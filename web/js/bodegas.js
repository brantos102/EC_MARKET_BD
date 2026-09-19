import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';

export async function renderBodegas(container) {
  container.innerHTML = `
    <form id="form-bodega" class="inline-form">
      <input type="text" id="bodega-nombre" placeholder="Nombre de la bodega" required />
      <input type="text" id="bodega-ubicacion" placeholder="Ubicación (opcional)" />
      <button type="submit">Agregar bodega</button>
      <span id="bodega-msg" class="form-msg"></span>
    </form>
    <div id="bodegas-table"></div>
  `;

  const msg = container.querySelector('#bodega-msg');
  const tableEl = container.querySelector('#bodegas-table');

  async function load() {
    const { data, error } = await supabase.from('bodegas').select('*').order('nombre');
    if (error) {
      tableEl.innerHTML = `<p class="error">${error.message}</p>`;
      return;
    }
    renderTable(tableEl, {
      columns: [
        { key: 'nombre', label: 'Nombre' },
        { key: 'ubicacion', label: 'Ubicación' },
        { key: 'activa', label: 'Activa', format: (v) => (v ? 'Sí' : 'No') },
      ],
      rows: data ?? [],
      emptyMessage: 'No hay bodegas registradas. Agrega la primera arriba.',
    });
  }

  container.querySelector('#form-bodega').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const nombre = container.querySelector('#bodega-nombre').value.trim();
    const ubicacion = container.querySelector('#bodega-ubicacion').value.trim() || null;
    const { error } = await supabase.from('bodegas').insert({ nombre, ubicacion });
    if (error) {
      msg.textContent = error.message;
      msg.className = 'form-msg error';
    } else {
      msg.textContent = 'Bodega agregada.';
      msg.className = 'form-msg ok';
      e.target.reset();
      load();
    }
  });

  await load();
}
