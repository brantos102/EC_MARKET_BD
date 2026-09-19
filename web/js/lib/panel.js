// Panel flotante de consulta rápida.
//
// DECISIÓN DE DISEÑO — por qué este panel es de SOLO LECTURA:
// el operador necesita consultar dónde está un producto o cuánto queda
// mientras tiene una venta a medio armar. Si el panel pudiera escribir
// (registrar movimientos, editar precios), dos partes de la aplicación
// estarían modificando el mismo stock a la vez y el carrito abierto
// quedaría trabajando con datos que ya cambiaron. Eso es exactamente el
// "choque de información" que hay que evitar. Al ser solo lectura, el
// panel nunca puede invalidar la venta en curso.
//
// Vive colgado de <body>, no de #content, así que sobrevive a la
// navegación entre módulos: el router reemplaza #content y el panel
// sigue abierto, en la misma posición y con la misma consulta.

import { supabase } from '../supabaseClient.js';
import { validarEAN13, normalizarCodigoEscaneado } from './ean13.js';

const CLAVE_POSICION = 'ccm_panel_posicion';

let panel = null;
let minimizado = false;

export function alternarPanel() {
  if (panel) cerrarPanel();
  else abrirPanel();
}

export function cerrarPanel() {
  panel?.remove();
  panel = null;
}

export function panelAbierto() {
  return panel !== null;
}

export function abrirPanel(consultaInicial = '') {
  if (panel) {
    panel.querySelector('#panel-buscar').focus();
    if (consultaInicial) {
      panel.querySelector('#panel-buscar').value = consultaInicial;
      buscar(consultaInicial);
    }
    return panel;
  }

  panel = document.createElement('section');
  panel.className = 'panel-flotante';
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Consulta rápida de productos');

  panel.innerHTML = `
    <header class="pf-head">
      <span class="pf-titulo">Consulta rápida</span>
      <span class="pf-solo-lectura" title="Este panel no modifica datos">solo lectura</span>
      <button class="pf-btn" data-accion="minimizar" title="Minimizar">–</button>
      <button class="pf-btn" data-accion="cerrar" title="Cerrar (Esc)">✕</button>
    </header>
    <div class="pf-cuerpo">
      <input type="search" id="panel-buscar" class="pf-buscar"
             placeholder="Código, EAN-13 o nombre..." autocomplete="off" />
      <div id="panel-resultado" class="pf-resultado">
        <p class="pf-vacio">Escanea o escribe un producto para ver dónde está,
        cuánto queda y a qué precio se vende. No interrumpe la venta en curso.</p>
      </div>
    </div>
  `;

  document.body.appendChild(panel);
  restaurarPosicion();
  hacerArrastrable();

  panel.querySelector('[data-accion="cerrar"]').addEventListener('click', cerrarPanel);
  panel.querySelector('[data-accion="minimizar"]').addEventListener('click', alternarMinimizado);
  panel.querySelector('.pf-head').addEventListener('dblclick', alternarMinimizado);

  const input = panel.querySelector('#panel-buscar');
  let temporizador;
  input.addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => buscar(input.value), 220);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(temporizador);
      buscar(input.value);
    }
  });

  if (consultaInicial) {
    input.value = consultaInicial;
    buscar(consultaInicial);
  }
  input.focus();
  return panel;
}

function alternarMinimizado() {
  minimizado = !minimizado;
  panel.classList.toggle('minimizado', minimizado);
  panel.querySelector('[data-accion="minimizar"]').textContent = minimizado ? '▢' : '–';
}

