// Mapa del local: dónde está físicamente cada producto.
//
// Cinco pestañas sobre los mismos datos:
//   Mapa        — planta en 2D, una celda por posición, con su ocupación.
//   Vista 3D    — el local dibujado con three.js, como se ve al entrar.
//   Posiciones  — la tabla, buscable y exportable.
//   Estructuras — dar de alta muebles y cambiarles columnas o niveles.
//   Ocupación   — qué tan llena está cada estructura.
//
// El código de posición es NAVE-LITERAL-COLUMNA-NIVEL (ECM-A-01-1), y
// esa cadena es lo que el bodeguero lee en voz alta, así que aparece
// literal en las cinco pestañas.

import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';
import { abrirModal, cerrarModal } from './lib/modal.js';
import { traducirErrorSupabase } from './lib/errores.js';
import { icono } from './lib/iconos.js';
import { botonesExportar, conectarExportar, metaDeEmpresa } from './lib/exportar.js';
import { empresaActual } from './lib/marca.js';

let estructuras = [];
let posiciones = [];
let escena = null;          // control de la escena 3D, si está creada

export async function renderLayout(container) {
  container.innerHTML = '<p class="loading">Cargando el mapa del local…</p>';

  const [{ data: estr, error: errE }, { data: pos, error: errP }] = await Promise.all([
    supabase.from('v_estructuras_ocupacion').select('*').order('orden').order('literal'),
    supabase.from('v_posiciones').select('*').order('codigo'),
  ]);

  if (errE) {
    container.innerHTML = traducirErrorSupabase(errE, 'v_estructuras_ocupacion');
    return;
  }
  if (errP) {
    container.innerHTML = traducirErrorSupabase(errP, 'v_posiciones');
    return;
  }

  estructuras = estr ?? [];
  posiciones = pos ?? [];

  const total = posiciones.length;
  const ocupadas = posiciones.filter((p) => p.producto_id).length;
  const sinStock = posiciones.filter((p) => p.producto_id && Number(p.stock) <= 0).length;

  container.innerHTML = `
    <div class="kpi-row">
      <div class="kpi-card"><span class="kpi-value">${estructuras.length}</span><span class="kpi-label">Muebles</span></div>
      <div class="kpi-card"><span class="kpi-value">${total}</span><span class="kpi-label">Posiciones</span></div>
      <div class="kpi-card"><span class="kpi-value">${ocupadas}</span><span class="kpi-label">Ocupadas</span></div>
      <div class="kpi-card"><span class="kpi-value">${total - ocupadas}</span><span class="kpi-label">Libres</span></div>
      <div class="kpi-card ${sinStock ? 'kpi-warning' : ''}">
        <span class="kpi-value">${sinStock}</span><span class="kpi-label">Sin stock</span></div>
    </div>

    <div class="panel buscador-layout">
      <label for="layout-buscar">Buscar un producto y ver dónde está</label>
      <input type="search" id="layout-buscar" placeholder="Nombre, marca, código o código de posición" />
      <div id="layout-resultado-busqueda" class="resultado-busqueda"></div>
    </div>

    <div class="tabs">
      <button class="tab active" data-v="mapa">Mapa del local</button>
      <button class="tab" data-v="tresd">Vista 3D</button>
      <button class="tab" data-v="tabla">Posiciones</button>
      <button class="tab" data-v="estructuras">Estructuras</button>
      <button class="tab" data-v="ocupacion">Ocupación</button>
    </div>
    <div id="layout-vista"></div>`;

  const vista = container.querySelector('#layout-vista');

  container.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      pintar(btn.dataset.v, vista, container);
    });
  });

  container.querySelector('#layout-buscar').addEventListener('input', (e) => {
    buscar(e.target.value, container);
  });

  pintar('mapa', vista, container);
}

/** Libera la escena 3D al salir del módulo. */
export function cerrarLayout() {
  if (escena) {
    escena.destruir();
    escena = null;
  }
}

