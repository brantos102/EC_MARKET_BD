import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';
import { traducirErrorSupabase } from './lib/errores.js';

export async function renderReportes(container) {
  container.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-r="ventas">Ventas por día</button>
      <button class="tab" data-r="productos">Productos más vendidos</button>
      <button class="tab" data-r="inventario">Valorización de inventario</button>
      <button class="tab" data-r="movimientos">Movimientos</button>
    </div>
    <div id="reporte-contenido"></div>
  `;

  const destino = container.querySelector('#reporte-contenido');

  container.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      cargar(btn.dataset.r);
    });
  });

  async function cargar(cual) {
    destino.innerHTML = '<p class="loading">Cargando...</p>';

    if (cual === 'ventas') {
      const { data, error } = await supabase
        .from('v_ventas_resumen').select('*').order('fecha', { ascending: false });
      if (error) return fallo(error);

      const total = (data ?? []).reduce((a, r) => a + Number(r.total || 0), 0);
      const transacciones = (data ?? []).reduce((a, r) => a + Number(r.num_ventas || 0), 0);
      destino.innerHTML = kpis([
        ['Transacciones', transacciones],
        ['Ingresos totales', `$${total.toFixed(2)}`],
        ['Ticket promedio', `$${transacciones ? (total / transacciones).toFixed(2) : '0.00'}`],
      ]) + '<div id="t"></div>';

      renderTable(destino.querySelector('#t'), {
        columns: [
          { key: 'fecha', label: 'Fecha' },
          { key: 'tipo_venta', label: 'Tipo' },
          { key: 'num_ventas', label: 'N.º ventas', numeric: true },
          { key: 'subtotal', label: 'Subtotal', numeric: true, format: money },
          { key: 'descuento_total', label: 'Descuentos', numeric: true, format: money },
          { key: 'impuesto', label: 'IVA', numeric: true, format: money },
          { key: 'total', label: 'Total', numeric: true, format: money },
        ],
        rows: data ?? [],
        emptyMessage: 'Todavía no hay ventas registradas.',
      });

    } else if (cual === 'productos') {
      const { data, error } = await supabase
        .from('v_productos_mas_vendidos').select('*').order('unidades_vendidas', { ascending: false });
      if (error) return fallo(error);

      destino.innerHTML = '<div id="t"></div>';
      renderTable(destino.querySelector('#t'), {
        columns: [
          { key: 'codigo', label: 'Código' },
          { key: 'producto', label: 'Producto' },
          { key: 'categoria', label: 'Categoría' },
          { key: 'unidades_vendidas', label: 'Unidades', numeric: true, format: (v) => Number(v).toFixed(2) },
          { key: 'num_transacciones', label: 'Transacciones', numeric: true },
          { key: 'ingresos', label: 'Ingresos', numeric: true, format: money },
        ],
        rows: data ?? [],
        emptyMessage: 'Sin ventas para analizar.',
      });

    } else if (cual === 'inventario') {
      const { data, error } = await supabase
        .from('v_stock_actual').select('*').order('valor_total', { ascending: false });
      if (error) return fallo(error);

      const filas = (data ?? []).filter((r) => Number(r.stock) !== 0);
      const valor = filas.reduce((a, r) => a + Number(r.valor_total || 0), 0);
      const bajos = filas.filter((r) => r.bajo_minimo).length;

      destino.innerHTML = kpis([
        ['Ítems con existencia', filas.length],
        ['Valor del inventario', `$${valor.toFixed(2)}`],
        ['Bajo stock mínimo', bajos],
      ]) + '<div id="t"></div>';

      renderTable(destino.querySelector('#t'), {
        columns: [
          { key: 'codigo', label: 'Código' },
          { key: 'producto', label: 'Producto' },
          { key: 'categoria', label: 'Categoría' },
          { key: 'ubicacion', label: 'Ubicación' },
          { key: 'stock', label: 'Stock', numeric: true, format: (v) => Number(v).toFixed(2) },
          { key: 'costo_promedio', label: 'Costo prom.', numeric: true, format: (v) => `$${Number(v).toFixed(4)}` },
          { key: 'valor_total', label: 'Valor', numeric: true, format: money },
          { key: 'precio_venta_menor', label: 'P. venta', numeric: true, format: money },
        ],
        rows: filas,
        rowClass: (r) => (r.bajo_minimo ? 'row-warning' : ''),
        emptyMessage: 'Sin existencias registradas.',
      });

    } else {
      const { data, error } = await supabase
        .from('movimientos_inventario')
        .select('created_at, tipo, cantidad, costo_unitario, costo_total, saldo_cantidad, referencia, productos(codigo, nombre)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) return fallo(error);

      destino.innerHTML = '<div id="t"></div>';
      renderTable(destino.querySelector('#t'), {
        columns: [
          { key: 'fecha', label: 'Fecha' },
          { key: 'codigo', label: 'Código' },
          { key: 'producto', label: 'Producto' },
          { key: 'tipo', label: 'Tipo' },
          { key: 'cantidad', label: 'Cantidad', numeric: true, format: (v) => Number(v).toFixed(2) },
          { key: 'costo_unitario', label: 'Costo unit.', numeric: true, format: (v) => `$${Number(v).toFixed(4)}` },
          { key: 'saldo_cantidad', label: 'Saldo', numeric: true, format: (v) => Number(v).toFixed(2) },
          { key: 'referencia', label: 'Referencia' },
        ],
        rows: (data ?? []).map((m) => ({
          ...m,
          fecha: new Date(m.created_at).toLocaleString('es-EC'),
          codigo: m.productos?.codigo,
          producto: m.productos?.nombre,
        })),
        rowClass: (r) => (r.tipo === 'SALIDA' ? 'row-salida' : ''),
        emptyMessage: 'Sin movimientos.',
      });
    }
  }

  function fallo(error) {
    destino.innerHTML = traducirErrorSupabase(error, 'v_ventas_resumen');
  }

  function kpis(pares) {
    return `<div class="kpi-row">${pares
      .map(([l, v]) => `<div class="kpi-card"><span class="kpi-label">${l}</span><span class="kpi-value">${v}</span></div>`)
      .join('')}</div>`;
  }

  const money = (v) => `$${Number(v).toFixed(2)}`;

  await cargar('ventas');
}
