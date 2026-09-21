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
      <button class="tab" data-v="acomodar">Acomodar el local</button>
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

/** Libera la escena 3D y el editor del plano al salir del módulo. */
export function cerrarLayout() {
  if (escena) {
    escena.destruir();
    escena = null;
  }
  if (editorPlano) {
    editorPlano.destruir();
    editorPlano = null;
  }
}

function pintar(cual, vista, container) {
  // La escena 3D ocupa memoria de la tarjeta gráfica: se suelta al
  // cambiar de pestaña y se vuelve a crear si el usuario regresa.
  if (cual !== 'tresd' && cual !== 'acomodar') cerrarLayout();
  else if (cual === 'tresd' && editorPlano) { editorPlano.destruir(); editorPlano = null; }
  else if (cual === 'acomodar' && escena) { escena.destruir(); escena = null; }

  if (cual === 'mapa') vistaMapa(vista);
  else if (cual === 'tresd') vista3D(vista);
  else if (cual === 'acomodar') vistaAcomodar(vista, container);
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
// Acomodar el local: arrastrar los muebles a donde están
//
// El plano 3D dibujaba los muebles en fila porque nadie le había dicho
// dónde están de verdad. Aquí se le dice, arrastrando sobre la planta.
// Lo que se acomoda en esta pestaña es exactamente lo que se ve en la
// vista 3D: leen las mismas coordenadas.
// =========================================================
let editorPlano = null;

async function vistaAcomodar(destino, container) {
  destino.innerHTML = `
    <div class="panel">
      <div class="acomodar-barra">
        <div class="acomodar-acciones">
          <button type="button" id="ac-girar" class="btn-secundario" disabled>Girar 90°</button>
          <button type="button" id="ac-guardar" class="btn-primary" disabled>Guardar posición</button>
          <button type="button" id="ac-local" class="btn-secundario">Medidas del local</button>
        </div>
        <span class="ayuda-3d">Arrastre cada mueble a donde está en la tienda. Se pega a la
        rejilla de 10 cm y no se puede sacar de la sala.</span>
      </div>

      <div class="acomodar-cuerpo">
        <div id="plano-editor" class="plano-editor"></div>
        <aside class="acomodar-ficha" id="ac-ficha">
          <p class="nota">Toque un mueble para acomodarlo.</p>
        </aside>
      </div>
      <p id="ac-msg" class="form-msg"></p>
    </div>`;

  const msg = destino.querySelector('#ac-msg');
  const ficha = destino.querySelector('#ac-ficha');
  const btnGirar = destino.querySelector('#ac-girar');
  const btnGuardar = destino.querySelector('#ac-guardar');

  let actual = null;
  let pendiente = null;      // {id, x, y, rot}

  const { crearEditorPlano } = await import('./lib/plano-editor.js');

  editorPlano = crearEditorPlano(destino.querySelector('#plano-editor'), {
    estructuras,
    alSeleccionar: (e) => {
      actual = e;
      btnGirar.disabled = !e;
      pintarFicha(e);
    },
    alMover: (id, x, y, rot) => {
      pendiente = { id, x, y, rot };
      btnGuardar.disabled = false;
      msg.textContent = 'Movido. Pulse «Guardar posición» para dejarlo así.';
      msg.className = 'form-msg';
    },
  });

  function pintarFicha(e) {
    if (!e) {
      ficha.innerHTML = '<p class="nota">Toque un mueble para acomodarlo.</p>';
      return;
    }
    ficha.innerHTML = `
      <h4>${escapar(e.literal)} · ${escapar(e.nombre)}</h4>
      <div class="comp-linea"><span>Tipo</span><b>${escapar(e.tipo_nombre ?? e.tipo)}</b></div>
      <div class="comp-linea"><span>Medidas</span><b>${e.ancho_cm} × ${e.fondo_cm} × ${e.alto_cm} cm</b></div>
      <div class="comp-linea"><span>Posiciones</span><b>${e.columnas} columnas × ${e.niveles} niveles</b></div>
      <div class="comp-linea"><span>Esquina</span><b>x ${e.pos_x_cm} · y ${e.pos_y_cm} cm</b></div>
      <div class="comp-linea"><span>Giro</span><b>${e.rotacion_grados ?? 0}°</b></div>
      <label class="ancho-completo">Calle o pasillo
        <input type="text" id="ac-calle" value="${escapar(e.calle ?? '')}"
               placeholder="Calle 1, Fondo, Caja…" />
      </label>
      <p class="nota">La calle no entra en el código de posición —ese ya está impreso en la
      percha— pero sí en la dirección que se le da a una persona:
      «${escapar(e.calle || 'Calle 1')}, ${escapar(e.literal)}, columna 03, nivel 1».</p>`;
  }

  btnGirar.addEventListener('click', () => {
    if (!actual) return;
    const e = editorPlano.girar(actual.estructura_id ?? actual.id, 90);
    actual = e;
    pintarFicha(e);
  });

  btnGuardar.addEventListener('click', async () => {
    if (!pendiente) return;
    btnGuardar.disabled = true;
    msg.textContent = 'Guardando…';
    msg.className = 'form-msg';

    const calle = destino.querySelector('#ac-calle')?.value?.trim() ?? null;
    const r = await guardarMovimiento(pendiente, calle, false);

    if (r?.estado === 'SOLAPE') {
      // No se guarda por las malas: hay casos reales en que dos muebles
      // sí comparten lugar (un frigorífico empotrado en una góndola),
      // así que se pregunta en vez de decidir por el operador.
      abrirModal({
        titulo: 'Ese sitio ya está ocupado',
        contenido: `<p>${escapar(r.mensaje)}</p>`,
        botones: [
          { texto: 'Lo muevo', clase: 'btn-secundario', accion: () => {
              cerrarModal();
              btnGuardar.disabled = false;
              msg.textContent = 'Arrástrelo a un sitio libre.';
              msg.className = 'form-msg';
            } },
          { texto: 'Sí van juntos, guardar', clase: 'btn-primary', accion: async () => {
              cerrarModal();
              const r2 = await guardarMovimiento(pendiente, calle, true);
              terminar(r2);
            } },
        ],
      });
      return;
    }
    terminar(r);
  });

  function terminar(r) {
    const malo = ['ERROR', 'FUERA'].includes(r?.estado);
    msg.textContent = r?.mensaje ?? 'Guardado.';
    msg.className = `form-msg ${malo ? 'error' : 'ok'}`;
    btnGuardar.disabled = !malo;
    if (!malo) pendiente = null;
  }

  async function guardarMovimiento(p, calle, forzar) {
    const { data, error } = await supabase.rpc('fn_mover_estructura', {
      p_estructura_id: p.id,
      p_x: p.x,
      p_y: p.y,
      p_rotacion: p.rot,
      p_calle: calle,
      p_forzar: forzar,
    });
    if (error) return { estado: 'ERROR', mensaje: error.message };

    const r = Array.isArray(data) ? data[0] : data;
    if (!['SOLAPE', 'ERROR', 'FUERA'].includes(r?.estado)) {
      // Se refleja en el arreglo que comparten las cinco pestañas, para
      // que la vista 3D lo muestre ya movido sin recargar la pantalla.
      const e = estructuras.find((x) => (x.estructura_id ?? x.id) === p.id);
      if (e) { e.pos_x_cm = p.x; e.pos_y_cm = p.y; e.rotacion_grados = p.rot; e.calle = calle ?? e.calle; }
    }
    return r;
  }

  destino.querySelector('#ac-local').addEventListener('click', () => abrirMedidasLocal(container));
}

/**
 * Las medidas de la sala. Sin ellas el plano no sabe dónde está la
 * pared y amontona todo contra el origen.
 */
function abrirMedidasLocal(container) {
  const sedeId = estructuras[0]?.sede_id;
  const ancho = estructuras[0]?.ancho_local_cm ?? 800;
  const fondo = estructuras[0]?.fondo_local_cm ?? 600;

  abrirModal({
    titulo: 'Medidas de la sala de ventas',
    contenido: `
      <p class="nota">De pared a pared, en centímetros. Con estas dos medidas el plano se
      dibuja a escala: el pasillo que se ve entre dos góndolas es el pasillo que va a quedar.</p>
      <label class="ancho-completo">Ancho (de izquierda a derecha)
        <input type="number" id="ml-ancho" min="100" max="10000" step="10" value="${ancho}" />
      </label>
      <label class="ancho-completo">Fondo (de la puerta al fondo)
        <input type="number" id="ml-fondo" min="100" max="10000" step="10" value="${fondo}" />
      </label>
      <p id="ml-msg" class="form-msg"></p>`,
    botones: [
      { texto: 'Cancelar', clase: 'btn-secundario', accion: cerrarModal },
      { texto: 'Guardar', clase: 'btn-primary', accion: async (modal) => {
          const m = modal.querySelector('#ml-msg');
          m.textContent = 'Guardando…';
          m.className = 'form-msg';
          const { error } = await supabase.from('sedes').update({
            ancho_local_cm: Number(modal.querySelector('#ml-ancho').value),
            fondo_local_cm: Number(modal.querySelector('#ml-fondo').value),
          }).eq('id', sedeId);

          if (error) {
            m.textContent = error.message;
            m.className = 'form-msg error';
            return;
          }
          cerrarModal();
          renderLayout(container);
        } },
    ],
  });
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

/**
 * Todo lo que hay en una posición, para contestar de pie frente a la
 * percha: qué producto es, cuánto queda, a cuánto se vende, qué costó y
 * qué lotes están por caducar. Desde aquí se puede sumar a la venta en
 * curso —para mostrárselo a un cliente— o pedirlo al proveedor, sin
 * tener que ir a otra pantalla y buscar el producto otra vez.
 */
async function abrirDetallePosicion(codigo) {
  const p = posiciones.find((x) => x.codigo === codigo);
  if (!p) return;

  const bajoMinimo = p.producto_id
    && Number(p.stock) <= Number(p.stock_minimo ?? 0)
    && Number(p.stock_minimo ?? 0) > 0;

  abrirModal({
    titulo: `Posición ${codigo}`,
    ancho: '34rem',
    contenido: `
      <div class="comprobante">
        <div class="comp-linea"><span>Dirección</span>
          <b>${escapar(p.calle ? `${p.calle} · ` : '')}${escapar(p.literal)} ·
             columna ${String(p.columna).padStart(2, '0')} · nivel ${p.nivel}</b></div>
        <div class="comp-linea"><span>Mueble</span><b>${escapar(p.estructura)}</b></div>
        <div class="comp-linea"><span>Conservación</span><b>${escapar(p.temperatura)}</b></div>
        ${p.producto ? `
          <div class="comp-linea"><span>Producto</span><b>${escapar(p.producto)}</b></div>
          <div class="comp-linea"><span>Código</span><b>${escapar(p.producto_codigo ?? '')}</b></div>
          <div class="comp-linea"><span>Marca / categoría</span>
            <b>${escapar(p.marca ?? '—')} · ${escapar(p.categoria ?? '—')}</b></div>
          <div class="comp-linea grande ${bajoMinimo ? 'alerta' : ''}"><span>Existencia</span>
            <b>${Number(p.stock).toFixed(2)} ${escapar(p.unidad ?? '')}</b></div>
          ${Number(p.stock_minimo ?? 0) > 0
            ? `<div class="comp-linea"><span>Mínimo</span>
                 <b>${Number(p.stock_minimo).toFixed(2)} ${escapar(p.unidad ?? '')}</b></div>` : ''}
          <div class="comp-linea"><span>Precio al público</span>
            <b>$${Number(p.precio_venta_menor ?? 0).toFixed(2)}</b></div>
          <div class="comp-linea"><span>Precio al por mayor</span>
            <b>$${Number(p.precio_venta_mayor ?? 0).toFixed(2)}</b></div>
          ${p.costo_promedio != null ? `
            <div class="comp-linea"><span>Costo promedio</span>
              <b>$${Number(p.costo_promedio).toFixed(4)}</b></div>
            <div class="comp-linea"><span>Valor en esta posición</span>
              <b>$${Number(p.valor_en_posicion ?? 0).toFixed(2)}</b></div>` : ''}
          ${bajoMinimo
            ? '<p class="aviso-inline">Está en el mínimo o por debajo: toca reponer.</p>' : ''}
        ` : '<p class="nota">Esta posición está libre.</p>'}
      </div>

      <div id="presentaciones-posicion"></div>
      <div id="lotes-posicion">${p.producto_id ? '<p class="loading">Cargando lotes…</p>' : ''}</div>
      <p id="dp-msg" class="form-msg"></p>`,
    botones: p.producto_id
      ? [
          { texto: 'Cerrar', clase: 'btn-secundario', accion: cerrarModal },
          { texto: 'Sumar a la venta', clase: 'btn-secundario', accion: sumarAVenta },
          { texto: 'Pedir al proveedor', clase: 'btn-primary', accion: pedirAlProveedor },
        ]
      : [{ texto: 'Cerrar', clase: 'btn-primary', accion: cerrarModal }],
    alAbrir: async (modal) => {
      if (!p.producto_id) return;
      await pintarPresentaciones(modal);
      await pintarLotes(modal);
    },
  });

  /** Cómo se vende: por unidad, por caja, y a cuánto sale el bulto. */
  async function pintarPresentaciones(modal) {
    const caja = modal.querySelector('#presentaciones-posicion');
    const { data, error } = await supabase
      .from('v_stock_presentacion')
      .select('presentacion, factor, lectura, se_vende_asi, precio_bulto')
      .eq('producto_id', p.producto_id);

    if (error || !data?.length) { caja.innerHTML = ''; return; }

    caja.innerHTML = `
      <h4>Cómo está contado</h4>
      <table class="dyn-table">
        <thead><tr><th>Presentación</th><th>Equivale a</th><th>Se vende así</th><th>Precio</th></tr></thead>
        <tbody>
          ${data.map((r) => `
            <tr>
              <td>${escapar(r.presentacion)}</td>
              <td>${escapar(r.lectura)}</td>
              <td>${r.se_vende_asi ? 'Sí' : '—'}</td>
              <td>${r.precio_bulto == null ? '—' : `$${Number(r.precio_bulto).toFixed(2)}`}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  async function pintarLotes(modal) {
    const caja = modal.querySelector('#lotes-posicion');
    const { data, error } = await supabase
      .from('v_lotes_disponibles')
      .select('codigo_lote, fecha_caducidad, cantidad_disponible, dias_para_caducar, estado_caducidad')
      .eq('producto_id', p.producto_id)
      .limit(20);

    if (error) {
      caja.innerHTML = '<p class="nota">No se pudieron leer los lotes.</p>';
      return;
    }
    if (!data?.length) {
      caja.innerHTML = '<p class="nota">Este producto no maneja lotes.</p>';
      return;
    }

    caja.innerHTML = `
      <h4>Lotes disponibles (se despacha primero el que caduca antes)</h4>
      <table class="dyn-table">
        <thead><tr><th>Lote</th><th>Caduca</th><th>Faltan</th><th>Disponible</th></tr></thead>
        <tbody>
          ${data.map((l) => `
            <tr class="${l.estado_caducidad === 'VENCIDO' ? 'row-danger'
                        : l.estado_caducidad === 'POR_VENCER' ? 'row-warning' : ''}">
              <td>${escapar(l.codigo_lote ?? '—')}</td>
              <td>${l.fecha_caducidad
                    ? new Date(l.fecha_caducidad + 'T00:00:00').toLocaleDateString('es-EC')
                    : '—'}</td>
              <td>${l.dias_para_caducar == null ? '—' : `${l.dias_para_caducar} días`}</td>
              <td>${Number(l.cantidad_disponible).toFixed(2)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  /**
   * Sumar a la venta en curso. Sirve para lo que pidió el operador:
   * estar frente a la percha con un cliente, mostrarle qué hay y
   * cargarlo sin volver a la caja a buscarlo por nombre.
   */
  async function sumarAVenta(modal) {
    const msg = modal.querySelector('#dp-msg');
    const { data } = await supabase
      .from('v_pos_productos').select('*').eq('producto_id', p.producto_id).limit(1);

    const producto = data?.[0];
    if (!producto) {
      msg.textContent = 'Ese producto no está disponible para la venta en esta bodega.';
      msg.className = 'form-msg error';
      return;
    }
    const { agregar } = await import('./lib/venta-activa.js');
    const r = agregar(producto);
    msg.textContent = r.mensaje ?? (r.ok ? 'Agregado a la venta.' : 'No se pudo agregar.');
    msg.className = `form-msg ${r.ok ? 'ok' : 'error'}`;
  }

  /**
   * Pedir al proveedor desde aquí. El bodeguero ve el hueco en la
   * percha y lo pide en ese momento; si tiene que anotarlo en un papel
   * para pedirlo después, la mitad de las veces no se pide.
   */
  async function pedirAlProveedor(modal) {
    const msg = modal.querySelector('#dp-msg');
    const sugerido = Math.max(
      Number(p.stock_minimo ?? 0) * 2 - Number(p.stock ?? 0), 1);

    modal.querySelector('#lotes-posicion').insertAdjacentHTML('beforebegin', `
      <div class="panel-pedido">
        <h4>Pedido de ${escapar(p.producto)}</h4>
        <label>Proveedor
          <select id="dp-proveedor"><option value="">Cargando…</option></select>
        </label>
        <label>Cantidad (${escapar(p.unidad ?? 'un')})
          <input type="number" id="dp-cantidad" min="0.001" step="0.001"
                 value="${Number(sugerido).toFixed(0)}" />
        </label>
        <button type="button" id="dp-enviar" class="btn-primary">Crear la orden</button>
      </div>`);

    const sel = modal.querySelector('#dp-proveedor');
    const { data: provs } = await supabase
      .from('proveedores').select('id, razon_social, nombre_comercial')
      .eq('activo', true).order('razon_social');

    sel.innerHTML = (provs ?? []).map((x) =>
      `<option value="${x.id}">${escapar(x.nombre_comercial ?? x.razon_social)}</option>`).join('')
      || '<option value="">No hay proveedores cargados</option>';

    modal.querySelector('#dp-enviar').addEventListener('click', async () => {
      if (!sel.value) {
        msg.textContent = 'Elija el proveedor.';
        msg.className = 'form-msg error';
        return;
      }
      msg.textContent = 'Creando la orden…';
      msg.className = 'form-msg';

      const { error } = await supabase.rpc('fn_crear_orden_compra', {
        p_proveedor_id: sel.value,
        p_items: [{
          producto_id: p.producto_id,
          cantidad: Number(modal.querySelector('#dp-cantidad').value),
          costo: Number(p.costo_promedio ?? 0),
        }],
        p_observaciones: `Pedido desde la posición ${codigo}`,
      });

      if (error) {
        // El rol de cajero no puede generar órdenes: se dice así, no
        // con el mensaje de PostgreSQL.
        msg.textContent = /rol no puede|permission|42501/i.test(error.message)
          ? 'Su usuario no puede generar órdenes de compra. Avise al supervisor.'
          : error.message;
        msg.className = 'form-msg error';
        return;
      }
      msg.textContent = 'Orden creada. Queda en Compras → Órdenes para revisarla y enviarla.';
      msg.className = 'form-msg ok';
      modal.querySelector('#dp-enviar').disabled = true;
    });
  }
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