function pintar(cual, vista, container) {
  // La escena 3D ocupa memoria de la tarjeta gráfica: se suelta al
  // cambiar de pestaña y se vuelve a crear si el usuario regresa.
  if (cual !== 'tresd') cerrarLayout();

  if (cual === 'mapa') vistaMapa(vista);
  else if (cual === 'tresd') vista3D(vista);
  else if (cual === 'tabla') vistaTabla(vista);
  else if (cual === 'estructuras') vistaEstructuras(vista, container);
  else vistaOcupacion(vista);
}

// =========================================================
// Mapa 2D
// =========================================================
function claseCelda(p) {
  if (!p.producto_id) return 'vacia';
  if (Number(p.stock) <= 0) return 'sin-stock';
  return 'ocupada';
}

function vistaMapa(destino) {
  if (!estructuras.length) {
    destino.innerHTML = `
      <div class="aviso-migracion">
        <h3>Todavía no hay muebles registrados</h3>
        <p>Dé de alta las estanterías, frigoríficos y el mostrador en la pestaña
        <b>Estructuras</b>. Cada mueble genera sus posiciones solo.</p>
      </div>`;
    return;
  }

  destino.innerHTML = `
    <div class="leyenda-mapa">
      <span><i class="pt ocupada"></i> Con producto y stock</span>
      <span><i class="pt sin-stock"></i> Asignada pero sin stock</span>
      <span><i class="pt vacia"></i> Libre</span>
      <span class="leyenda-nota">El código se lee NAVE-MUEBLE-COLUMNA-NIVEL. Clic en una posición para ver su detalle.</span>
    </div>
    <div class="mapa-local">
      ${estructuras.map((e) => bloqueEstructura(e)).join('')}
    </div>`;

  destino.querySelectorAll('.celda').forEach((celda) => {
    celda.addEventListener('click', () => abrirDetallePosicion(celda.dataset.codigo));
  });
}

function bloqueEstructura(e) {
  const suyas = posiciones.filter((p) => p.estructura_id === e.estructura_id);

  // Se dibuja de arriba hacia abajo: el nivel más alto arriba, como en
  // la percha real. Al revés obliga a leer el mapa al revés.
  const niveles = [];
  for (let n = e.niveles; n >= 1; n--) {
    const fila = [];
    for (let c = 1; c <= e.columnas; c++) {
      const p = suyas.find((x) => x.columna === c && x.nivel === n);
      if (!p) {
        fila.push('<div class="celda faltante" title="Posición no generada"></div>');
        continue;
      }
      fila.push(`
        <div class="celda ${claseCelda(p)}" data-codigo="${escapar(p.codigo)}"
             title="${escapar(p.codigo)}${p.producto ? ' · ' + escapar(p.producto) : ' · libre'}">
          <span class="celda-col">${String(c).padStart(2, '0')}</span>
          ${p.producto ? `<span class="celda-prod">${escapar(recortar(p.producto, 18))}</span>` : ''}
        </div>`);
    }
    niveles.push(`
      <div class="nivel-fila">
        <span class="nivel-etq" title="Nivel ${n}">${n}</span>
        ${fila.join('')}
      </div>`);
  }

  const claseTemp = e.temperatura === 'REFRIGERADO' ? 'frio'
                  : e.temperatura === 'CONGELADO' ? 'congelado' : '';

  return `
    <section class="zona estructura-2d ${claseTemp}" data-literal="${escapar(e.literal)}">
      <header class="estructura-cabecera">
        <span class="estructura-literal">${escapar(e.literal)}</span>
        <div>
          <b>${escapar(e.nombre)}</b>
          <small>${escapar(e.tipo_nombre)} · ${e.columnas} columnas × ${e.niveles} niveles</small>
        </div>
        <span class="estructura-ocupacion" title="Posiciones con producto asignado">
          ${e.ocupacion_pct}%
        </span>
      </header>
      <div class="estructura-rejilla">${niveles.join('')}</div>
    </section>`;
}

