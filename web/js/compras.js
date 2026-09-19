// Compras a proveedores.
//
// Dos pantallas en una:
//   · Sugerencia de reposición — qué está bajo el mínimo y cuánto pedir.
//     La cantidad no sale de una regla fija: es lo que falta para el
//     mínimo más dos semanas de la rotación real de los últimos 30 días,
//     redondeado al paso de venta del producto (no se piden 7,3 libras).
//   · Órdenes de compra — el pedido formal al proveedor, que se deja
//     listo en la bandeja de salida con la plantilla de correo.

import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';
import { abrirModal, cerrarModal } from './lib/modal.js';
import { traducirErrorSupabase } from './lib/errores.js';

export async function renderCompras(container) {
  container.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-a="reposicion">Sugerencia de reposición</button>
      <button class="tab" data-a="ordenes">Órdenes de compra</button>
    </div>
    <div id="compras-vista"></div>`;

  const vista = container.querySelector('#compras-vista');
  container.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.a === 'reposicion') vistaReposicion(vista);
      else vistaOrdenes(vista);
    });
  });

  await vistaReposicion(vista);
}

// ---------------------------------------------------------
// Sugerencia de reposición
// ---------------------------------------------------------
async function vistaReposicion(destino) {
  destino.innerHTML = '<p class="loading">Calculando reposición…</p>';

  const { data, error } = await supabase
    .from('v_sugerencia_reposicion')
    .select('*')
    .order('urgencia')
    .order('nombre');

  if (error) {
    destino.innerHTML = traducirErrorSupabase(error, 'v_sugerencia_reposicion');
    return;
  }

  const filas = data ?? [];
  const agotados = filas.filter((f) => f.urgencia === 'AGOTADO').length;
  const sinProveedor = filas.filter((f) => !f.proveedor_id).length;

  destino.innerHTML = `
    <div class="panel">
      <h3>Qué hay que reponer</h3>
      <p class="nota">Se listan los productos por debajo de su stock mínimo. La
      <b>cantidad sugerida</b> cubre lo que falta para el mínimo más catorce días
      de la rotación real de las últimas cuatro semanas, redondeada al paso de
      venta del producto. Puede cambiarla antes de generar la orden.</p>
      <div class="tarjetas-resumen">
        <div class="tarjeta-mini"><span>${filas.length}</span><small>bajo el mínimo</small></div>
        <div class="tarjeta-mini ${agotados ? 'alerta' : ''}"><span>${agotados}</span><small>agotados</small></div>
        <div class="tarjeta-mini ${sinProveedor ? 'aviso' : ''}"><span>${sinProveedor}</span><small>sin proveedor</small></div>
      </div>
      <div class="acciones-fila">
        <button id="btn-agrupar" class="btn-primary" ${filas.length ? '' : 'disabled'}>
          Generar órdenes por proveedor
        </button>
      </div>
      <div id="rep-msg" class="form-msg"></div>
    </div>
    <div id="tabla-rep"></div>`;

  renderTable(destino.querySelector('#tabla-rep'), {
    columns: [
      { key: 'urgencia', label: 'Urgencia' },
      { key: 'codigo', label: 'Código' },
      { key: 'nombre', label: 'Producto' },
      { key: 'stock_txt', label: 'Stock' },
      { key: 'stock_minimo', label: 'Mínimo' },
      { key: 'rotacion', label: 'Venta 30 días' },
      { key: 'sugerida', label: 'Pedir' },
      { key: 'proveedor_txt', label: 'Proveedor' },
    ],
    rows: filas.map((f) => ({
      ...f,
      stock_txt: Number(f.stock).toFixed(2),
      rotacion: `${Number(f.vendido_30d).toFixed(1)} (${Number(f.promedio_diario).toFixed(2)}/día)`,
      sugerida: Number(f.cantidad_sugerida).toFixed(2),
      proveedor_txt: f.proveedor ?? '— sin registrar —',
    })),
    searchable: true,
    rowClass: (r) => (r.urgencia === 'AGOTADO' ? 'row-error'
                    : r.urgencia === 'CRITICO' ? 'row-warning' : ''),
    emptyMessage: 'Ningún producto está por debajo del stock mínimo. Nada que pedir hoy.',
  });

  destino.querySelector('#btn-agrupar')?.addEventListener('click', () => {
    abrirAgrupacion(filas, destino);
  });
}

/**
 * Agrupa lo que falta por proveedor y crea una orden por cada uno.
 * Los productos sin proveedor registrado se muestran aparte en vez de
 * desaparecer en silencio: alguien tiene que decidir a quién comprarlos.
 */
function abrirAgrupacion(filas, destino) {
  const porProveedor = new Map();
  const huerfanos = [];

  for (const f of filas) {
    if (!f.proveedor_id) { huerfanos.push(f); continue; }
    if (!porProveedor.has(f.proveedor_id)) {
      porProveedor.set(f.proveedor_id, { nombre: f.proveedor, email: f.proveedor_email, items: [] });
    }
    porProveedor.get(f.proveedor_id).items.push(f);
  }

  abrirModal({
    titulo: 'Órdenes de compra a generar',
    contenido: `
      ${[...porProveedor.entries()].map(([id, g]) => `
        <label class="prov-bloque">
          <input type="checkbox" class="chk-prov" value="${id}" checked />
          <div>
            <b>${escapar(g.nombre ?? 'Proveedor')}</b>
            <div class="nota">${g.items.length} productos ·
              ${g.email ? escapar(g.email) : '<span class="texto-alerta">sin correo registrado</span>'}</div>
          </div>
        </label>`).join('') || '<p class="nota">No hay productos con proveedor asignado.</p>'}

      ${huerfanos.length ? `
        <div class="aviso-migracion" style="margin-top:0.75rem">
          <b>${huerfanos.length} productos sin proveedor</b>
          <p class="nota">No entran en ninguna orden porque nunca se registró de quién
          se compran: ${escapar(huerfanos.slice(0, 5).map((h) => h.nombre).join(', '))}${huerfanos.length > 5 ? '…' : ''}.
          Regístrelos con un ingreso de mercadería o asígneles proveedor en Administración.</p>
        </div>` : ''}

      <label class="ancho-completo" style="margin-top:0.75rem">Fecha requerida
        <input type="date" id="oc-fecha" value="${enDias(3)}" />
      </label>
      <label class="ancho-completo">Observación para el proveedor
        <input type="text" id="oc-obs" placeholder="Entregar en horario de la mañana" />
      </label>
      <div id="oc-msg" class="form-msg"></div>`,
    botones: [
      { texto: 'Cancelar', clase: 'btn-secundario', accion: cerrarModal },
      { texto: 'Crear y encolar correos', clase: 'btn-primary', accion: crear },
    ],
  });

  async function crear() {
    const modal = document.querySelector('.modal');
    const msg = modal.querySelector('#oc-msg');
    const elegidos = [...modal.querySelectorAll('.chk-prov:checked')].map((c) => c.value);

    if (!elegidos.length) {
      msg.textContent = 'Seleccione al menos un proveedor';
      msg.className = 'form-msg error';
      return;
    }

    msg.textContent = 'Creando órdenes…';
    msg.className = 'form-msg';

    const fecha = modal.querySelector('#oc-fecha').value || null;
    const obs = modal.querySelector('#oc-obs').value.trim() || null;
    const resultados = [];

    for (const id of elegidos) {
      const g = porProveedor.get(id);
      const items = g.items.map((f) => ({
        producto_id: f.producto_id,
        cantidad: Number(f.cantidad_sugerida),
        costo: Number(f.ultimo_costo ?? 0),
      }));

      const { data: ordenId, error } = await supabase.rpc('fn_crear_orden_compra', {
        p_proveedor_id: id,
        p_items: items,
        p_fecha_requerida: fecha,
        p_observaciones: obs,
      });

      if (error) {
        resultados.push(`${g.nombre}: ${error.message}`);
        continue;
      }

      // Encolar el correo es opcional: si el proveedor no tiene correo,
      // la orden igual queda creada para imprimirla o mandarla por otro medio.
      const { error: errCorreo } = await supabase.rpc('fn_enviar_orden_compra', { p_orden_id: ordenId });
      resultados.push(errCorreo
        ? `${g.nombre}: orden creada, correo no encolado (${errCorreo.message})`
        : `${g.nombre}: orden creada y correo en cola`);
    }

    cerrarModal();
    const cont = destino.querySelector('#rep-msg');
    if (cont) {
      cont.innerHTML = resultados.map((r) => `<div>${escapar(r)}</div>`).join('');
      cont.className = 'form-msg ok';
    }
  }
}

// ---------------------------------------------------------
// Órdenes de compra
// ---------------------------------------------------------
async function vistaOrdenes(destino) {
  destino.innerHTML = '<p class="loading">Cargando órdenes…</p>';

  const { data, error } = await supabase
    .from('ordenes_compra')
    .select('id, numero, fecha, fecha_requerida, estado, total_estimado, observaciones, proveedores(razon_social, email)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    destino.innerHTML = traducirErrorSupabase(error, 'ordenes_compra');
    return;
  }

  destino.innerHTML = `
    <div class="panel">
      <h3>Pedidos hechos a proveedores</h3>
      <p class="nota">Una orden pasa a <b>ENVIADA</b> cuando su correo queda en la
      bandeja de salida. Cuando llegue la mercadería, regístrela desde
      <b>Ingreso de mercadería</b>: ahí es donde entra al inventario y se
      recalcula el costo promedio.</p>
    </div>
    <div id="tabla-oc"></div>`;

  renderTable(destino.querySelector('#tabla-oc'), {
    columns: [
      { key: 'numero', label: 'Número' },
      { key: 'fecha_txt', label: 'Fecha' },
      { key: 'proveedor', label: 'Proveedor' },
      { key: 'requerida', label: 'Requerida' },
      { key: 'total_txt', label: 'Total estimado' },
      { key: 'estado', label: 'Estado' },
    ],
    rows: (data ?? []).map((o) => ({
      ...o,
      fecha_txt: new Date(o.fecha + 'T00:00:00').toLocaleDateString('es-EC'),
      requerida: o.fecha_requerida
        ? new Date(o.fecha_requerida + 'T00:00:00').toLocaleDateString('es-EC') : '—',
      proveedor: o.proveedores?.razon_social ?? '—',
      total_txt: `$${Number(o.total_estimado).toFixed(2)}`,
    })),
    searchable: true,
    rowClass: (r) => (r.estado === 'ENVIADA' ? 'row-ok' : r.estado === 'ANULADA' ? 'row-warning' : ''),
    emptyMessage: 'Todavía no se ha generado ninguna orden de compra.',
  });
}

function enDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}
