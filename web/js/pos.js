import { supabase } from './supabaseClient.js';
import { normalizarCodigoEscaneado } from './lib/ean13.js';
import { abrirModal, cerrarModal } from './lib/modal.js';
import { traducirErrorSupabase } from './lib/errores.js';
import { abrirPanel } from './lib/panel.js';
import { autocompletar } from './lib/autocomplete.js';
import { fijarCatalogo, actualizarPanelVenta } from './lib/panel-venta.js';
import { abrirSelectorCliente } from './lib/cliente-venta.js';
import { imprimirComprobante } from './lib/comprobante.js';
import { paso, formatear, fracciona, sumarPaso, decimales } from './lib/cantidad.js';
import { empresaActual } from './lib/marca.js';
import { abrirQRDeUna } from './lib/qr-deuna.js';
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
        <td>
          <div class="cant-stepper ${fracciona(l.producto) ? 'es-peso' : ''}">
            <button type="button" class="cant-btn" data-menos="${l.producto.producto_id}"
                    title="Quitar ${formatear(paso(l.producto), l.producto)} ${escapar(l.producto.unidad ?? '')}">−</button>
            <input type="number" class="cant-input" data-id="${l.producto.producto_id}"
                   value="${formatear(l.cantidad, l.producto)}"
                   min="0" step="${paso(l.producto)}"
                   inputmode="${fracciona(l.producto) ? 'decimal' : 'numeric'}" />
            <button type="button" class="cant-btn" data-mas="${l.producto.producto_id}"
                    title="Agregar ${formatear(paso(l.producto), l.producto)} ${escapar(l.producto.unidad ?? '')}">+</button>
            ${fracciona(l.producto)
              ? `<button type="button" class="cant-peso" data-peso="${l.producto.producto_id}"
                         title="Digitar el peso exacto que marca la balanza">⚖</button>` : ''}
          </div>
          <div class="cant-unidad">${escapar(l.producto.unidad_nombre ?? l.producto.unidad ?? '')}</div>
        </td>
        <td>$${l.calculo.precioBase.toFixed(2)}</td>
        <td class="${l.calculo.descuento > 0 ? 'texto-descuento' : ''}">
          ${l.calculo.descuento > 0 ? '-$' + l.calculo.descuento.toFixed(2) : '—'}</td>
        <td>$${l.calculo.totalConPromo.toFixed(2)}</td>
        <td>$${l.impuesto.toFixed(2)}</td>
        <td><button class="btn-quitar" data-id="${l.producto.producto_id}" title="Quitar">✕</button></td>
      </tr>`).join('');

    function aplicar(resultado) {
      if (!resultado.ok && resultado.mensaje) {
        scanMsg.textContent = resultado.mensaje;
        scanMsg.className = 'form-msg error';
      } else {
        scanMsg.textContent = '';
      }
      pintar();
    }

    function lineaDe(id) {
      return lineasCalculadas().find((l) => l.producto.producto_id === id);
    }

    tbody.querySelectorAll('.cant-input').forEach((input) => {
      input.addEventListener('change', () => aplicar(cambiarCantidad(input.dataset.id, input.value)));
    });

    tbody.querySelectorAll('[data-mas]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const l = lineaDe(btn.dataset.mas);
        if (l) aplicar(cambiarCantidad(l.producto.producto_id, sumarPaso(l.cantidad, l.producto, +1)));
      });
    });

    tbody.querySelectorAll('[data-menos]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const l = lineaDe(btn.dataset.menos);
        if (l) aplicar(cambiarCantidad(l.producto.producto_id, sumarPaso(l.cantidad, l.producto, -1)));
      });
    });

    tbody.querySelectorAll('[data-peso]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const l = lineaDe(btn.dataset.peso);
        if (l) abrirTecladoPeso(l, (valor) => aplicar(cambiarCantidad(l.producto.producto_id, valor)));
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
        { texto: 'Enviar por correo', clase: 'btn-secundario', accion: () => enviarPorCorreo(venta) },
        { texto: 'Nueva venta', clase: 'btn-primary', accion: cerrarModal },
      ],
    });
  }

  /**
   * Deja el comprobante listo en la bandeja de salida.
   *
   * No se envía desde aquí: el navegador no debe tener la clave del
   * proveedor de correo. La base arma el mensaje con la plantilla y una
   * función de borde lo despacha (ver PUBLICACION.md).
   */
  async function enviarPorCorreo(venta) {
    const estado = obtenerEstado();
    let destino = estado.clienteEmail ?? '';

    if (!destino) {
      const { data } = await supabase.rpc('fn_buscar_cliente',
        { p_identificacion: estado.clienteIdentificacion ?? '' });
      destino = data?.[0]?.email ?? '';
    }

    destino = window.prompt('Correo del cliente:', destino || '');
    if (!destino) return;

    const { data: datos, error: errDatos } =
      await supabase.rpc('fn_datos_correo_venta', { p_venta_id: venta.id });
    if (errDatos) {
      alert(`No se pudo preparar el correo: ${errDatos.message}`);
      return;
    }

    const { error } = await supabase.rpc('fn_encolar_correo', {
      p_plantilla: 'COMPROBANTE_CLIENTE',
      p_destinatario: destino.trim(),
      p_datos: datos,
      p_destinatario_nombre: estado.clienteNombre ?? null,
      p_referencia_tipo: 'VENTA',
      p_referencia_id: venta.id,
    });

    if (error) {
      alert(`No se pudo encolar el correo: ${error.message}`);
      return;
    }

    posMsg.textContent = `Comprobante en cola para ${destino.trim()}.`;
    posMsg.className = 'form-msg ok';
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

// =========================================================
// Teclado de peso
//
// Para un producto que se pesa, el cajero necesita escribir el número
// exacto que marca la balanza (1,03 lb) sin pelear con una flecha que
// avanza de centésima en centésima. Este teclado es la única puerta por
// la que entra un decimal a la venta, y solo se abre en productos que
// se venden por peso o volumen.
// =========================================================
function abrirTecladoPeso(linea, alConfirmar) {
  const p = linea.producto;
  const unidad = p.unidad_nombre ?? p.unidad ?? '';
  const precio = Number(linea.calculo?.precioBase ?? p.precio_venta_menor ?? 0);

  abrirModal({
    titulo: `Peso de ${p.nombre}`,
    contenido: `
      <div class="peso-caja">
        <div class="peso-lectura">
          <input type="text" id="peso-valor" class="peso-input" inputmode="decimal"
                 value="${formatear(linea.cantidad, p)}" autocomplete="off" />
          <span class="peso-unidad">${escapar(unidad)}</span>
        </div>
        <div class="peso-importe">
          $${precio.toFixed(2)} por ${escapar(unidad)} · importe
          <b id="peso-importe">$${(precio * linea.cantidad).toFixed(2)}</b>
        </div>
        <div class="peso-teclado">
          ${['7','8','9','4','5','6','1','2','3','.','0','←']
            .map((t) => `<button type="button" class="peso-tecla" data-t="${t}">${t}</button>`).join('')}
        </div>
        <div class="peso-rapidos">
          ${[0.25, 0.5, 1, 2, 5].map((v) =>
            `<button type="button" class="peso-rapido" data-v="${v}">${v} ${escapar(unidad)}</button>`).join('')}
        </div>
        <p class="nota">Disponible: ${formatear(p.stock, p)} ${escapar(unidad)}</p>
        <div id="peso-msg" class="form-msg"></div>
      </div>`,
    botones: [
      { texto: 'Cancelar', clase: 'btn-secundario', accion: cerrarModal },
      { texto: 'Aplicar peso', clase: 'btn-primary', accion: confirmar },
    ],
    alAbrir: (modal) => {
      const campo = modal.querySelector('#peso-valor');
      const importe = modal.querySelector('#peso-importe');

      function repintar() {
        const n = Number(campo.value.replace(',', '.'));
        importe.textContent = Number.isFinite(n) ? `$${(precio * n).toFixed(2)}` : '—';
      }

      modal.querySelectorAll('.peso-tecla').forEach((b) => {
        b.addEventListener('click', () => {
          const t = b.dataset.t;
          if (t === '←') campo.value = campo.value.slice(0, -1);
          else if (t === '.') { if (!campo.value.includes('.')) campo.value += campo.value ? '.' : '0.'; }
          else campo.value = campo.value === '0' ? t : campo.value + t;
          repintar();
        });
      });

      modal.querySelectorAll('.peso-rapido').forEach((b) => {
        b.addEventListener('click', () => { campo.value = b.dataset.v; repintar(); });
      });

      campo.addEventListener('input', repintar);
      campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmar(); });
      campo.focus();
      campo.select();
    },
  });

  function confirmar() {
    const modal = document.querySelector('.modal');
    const n = Number(modal.querySelector('#peso-valor').value.replace(',', '.'));
    const msg = modal.querySelector('#peso-msg');
    if (!Number.isFinite(n) || n <= 0) {
      msg.textContent = 'Escriba un peso mayor que cero';
      msg.className = 'form-msg error';
      return;
    }
    cerrarModal();
    alConfirmar(n);
  }
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

// =========================================================
// Modal de pago
// =========================================================
/**
 * QR de cobro De Una!
 *
 * El comercio descarga su QR de la banca en línea del Banco Pichincha y
 * lo carga en Administración → Empresa. La caja lo muestra grande para
 * que el cliente lo escanee con la app; el cajero anota después el
 * código del comprobante que le queda en pantalla al cliente.
 *
 * Es un QR estático: no lleva el monto, lo digita el cliente. Generar un
 * QR con el monto ya incluido exige la API de Deuna, que requiere un
 * contrato comercial con el banco (ver PUBLICACION.md). Mientras tanto
 * el cajero canta el valor, que es exactamente como se cobra hoy en
 * mostrador.
 */
function pintarDeuna(modal) {
  const caja = modal.querySelector('#deuna-qr');
  const nota = modal.querySelector('#deuna-nota');
  if (!caja || caja.dataset.listo) return;

  const e = empresaActual();
  const url = e?.deuna_qr_url;
  const mime = e?.deuna_qr_mime ?? '';

  if (url) {
    // El QR puede venir como imagen o como PDF: el banco entrega uno u
    // otro según por dónde se descargue. El PDF se muestra con <embed>,
    // que los navegadores saben dibujar sin librerías añadidas.
    caja.innerHTML = mime === 'application/pdf' || /^data:application\/pdf/.test(url)
      ? `<embed src="${url}#toolbar=0&navpanes=0" type="application/pdf" class="deuna-pdf" />`
      : `<img src="${url}" alt="Código QR de cobro De Una" />`;
    nota.textContent = e.deuna_instrucciones
      || 'Escanee el código con la app De Una y envíe el valor indicado.';
  } else {
    caja.innerHTML = '<div class="deuna-falta">Sin QR cargado</div>';
    nota.textContent =
      'Cargue el QR de cobro en Administración → Empresa → De Una. ' +
      'Mientras tanto el cobro se puede registrar igual.';
  }

  const titular = modal.querySelector('#deuna-titular');
  if (titular) {
    titular.textContent = e?.deuna_titular
      ? `Cuenta de ${e.deuna_titular}${e.deuna_telefono ? ` · ${e.deuna_telefono}` : ''}`
      : '';
  }
  caja.dataset.listo = '1';
}

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

      <div id="pago-deuna" class="pago-campos hidden">
        <div class="deuna-caja">
          <div class="deuna-qr" id="deuna-qr"></div>
          <div class="deuna-datos">
            <p class="deuna-etiqueta">El cliente debe enviar</p>
            <p class="deuna-monto"><b>$${total.toFixed(2)}</b></p>
            <button type="button" id="deuna-ampliar" class="btn-primary btn-ampliar">
              Mostrar el código en grande
            </button>
            <p class="nota" id="deuna-nota"></p>
            <p class="nota" id="deuna-titular"></p>
            <label class="deuna-ref">
              Referencia (opcional)
              <input type="text" id="deuna-referencia"
                     placeholder="N.º de comprobante, si el cliente lo dicta" />
            </label>
          </div>
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
          const esDeuna = forma === 'TRANSFERENCIA_DEUNA';

          // Tres paneles excluyentes: efectivo, De Una, y el del
          // voucher para tarjeta o transferencia bancaria. De Una tiene
          // el suyo propio porque no pide código, solo muestra el QR y
          // el monto que el cliente debe enviar.
          modal.querySelector('#pago-efectivo').classList.toggle('hidden', !esEfectivo);
          modal.querySelector('#pago-deuna').classList.toggle('hidden', !esDeuna);
          modal.querySelector('#pago-codigo').classList.toggle('hidden', esEfectivo || esDeuna);

          if (esDeuna) {
            pintarDeuna(modal);
            // El botón se conecta al pintarse el panel, no al abrir el
            // modal: antes de elegir De Una todavía no existe.
            modal.querySelector('#deuna-ampliar')?.addEventListener('click', () => {
              abrirQRDeUna(total, () => abrirModalPago(total, onConfirmar));
            });
          }
          if (!esEfectivo && !esDeuna) {
            modal.querySelector('#pago-codigo-label').textContent =
              forma.startsWith('TARJETA') ? 'N.º de voucher' : 'N.º de transferencia';
          }
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

    } else if (forma === 'TRANSFERENCIA_DEUNA') {
      // De Una es una transferencia: el cliente escanea el QR y envía el
      // monto que se le dijo. No hay token ni código que el sistema
      // pueda comprobar, así que exigir uno solo frenaba la caja y
      // empujaba al cajero a inventar cualquier cosa para poder cerrar.
      // La referencia se guarda si el cliente la dicta, y nada más.
      onConfirmar([{
        forma_pago: forma,
        monto: total,
        codigo_transaccion: modal.querySelector('#deuna-referencia')?.value.trim() || null,
        banco: 'Banco Pichincha — De Una',
      }]);

    } else {
      // Tarjeta y transferencia bancaria sí dejan un voucher o un número
      // de transferencia en el momento: ahí el dato existe y pedirlo es
      // lo que permite cuadrar la caja al cierre.
      const codigo = modal.querySelector('#pago-codigo-input').value.trim();
      if (!codigo) {
        msg.textContent = 'Ingrese el número del voucher o de la transferencia';
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
