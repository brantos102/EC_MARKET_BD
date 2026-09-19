import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';
import { abrirModal, cerrarModal } from './lib/modal.js';

export async function renderAuditoria(container) {
  container.innerHTML = `
    <div class="panel">
      <form id="form-filtro-audit" class="inline-form">
        <select id="au-tabla">
          <option value="">Todas las tablas</option>
          <option value="ventas">Ventas</option>
          <option value="venta_detalle">Detalle de ventas</option>
          <option value="pagos_venta">Pagos</option>
          <option value="documentos_ingreso">Ingresos</option>
          <option value="ingreso_detalle">Detalle de ingresos</option>
          <option value="movimientos_inventario">Movimientos de inventario</option>
          <option value="productos">Productos</option>
          <option value="lotes">Lotes</option>
          <option value="promociones">Promociones</option>
        </select>
        <select id="au-operacion">
          <option value="">Toda operación</option>
          <option value="INSERT">Creación</option>
          <option value="UPDATE">Modificación</option>
          <option value="DELETE">Eliminación</option>
        </select>
        <input type="date" id="au-desde" />
        <select id="au-limite">
          <option value="100">Últimos 100</option>
          <option value="500">Últimos 500</option>
          <option value="2000">Últimos 2000</option>
        </select>
        <button type="submit">Filtrar</button>
      </form>
      <p class="nota">La bitácora la escribe la propia base de datos y no se puede modificar desde la aplicación
      (control A.8.15 de ISO/IEC 27001). Haga clic en una fila para ver el detalle del cambio.</p>
    </div>
    <div id="tabla-auditoria"></div>
  `;

  const destino = container.querySelector('#tabla-auditoria');

  async function cargar() {
    destino.innerHTML = '<p class="loading">Cargando bitácora...</p>';

    let query = supabase
      .from('auditoria_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Number(container.querySelector('#au-limite').value));

    const tabla = container.querySelector('#au-tabla').value;
    const operacion = container.querySelector('#au-operacion').value;
    const desde = container.querySelector('#au-desde').value;

    if (tabla) query = query.eq('tabla', tabla);
    if (operacion) query = query.eq('operacion', operacion);
    if (desde) query = query.gte('created_at', desde);

    const { data, error } = await query;
    if (error) {
      destino.innerHTML = `<p class="error">${error.message}</p>`;
      return;
    }

    const filas = (data ?? []).map((r) => ({
      ...r,
      fecha: new Date(r.created_at).toLocaleString('es-EC'),
      usuario: r.usuario_email ?? '(sistema)',
      cambios: (r.campos_modificados ?? []).join(', ') || '—',
    }));

    renderTable(destino, {
      columns: [
        { key: 'fecha', label: 'Fecha' },
        { key: 'tabla', label: 'Tabla' },
        { key: 'operacion', label: 'Operación' },
        { key: 'usuario', label: 'Usuario' },
        { key: 'cambios', label: 'Campos modificados' },
      ],
      rows: filas,
      emptyMessage: 'Sin eventos para este filtro.',
    });

    // Click en fila -> detalle
    destino.querySelectorAll('tbody tr').forEach((tr, i) => {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => mostrarDetalle(filas[i]));
    });
  }

  function mostrarDetalle(fila) {
    const json = (obj) =>
      obj ? `<pre class="json-box">${JSON.stringify(obj, null, 2)}</pre>` : '<p class="nota">—</p>';

    abrirModal({
      ancho: '760px',
      titulo: `${fila.operacion} en ${fila.tabla}`,
      contenido: `
        <div class="comp-linea"><span>Fecha</span><b>${fila.fecha}</b></div>
        <div class="comp-linea"><span>Usuario</span><b>${fila.usuario}</b></div>
        <div class="comp-linea"><span>Registro</span><b>${fila.registro_id ?? '—'}</b></div>
        <div class="comp-linea"><span>Campos</span><b>${fila.cambios}</b></div>
        <div class="audit-columnas">
          <div><h4>Antes</h4>${json(fila.datos_anteriores)}</div>
          <div><h4>Después</h4>${json(fila.datos_nuevos)}</div>
        </div>`,
      botones: [{ texto: 'Cerrar', clase: 'btn-secundario', accion: cerrarModal }],
    });
  }

  container.querySelector('#form-filtro-audit').addEventListener('submit', (e) => {
    e.preventDefault();
    cargar();
  });

  await cargar();
}
