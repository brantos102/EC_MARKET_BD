import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';
import { abrirModal, cerrarModal } from './lib/modal.js';
import { traducirErrorSupabase } from './lib/errores.js';

let datos = [];

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
    container.innerHTML = traducirErrorSupabase(error, 'v_ocupacion_layout');
    return;
  }
  datos = data ?? [];

  const totalUbic = new Set(datos.map((f) => f.ubicacion_id)).size;
  const ocupadas = new Set(datos.filter((f) => f.producto_id).map((f) => f.ubicacion_id)).size;
  const zonas = new Set(datos.map((f) => f.zona_codigo)).size;

  container.innerHTML = `
    <div class="kpi-row">
      <div class="kpi-card"><span class="kpi-label">Zonas</span><span class="kpi-value">${zonas}</span></div>
      <div class="kpi-card"><span class="kpi-label">Ubicaciones</span><span class="kpi-value">${totalUbic}</span></div>
      <div class="kpi-card">
        <span class="kpi-label">Ocupadas</span>
        <span class="kpi-value">${ocupadas}</span>
        <span class="kpi-sub">${totalUbic ? Math.round((ocupadas / totalUbic) * 100) : 0}% del total</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Libres</span>
        <span class="kpi-value">${totalUbic - ocupadas}</span>
      </div>
    </div>

    <div class="panel">
      <input type="search" id="layout-buscar" class="buscador-layout"
             placeholder="Buscar un producto para ver dónde está ubicado..." />
      <div id="layout-resultado-busqueda"></div>
    </div>

    <div class="tabs">
      <button class="tab active" data-v="mapa">Mapa 2D</button>
      <button class="tab" data-v="tresd">Vista 3D</button>
      <button class="tab" data-v="tabla">Tabla de posiciones</button>
      <button class="tab" data-v="ocupacion">Análisis de ocupación</button>
    </div>
    <div id="layout-vista"></div>
  `;

  const vista = container.querySelector('#layout-vista');
  container.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      pintarVista(btn.dataset.v, vista);
    });
  });

  pintarVista('mapa', vista);
  activarBuscador(container);
}

function pintarVista(cual, destino) {
  if (cual === 'mapa') vistaMapa(destino);
  else if (cual === 'tresd') vista3D(destino);
  else if (cual === 'tabla') vistaTabla(destino);
  else vistaOcupacion(destino);
}

// ---------------------------------------------------------
// Agrupación común
// ---------------------------------------------------------
function agruparPorZona() {
  const zonas = new Map();
  for (const f of datos) {
    if (!zonas.has(f.zona_codigo)) {
      zonas.set(f.zona_codigo, {
        codigo: f.zona_codigo, nombre: f.zona, color: f.color_hex,
        conservacion: f.tipo_conservacion, filas: [],
      });
    }
    zonas.get(f.zona_codigo).filas.push(f);
  }
  return zonas;
}

// ---------------------------------------------------------
// Vista 1: mapa 2D
// ---------------------------------------------------------
function vistaMapa(destino) {
  const zonas = agruparPorZona();

  destino.innerHTML = `<div class="leyenda-mapa">
      <span><i class="lg ocupada"></i> con producto</span>
      <span><i class="lg sin-stock"></i> producto sin existencia</span>
      <span><i class="lg vacia"></i> libre</span>
    </div>
    <div class="mapa-market">` +
    [...zonas.values()].map((zona) => {
      const pasillos = new Map();
      for (const f of zona.filas) {
        if (!pasillos.has(f.pasillo)) pasillos.set(f.pasillo, new Map());
        const p = pasillos.get(f.pasillo);
        if (!p.has(f.estante)) p.set(f.estante, []);
        p.get(f.estante).push(f);
      }

      const pasillosHtml = [...pasillos.entries()].map(([pasillo, estantes]) => {
        const estantesHtml = [...estantes.entries()].map(([estante, celdas]) => {
          const niveles = celdas.sort((a, b) => b.nivel - a.nivel).map((c) => {
            const ocupada = Boolean(c.producto_id);
            const sinStock = ocupada && Number(c.stock) <= 0;
            const clase = !ocupada ? 'vacia' : sinStock ? 'sin-stock' : 'ocupada';
            return `<div class="celda ${clase}" data-ubicacion="${c.ubicacion}"
                      title="${c.ubicacion} — ${ocupada ? c.producto : 'libre'}">
                      <span class="celda-nivel">N${c.nivel}</span>
                      <span class="celda-texto">${ocupada ? c.producto : 'libre'}</span>
                      ${ocupada ? `<span class="celda-stock">${Number(c.stock).toFixed(0)}</span>` : ''}
                    </div>`;
          }).join('');
          return `<div class="estante">
                    <div class="estante-label">E${String(estante).padStart(2, '0')}</div>${niveles}
                  </div>`;
        }).join('');
        return `<div class="pasillo">
                  <div class="pasillo-label">Pasillo ${pasillo}</div>
                  <div class="estantes">${estantesHtml}</div>
                </div>`;
      }).join('');

      return `<section class="zona" style="--zona-color:${zona.color}">
                <header class="zona-head">
                  <span class="zona-badge">${zona.codigo}</span>
                  <h3>${zona.nombre}</h3>
                  <span class="zona-cons">${zona.conservacion}</span>
                </header>
                <div class="pasillos">${pasillosHtml}</div>
              </section>`;
    }).join('') + '</div>';

  destino.querySelectorAll('.celda.ocupada, .celda.sin-stock').forEach((celda) => {
    celda.addEventListener('click', () => detalleUbicacion(celda.dataset.ubicacion));
  });
}

