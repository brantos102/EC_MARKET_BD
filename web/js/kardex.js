import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';

export async function renderKardex(container) {
  container.innerHTML = `
    <form id="form-kardex-filtro" class="inline-form">
      <select id="kx-producto" required><option value="">Producto...</option></select>
      <select id="kx-bodega" required><option value="">Bodega...</option></select>
      <button type="submit">Ver Kardex</button>
    </form>
    <div id="kx-resultado"></div>
  `;

  const productoSelect = container.querySelector('#kx-producto');
  const bodegaSelect = container.querySelector('#kx-bodega');
  const resultado = container.querySelector('#kx-resultado');

  const [{ data: productos }, { data: bodegas }] = await Promise.all([
    supabase.from('productos').select('id, codigo, nombre').order('nombre'),
    supabase.from('bodegas').select('id, nombre').order('nombre'),
  ]);

  (productos ?? []).forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.codigo} — ${p.nombre}`;
    productoSelect.appendChild(opt);
  });
  (bodegas ?? []).forEach((b) => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.nombre;
    bodegaSelect.appendChild(opt);
  });

  container.querySelector('#form-kardex-filtro').addEventListener('submit', async (e) => {
    e.preventDefault();
    resultado.innerHTML = '<p class="loading">Cargando kardex...</p>';

    const { data, error } = await supabase
      .from('movimientos_inventario')
      .select('*')
      .eq('producto_id', productoSelect.value)
      .eq('bodega_id', bodegaSelect.value)
      .order('created_at', { ascending: true });

    if (error) {
      resultado.innerHTML = `<p class="error">${error.message}</p>`;
      return;
    }

    resultado.innerHTML = '';
    renderTable(resultado, {
      columns: [
        { key: 'created_at', label: 'Fecha', format: (v) => new Date(v).toLocaleString('es-EC') },
        { key: 'tipo', label: 'Tipo' },
        { key: 'cantidad', label: 'Cantidad', numeric: true },
        { key: 'costo_unitario', label: 'Costo Unit.', numeric: true, format: (v) => `$${Number(v).toFixed(4)}` },
        { key: 'costo_total', label: 'Costo Total', numeric: true, format: (v) => `$${Number(v).toFixed(2)}` },
        { key: 'saldo_cantidad', label: 'Saldo Cant.', numeric: true },
        { key: 'saldo_costo_promedio', label: 'Saldo Costo Prom.', numeric: true, format: (v) => `$${Number(v).toFixed(4)}` },
        { key: 'saldo_valor_total', label: 'Saldo Valor', numeric: true, format: (v) => `$${Number(v).toFixed(2)}` },
        { key: 'referencia', label: 'Referencia' },
      ],
      rows: data ?? [],
      emptyMessage: 'Sin movimientos registrados para esta combinación producto/bodega.',
    });
  });
}