// =========================================================
// Vista 3D
// =========================================================
async function vista3D(destino) {
  destino.innerHTML = `
    <div class="panel panel-3d">
      <div class="barra-3d">
        <div class="vistas-3d">
          <button class="btn-vista activa" data-vista="general">Vista general</button>
          <button class="btn-vista" data-vista="frente">De frente</button>
          <button class="btn-vista" data-vista="pasillo">Desde el pasillo</button>
          <button class="btn-vista" data-vista="planta">Planta</button>
        </div>
        <span class="ayuda-3d">Arrastre para girar · rueda para acercar · clic derecho para desplazar</span>
      </div>
      <div id="lienzo-3d" class="lienzo-3d"><p class="loading">Preparando la escena…</p></div>
      <div id="detalle-3d" class="detalle-3d">
        Haga clic en cualquier posición para ver qué hay ahí.
      </div>
    </div>`;

  const lienzo = destino.querySelector('#lienzo-3d');
  const detalle = destino.querySelector('#detalle-3d');

  try {
    const { crearEscena } = await import('./lib/escena3d.js');
    lienzo.innerHTML = '';

    escena = await crearEscena(lienzo, {
      alSeleccionar: (info) => {
        if (!info) {
          detalle.innerHTML = 'Haga clic en cualquier posición para ver qué hay ahí.';
          detalle.className = 'detalle-3d';
          return;
        }
        detalle.className = 'detalle-3d con-dato';
        detalle.innerHTML = info.producto
          ? `<code class="pos-codigo">${escapar(info.codigo)}</code>
             <b>${escapar(info.producto)}</b>
             <span>${escapar(info.producto_codigo ?? '')} ·
               ${escapar(info.categoria ?? 'sin categoría')} ·
               stock ${Number(info.stock ?? 0).toFixed(2)} ${escapar(info.unidad ?? '')}</span>
             <button class="btn-mini" data-ver="${escapar(info.codigo)}">Ver detalle</button>`
          : `<code class="pos-codigo">${escapar(info.codigo)}</code>
             <b>Posición libre</b>
             <span>${escapar(info.estructura)} · columna ${info.columna}, nivel ${info.nivel}</span>`;

        detalle.querySelector('[data-ver]')?.addEventListener('click', (ev) => {
          abrirDetallePosicion(ev.target.dataset.ver);
        });
      },
    });

    escena.actualizar(estructuras, posiciones);

    destino.querySelectorAll('.btn-vista').forEach((b) => {
      b.addEventListener('click', () => {
        destino.querySelectorAll('.btn-vista').forEach((x) => x.classList.remove('activa'));
        b.classList.add('activa');
        escena?.vista(b.dataset.vista);
      });
    });

  } catch (err) {
    // Un equipo viejo sin aceleración de vídeo no puede dibujar WebGL.
    // Antes que dejar un cuadro negro sin explicación, se dice qué pasó
    // y se manda al usuario al mapa 2D, que muestra la misma información.
    console.error(err);
    lienzo.innerHTML = `
      <div class="aviso-migracion">
        <h3>Este equipo no puede dibujar la vista 3D</h3>
        <p class="nota">${escapar(err.message)}</p>
        <p class="nota">Suele pasar en computadoras sin aceleración de vídeo o con el
        navegador muy desactualizado. La pestaña <b>Mapa del local</b> muestra
        exactamente la misma información en dos dimensiones.</p>
      </div>`;
  }
}

// =========================================================
// Tabla de posiciones
// =========================================================
function filasTabla() {
  return posiciones.map((p) => ({
    codigo: p.codigo,
    estructura: `${p.literal} · ${p.estructura}`,
    columna: String(p.columna).padStart(2, '0'),
    nivel: p.nivel,
    producto: p.producto ?? 'Libre',
    producto_codigo: p.producto_codigo ?? '—',
    categoria: p.categoria ?? '—',
    stock: p.producto_id ? Number(p.stock).toFixed(2) : '—',
    unidad: p.producto_id ? (p.unidad ?? '') : '',
    temperatura: p.temperatura,
  }));
}

