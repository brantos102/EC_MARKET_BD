import { supabase } from './supabaseClient.js';
import { normalizarCodigoEscaneado } from './lib/ean13.js';
import { calcularLinea, calcularImpuesto, totalizarCarrito } from './lib/pricing.js';
import { abrirModal, cerrarModal } from './lib/modal.js';
import { traducirErrorSupabase } from './lib/errores.js';
import { abrirPanel } from './lib/panel.js';

// Canal de tiempo real activo. Se guarda fuera de la función para poder
// cerrarlo cuando el operador sale del punto de venta: dejar canales
// abiertos al navegar acumula suscripciones y consume cuota de Supabase.
let canalStock = null;

export function cerrarCanalPOS() {
  if (canalStock) {
    supabase.removeChannel(canalStock);
    canalStock = null;
  }
}

export async function renderPOS(container) {
  container.innerHTML = `
    <div class="pos-layout">
      <div class="pos-izquierda">
        <div class="panel pos-scan-panel">
          <label for="pos-scan" class="scan-label">Escanear producto</label>
          <input type="text" id="pos-scan" class="scan-input"
                 placeholder="Pase el lector o escriba el código / nombre" autocomplete="off" autofocus />
          <div id="pos-scan-msg" class="form-msg"></div>
          <div id="pos-sugerencias" class="sugerencias"></div>
        </div>

        <div class="panel">
          <div class="pos-carrito-head">
            <h3>Carrito</h3>
            <div class="tipo-venta-switch">
              <label><input type="radio" name="tipo-venta" value="MENOR" checked /> Al detalle</label>
              <label><input type="radio" name="tipo-venta" value="MAYOR" /> Por mayor</label>
            </div>
          </div>
          <table class="dyn-table pos-carrito">
            <thead>
              <tr>
                <th>Producto</th><th>Cant.</th><th>P. Unit.</th>
                <th>Desc.</th><th>Subtotal</th><th>IVA</th><th></th>
              </tr>
            </thead>
            <tbody id="pos-lineas"></tbody>
          </table>
          <div id="pos-vacio" class="dyn-table-empty">El carrito está vacío. Escanee un producto para comenzar.</div>
        </div>
      </div>

      <aside class="pos-derecha">
        <div class="panel pos-resumen">
          <div class="pos-estado-linea">
            <span id="pos-conexion" class="conexion conectando" title="Estado de la sincronización con otras cajas">
              <i></i><span class="conexion-texto">conectando…</span>
            </span>
            <button id="pos-consulta" class="btn-consulta" title="Consulta rápida sin salir de la venta (F2)">
              Consultar (F2)
            </button>
          </div>
          <div class="pos-cliente">
            <label>Cliente</label>
            <select id="pos-cliente"></select>
          </div>
          <div class="pos-total-linea"><span>Subtotal</span><b id="pos-subtotal">$0.00</b></div>
          <div class="pos-total-linea descuento"><span>Descuentos</span><b id="pos-descuento">-$0.00</b></div>
          <div class="pos-total-linea"><span>IVA</span><b id="pos-iva">$0.00</b></div>
          <div class="pos-total-linea grande"><span>TOTAL</span><b id="pos-total">$0.00</b></div>
          <button id="pos-cobrar" class="btn-primary btn-grande" disabled>Cobrar</button>
          <button id="pos-limpiar" class="btn-secundario">Vaciar carrito</button>
          <div id="pos-msg" class="form-msg"></div>
        </div>
      </aside>
    </div>
  `;

  // ----- Estado -----
  let carrito = [];       // { producto, cantidad, calculo, impuesto }
  let tipoVenta = 'MENOR';
  let bodegaId = null;

  const scan = container.querySelector('#pos-scan');
  const scanMsg = container.querySelector('#pos-scan-msg');
  const sugerencias = container.querySelector('#pos-sugerencias');
  const posMsg = container.querySelector('#pos-msg');

  // ----- Carga de datos -----
  const [{ data: bodegas }, { data: clientes }, { data: promos }] = await Promise.all([
    supabase.from('bodegas').select('id, nombre').eq('activa', true).order('nombre'),
    supabase.from('clientes').select('id, identificacion, nombre').eq('activo', true).order('nombre'),
    supabase.from('promociones')
      .select('id, nombre, tipo, cantidad, valor, aplica_tipo_venta, prioridad, vigencia_desde, vigencia_hasta, promocion_alcance(producto_id, categoria_id)')
      .eq('activa', true),
  ]);

  bodegaId = bodegas?.[0]?.id ?? null;

  const selCliente = container.querySelector('#pos-cliente');
  (clientes ?? []).forEach((c) => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = `${c.nombre} (${c.identificacion})`;
    selCliente.appendChild(o);
  });

  const { data: productos, error: errProductos } = await supabase
    .from('v_pos_productos')
    .select('*')
    .eq('bodega_id', bodegaId);

  if (errProductos) {
    container.innerHTML = traducirErrorSupabase(errProductos, 'v_pos_productos');
    return;
  }

  container.querySelector('#pos-consulta').addEventListener('click', () => abrirPanel());

  const hoy = new Date().toISOString().slice(0, 10);
  const promosVigentes = (promos ?? []).filter(
    (p) => p.vigencia_desde <= hoy && p.vigencia_hasta >= hoy
  );

  function promoPara(producto) {
    const candidatas = promosVigentes.filter((p) => {
      if (p.aplica_tipo_venta !== 'AMBAS' && p.aplica_tipo_venta !== tipoVenta) return false;
      return (p.promocion_alcance ?? []).some(
        (a) => a.producto_id === producto.producto_id || a.categoria_id === producto.categoria_id
      );
    });
    candidatas.sort((a, b) => b.prioridad - a.prioridad);
    return candidatas[0] ?? null;
  }

  // ----- Búsqueda / escaneo -----
  function buscarProducto(texto) {
    const limpio = texto.trim();
    if (!limpio) return [];
    const ean = normalizarCodigoEscaneado(limpio);
    if (ean) {
      const exacto = (productos ?? []).find((p) => p.ean13 === ean);
      if (exacto) return [exacto];
    }
    const lower = limpio.toLowerCase();
    return (productos ?? []).filter(
      (p) =>
        p.codigo?.toLowerCase() === lower ||
        p.ean13 === limpio ||
        p.nombre?.toLowerCase().includes(lower) ||
        p.marca?.toLowerCase().includes(lower)
    ).slice(0, 8);
  }

  scan.addEventListener('input', () => {
    const texto = scan.value.trim();
    if (texto.length < 2) {
      sugerencias.innerHTML = '';
      return;
    }
    const encontrados = buscarProducto(texto);
    sugerencias.innerHTML = encontrados
      .map(
        (p) => `<button class="sugerencia" data-id="${p.producto_id}">
          <span class="sug-nombre">${p.nombre}${p.marca ? ` · ${p.marca}` : ''}</span>
          <span class="sug-meta">${p.codigo} · ${p.ubicacion ?? 'sin ubicación'} · stock ${Number(p.stock).toFixed(2)} ${p.unidad}</span>
          <span class="sug-precio">$${Number(p.precio_venta_menor).toFixed(2)}</span>
        </button>`
      )
      .join('');
    sugerencias.querySelectorAll('.sugerencia').forEach((btn) => {
      btn.addEventListener('click', () => {
        agregar((productos ?? []).find((p) => p.producto_id === btn.dataset.id));
        scan.value = '';
        sugerencias.innerHTML = '';
        scan.focus();
      });
    });
  });

  scan.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const encontrados = buscarProducto(scan.value);
    if (encontrados.length === 0) {
      scanMsg.textContent = `No se encontró "${scan.value.trim()}"`;
      scanMsg.className = 'form-msg error';
    } else {
      agregar(encontrados[0]);
      scan.value = '';
      sugerencias.innerHTML = '';
    }
  });

  function agregar(producto) {
    if (!producto) return;

    const existente = carrito.find((l) => l.producto.producto_id === producto.producto_id);
    const cantidadNueva = (existente?.cantidad ?? 0) + 1;

    if (cantidadNueva > Number(producto.stock)) {
      scanMsg.textContent = `Stock insuficiente de "${producto.nombre}": quedan ${Number(producto.stock).toFixed(2)} ${producto.unidad}`;
      scanMsg.className = 'form-msg error';
      return;
    }

    if (existente) {
      existente.cantidad = cantidadNueva;
    } else {
      carrito.push({ producto, cantidad: 1 });
    }
    scanMsg.textContent = `${producto.nombre} agregado`;
    scanMsg.className = 'form-msg ok';
    pintar();
  }

  function cambiarCantidad(productoId, cantidad) {
    const linea = carrito.find((l) => l.producto.producto_id === productoId);
    if (!linea) return;
    if (cantidad <= 0) {
      carrito = carrito.filter((l) => l.producto.producto_id !== productoId);
    } else if (cantidad > Number(linea.producto.stock)) {
      scanMsg.textContent = `Stock insuficiente: quedan ${Number(linea.producto.stock).toFixed(2)}`;
      scanMsg.className = 'form-msg error';
      return;
    } else {
      linea.cantidad = cantidad;
    }
    pintar();
  }

  function pintar() {
    const tbody = container.querySelector('#pos-lineas');
    container.querySelector('#pos-vacio').classList.toggle('hidden', carrito.length > 0);

    const lineasCalculadas = carrito.map((l) => {
      const promo = promoPara(l.producto);
      const calculo = calcularLinea(l.producto, tipoVenta, l.cantidad, promo);
      const impuesto = calcularImpuesto(calculo.totalConPromo, l.producto.tarifa_impuesto);
      return { ...l, calculo, impuesto };
    });

    tbody.innerHTML = lineasCalculadas
      .map(
        (l) => `<tr>
          <td>
            <div class="linea-nombre">${l.producto.nombre}</div>
            <div class="linea-meta">${l.producto.codigo} · ${l.producto.ubicacion ?? 's/u'}
              ${l.calculo.promocionAplicada ? `<span class="badge-promo">${l.calculo.promocionAplicada.nombre}</span>` : ''}
            </div>
          </td>
          <td><input type="number" class="cant-input" data-id="${l.producto.producto_id}"
                     value="${l.cantidad}" min="0" step="${l.producto.permite_fraccion ? '0.01' : '1'}" /></td>
          <td>$${l.calculo.precioBase.toFixed(2)}</td>
          <td class="${l.calculo.descuento > 0 ? 'texto-descuento' : ''}">
            ${l.calculo.descuento > 0 ? '-$' + l.calculo.descuento.toFixed(2) : '—'}</td>
          <td>$${l.calculo.totalConPromo.toFixed(2)}</td>
          <td>$${l.impuesto.toFixed(2)}</td>
          <td><button class="btn-quitar" data-id="${l.producto.producto_id}" title="Quitar">✕</button></td>
        </tr>`
      )
      .join('');

    tbody.querySelectorAll('.cant-input').forEach((input) => {
      input.addEventListener('change', () =>
        cambiarCantidad(input.dataset.id, Number(input.value))
      );
    });
    tbody.querySelectorAll('.btn-quitar').forEach((btn) => {
      btn.addEventListener('click', () => cambiarCantidad(btn.dataset.id, 0));
    });

    const totales = totalizarCarrito(
      lineasCalculadas.map((l) => ({
        subtotal: l.calculo.totalConPromo,
        valor_impuesto: l.impuesto,
        descuento: l.calculo.descuento,
      }))
    );

    container.querySelector('#pos-subtotal').textContent = `$${totales.subtotal.toFixed(2)}`;
    container.querySelector('#pos-descuento').textContent = `-$${totales.descuento.toFixed(2)}`;
    container.querySelector('#pos-iva').textContent = `$${totales.impuesto.toFixed(2)}`;
    container.querySelector('#pos-total').textContent = `$${totales.total.toFixed(2)}`;
    container.querySelector('#pos-cobrar').disabled = carrito.length === 0;

    return totales;
  }

  container.querySelectorAll('input[name="tipo-venta"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      tipoVenta = radio.value;
      pintar();
    });
  });

  container.querySelector('#pos-limpiar').addEventListener('click', () => {
    carrito = [];
    scanMsg.textContent = '';
    pintar();
    scan.focus();
  });

  // ----- Cobro -----
  container.querySelector('#pos-cobrar').addEventListener('click', async () => {
    const totales = pintar();
    abrirModalPago(totales.total, async (pagos) => {
      posMsg.textContent = 'Procesando venta...';
      posMsg.className = 'form-msg';
      try {
        const resultado = await registrarVenta(pagos);
        cerrarModal();
        mostrarComprobante(resultado);
        carrito = [];
        pintar();
        await refrescarStock();
        scan.focus();
      } catch (err) {
        posMsg.textContent = err.message;
        posMsg.className = 'form-msg error';
        cerrarModal();
      }
    });
  });

  async function registrarVenta(pagos) {
    const { data: { user } } = await supabase.auth.getUser();

    const { data: venta, error: errVenta } = await supabase
      .from('ventas')
      .insert({
        cliente_id: selCliente.value,
        bodega_id: bodegaId,
        tipo_venta: tipoVenta,
        usuario_id: user?.id ?? null,
      })
      .select('id, numero_interno')
      .single();
    if (errVenta) throw new Error(`No se pudo crear la venta: ${errVenta.message}`);

    const lineas = carrito.map((l) => ({
      venta_id: venta.id,
      producto_id: l.producto.producto_id,
      cantidad: l.cantidad,
      precio_unitario: 0,   // lo recalcula la base de datos
      subtotal: 0,
    }));

    const { error: errDet } = await supabase.from('venta_detalle').insert(lineas);
    if (errDet) throw new Error(`Error al registrar el detalle: ${errDet.message}`);

    const { error: errConf } = await supabase
      .from('ventas').update({ estado: 'CONFIRMADA' }).eq('id', venta.id);
    if (errConf) throw new Error(errConf.message);

    const { data: ventaFinal } = await supabase
      .from('ventas').select('*').eq('id', venta.id).single();

    const filasPago = pagos.map((p) => ({ venta_id: venta.id, ...p }));
    const { error: errPago } = await supabase.from('pagos_venta').insert(filasPago);
    if (errPago) throw new Error(`Venta confirmada pero el pago falló: ${errPago.message}`);

    return ventaFinal;
  }

  async function refrescarStock() {
    const { data } = await supabase.from('v_pos_productos').select('*').eq('bodega_id', bodegaId);
    if (data) {
      productos.length = 0;
      productos.push(...data);
    }
  }

  function mostrarComprobante(venta) {
    abrirModal({
      titulo: `Venta ${venta.numero_interno} registrada`,
      contenido: `
        <div class="comprobante">
          <div class="comp-linea"><span>Subtotal</span><b>$${Number(venta.subtotal).toFixed(2)}</b></div>
          <div class="comp-linea"><span>Descuentos</span><b>-$${Number(venta.descuento).toFixed(2)}</b></div>
          <div class="comp-linea"><span>IVA</span><b>$${Number(venta.valor_impuesto).toFixed(2)}</b></div>
          <div class="comp-linea grande"><span>TOTAL</span><b>$${Number(venta.total).toFixed(2)}</b></div>
          <p class="nota">Estado: ${venta.estado}. El stock ya fue descontado y los lotes asignados por FEFO.</p>
          <p class="nota">El envío de la factura electrónica por correo requiere el módulo de facturación SRI (pendiente).</p>
        </div>`,
      botones: [{ texto: 'Nueva venta', clase: 'btn-primary', accion: cerrarModal }],
    });
  }

  // -------------------------------------------------------
  // Sincronización en tiempo real del stock entre cajas.
  //
  // El problema que resuelve: dos cajas atendiendo a la vez pueden
  // escanear la última unidad del mismo producto. La base de datos
  // siempre rechaza la segunda venta (el trigger valida el stock al
  // confirmar), pero sin esto el segundo cajero se entera recién al
  // cobrar, con el cliente esperando. Escuchando los cambios de
  // inventario_saldos, el carrito se entera en el momento.
  //
  // La base de datos sigue siendo la única autoridad: esto es aviso
  // temprano, no sustituye la validación del servidor.
  // -------------------------------------------------------
  const indicador = container.querySelector('#pos-conexion');

  function marcarConexion(estado, texto) {
    if (!indicador.isConnected) return;
    indicador.className = `conexion ${estado}`;
    indicador.querySelector('.conexion-texto').textContent = texto;
  }

  cerrarCanalPOS();
  canalStock = supabase
    .channel('pos-stock')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'inventario_saldos' },
      (payload) => {
        const fila = payload.new;
        if (!fila || fila.bodega_id !== bodegaId) return;

        const producto = productos.find((p) => p.producto_id === fila.producto_id);
        if (!producto) return;

        const anterior = Number(producto.stock);
        producto.stock = Number(fila.stock);
        if (anterior === producto.stock) return;

        const enCarrito = carrito.find((l) => l.producto.producto_id === fila.producto_id);
        if (enCarrito) {
          if (enCarrito.cantidad > producto.stock) {
            scanMsg.textContent =
              `Otra caja acaba de vender "${producto.nombre}": quedan ${producto.stock.toFixed(2)} ` +
              `y tienes ${enCarrito.cantidad} en el carrito. Ajusta la cantidad antes de cobrar.`;
            scanMsg.className = 'form-msg error';
          }
          pintar();
        }
      }
    )
    .subscribe((estado) => {
      if (estado === 'SUBSCRIBED') marcarConexion('conectado', 'sincronizado');
      else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
        marcarConexion('desconectado', 'sin sincronizar');
      } else if (estado === 'CLOSED') {
        marcarConexion('desconectado', 'desconectado');
      }
    });

  // Si Realtime no está habilitado en el proyecto, el canal nunca llega a
  // SUBSCRIBED. Se avisa sin alarmar: la venta funciona igual, solo que
  // el aviso de stock llega al confirmar en vez de al instante.
  setTimeout(() => {
    if (indicador.isConnected && indicador.classList.contains('conectando')) {
      marcarConexion('desconectado', 'sin sincronizar');
      indicador.title =
        'Realtime no está activo. La venta funciona igual: la base de datos valida ' +
        'el stock al confirmar. Para avisos instantáneos, aplica db/007_realtime.sql.';
    }
  }, 6000);

  pintar();
  scan.focus();
}

