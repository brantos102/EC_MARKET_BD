import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';

export async function renderDashboard(container) {
  container.innerHTML = '<p class="loading">Cargando stock actual...</p>';

  const { data, error } = await supabase
    .from('v_stock_actual')
    .select('*')
    .order('producto', { ascending: true });

  if (error) {
    container.innerHTML = `<p class="error">Error cargando el dashboard: ${error.message}</p>`;
    return;
  }

  const totalValor = (data ?? []).reduce((acc, r) => acc + Number(r.valor_total || 0), 0);
  const bajoMinimo = (data ?? []).filter((r) => r.bajo_minimo).length;

  const summary = document.createElement('div');
  summary.className = 'kpi-row';
  summary.innerHTML = `
    <div class="kpi-card">
      <span class="kpi-label">Productos activos</span>
      <span class="kpi-value">${data?.length ?? 0}</span>
    </div>
    <div class="kpi-card">
      <span class="kpi-label">Valor total de inventario</span>
      <span class="kpi-value">$${totalValor.toFixed(2)}</span>
    </div>
    <div class="kpi-card ${bajoMinimo > 0 ? 'kpi-warning' : ''}">
      <span class="kpi-label">Bajo stock mínimo</span>
      <span class="kpi-value">${bajoMinimo}</span>
    </div>
  `;

  const tableContainer = document.createElement('div');

  container.innerHTML = '';
  container.appendChild(summary);
  container.appendChild(tableContainer);

  renderTable(tableContainer, {
    columns: [
      { key: 'codigo', label: 'Código' },
      { key: 'producto', label: 'Producto' },
      { key: 'categoria', label: 'Categoría' },
      { key: 'bodega', label: 'Bodega' },
      { key: 'stock', label: 'Stock', numeric: true, format: (v) => Number(v).toFixed(2) },
      { key: 'costo_promedio', label: 'Costo Prom.', numeric: true, format: (v) => `$${Number(v).toFixed(4)}` },
      { key: 'valor_total', label: 'Valor Total', numeric: true, format: (v) => `$${Number(v).toFixed(2)}` },
    ],
    rows: data ?? [],
    rowClass: (row) => (row.bajo_minimo ? 'row-warning' : ''),
    emptyMessage: 'No hay productos registrados todavía.',
  });
}