const COLUMNAS_TABLA = [
  { key: 'codigo', label: 'Posición' },
  { key: 'estructura', label: 'Mueble' },
  { key: 'columna', label: 'Col.' },
  { key: 'nivel', label: 'Nivel' },
  { key: 'producto', label: 'Producto' },
  { key: 'producto_codigo', label: 'Código' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'stock', label: 'Stock', numeric: true },
  { key: 'unidad', label: 'Unidad' },
];

function vistaTabla(destino) {
  destino.innerHTML = `
    <div class="panel">
      <div class="panel-cabecera">
        <h3>Todas las posiciones</h3>
        ${botonesExportar('pos')}
      </div>
      <p class="nota">El código se lee de izquierda a derecha: nave, mueble, columna
      y nivel. <code>ECM-A-01-1</code> es el nivel 1 de la primera columna de la
      estantería A en la matriz.</p>
    </div>
    <div id="tabla-posiciones"></div>`;

  renderTable(destino.querySelector('#tabla-posiciones'), {
    columns: COLUMNAS_TABLA,
    rows: filasTabla(),
    searchable: true,
    rowClass: (r) => (r.producto === 'Libre' ? 'row-warning' : ''),
    emptyMessage: 'No hay posiciones registradas.',
  });

  conectarExportar(destino, 'pos',
    () => ({ columnas: COLUMNAS_TABLA, filas: filasTabla() }),
    'Posiciones del local',
    () => metaDeEmpresa(empresaActual()));
}

