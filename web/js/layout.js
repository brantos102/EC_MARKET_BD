import { supabase } from './supabaseClient.js';
import { abrirModal, cerrarModal } from './lib/modal.js';

export async function renderLayout(container) {
  container.innerHTML = '<p class="loading">Cargando el mapa del market...</p>';

  const { data, error } = await supabase
    .from('v_ocupacion_layout')
    .select('*')
    .order('orden')
    .order('pasillo')
    .order('estante')
    .order('nivel');

  if (error) {
    container.innerHTML = `<p class="error">${error.message}</p>`;
    return;
  }

  // Agrupar: zona -> pasillo -> estante -> niveles
  const zonas = new Map();
  for (const fila of data ?? []) {
    if (!zonas.has(fila.zona_codigo)) {
      zonas.set(fila.zona_codigo, {
        codigo: fila.zona_codigo,
        nombre: fila.zona,
        color: fila.color_hex,
        conservacion: fila.tipo_conservacion,
        pasillos: new Map(),
      });
    }
    const zona = zonas.get(fila.zona_codigo);
    if (!zona.pasillos.has(fila.pasillo)) zona.pasillos.set(fila.pasillo, new Map());
    const pasillo = zona.pasillos.get(fila.pasillo);
    if (!pasillo.has(fila.estante)) pasillo.set(fila.estante, []);
    pasillo.get(fila.estante).push(fila);
  }

  const totalUbicaciones = new Set((data ?? []).map((f) => f.ubicacion_id)).size;
  const ocupadas = new Set((data ?? []).filter((f) => f.producto_id).map((f) => f.ubicacion_id)).size;

  container.innerHTML = `
    <div class="kpi-row">
      <div class="kpi-card">
        <span class="kpi-label">Zonas</span><span class="kpi-value">${zonas.size}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Ubicaciones</span><span class="kpi-value">${totalUbicaciones}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Ocupadas</span>
        <span class="kpi-value">${ocupadas} <small>(${totalUbicaciones ? Math.round((ocupadas / totalUbicaciones) * 100) : 0}%)</small></span>
      </div>
    </div>

    <div class="panel">
      <input type="search" id="layout-buscar" class="buscador-layout"
             placeholder="Buscar un producto para ver dónde está ubicado..." />
      <div id="layout-resultado-busqueda"></div>
    </div>

    <div id="mapa" class="mapa-market"></div>
  `;

  const mapa = container.querySelector('#mapa');
  mapa.innerHTML = [...zonas.values()]
    .map((zona) => {
      const pasillosHtml = [...zona.pasillos.entries()]
        .map(([pasillo, estantes]) => {
          const estantesHtml = [...estantes.entries()]
            .map(([estante, celdas]) => {
              const nivelesHtml = celdas
                .sort((a, b) => b.nivel - a.nivel)
                .map((c) => {
                  const ocupada = Boolean(c.producto_id);
                  const sinStock = ocupada && Number(c.stock) <= 0;
                  const clase = !ocupada ? 'vacia' : sinStock ? 'sin-stock' : 'ocupada';
                  const etiqueta = ocupada ? c.producto : 'libre';
                  return `<div class="celda ${clase}" data-ubicacion="${c.ubicacion}"
                            data-producto-id="${c.producto_id ?? ''}"
                            title="${c.ubicacion} — ${etiqueta}">
                            <span class="celda-nivel">N${c.nivel}</span>
                            <span class="celda-texto">${etiqueta}</span>
                            ${ocupada ? `<span class="celda-stock">${Number(c.stock).toFixed(0)}</span>` : ''}
                          </div>`;
                })
                .join('');
              return `<div class="estante">
                        <div class="estante-label">E${String(estante).padStart(2, '0')}</div>
                        ${nivelesHtml}
                      </div>`;
            })
            .join('');
          return `<div class="pasillo">
                    <div class="pasillo-label">Pasillo ${pasillo}</div>
                    <div class="estantes">${estantesHtml}</div>
                  </div>`;
        })
        .join('');

      return `<section class="zona" style="--zona-color:${zona.color}">
                <header class="zona-head">
                  <span class="zona-badge">${zona.codigo}</span>
                  <h3>${zona.nombre}</h3>
                  <span class="zona-cons">${zona.conservacion}</span>
                </header>
                <div class="pasillos">${pasillosHtml}</div>
              </section>`;
    })
    .join('');

  mapa.querySelectorAll('.celda.ocupada, .celda.sin-stock').forEach((celda) => {
    celda.addEventListener('click', () => mostrarDetalleUbicacion(celda.dataset.ubicacion));
  });

  // Buscador de ubicación
  const buscador = container.querySelector('#layout-buscar');
  const resultado = container.querySelector('#layout-resultado-busqueda');
  buscador.addEventListener('input', () => {
    const texto = buscador.value.trim().toLowerCase();
    mapa.querySelectorAll('.celda').forEach((c) => c.classList.remove('resaltada'));
    if (texto.length < 2) {
      resultado.innerHTML = '';
      return;
    }
    const encontrados = (data ?? []).filter(
      (f) =>
        f.producto_id &&
        (f.producto?.toLowerCase().includes(texto) ||
          f.producto_codigo?.toLowerCase().includes(texto) ||
          f.ean13 === buscador.value.trim())
    );

    resultado.innerHTML = encontrados.length
      ? `<div class="resultados-ubicacion">${encontrados
          .slice(0, 10)
          .map(
            (f) => `<div class="resultado-item">
                      <b>${f.producto}</b>
                      <span class="ubicacion-chip">${f.ubicacion}</span>
                      <span class="resultado-meta">${f.zona} · stock ${Number(f.stock).toFixed(2)}</span>
                    </div>`
          )
          .join('')}</div>`
      : '<p class="nota">Sin coincidencias.</p>';

    encontrados.forEach((f) => {
      const celda = mapa.querySelector(`.celda[data-ubicacion="${f.ubicacion}"]`);
      celda?.classList.add('resaltada');
    });
    if (encontrados.length === 1) {
      mapa.querySelector(`.celda[data-ubicacion="${encontrados[0].ubicacion}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  async function mostrarDetalleUbicacion(codigoUbicacion) {
    const fila = (data ?? []).find((f) => f.ubicacion === codigoUbicacion && f.producto_id);
    if (!fila) return;

    const { data: lotes } = await supabase
      .from('lotes')
      .select('codigo_lote, fecha_caducidad, cantidad_disponible, costo_unitario')
      .eq('producto_id', fila.producto_id)
      .gt('cantidad_disponible', 0)
      .order('fecha_caducidad', { nullsFirst: false });

    abrirModal({
      titulo: `${fila.ubicacion} — ${fila.producto}`,
      contenido: `
        <div class="detalle-ubicacion">
          <div class="comp-linea"><span>Zona</span><b>${fila.zona}</b></div>
          <div class="comp-linea"><span>Código</span><b>${fila.producto_codigo}</b></div>
          <div class="comp-linea"><span>EAN-13</span><b>${fila.ean13 ?? '—'}</b></div>
          <div class="comp-linea"><span>Stock</span><b>${Number(fila.stock).toFixed(2)}</b></div>
          <div class="comp-linea"><span>Ocupación</span><b>${fila.porcentaje_ocupacion ?? '—'}%</b></div>
          <h4>Lotes disponibles</h4>
          ${
            lotes?.length
              ? `<table class="dyn-table"><thead><tr><th>Lote</th><th>Caducidad</th><th>Disponible</th></tr></thead>
                 <tbody>${lotes
                   .map(
                     (l) => `<tr><td>${l.codigo_lote}</td><td>${l.fecha_caducidad ?? '—'}</td>
                              <td>${Number(l.cantidad_disponible).toFixed(2)}</td></tr>`
                   )
                   .join('')}</tbody></table>`
              : '<p class="nota">Este producto no maneja lotes o no tiene existencias.</p>'
          }
        </div>`,
      botones: [{ texto: 'Cerrar', clase: 'btn-secundario', accion: cerrarModal }],
    });
  }
}