// ---------------------------------------------------------
// Vista 2: 3D en perspectiva.
// Se dibuja con transformaciones CSS 3D en vez de una librería
// como three.js: no agrega dependencias, funciona sin conexión y
// es suficiente para leer altura de nivel y profundidad de pasillo.
// ---------------------------------------------------------
function vista3D(destino) {
  const zonas = agruparPorZona();

  destino.innerHTML = `
    <div class="panel controles-3d">
      <label>Giro horizontal <input type="range" id="rot-y" min="-60" max="60" value="-28" /></label>
      <label>Inclinación <input type="range" id="rot-x" min="0" max="60" value="22" /></label>
      <label>Zoom <input type="range" id="zoom-3d" min="40" max="160" value="115" /></label>
      <select id="zona-3d">${[...zonas.values()].map((z) => `<option value="${z.codigo}">${z.nombre}</option>`).join('')}</select>
      <span class="nota">Arrastra los controles para girar la estantería. Haz clic en una caja para ver su contenido.</span>
    </div>
    <div class="escena-3d"><div class="mundo-3d" id="mundo"><div class="grupo-3d" id="grupo"></div></div></div>
  `;

  const mundo = destino.querySelector('#mundo');
  const grupo = destino.querySelector('#grupo');
  const selZona = destino.querySelector('#zona-3d');

  function dibujar() {
    const zona = zonas.get(selZona.value);
    if (!zona) return;

    const pasillos = [...new Set(zona.filas.map((f) => f.pasillo))].sort();
    const ANCHO = 74, ALTO = 40, PROF = 92;

    const maxEstante = Math.max(...zona.filas.map((f) => f.estante));
    const maxNivel = Math.max(...zona.filas.map((f) => f.nivel));

    // La escena se centra en el origen calculando la extensión real que
    // ocupan las cajas. Sin esto el conjunto crece hacia la derecha y hacia
    // abajo desde el origen y se sale de cuadro al rotar.
    //   X: de 0 a (maxEstante-1)*paso + ancho de caja
    //   Y: de -(maxNivel-1)*paso a +alto de caja (los niveles suben)
    //   Z: de -(pasillos-1)*profundidad a 0
    const anchoTotal = (maxEstante - 1) * (ANCHO + 8) + ANCHO;
    const centroY = ((maxNivel - 1) * (ALTO + 4) - ALTO) / 2;
    const centroZ = ((pasillos.length - 1) * PROF) / 2;
    grupo.style.transform =
      `translate3d(${-anchoTotal / 2}px, ${centroY}px, ${centroZ}px)`;

    grupo.innerHTML = zona.filas.map((f) => {
      const x = (f.estante - 1) * (ANCHO + 8);
      const y = -(f.nivel - 1) * (ALTO + 4);
      const z = pasillos.indexOf(f.pasillo) * PROF;
      const ocupada = Boolean(f.producto_id);
      const sinStock = ocupada && Number(f.stock) <= 0;
      const clase = !ocupada ? 'vacia' : sinStock ? 'sin-stock' : 'ocupada';
      return `<div class="caja-3d ${clase}" data-ubicacion="${f.ubicacion}"
                style="transform: translate3d(${x}px, ${y}px, ${-z}px)"
                title="${f.ubicacion} — ${ocupada ? f.producto : 'libre'}">
                <span class="caja-cod">${f.ubicacion}</span>
                <span class="caja-prod">${ocupada ? f.producto : ''}</span>
              </div>`;
    }).join('') +
    // Un piso por pasillo, dimensionado al ancho real de la estantería
    pasillos.map((p, i) => `<div class="piso-3d"
        style="width:${anchoTotal + 20}px; transform: translate3d(-10px, ${ALTO + 6}px, ${-i * PROF}px) rotateX(90deg)">
        <span>Pasillo ${p}</span></div>`).join('');

    grupo.querySelectorAll('.caja-3d.ocupada, .caja-3d.sin-stock').forEach((c) => {
      c.addEventListener('click', () => detalleUbicacion(c.dataset.ubicacion));
    });
  }

  function aplicarTransformacion() {
    const ry = destino.querySelector('#rot-y').value;
    const rx = destino.querySelector('#rot-x').value;
    const zoom = destino.querySelector('#zoom-3d').value / 100;
    mundo.style.transform = `scale(${zoom}) rotateX(${rx}deg) rotateY(${ry}deg)`;
  }

  ['#rot-y', '#rot-x', '#zoom-3d'].forEach((sel) =>
    destino.querySelector(sel).addEventListener('input', aplicarTransformacion)
  );
  selZona.addEventListener('change', dibujar);

  dibujar();
  aplicarTransformacion();
}