// =========================================================
// Estructuras
// =========================================================
async function vistaEstructuras(destino, container) {
  const { data: tipos } = await supabase
    .from('tipos_estructura').select('*').order('orden');

  destino.innerHTML = `
    <div class="panel">
      <h3>Agregar un mueble</h3>
      <p class="nota">El literal se asigna solo: las estanterías toman la siguiente
      letra libre (A, B, C…) y los frigoríficos, neveras y mostradores el siguiente
      número de su prefijo (FR1, FR2…). Puede escribirlo a mano si prefiere otro.</p>
      <form id="form-estructura" class="inline-form">
        <select id="es-tipo" required>
          ${(tipos ?? []).map((t) =>
            `<option value="${t.codigo}" data-cols="${t.columnas_defecto}" data-niv="${t.niveles_defecto}">
               ${escapar(t.nombre)}
             </option>`).join('')}
        </select>
        <input type="text" id="es-nombre" placeholder="Nombre del mueble" required />
        <input type="text" id="es-literal" placeholder="Literal (opcional)" maxlength="4"
               pattern="[A-Za-z]{1,3}[0-9]{0,2}" />
        <input type="number" id="es-cols" min="1" max="99" value="4" title="Columnas" />
        <input type="number" id="es-niv" min="1" max="9" value="4" title="Niveles" />
        <button type="submit">Crear mueble</button>
        <span id="es-msg" class="form-msg"></span>
      </form>
      <p class="nota" id="es-descripcion"></p>
    </div>
    <div id="tabla-estructuras"></div>`;

  const sel = destino.querySelector('#es-tipo');
  const desc = destino.querySelector('#es-descripcion');

  function refrescarTipo() {
    const op = sel.selectedOptions[0];
    destino.querySelector('#es-cols').value = op?.dataset.cols ?? 4;
    destino.querySelector('#es-niv').value = op?.dataset.niv ?? 4;
    const t = (tipos ?? []).find((x) => x.codigo === sel.value);
    desc.textContent = t ? `${t.descripcion} Medidas típicas: ${t.ancho_cm} × ${t.alto_cm} × ${t.fondo_cm} cm.` : '';
  }
  sel.addEventListener('change', refrescarTipo);
  refrescarTipo();

  destino.querySelector('#form-estructura').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = destino.querySelector('#es-msg');
    msg.textContent = 'Creando…';
    msg.className = 'form-msg';

    const { error } = await supabase.rpc('fn_crear_estructura', {
      p_tipo: sel.value,
      p_nombre: destino.querySelector('#es-nombre').value.trim(),
      p_literal: destino.querySelector('#es-literal').value.trim() || null,
      p_columnas: Number(destino.querySelector('#es-cols').value),
      p_niveles: Number(destino.querySelector('#es-niv').value),
    });

    if (error) {
      msg.textContent = error.message;
      msg.className = 'form-msg error';
      return;
    }
    msg.textContent = 'Mueble creado con sus posiciones.';
    msg.className = 'form-msg ok';
    await renderLayout(container);
  });

  renderTable(destino.querySelector('#tabla-estructuras'), {
    columns: [
      { key: 'literal', label: 'Literal' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'tipo_nombre', label: 'Tipo' },
      { key: 'medida', label: 'Columnas × niveles' },
      { key: 'posiciones', label: 'Posiciones', numeric: true },
      { key: 'ocupacion_pct', label: 'Ocupación %', numeric: true },
      { key: 'acciones', label: 'Cambiar tamaño' },
    ],
    rows: estructuras.map((e) => ({
      ...e,
      medida: `${e.columnas} × ${e.niveles}`,
      acciones: '',
    })),
    searchable: true,
    emptyMessage: 'No hay muebles registrados.',
  });

  destino.querySelectorAll('#tabla-estructuras tbody tr').forEach((tr, i) => {
    const e = estructuras[i];
    if (!e) return;
    tr.lastElementChild.innerHTML =
      `<button class="btn-mini" data-redim="${e.estructura_id}">Columnas / niveles</button>`;
  });

  destino.querySelectorAll('[data-redim]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const e = estructuras.find((x) => x.estructura_id === btn.dataset.redim);
      if (e) abrirRedimensionar(e, container);
    });
  });
}

function abrirRedimensionar(e, container) {
  abrirModal({
    titulo: `${e.literal} — ${e.nombre}`,
    contenido: `
      <p class="nota">Crecer agrega las posiciones nuevas al instante. Encoger solo
      se permite si las posiciones que desaparecen están vacías: si alguna tiene
      producto, el sistema dice cuál y no borra nada.</p>
      <div class="redim-campos">
        <label>Columnas
          <input type="number" id="rd-cols" min="1" max="99" value="${e.columnas}" />
        </label>
        <label>Niveles
          <input type="number" id="rd-niv" min="1" max="9" value="${e.niveles}" />
        </label>
        <div class="redim-total">
          Posiciones: <b id="rd-total">${e.columnas * e.niveles}</b>
          <small>(hoy ${e.posiciones}, ${e.posiciones_ocupadas} con producto)</small>
        </div>
      </div>
      <div id="rd-msg" class="form-msg"></div>`,
    botones: [
      { texto: 'Cancelar', clase: 'btn-secundario', accion: cerrarModal },
      { texto: 'Aplicar', clase: 'btn-primary', accion: aplicar },
    ],
    alAbrir: (modal) => {
      const recalcular = () => {
        modal.querySelector('#rd-total').textContent =
          Number(modal.querySelector('#rd-cols').value) *
          Number(modal.querySelector('#rd-niv').value);
      };
      modal.querySelector('#rd-cols').addEventListener('input', recalcular);
      modal.querySelector('#rd-niv').addEventListener('input', recalcular);
    },
  });

  async function aplicar() {
    const modal = document.querySelector('.modal');
    const msg = modal.querySelector('#rd-msg');
    msg.textContent = 'Aplicando…';
    msg.className = 'form-msg';

    const { error } = await supabase.rpc('fn_redimensionar_estructura', {
      p_estructura_id: e.estructura_id,
      p_columnas: Number(modal.querySelector('#rd-cols').value),
      p_niveles: Number(modal.querySelector('#rd-niv').value),
    });

    if (error) {
      msg.textContent = error.message;
      msg.className = 'form-msg error';
      return;
    }
    cerrarModal();
    await renderLayout(container);
  }
}

