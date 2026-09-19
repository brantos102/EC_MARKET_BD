import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';
import { traducirErrorSupabase } from './lib/errores.js';

export async function renderCaducidades(container) {
  container.innerHTML = '<p class="loading">Revisando lotes...</p>';

  const { data, error } = await supabase
    .from('v_alertas_caducidad')
    .select('*')
    .order('dias_restantes');

  if (error) {
    container.innerHTML = traducirErrorSupabase(error, 'v_alertas_caducidad');
    return;
  }

  const filas = data ?? [];
  const cuenta = (nivel) => filas.filter((f) => f.nivel_alerta === nivel).length;
  const valor = (nivel) =>
    filas.filter((f) => f.nivel_alerta === nivel)
         .reduce((a, f) => a + Number(f.valor_en_riesgo || 0), 0);

  container.innerHTML = `
    <div class="kpi-row">
      <div class="kpi-card kpi-danger">
        <span class="kpi-label">Vencidos</span>
        <span class="kpi-value">${cuenta('VENCIDO')}</span>
        <span class="kpi-sub">$${valor('VENCIDO').toFixed(2)} en riesgo</span>
      </div>
      <div class="kpi-card kpi-warning">
        <span class="kpi-label">Críticos (≤ 7 días)</span>
        <span class="kpi-value">${cuenta('CRITICO')}</span>
        <span class="kpi-sub">$${valor('CRITICO').toFixed(2)} en riesgo</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Próximos a vencer</span>
        <span class="kpi-value">${cuenta('PROXIMO')}</span>
        <span class="kpi-sub">$${valor('PROXIMO').toFixed(2)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Vigentes</span>
        <span class="kpi-value">${cuenta('VIGENTE')}</span>
      </div>
    </div>
    <p class="nota">Las salidas consumen siempre el lote que caduca primero (FEFO), así que esta lista baja sola conforme se vende.</p>
    <div id="tabla-caducidad"></div>
  `;

  renderTable(container.querySelector('#tabla-caducidad'), {
    columns: [
      { key: 'nivel_alerta', label: 'Alerta' },
      { key: 'codigo', label: 'Código' },
      { key: 'producto', label: 'Producto' },
      { key: 'categoria', label: 'Categoría' },
      { key: 'codigo_lote', label: 'Lote' },
      { key: 'fecha_caducidad', label: 'Caduca' },
      { key: 'dias_restantes', label: 'Días', numeric: true },
      { key: 'cantidad_disponible', label: 'Cantidad', numeric: true, format: (v) => Number(v).toFixed(2) },
      { key: 'valor_en_riesgo', label: 'Valor', numeric: true, format: (v) => `$${Number(v).toFixed(2)}` },
      { key: 'ubicacion', label: 'Ubicación' },
    ],
    rows: filas,
    rowClass: (r) =>
      r.nivel_alerta === 'VENCIDO' ? 'row-danger'
      : r.nivel_alerta === 'CRITICO' ? 'row-warning'
      : '',
    emptyMessage: 'No hay lotes con fecha de caducidad registrada.',
  });
}