// ---------------------------------------------------------
// Vista 3: tabla dinámica de posiciones
// ---------------------------------------------------------
function vistaTabla(destino) {
  destino.innerHTML = '<div id="tabla-posiciones"></div>';
  renderTable(destino.querySelector('#tabla-posiciones'), {
    columns: [
      { key: 'ubicacion', label: 'Ubicación' },
      { key: 'zona', label: 'Zona' },
      { key: 'pasillo', label: 'Pasillo' },
      { key: 'estante', label: 'Estante', numeric: true },
      { key: 'nivel', label: 'Nivel', numeric: true },
      { key: 'producto_codigo', label: 'Código' },
      { key: 'producto', label: 'Producto' },
      { key: 'ean13', label: 'EAN-13' },
      { key: 'stock', label: 'Stock', numeric: true, format: (v) => Number(v ?? 0).toFixed(2) },
      { key: 'porcentaje_ocupacion', label: '% ocupación', numeric: true,
        format: (v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(1)}%`) },
      { key: 'estado', label: 'Estado' },
    ],
    rows: datos.map((f) => ({
      ...f,
      producto: f.producto ?? '(libre)',
      producto_codigo: f.producto_codigo ?? '—',
      ean13: f.ean13 ?? '—',
      estado: !f.producto_id ? 'Libre' : Number(f.stock) <= 0 ? 'Sin existencia' : 'Con producto',
    })),
    rowClass: (r) =>
      r.estado === 'Sin existencia' ? 'row-warning' : r.estado === 'Libre' ? '' : 'row-ok',
    emptyMessage: 'No hay ubicaciones registradas.',
  });
}

// ---------------------------------------------------------
// Vista 4: análisis de ocupación
// Barras horizontales de una sola serie (magnitud comparada entre
// zonas). Una serie = sin leyenda; el título nombra la medida y cada
// barra lleva su valor como etiqueta directa.
// ---------------------------------------------------------
function vistaOcupacion(destino) {
  const zonas = agruparPorZona();

  const resumen = [...zonas.values()].map((z) => {
    const ubicaciones = new Set(z.filas.map((f) => f.ubicacion_id)).size;
    const ocupadas = new Set(z.filas.filter((f) => f.producto_id).map((f) => f.ubicacion_id)).size;
    const sinStock = z.filas.filter((f) => f.producto_id && Number(f.stock) <= 0).length;
    const unidades = z.filas.reduce((a, f) => a + Number(f.stock || 0), 0);
    const pct = ubicaciones ? (ocupadas / ubicaciones) * 100 : 0;
    return {
      zona: z.nombre, codigo: z.codigo, conservacion: z.conservacion,
      ubicaciones, ocupadas, libres: ubicaciones - ocupadas, sinStock, unidades, pct,
      estado: pct >= 90 ? 'Saturada' : pct >= 70 ? 'Alta' : pct >= 30 ? 'Holgada' : 'Subutilizada',
    };
  }).sort((a, b) => b.pct - a.pct);

  const maxPct = Math.max(100, ...resumen.map((r) => r.pct));

  destino.innerHTML = `
    <div class="panel viz-root">
      <h3>Ocupación de ubicaciones por zona</h3>
      <p class="nota">Porcentaje de posiciones que tienen un producto asignado, sobre el total de posiciones de la zona.</p>
      <div class="barras-ocupacion">
        ${resumen.map((r) => `
          <div class="barra-fila">
            <span class="barra-etiqueta" title="${r.zona}">${r.codigo} · ${r.zona}</span>
            <div class="barra-pista">
              <div class="barra-valor" style="width:${(r.pct / maxPct) * 100}%"></div>
            </div>
            <span class="barra-numero">${r.pct.toFixed(0)}%</span>
          </div>`).join('')}
      </div>
    </div>

    <div class="panel">
      <h3>Detalle por zona</h3>
      <div id="tabla-ocupacion"></div>
    </div>
  `;

  renderTable(destino.querySelector('#tabla-ocupacion'), {
    columns: [
      { key: 'codigo', label: 'Zona' },
      { key: 'zona', label: 'Nombre' },
      { key: 'conservacion', label: 'Conservación' },
      { key: 'ubicaciones', label: 'Posiciones', numeric: true },
      { key: 'ocupadas', label: 'Ocupadas', numeric: true },
      { key: 'libres', label: 'Libres', numeric: true },
      { key: 'sinStock', label: 'Sin existencia', numeric: true },
      { key: 'unidades', label: 'Unidades', numeric: true, format: (v) => Number(v).toFixed(0) },
      { key: 'pctTexto', label: '% ocupación', numeric: false },
      { key: 'estado', label: 'Estado' },
    ],
    rows: resumen.map((r) => ({ ...r, pctTexto: `${r.pct.toFixed(1)}%` })),
    searchable: false,
    rowClass: (r) => (r.estado === 'Saturada' ? 'row-warning' : ''),
    emptyMessage: 'Sin zonas registradas.',
  });
}

// ---------------------------------------------------------
// Buscador de ubicación
// ---------------------------------------------------------
function activarBuscador(container) {
  const buscador = container.querySelector('#layout-buscar');
  const resultado = container.querySelector('#layout-resultado-busqueda');

  buscador.addEventListener('input', () => {
    const texto = buscador.value.trim().toLowerCase();
    container.querySelectorAll('.celda, .caja-3d').forEach((c) => c.classList.remove('resaltada'));

    if (texto.length < 2) {
      resultado.innerHTML = '';
      return;
    }

    const encontrados = datos.filter(
      (f) => f.producto_id &&
        (f.producto?.toLowerCase().includes(texto) ||
         f.producto_codigo?.toLowerCase().includes(texto) ||
         f.ean13 === buscador.value.trim())
    );

    resultado.innerHTML = encontrados.length
      ? `<div class="resultados-ubicacion">${encontrados.slice(0, 10).map((f) =>
          `<div class="resultado-item">
             <b>${f.producto}</b>
             <span class="ubicacion-chip">${f.ubicacion}</span>
             <span class="resultado-meta">${f.zona} · stock ${Number(f.stock).toFixed(2)}</span>
           </div>`).join('')}</div>`
      : '<p class="nota">Sin coincidencias.</p>';

    encontrados.forEach((f) => {
      container.querySelectorAll(`[data-ubicacion="${f.ubicacion}"]`)
        .forEach((el) => el.classList.add('resaltada'));
    });
    if (encontrados.length === 1) {
      container.querySelector(`.celda[data-ubicacion="${encontrados[0].ubicacion}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

// ---------------------------------------------------------
// Detalle de una ubicación
// ---------------------------------------------------------
async function detalleUbicacion(codigoUbicacion) {
  const fila = datos.find((f) => f.ubicacion === codigoUbicacion && f.producto_id);
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
        <div class="comp-linea"><span>Pasillo / Estante / Nivel</span><b>${fila.pasillo} · E${fila.estante} · N${fila.nivel}</b></div>
        <div class="comp-linea"><span>Código</span><b>${fila.producto_codigo}</b></div>
        <div class="comp-linea"><span>EAN-13</span><b>${fila.ean13 ?? '—'}</b></div>
        <div class="comp-linea"><span>Stock</span><b>${Number(fila.stock).toFixed(2)}</b></div>
        <div class="comp-linea"><span>Ocupación de la posición</span><b>${fila.porcentaje_ocupacion ?? '—'}%</b></div>
        <h4>Lotes disponibles</h4>
        ${lotes?.length
          ? `<table class="dyn-table"><thead><tr><th>Lote</th><th>Caducidad</th><th>Disponible</th></tr></thead>
             <tbody>${lotes.map((l) => `<tr><td>${l.codigo_lote}</td><td>${l.fecha_caducidad ?? '—'}</td>
               <td>${Number(l.cantidad_disponible).toFixed(2)}</td></tr>`).join('')}</tbody></table>
             <p class="nota">El primero de la lista es el que sale al vender (FEFO).</p>`
          : '<p class="nota">Este producto no maneja lotes o no tiene existencias.</p>'}
      </div>`,
    botones: [{ texto: 'Cerrar', clase: 'btn-secundario', accion: cerrarModal }],
  });
}