// =========================================================
// Ocupación
// =========================================================
function vistaOcupacion(destino) {
  const ordenadas = [...estructuras].sort((a, b) => b.ocupacion_pct - a.ocupacion_pct);

  const estado = (pct) =>
    pct >= 95 ? 'Saturada' : pct >= 75 ? 'Alta' : pct >= 35 ? 'Holgada' : 'Subutilizada';

  const filas = ordenadas.map((e) => ({
    literal: e.literal,
    nombre: e.nombre,
    tipo: e.tipo_nombre,
    posiciones: e.posiciones,
    ocupadas: e.posiciones_ocupadas,
    libres: e.posiciones - e.posiciones_ocupadas,
    ocupacion: `${e.ocupacion_pct}%`,
    estado: estado(Number(e.ocupacion_pct)),
  }));

  const columnas = [
    { key: 'literal', label: 'Literal' },
    { key: 'nombre', label: 'Mueble' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'posiciones', label: 'Posiciones', numeric: true },
    { key: 'ocupadas', label: 'Ocupadas', numeric: true },
    { key: 'libres', label: 'Libres', numeric: true },
    { key: 'ocupacion', label: 'Ocupación' },
    { key: 'estado', label: 'Estado' },
  ];

  destino.innerHTML = `
    <div class="panel">
      <div class="panel-cabecera">
        <h3>Qué tan llenos están los muebles</h3>
        ${botonesExportar('ocu')}
      </div>
      <p class="nota">El valor va como etiqueta sobre cada barra: leer una barra
      contra un eje obliga a estimar, y aquí el número exacto importa.</p>
      <div class="barras-ocupacion">
        ${ordenadas.map((e) => `
          <div class="barra-fila">
            <span class="barra-etq" title="${escapar(e.nombre)}">
              ${escapar(e.literal)} · ${escapar(recortar(e.nombre, 26))}
            </span>
            <div class="barra-pista">
              <div class="barra-valor ${Number(e.ocupacion_pct) >= 95 ? 'saturada' : ''}"
                   style="width:${Math.max(Number(e.ocupacion_pct), 1.5)}%"></div>
            </div>
            <span class="barra-numero">${e.ocupacion_pct}%</span>
          </div>`).join('')}
      </div>
    </div>
    <div id="tabla-ocupacion"></div>`;

  renderTable(destino.querySelector('#tabla-ocupacion'), {
    columns: columnas,
    rows: filas,
    rowClass: (r) => (r.estado === 'Saturada' ? 'row-error'
                    : r.estado === 'Subutilizada' ? 'row-warning' : ''),
    emptyMessage: 'No hay muebles registrados.',
  });

  conectarExportar(destino, 'ocu',
    () => ({ columnas, filas }),
    'Ocupación por mueble',
    () => metaDeEmpresa(empresaActual()));
}