// ---------------------------------------------------------
// Arrastre
// ---------------------------------------------------------
function hacerArrastrable() {
  const cabecera = panel.querySelector('.pf-head');
  let inicioX = 0, inicioY = 0, origenX = 0, origenY = 0, arrastrando = false;

  cabecera.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('pf-btn')) return;
    arrastrando = true;
    cabecera.setPointerCapture(e.pointerId);
    inicioX = e.clientX;
    inicioY = e.clientY;
    const r = panel.getBoundingClientRect();
    origenX = r.left;
    origenY = r.top;
    panel.classList.add('arrastrando');
  });

  cabecera.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    const nx = origenX + (e.clientX - inicioX);
    const ny = origenY + (e.clientY - inicioY);
    // Se mantiene siempre una franja visible para que no se pueda perder
    const maxX = window.innerWidth - 80;
    const maxY = window.innerHeight - 40;
    panel.style.left = `${Math.min(Math.max(nx, -panel.offsetWidth + 120), maxX)}px`;
    panel.style.top = `${Math.min(Math.max(ny, 0), maxY)}px`;
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });

  const soltar = () => {
    if (!arrastrando) return;
    arrastrando = false;
    panel.classList.remove('arrastrando');
    guardarPosicion();
  };
  cabecera.addEventListener('pointerup', soltar);
  cabecera.addEventListener('pointercancel', soltar);
}

function guardarPosicion() {
  try {
    const r = panel.getBoundingClientRect();
    localStorage.setItem(CLAVE_POSICION, JSON.stringify({ left: r.left, top: r.top }));
  } catch {
    // Si el navegador bloquea el almacenamiento, el panel simplemente
    // vuelve a su posición por defecto la próxima vez. No es crítico.
  }
}

