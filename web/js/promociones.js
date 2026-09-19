import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';

const DESCRIPCION_TIPO = {
  N_POR_DOLAR: (p) => `${p.cantidad} por $${Number(p.valor).toFixed(2)}`,
  N_POR_M: (p) => `${p.cantidad}x${p.valor}`,
  PORCENTAJE: (p) => `${Number(p.valor)}% de descuento`,
  PRECIO_FIJO: (p) => `Precio fijo $${Number(p.valor).toFixed(2)}`,
};

export async function renderPromociones(container) {
  container.innerHTML = `
    <div class="panel">
      <h3>Nueva promoción de temporada</h3>
      <form id="form-promo" class="inline-form">
        <input type="text" id="pr-codigo" placeholder="Código (ej. PROMO-VERANO)" required />
        <input type="text" id="pr-nombre" placeholder="Nombre visible" required />
        <input type="text" id="pr-temporada" placeholder="Temporada (Navidad, Carnaval...)" />
        <select id="pr-tipo">
          <option value="N_POR_DOLAR">N por $X (ej. 3 por $1)</option>
          <option value="N_POR_M">NxM (ej. 2x1)</option>
          <option value="PORCENTAJE">% de descuento</option>
          <option value="PRECIO_FIJO">Precio fijo</option>
        </select>
        <input type="number" id="pr-cantidad" placeholder="N" step="1" min="1" />
        <input type="number" id="pr-valor" placeholder="Valor" step="0.01" min="0" required />
        <input type="date" id="pr-desde" required />
        <input type="date" id="pr-hasta" required />
        <select id="pr-aplica">
          <option value="AMBAS">Detalle y mayor</option>
          <option value="MENOR">Solo al detalle</option>
          <option value="MAYOR">Solo por mayor</option>
        </select>
        <select id="pr-alcance-tipo">
          <option value="producto">Aplicar a un producto</option>
          <option value="categoria">Aplicar a una categoría</option>
        </select>
        <select id="pr-alcance-valor"></select>
        <button type="submit">Crear promoción</button>
        <span id="pr-msg" class="form-msg"></span>
      </form>
      <p class="nota" id="pr-ayuda"></p>
    </div>
    <div id="tabla-promos"></div>
  `;

  const hoy = new Date().toISOString().slice(0, 10);
  container.querySelector('#pr-desde').value = hoy;
  container.querySelector('#pr-hasta').value = hoy.slice(0, 4) + '-12-31';

  const [{ data: productos }, { data: categorias }] = await Promise.all([
    supabase.from('productos').select('id, codigo, nombre').eq('activo', true).order('nombre'),
    supabase.from('categorias').select('id, nombre').order('nombre'),
  ]);

  const selAlcanceTipo = container.querySelector('#pr-alcance-tipo');
  const selAlcanceValor = container.querySelector('#pr-alcance-valor');
  const tipoSelect = container.querySelector('#pr-tipo');
  const ayuda = container.querySelector('#pr-ayuda');

  function llenarAlcance() {
    selAlcanceValor.innerHTML = '';
    const lista = selAlcanceTipo.value === 'producto'
      ? (productos ?? []).map((p) => [p.id, `${p.codigo} — ${p.nombre}`])
      : (categorias ?? []).map((c) => [c.id, c.nombre]);
    for (const [id, texto] of lista) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = texto;
      selAlcanceValor.appendChild(o);
    }
  }
  selAlcanceTipo.addEventListener('change', llenarAlcance);
  llenarAlcance();

  function actualizarAyuda() {
    const t = tipoSelect.value;
    const cant = container.querySelector('#pr-cantidad');
    cant.disabled = t === 'PORCENTAJE' || t === 'PRECIO_FIJO';
    ayuda.textContent = {
      N_POR_DOLAR: 'Ejemplo: N = 3 y Valor = 1.00 significa "3 unidades por $1". El resto se cobra al precio normal.',
      N_POR_M: 'Ejemplo: N = 2 y Valor = 1 significa "2x1": de cada 2 unidades, el cliente paga 1.',
      PORCENTAJE: 'Valor = 20 significa 20% de descuento sobre el precio de lista.',
      PRECIO_FIJO: 'Valor = 0.40 significa que cada unidad se cobra a $0.40 durante la vigencia.',
    }[t];
  }
  tipoSelect.addEventListener('change', actualizarAyuda);
  actualizarAyuda();

  const msg = container.querySelector('#pr-msg');

  container.querySelector('#form-promo').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const tipo = tipoSelect.value;

    const { data: promo, error } = await supabase.from('promociones').insert({
      codigo: container.querySelector('#pr-codigo').value.trim(),
      nombre: container.querySelector('#pr-nombre').value.trim(),
      temporada: container.querySelector('#pr-temporada').value.trim() || null,
      tipo,
      cantidad: (tipo === 'N_POR_DOLAR' || tipo === 'N_POR_M')
        ? Number(container.querySelector('#pr-cantidad').value) : null,
      valor: Number(container.querySelector('#pr-valor').value),
      vigencia_desde: container.querySelector('#pr-desde').value,
      vigencia_hasta: container.querySelector('#pr-hasta').value,
      aplica_tipo_venta: container.querySelector('#pr-aplica').value,
    }).select('id').single();

    if (error) {
      msg.textContent = error.message;
      msg.className = 'form-msg error';
      return;
    }

    const alcance = selAlcanceTipo.value === 'producto'
      ? { promocion_id: promo.id, producto_id: selAlcanceValor.value }
      : { promocion_id: promo.id, categoria_id: selAlcanceValor.value };

    const { error: errAlc } = await supabase.from('promocion_alcance').insert(alcance);
    if (errAlc) {
      msg.textContent = `Promoción creada pero sin alcance: ${errAlc.message}`;
      msg.className = 'form-msg error';
    } else {
      msg.textContent = 'Promoción creada y activa.';
      msg.className = 'form-msg ok';
      e.target.reset();
      container.querySelector('#pr-desde').value = hoy;
      container.querySelector('#pr-hasta').value = hoy.slice(0, 4) + '-12-31';
    }
    cargar();
  });

  async function cargar() {
    const destino = container.querySelector('#tabla-promos');
    const { data, error } = await supabase
      .from('promociones')
      .select('*, promocion_alcance(producto_id, categoria_id, productos(nombre), categorias(nombre))')
      .order('vigencia_desde', { ascending: false });

    if (error) {
      destino.innerHTML = `<p class="error">${error.message}</p>`;
      return;
    }

    renderTable(destino, {
      columns: [
        { key: 'codigo', label: 'Código' },
        { key: 'nombre', label: 'Promoción' },
        { key: 'temporada', label: 'Temporada' },
        { key: 'descripcion', label: 'Regla' },
        { key: 'alcance', label: 'Aplica a' },
        { key: 'vigencia_desde', label: 'Desde' },
        { key: 'vigencia_hasta', label: 'Hasta' },
        { key: 'estado_vigencia', label: 'Estado' },
      ],
      rows: (data ?? []).map((p) => {
        const alc = (p.promocion_alcance ?? [])
          .map((a) => a.productos?.nombre ?? (a.categorias?.nombre ? `Categoría: ${a.categorias.nombre}` : '—'))
          .join(', ');
        const vigente = p.activa && p.vigencia_desde <= hoy && p.vigencia_hasta >= hoy;
        return {
          ...p,
          descripcion: DESCRIPCION_TIPO[p.tipo]?.(p) ?? p.tipo,
          alcance: alc || '—',
          estado_vigencia: !p.activa ? 'Inactiva' : vigente ? 'Vigente' : (p.vigencia_desde > hoy ? 'Programada' : 'Expirada'),
        };
      }),
      rowClass: (r) => (r.estado_vigencia === 'Vigente' ? 'row-ok' : ''),
      emptyMessage: 'No hay promociones registradas.',
    });
  }

  await cargar();
}
