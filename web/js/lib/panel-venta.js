// Panel flotante de la venta en curso.
//
// Aparece automáticamente cuando hay un carrito abierto y el operador
// está en otro módulo (mapa, caducidades, promociones...). Muestra las
// líneas, el total, permite seguir escaneando y volver a la caja para
// cobrar. Al entrar al punto de venta se oculta solo, porque ahí la
// venta ya está en pantalla completa.

import {
  hayVentaActiva, lineasCalculadas, totales, suscribir,
  cambiarCantidad, agregar, obtenerEstado,
} from './venta-activa.js';
import { normalizarCodigoEscaneado } from './ean13.js';

let panel = null;
let colapsado = false;
let catalogo = () => [];

export function fijarCatalogo(fn) {
  catalogo = fn;
}

/** Decide si el panel debe verse, según el módulo actual. */
export function actualizarPanelVenta() {
  const enPOS = (location.hash || '#dashboard').replace('#', '') === 'pos';

  if (enPOS || !hayVentaActiva()) {
    cerrar();
    return;
  }
  if (!panel) crear();
  pintar();
}

function cerrar() {
  panel?.remove();
  panel = null;
}

function crear() {
  panel = document.createElement('aside');
  panel.className = 'panel-venta';
  panel.setAttribute('aria-label', 'Venta en curso');
  panel.innerHTML = `
    <header class="pv-head">
      <span class="pv-punto"></span>
      <span class="pv-titulo">Venta en curso</span>
      <span class="pv-contador"></span>
      <button class="pv-btn" data-accion="colapsar" title="Contraer">–</button>
    </header>
    <div class="pv-cuerpo">
      <input type="text" class="pv-scan" placeholder="Escanear para seguir agregando..." autocomplete="off" />
      <div class="pv-msg"></div>
      <ul class="pv-lineas"></ul>
      <div class="pv-total"><span>TOTAL</span><b></b></div>
      <button class="pv-cobrar btn-primary">Ir a cobrar</button>
    </div>
  `;
  document.body.appendChild(panel);

  panel.querySelector('[data-accion="colapsar"]').addEventListener('click', () => {
    colapsado = !colapsado;
    panel.classList.toggle('colapsado', colapsado);
    panel.querySelector('[data-accion="colapsar"]').textContent = colapsado ? '▢' : '–';
  });
  panel.querySelector('.pv-head').addEventListener('dblclick', () => {
    panel.querySelector('[data-accion="colapsar"]').click();
  });

  panel.querySelector('.pv-cobrar').addEventListener('click', () => {
    location.hash = '#pos';
  });

  const scan = panel.querySelector('.pv-scan');
  scan.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const texto = scan.value.trim();
    if (!texto) return;

    // Misma tolerancia que el buscador del punto de venta: EAN normalizado,
    // código exacto, o coincidencia por EAN/nombre/marca escritos a mano.
    const ean = normalizarCodigoEscaneado(texto);
    const q = texto.toLowerCase();
    const lista = catalogo() ?? [];
    const encontrado =
      (ean && lista.find((p) => p.ean13 === ean)) ||
      lista.find((p) => p.codigo?.toLowerCase() === q || p.ean13 === texto) ||
      lista.find((p) => p.nombre?.toLowerCase().includes(q) || p.marca?.toLowerCase().includes(q));

    const msg = panel.querySelector('.pv-msg');
    if (!encontrado) {
      msg.textContent = `No se encontró "${texto}"`;
      msg.className = 'pv-msg error';
    } else {
      const r = agregar(encontrado);
      msg.textContent = r.mensaje ?? '';
      msg.className = `pv-msg ${r.ok ? 'ok' : 'error'}`;
    }
    scan.value = '';
  });

  panel.classList.toggle('colapsado', colapsado);
}

function pintar() {
  if (!panel) return;

  const lineas = lineasCalculadas();
  const t = totales();
  const estado = obtenerEstado();

  panel.querySelector('.pv-contador').textContent =
    `${lineas.length} ${lineas.length === 1 ? 'ítem' : 'ítems'} · ${estado.tipoVenta === 'MAYOR' ? 'mayor' : 'detalle'}`;

  panel.querySelector('.pv-lineas').innerHTML = lineas
    .map((l) => `
      <li class="pv-linea">
        <div class="pv-linea-info">
          <b>${escapar(l.producto.nombre)}</b>
          <span>${l.producto.codigo}${l.producto.ubicacion ? ` · ${l.producto.ubicacion}` : ''}
            ${l.calculo.promocionAplicada ? `<span class="badge-promo">${escapar(l.calculo.promocionAplicada.nombre)}</span>` : ''}
          </span>
        </div>
        <input type="number" class="pv-cant" data-id="${l.producto.producto_id}"
               value="${l.cantidad}" min="0" step="${l.producto.permite_fraccion ? '0.01' : '1'}" />
        <span class="pv-sub">$${l.calculo.totalConPromo.toFixed(2)}</span>
      </li>`)
    .join('');

  panel.querySelectorAll('.pv-cant').forEach((input) => {
    input.addEventListener('change', () => {
      const r = cambiarCantidad(input.dataset.id, Number(input.value));
      if (!r.ok && r.mensaje) {
        const msg = panel.querySelector('.pv-msg');
        msg.textContent = r.mensaje;
        msg.className = 'pv-msg error';
        pintar();
      }
    });
  });

  panel.querySelector('.pv-total b').textContent = `$${t.total.toFixed(2)}`;
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

// Cualquier cambio en la venta repinta el panel si está visible
suscribir(() => {
  if (panel) pintar();
  else actualizarPanelVenta();
});
