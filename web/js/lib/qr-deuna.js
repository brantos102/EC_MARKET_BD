// Ventana del QR de De Una, a tamaño de mostrador.
//
// EL PROBLEMA: dentro del modal de cobro el código salía de unos 190 px.
// Sirve para que el cajero compruebe que está cargado, pero no para que
// el cliente lo escanee desde el otro lado del mostrador: tiene que
// acercarse y agacharse sobre la pantalla, lo que en una fila de cinco
// personas es exactamente lo que no se quiere.
//
// Esta ventana es aparte y ocupa casi toda la pantalla, con el monto en
// grande y un control de tamaño que el vendedor mueve según lo lejos que
// esté el cliente. El tamaño elegido se recuerda, porque el mostrador
// del local no cambia de sitio todos los días.

import { abrirModal, cerrarModal } from './modal.js';
import { empresaActual } from './marca.js';

const CLAVE_TAMANO = 'elcultivo.qr.tamano';
const MIN = 220;
const MAX = 620;

function tamanoGuardado() {
  try {
    const v = Number(localStorage.getItem(CLAVE_TAMANO));
    if (Number.isFinite(v) && v >= MIN && v <= MAX) return v;
  } catch {
    // Sin almacenamiento se usa el valor por defecto y ya.
  }
  return 380;
}

function guardarTamano(v) {
  try {
    localStorage.setItem(CLAVE_TAMANO, String(v));
  } catch {
    // No poder recordarlo no es motivo para no mostrarlo.
  }
}

/**
 * Abre el QR en grande.
 *
 * @param {number} total     monto que el cliente debe enviar
 * @param {Function} alCerrar  se llama al volver a la pantalla de cobro
 */
export function abrirQRDeUna(total, alCerrar) {
  const e = empresaActual();
  const url = e?.deuna_qr_url;
  const mime = e?.deuna_qr_mime ?? '';
  const esPDF = mime === 'application/pdf' || /^data:application\/pdf/.test(url ?? '');
  const tamano = tamanoGuardado();

  abrirModal({
    titulo: 'Cobro con De Una',
    ancho: '96vw',
    contenido: `
      <div class="qr-pantalla">
        <div class="qr-lado-izq">
          <div class="qr-marco" id="qr-marco" style="--qr:${tamano}px">
            ${url
              ? (esPDF
                  ? `<embed src="${url}#toolbar=0&navpanes=0&scrollbar=0" type="application/pdf" class="qr-pdf" />`
                  : `<img src="${url}" alt="Código QR de cobro De Una" class="qr-img" />`)
              : `<div class="qr-sin">
                   <b>No hay código cargado</b>
                   <span>Administración → Empresa → De Una</span>
                 </div>`}
          </div>

          <div class="qr-zoom">
            <button type="button" class="qr-btn" id="qr-menos" title="Más pequeño">−</button>
            <input type="range" id="qr-tamano" min="${MIN}" max="${MAX}" step="20" value="${tamano}"
                   aria-label="Tamaño del código" />
            <button type="button" class="qr-btn" id="qr-mas" title="Más grande">+</button>
            <button type="button" class="qr-btn ancho" id="qr-pantalla-completa"
                    title="Ocupar toda la pantalla">Pantalla completa</button>
          </div>
        </div>

        <div class="qr-lado-der">
          <p class="qr-etiqueta">El cliente debe enviar</p>
          <p class="qr-monto">$${Number(total).toFixed(2)}</p>
          <ol class="qr-pasos">
            <li>Abra la aplicación <b>De Una</b> en su teléfono.</li>
            <li>Escanee este código.</li>
            <li>Escriba el valor <b>$${Number(total).toFixed(2)}</b> y confirme.</li>
          </ol>
          ${e?.deuna_titular
            ? `<p class="qr-titular">Cuenta de <b>${escapar(e.deuna_titular)}</b>${
                 e.deuna_telefono ? ` · ${escapar(e.deuna_telefono)}` : ''}</p>`
            : ''}
          <p class="nota">${escapar(e?.deuna_instrucciones ??
            'El monto lo digita el cliente: este código no lo lleva incluido.')}</p>
        </div>
      </div>`,
    botones: [
      { texto: 'Volver al cobro', clase: 'btn-primary', accion: () => {
          cerrarModal();
          alCerrar?.();
        } },
    ],
    alAbrir: (modal) => {
      const marco = modal.querySelector('#qr-marco');
      const rango = modal.querySelector('#qr-tamano');

      const aplicar = (v) => {
        const n = Math.max(MIN, Math.min(MAX, Number(v)));
        marco.style.setProperty('--qr', `${n}px`);
        rango.value = n;
        guardarTamano(n);
      };

      rango.addEventListener('input', () => aplicar(rango.value));
      modal.querySelector('#qr-mas').addEventListener('click', () => aplicar(Number(rango.value) + 40));
      modal.querySelector('#qr-menos').addEventListener('click', () => aplicar(Number(rango.value) - 40));

      modal.querySelector('#qr-pantalla-completa').addEventListener('click', () => {
        const caja = modal.querySelector('.qr-pantalla');
        if (document.fullscreenElement) document.exitFullscreen?.();
        else caja.requestFullscreen?.().catch(() => {
          // Si el navegador no deja pantalla completa, al menos se
          // agranda al máximo: el objetivo es que el cliente escanee.
          aplicar(MAX);
        });
      });

      // Con el teclado: + y − ajustan sin tocar el ratón, que es como
      // trabaja un cajero con las dos manos ocupadas.
      modal.addEventListener('keydown', (ev) => {
        if (ev.key === '+' || ev.key === '=') aplicar(Number(rango.value) + 40);
        if (ev.key === '-' || ev.key === '_') aplicar(Number(rango.value) - 40);
      });
    },
  });
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}