// =========================================================
// Búsqueda y detalle
// =========================================================
function buscar(texto, container) {
  const salida = container.querySelector('#layout-resultado-busqueda');
  const t = texto.trim().toLowerCase();

  container.querySelectorAll('.celda.resaltada').forEach((c) => c.classList.remove('resaltada'));

  if (t.length < 2) {
    salida.innerHTML = '';
    return;
  }

  const hallados = posiciones.filter((p) =>
    (p.producto ?? '').toLowerCase().includes(t) ||
    (p.marca ?? '').toLowerCase().includes(t) ||
    (p.producto_codigo ?? '').toLowerCase().includes(t) ||
    (p.codigo ?? '').toLowerCase().includes(t));

  if (!hallados.length) {
    salida.innerHTML = '<span class="sin-resultado">Nada con ese nombre o código.</span>';
    return;
  }

  salida.innerHTML = hallados.slice(0, 12).map((p) => `
    <button class="chip-ubicacion" data-codigo="${escapar(p.codigo)}">
      <code>${escapar(p.codigo)}</code>
      <span>${escapar(p.producto ?? 'libre')}</span>
    </button>`).join('') +
    (hallados.length > 12 ? `<span class="sin-resultado">y ${hallados.length - 12} más…</span>` : '');

  for (const p of hallados) {
    container.querySelector(`.celda[data-codigo="${cssEscapar(p.codigo)}"]`)
      ?.classList.add('resaltada');
  }

  salida.querySelectorAll('.chip-ubicacion').forEach((b) => {
    b.addEventListener('click', () => abrirDetallePosicion(b.dataset.codigo));
  });
}

async function abrirDetallePosicion(codigo) {
  const p = posiciones.find((x) => x.codigo === codigo);
  if (!p) return;

  abrirModal({
    titulo: `Posición ${codigo}`,
    contenido: `
      <div class="comprobante">
        <div class="comp-linea"><span>Mueble</span><b>${escapar(p.literal)} · ${escapar(p.estructura)}</b></div>
        <div class="comp-linea"><span>Columna / nivel</span><b>${String(p.columna).padStart(2, '0')} / ${p.nivel}</b></div>
        <div class="comp-linea"><span>Conservación</span><b>${escapar(p.temperatura)}</b></div>
        ${p.producto ? `
          <div class="comp-linea"><span>Producto</span><b>${escapar(p.producto)}</b></div>
          <div class="comp-linea"><span>Código</span><b>${escapar(p.producto_codigo ?? '')}</b></div>
          <div class="comp-linea"><span>Categoría</span><b>${escapar(p.categoria ?? '—')}</b></div>
          <div class="comp-linea grande"><span>Stock</span>
            <b>${Number(p.stock).toFixed(2)} ${escapar(p.unidad ?? '')}</b></div>
        ` : '<p class="nota">Esta posición está libre.</p>'}
      </div>
      <div id="lotes-posicion">${p.producto_id ? '<p class="loading">Cargando lotes…</p>' : ''}</div>`,
    botones: [{ texto: 'Cerrar', clase: 'btn-primary', accion: cerrarModal }],
    alAbrir: async (modal) => {
      if (!p.producto_id) return;
      const caja = modal.querySelector('#lotes-posicion');

      const { data, error } = await supabase
        .from('v_lotes_disponibles')
        .select('codigo_lote, fecha_caducidad, cantidad_disponible')
        .eq('producto_id', p.producto_id)
        .limit(20);

      if (error) {
        caja.innerHTML = '<p class="nota">No se pudieron leer los lotes.</p>';
        return;
      }
      if (!data?.length) {
        caja.innerHTML = '<p class="nota">Lotes disponibles: este producto no maneja lotes.</p>';
        return;
      }

      caja.innerHTML = `
        <h4>Lotes disponibles</h4>
        <table class="dyn-table">
          <thead><tr><th>Lote</th><th>Caduca</th><th>Disponible</th></tr></thead>
          <tbody>
            ${data.map((l) => `
              <tr>
                <td>${escapar(l.codigo_lote ?? '—')}</td>
                <td>${l.fecha_caducidad
                      ? new Date(l.fecha_caducidad + 'T00:00:00').toLocaleDateString('es-EC')
                      : '—'}</td>
                <td>${Number(l.cantidad_disponible).toFixed(2)}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    },
  });
}

// =========================================================
function recortar(t, n) {
  const s = String(t ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML.replace(/"/g, '&quot;');
}

function cssEscapar(t) {
  return String(t ?? '').replace(/["\\]/g, '\\$&');
}