// =========================================================
// Modal de pago
// =========================================================
function abrirModalPago(total, onConfirmar) {
  abrirModal({
    titulo: `Cobrar $${total.toFixed(2)}`,
    contenido: `
      <div class="pago-formas">
        <button class="forma-pago activa" data-forma="EFECTIVO">Efectivo</button>
        <button class="forma-pago" data-forma="TARJETA_DEBITO">Tarjeta débito</button>
        <button class="forma-pago" data-forma="TARJETA_CREDITO">Tarjeta crédito</button>
        <button class="forma-pago" data-forma="TRANSFERENCIA_DEUNA">De Una</button>
        <button class="forma-pago" data-forma="TRANSFERENCIA_OTRO">Otro banco</button>
      </div>

      <div id="pago-efectivo" class="pago-campos">
        <label>Recibe</label>
        <input type="number" id="pago-recibido" step="0.01" min="0" placeholder="0.00" />
        <div class="cambio-box">Cambio: <b id="pago-cambio">$0.00</b></div>
        <div class="billetes-rapidos">
          <button data-monto="${total.toFixed(2)}">Exacto</button>
          <button data-monto="5">$5</button>
          <button data-monto="10">$10</button>
          <button data-monto="20">$20</button>
          <button data-monto="50">$50</button>
        </div>
      </div>

      <div id="pago-codigo" class="pago-campos hidden">
        <label id="pago-codigo-label">Código de la transacción</label>
        <input type="text" id="pago-codigo-input" placeholder="N.º de comprobante" />
        <label>Banco</label>
        <input type="text" id="pago-banco" placeholder="Banco emisor" />
      </div>

      <div id="pago-msg" class="form-msg"></div>
    `,
    botones: [
      { texto: 'Cancelar', clase: 'btn-secundario', accion: cerrarModal },
      { texto: 'Confirmar pago', clase: 'btn-primary', accion: confirmar, id: 'btn-confirmar-pago' },
    ],
    alAbrir: (modal) => {
      let forma = 'EFECTIVO';
      const recibido = modal.querySelector('#pago-recibido');
      const cambio = modal.querySelector('#pago-cambio');

      modal.querySelectorAll('.forma-pago').forEach((btn) => {
        btn.addEventListener('click', () => {
          modal.querySelectorAll('.forma-pago').forEach((b) => b.classList.remove('activa'));
          btn.classList.add('activa');
          forma = btn.dataset.forma;
          const esEfectivo = forma === 'EFECTIVO';
          modal.querySelector('#pago-efectivo').classList.toggle('hidden', !esEfectivo);
          modal.querySelector('#pago-codigo').classList.toggle('hidden', esEfectivo);
          modal.querySelector('#pago-codigo-label').textContent =
            forma === 'TRANSFERENCIA_DEUNA' ? 'Código de comprobante De Una'
            : forma.startsWith('TARJETA') ? 'N.º de voucher'
            : 'N.º de transferencia';
        });
      });

      recibido.addEventListener('input', () => {
        const v = Number(recibido.value || 0) - total;
        cambio.textContent = `$${(v > 0 ? v : 0).toFixed(2)}`;
      });

      modal.querySelectorAll('.billetes-rapidos button').forEach((b) => {
        b.addEventListener('click', () => {
          recibido.value = b.dataset.monto;
          recibido.dispatchEvent(new Event('input'));
        });
      });

      modal.dataset.forma = 'EFECTIVO';
      modal._obtenerForma = () => forma;
      recibido.focus();
    },
  });

  function confirmar() {
    const modal = document.querySelector('.modal');
    const forma = modal._obtenerForma();
    const msg = modal.querySelector('#pago-msg');

    if (forma === 'EFECTIVO') {
      const recibido = Number(modal.querySelector('#pago-recibido').value || 0);
      if (recibido < total) {
        msg.textContent = `El efectivo recibido ($${recibido.toFixed(2)}) no cubre el total`;
        msg.className = 'form-msg error';
        return;
      }
      onConfirmar([{ forma_pago: 'EFECTIVO', monto: total, recibido, cambio: recibido - total }]);
    } else {
      const codigo = modal.querySelector('#pago-codigo-input').value.trim();
      if (!codigo) {
        msg.textContent = 'Ingrese el código de la transacción';
        msg.className = 'form-msg error';
        return;
      }
      onConfirmar([{
        forma_pago: forma,
        monto: total,
        codigo_transaccion: codigo,
        banco: modal.querySelector('#pago-banco').value.trim() || null,
      }]);
    }
  }
}
