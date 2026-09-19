import { supabase } from './supabaseClient.js';
import { normalizarCodigoEscaneado } from './lib/ean13.js';
import { abrirModal, cerrarModal } from './lib/modal.js';
import { traducirErrorSupabase } from './lib/errores.js';
import { abrirPanel } from './lib/panel.js';
import { autocompletar } from './lib/autocomplete.js';
import { fijarCatalogo, actualizarPanelVenta } from './lib/panel-venta.js';
import { abrirSelectorCliente } from './lib/cliente-venta.js';
import { imprimirComprobante } from './lib/comprobante.js';
import {
  configurar, fijarTipoVenta, agregar, cambiarCantidad, vaciar,
  lineasCalculadas, totales, obtenerEstado, actualizarStock, suscribir, reiniciarCliente,
} from './lib/venta-activa.js';

// Canal de tiempo real activo. Se cierra al salir del punto de venta
// para no acumular suscripciones al navegar.
let canalStock = null;
let catalogo = [];
let desuscribir = null;

export function cerrarCanalPOS() {
  if (canalStock) {
    supabase.removeChannel(canalStock);
    canalStock = null;
  }
  if (desuscribir) {
    desuscribir();
    desuscribir = null;
  }
}

export async function renderPOS(container) {
  container.innerHTML = `
    <div class="pos-layout">
      <div class="pos-izquierda">
        <div class="panel pos-scan-panel">
          <label for="pos-scan" class="scan-label">Escanear o buscar producto</label>
          <input type="text" id="pos-scan" class="scan-input"
                 placeholder="Pase el lector, o escriba código / nombre / marca" autocomplete="off" />
          <div id="pos-scan-msg" class="form-msg"></div>
        </div>

        <div class="panel">
          <div class="pos-carrito-head">
            <h3>Carrito</h3>
            <div class="tipo-venta-switch">
              <label><input type="radio" name="tipo-venta" value="MENOR" /> Al detalle</label>
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
          <button type="button" id="pos-cliente-btn" class="tarjeta-cliente">
            <span class="tc-tipo" id="pos-tipo-comp">NOTA DE VENTA</span>
            <span class="tc-nombre" id="pos-cliente-nombre">CONSUMIDOR FINAL</span>
            <span class="tc-id" id="pos-cliente-id">9999999999999</span>
            <span class="tc-cambiar">Cambiar / facturar</span>
          </button>
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

  const scan = container.querySelector('#pos-scan');
  const scanMsg = container.querySelector('#pos-scan-msg');
  const posMsg = container.querySelector('#pos-msg');

  // ----- Carga de datos -----
  const [{ data: bodegas }, { data: clientes }, { data: promos }] = await Promise.all([
    supabase.from('bodegas').select('id, nombre').eq('activa', true).order('nombre'),
    supabase.from('clientes').select('id, identificacion, nombre').eq('activo', true).order('nombre'),
    supabase.from('promociones')
      .select('id, nombre, tipo, cantidad, valor, aplica_tipo_venta, prioridad, activa, vigencia_desde, vigencia_hasta, promocion_alcance(producto_id, categoria_id)')
      .eq('activa', true),
  ]);

  const bodegaId = obtenerEstado().bodegaId ?? bodegas?.[0]?.id ?? null;

  const consumidorFinal = (clientes ?? []).find((c) => c.identificacion === '9999999999999');
  if (!obtenerEstado().clienteId && consumidorFinal) {
    configurar({ clienteId: consumidorFinal.id });
  }

  function pintarCliente() {
    const e = obtenerEstado();
    container.querySelector('#pos-tipo-comp').textContent =
      e.tipoComprobante === 'FACTURA' ? 'FACTURA' : 'NOTA DE VENTA';
    container.querySelector('#pos-tipo-comp').className =
      `tc-tipo ${e.tipoComprobante === 'FACTURA' ? 'es-factura' : ''}`;
    container.querySelector('#pos-cliente-nombre').textContent = e.clienteNombre ?? 'CONSUMIDOR FINAL';
    container.querySelector('#pos-cliente-id').textContent = e.clienteIdentificacion ?? '9999999999999';
  }

  container.querySelector('#pos-cliente-btn').addEventListener('click', () => {
    abrirSelectorCliente(obtenerEstado(), (sel) => {
      configurar({
        clienteId: sel.clienteId ?? consumidorFinal?.id ?? null,
        clienteNombre: sel.nombre,
        clienteIdentificacion: sel.identificacion,
        tipoComprobante: sel.tipoComprobante,
      });
      pintarCliente();
      scan.focus();
    });
  });

  const { data: productos, error: errProductos } = await supabase
    .from('v_pos_productos').select('*').eq('bodega_id', bodegaId);

  if (errProductos) {
    container.innerHTML = traducirErrorSupabase(errProductos, 'v_pos_productos');
    return;
  }

  catalogo = productos ?? [];
  fijarCatalogo(() => catalogo);
  configurar({ bodegaId, promos: promos ?? [] });

  container.querySelector('#pos-consulta').addEventListener('click', () => abrirPanel());

  // Marcar el tipo de venta que ya tenía la venta en curso
  const tipoActual = obtenerEstado().tipoVenta;
  container.querySelector(`input[name="tipo-venta"][value="${tipoActual}"]`).checked = true;

  // ----- Autocompletado sobre el campo de escaneo -----
  autocompletar(scan, {
    items: () => catalogo,
    texto: (p) => `${p.nombre}${p.marca ? ` · ${p.marca}` : ''}`,
    secundario: (p) =>
      `${p.codigo}${p.ean13 ? ` · ${p.ean13}` : ''} · ${p.ubicacion ?? 's/ubicación'} · ` +
      `stock ${Number(p.stock).toFixed(2)} ${p.unidad ?? ''} · $${Number(p.precio_venta_menor).toFixed(2)}`,
    valor: (p) => p.producto_id,
    coincideExacto: (p, texto) => {
      const ean = normalizarCodigoEscaneado(texto);
      return (ean && p.ean13 === ean) || p.codigo?.toLowerCase() === texto.toLowerCase();
    },
    alElegir: (producto) => {
      const r = agregar(producto);
      scanMsg.textContent = r.mensaje ?? '';
      scanMsg.className = `form-msg ${r.ok ? 'ok' : 'error'}`;
      scan.value = '';
      delete scan.dataset.valor;
      scan.classList.remove('ac-elegido');
      scan.focus();
    },
  });

  // ----- Pintado -----
  function pintar() {
    const tbody = container.querySelector('#pos-lineas');
    if (!tbody.isConnected) return;

    const lineas = lineasCalculadas();
    container.querySelector('#pos-vacio').classList.toggle('hidden', lineas.length > 0);

    tbody.innerHTML = lineas.map((l) => `
      <tr>
        <td>
          <div class="linea-nombre">${escapar(l.producto.nombre)}</div>
          <div class="linea-meta">${l.producto.codigo} · ${l.producto.ubicacion ?? 's/u'}
            ${l.calculo.promocionAplicada ? `<span class="badge-promo">${escapar(l.calculo.promocionAplicada.nombre)}</span>` : ''}
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
      </tr>`).join('');

    tbody.querySelectorAll('.cant-input').forEach((input) => {
      input.addEventListener('change', () => {
        const r = cambiarCantidad(input.dataset.id, Number(input.value));
        if (!r.ok && r.mensaje) {
          scanMsg.textContent = r.mensaje;
          scanMsg.className = 'form-msg error';
          pintar();
        }
      });
    });
    tbody.querySelectorAll('.btn-quitar').forEach((btn) => {
      btn.addEventListener('click', () => cambiarCantidad(btn.dataset.id, 0));
    });

    const t = totales();
    container.querySelector('#pos-subtotal').textContent = `$${t.subtotal.toFixed(2)}`;
    container.querySelector('#pos-descuento').textContent = `-$${t.descuento.toFixed(2)}`;
    container.querySelector('#pos-iva').textContent = `$${t.impuesto.toFixed(2)}`;
    container.querySelector('#pos-total').textContent = `$${t.total.toFixed(2)}`;
    container.querySelector('#pos-cobrar').disabled = lineas.length === 0;
  }

  desuscribir = suscribir(pintar);

  container.querySelectorAll('input[name="tipo-venta"]').forEach((radio) => {
    radio.addEventListener('change', () => fijarTipoVenta(radio.value));
  });

  container.querySelector('#pos-limpiar').addEventListener('click', () => {
    vaciar();
    scanMsg.textContent = '';
    scan.focus();
  });

  // ----- Cobro -----
  container.querySelector('#pos-cobrar').addEventListener('click', () => {
    const t = totales();
    abrirModalPago(t.total, async (pagos) => {
      posMsg.textContent = 'Procesando venta...';
      posMsg.className = 'form-msg';
      try {
        const resultado = await registrarVenta(pagos);
        cerrarModal();
        mostrarComprobante(resultado);
        vaciar();
        reiniciarCliente(consumidorFinal?.id);
        pintarCliente();
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
    const estado = obtenerEstado();

    const { data: venta, error: errVenta } = await supabase
      .from('ventas')
      .insert({
        cliente_id: estado.clienteId,
        bodega_id: estado.bodegaId,
        tipo_venta: estado.tipoVenta,
        tipo_comprobante: estado.tipoComprobante,
        usuario_id: user?.id ?? null,
      })
      .select('id, numero_interno')
      .single();
    if (errVenta) throw new Error(`No se pudo crear la venta: ${errVenta.message}`);

    const filas = estado.lineas.map((l) => ({
      venta_id: venta.id,
      producto_id: l.producto.producto_id,
      cantidad: l.cantidad,
      precio_unitario: 0,   // lo recalcula la base de datos
      subtotal: 0,
    }));

    const { error: errDet } = await supabase.from('venta_detalle').insert(filas);
    if (errDet) throw new Error(`Error al registrar el detalle: ${errDet.message}`);

    const { error: errConf } = await supabase
      .from('ventas').update({ estado: 'CONFIRMADA' }).eq('id', venta.id);
    if (errConf) throw new Error(errConf.message);

    const { data: ventaFinal } = await supabase
      .from('ventas').select('*').eq('id', venta.id).single();

    const { error: errPago } = await supabase
      .from('pagos_venta').insert(pagos.map((p) => ({ venta_id: venta.id, ...p })));
    if (errPago) throw new Error(`Venta confirmada pero el pago falló: ${errPago.message}`);

    return ventaFinal;
  }

  async function refrescarStock() {
    const { data } = await supabase.from('v_pos_productos').select('*').eq('bodega_id', bodegaId);
    if (data) {
      catalogo.length = 0;
      catalogo.push(...data);
    }
  }

  function mostrarComprobante(venta) {
    abrirModal({
      titulo: `${venta.tipo_comprobante === 'FACTURA' ? 'Factura' : 'Nota de venta'} ${venta.numero_comprobante ?? venta.numero_interno}`,
      contenido: `
        <div class="comprobante">
          <div class="comp-linea"><span>Subtotal</span><b>$${Number(venta.subtotal).toFixed(2)}</b></div>
          <div class="comp-linea"><span>Descuentos</span><b>-$${Number(venta.descuento).toFixed(2)}</b></div>
          <div class="comp-linea"><span>IVA</span><b>$${Number(venta.valor_impuesto).toFixed(2)}</b></div>
          <div class="comp-linea grande"><span>TOTAL</span><b>$${Number(venta.total).toFixed(2)}</b></div>
          <p class="nota">Estado: ${venta.estado}. El stock ya fue descontado y los lotes asignados por FEFO.</p>
        </div>`,
      botones: [
        { texto: 'Imprimir comprobante', clase: 'btn-secundario', accion: async () => {
            try {
              await imprimirComprobante(venta.id);
            } catch (err) {
              alert(`No se pudo generar el comprobante: ${err.message}`);
            }
          } },
        { texto: 'Nueva venta', clase: 'btn-primary', accion: cerrarModal },
      ],
    });
  }

  // ----- Tiempo real entre cajas -----
  const indicador = container.querySelector('#pos-conexion');

  function marcarConexion(estado, texto) {
    if (!indicador.isConnected) return;
    indicador.className = `conexion ${estado}`;
    indicador.querySelector('.conexion-texto').textContent = texto;
  }

  cerrarCanalPOS();
  desuscribir = suscribir(pintar);

  canalStock = supabase
    .channel('pos-stock')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'inventario_saldos' },
      (payload) => {
        const fila = payload.new;
        if (!fila || fila.bodega_id !== bodegaId) return;

        const producto = catalogo.find((p) => p.producto_id === fila.producto_id);
        if (producto) producto.stock = Number(fila.stock);

        const aviso = actualizarStock(fila.producto_id, Number(fila.stock));
        if (aviso) {
          scanMsg.textContent = aviso;
          scanMsg.className = 'form-msg error';
        }
      })
    .subscribe((estado) => {
      if (estado === 'SUBSCRIBED') marcarConexion('conectado', 'sincronizado');
      else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') marcarConexion('desconectado', 'sin sincronizar');
      else if (estado === 'CLOSED') marcarConexion('desconectado', 'desconectado');
    });

  setTimeout(() => {
    if (indicador.isConnected && indicador.classList.contains('conectando')) {
      marcarConexion('desconectado', 'sin sincronizar');
      indicador.title =
        'Realtime no está activo. La venta funciona igual: la base de datos valida ' +
        'el stock al confirmar. Para avisos instantáneos, aplica db/007_realtime.sql.';
    }
  }, 6000);

  pintar();
  pintarCliente();
  actualizarPanelVenta();
  scan.focus();
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
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
