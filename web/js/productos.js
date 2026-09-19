import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';

export async function renderProductos(container) {
  container.innerHTML = `
    <form id="form-producto" class="inline-form">
      <input type="text" id="prod-codigo" placeholder="Código" required />
      <input type="text" id="prod-nombre" placeholder="Nombre" required />
      <select id="prod-categoria"><option value="">Sin categoría</option></select>
      <input type="text" id="prod-unidad" placeholder="Unidad (UND, KG, LT...)" value="UND" />
      <input type="number" id="prod-stock-min" placeholder="Stock mínimo" min="0" step="0.01" value="0" />
      <button type="submit">Agregar producto</button>
      <span id="prod-msg" class="form-msg"></span>
    </form>
    <div id="productos-table"></div>
  `;

  const msg = container.querySelector('#prod-msg');
  const tableEl = container.querySelector('#productos-table');
  const categoriaSelect = container.querySelector('#prod-categoria');

  const { data: categorias } = await supabase.from('categorias').select('id, nombre').order('nombre');
  (categorias ?? []).forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nombre;
    categoriaSelect.appendChild(opt);
  });

  async function load() {
    const { data, error } = await supabase
      .from('productos')
      .select('codigo, nombre, unidad_medida, stock_minimo, activo, categorias(nombre)')
      .order('nombre');
    if (error) {
      tableEl.innerHTML = `<p class="error">${error.message}</p>`;
      return;
    }
    renderTable(tableEl, {
      columns: [
        { key: 'codigo', label: 'Código' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'categoria', label: 'Categoría' },
        { key: 'unidad_medida', label: 'Unidad' },
        { key: 'stock_minimo', label: 'Stock mín.', numeric: true },
        { key: 'activo', label: 'Activo', format: (v) => (v ? 'Sí' : 'No') },
      ],
      rows: (data ?? []).map((p) => ({ ...p, categoria: p.categorias?.nombre ?? '—' })),
      emptyMessage: 'No hay productos registrados. Agrega el primero arriba.',
    });
  }

  container.querySelector('#form-producto').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const payload = {
      codigo: container.querySelector('#prod-codigo').value.trim(),
      nombre: container.querySelector('#prod-nombre').value.trim(),
      categoria_id: categoriaSelect.value || null,
      unidad_medida: container.querySelector('#prod-unidad').value.trim() || 'UND',
      stock_minimo: Number(container.querySelector('#prod-stock-min').value || 0),
    };
    const { error } = await supabase.from('productos').insert(payload);
    if (error) {
      msg.textContent = error.message;
      msg.className = 'form-msg error';
    } else {
      msg.textContent = 'Producto agregado.';
      msg.className = 'form-msg ok';
      e.target.reset();
      container.querySelector('#prod-unidad').value = 'UND';
      load();
    }
  });

  await load();
}