function restaurarPosicion() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_POSICION) ?? 'null');
    if (guardado && guardado.left < window.innerWidth - 60 && guardado.top < window.innerHeight - 40) {
      panel.style.left = `${Math.max(guardado.left, 0)}px`;
      panel.style.top = `${Math.max(guardado.top, 0)}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    }
  } catch {
    // Posición por defecto (definida en el CSS)
  }
}

// ---------------------------------------------------------
// Consulta (solo lectura)
// ---------------------------------------------------------
async function buscar(texto) {
  const destino = panel?.querySelector('#panel-resultado');
  if (!destino) return;

  const limpio = (texto ?? '').trim();
  if (limpio.length < 2) {
    destino.innerHTML = '<p class="pf-vacio">Escribe al menos 2 caracteres.</p>';
    return;
  }

  destino.innerHTML = '<p class="pf-vacio">Buscando...</p>';

  const ean = normalizarCodigoEscaneado(limpio);
  let consulta = supabase.from('v_stock_actual').select('*').limit(12);

  if (ean) {
    consulta = consulta.eq('ean13', ean);
  } else {
    consulta = consulta.or(
      `codigo.ilike.%${limpio}%,producto.ilike.%${limpio}%,marca.ilike.%${limpio}%`
    );
  }

  const { data, error } = await consulta;

  if (error) {
    destino.innerHTML = `<p class="pf-error">${traducirError(error.message)}</p>`;
    return;
  }
  if (!data?.length) {
    destino.innerHTML = `<p class="pf-vacio">Sin resultados para "${escapar(limpio)}".
      ${validarEAN13(limpio) ? 'El código es válido pero no está registrado.' : ''}</p>`;
    return;
  }

  // Un producto puede aparecer en varias bodegas: se agrupan
  const porProducto = new Map();
  for (const fila of data) {
    if (!porProducto.has(fila.producto_id)) porProducto.set(fila.producto_id, []);
    porProducto.get(fila.producto_id).push(fila);
  }

  destino.innerHTML = [...porProducto.values()]
    .map((filas) => tarjetaProducto(filas))
    .join('');

  destino.querySelectorAll('[data-lotes]').forEach((btn) => {
    btn.addEventListener('click', () => cargarLotes(btn.dataset.lotes, btn));
  });
}

function tarjetaProducto(filas) {
  const p = filas[0];
  const stockTotal = filas.reduce((a, f) => a + Number(f.stock || 0), 0);
  const bajo = filas.some((f) => f.bajo_minimo);

  const ubicaciones = filas
    .filter((f) => f.ubicacion)
    .map((f) => `<span class="pf-chip-ubic">${f.ubicacion}</span>`)
    .join('') || '<span class="pf-sin">sin ubicación asignada</span>';

  const porBodega = filas
    .map(
      (f) => `<div class="pf-bodega-linea">
        <span>${f.bodega}</span>
        <b class="${Number(f.stock) <= 0 ? 'pf-agotado' : ''}">${Number(f.stock).toFixed(2)} ${f.unidad ?? ''}</b>
      </div>`
    )
    .join('');

  return `
    <article class="pf-tarjeta ${bajo ? 'pf-bajo' : ''}">
      <div class="pf-tarjeta-head">
        <b>${escapar(p.producto)}</b>
        ${p.marca ? `<span class="pf-marca">${escapar(p.marca)}</span>` : ''}
      </div>
      <div class="pf-meta">${p.codigo} ${p.ean13 ? `· ${p.ean13}` : ''} ${p.categoria ? `· ${escapar(p.categoria)}` : ''}</div>

      <div class="pf-fila"><span>Ubicación</span><div class="pf-ubics">${ubicaciones}</div></div>
      <div class="pf-fila"><span>Existencia</span><div class="pf-bodegas">${porBodega}</div></div>
      <div class="pf-fila"><span>Total</span><b>${stockTotal.toFixed(2)}</b></div>
      <div class="pf-fila"><span>Precio detalle</span><b>$${Number(p.precio_venta_menor ?? 0).toFixed(2)}</b></div>
      <div class="pf-fila"><span>Precio mayor</span><b>$${Number(p.precio_venta_mayor ?? 0).toFixed(2)}</b></div>
      <div class="pf-fila"><span>Costo promedio</span><span>$${Number(p.costo_promedio ?? 0).toFixed(4)}</span></div>
      ${bajo ? '<div class="pf-aviso">Por debajo del stock mínimo</div>' : ''}

      <button class="pf-lotes-btn" data-lotes="${p.producto_id}">Ver lotes y caducidad</button>
      <div class="pf-lotes"></div>
    </article>`;
}

async function cargarLotes(productoId, boton) {
  const destino = boton.nextElementSibling;
  destino.innerHTML = '<p class="pf-vacio">Cargando lotes...</p>';

  const { data, error } = await supabase
    .from('lotes')
    .select('codigo_lote, fecha_caducidad, cantidad_disponible')
    .eq('producto_id', productoId)
    .gt('cantidad_disponible', 0)
    .order('fecha_caducidad', { nullsFirst: false })
    .limit(20);

  if (error) {
    destino.innerHTML = `<p class="pf-error">${traducirError(error.message)}</p>`;
    return;
  }
  if (!data?.length) {
    destino.innerHTML = '<p class="pf-vacio">Sin lotes con existencia.</p>';
    return;
  }

  const hoy = new Date().toISOString().slice(0, 10);
  destino.innerHTML = `<table class="pf-tabla-lotes">
    <thead><tr><th>Lote</th><th>Caduca</th><th>Disp.</th></tr></thead>
    <tbody>${data
      .map((l) => {
        const vencido = l.fecha_caducidad && l.fecha_caducidad < hoy;
        return `<tr class="${vencido ? 'pf-vencido' : ''}">
          <td>${escapar(l.codigo_lote)}</td>
          <td>${l.fecha_caducidad ?? '—'}</td>
          <td>${Number(l.cantidad_disponible).toFixed(2)}</td>
        </tr>`;
      })
      .join('')}</tbody></table>
    <p class="pf-nota-fefo">El primero de la lista es el que sale al vender (FEFO).</p>`;
}

// ---------------------------------------------------------
// Utilidades
// ---------------------------------------------------------
function escapar(texto) {
  const d = document.createElement('div');
  d.textContent = texto ?? '';
  return d.innerHTML;
}

function traducirError(mensaje) {
  if (/schema cache|does not exist|Could not find the table/i.test(mensaje)) {
    return 'Faltan tablas en la base de datos. Ejecuta db/000_diagnostico.sql en Supabase para ver qué migración falta.';
  }
  return escapar(mensaje);
}

// Atajo global: F2 abre y cierra el panel desde cualquier módulo.
document.addEventListener('keydown', (e) => {
  if (e.key === 'F2') {
    e.preventDefault();
    alternarPanel();
  } else if (e.key === 'Escape' && panel && !document.querySelector('.modal')) {
    cerrarPanel();
  }
});
