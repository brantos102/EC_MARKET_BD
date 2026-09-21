// Lectura de códigos de barras con la cámara del teléfono.
//
// POR QUÉ HACE FALTA. En el mostrador hay un lector láser conectado por
// USB, que se comporta como un teclado: lee el código, lo escribe en el
// campo y manda Enter. Pero el mismo sistema se usa desde el celular
// —para recibir mercadería junto al camión, para tomar inventario en la
// percha, para consultar un precio en la sala— y ahí no hay lector. La
// única cámara disponible es la del teléfono.
//
// DOS CAMINOS, POR ORDEN DE PREFERENCIA
//
// 1. BarcodeDetector, que es parte del navegador. Lo trae Chrome en
//    Android. Usa el decodificador del sistema operativo: es rápido,
//    no descarga nada y gasta poca batería.
//
// 2. Si el navegador no lo tiene —Safari en iPhone, Firefox, y Chrome
//    de escritorio sin la bandera— se carga un decodificador propio
//    (Quagga, 143 KB) SOLO en ese momento. No se descarga si no hace
//    falta, para que la caja del mostrador no cargue 143 KB que nunca
//    va a usar.
//
// LA LECTURA SE CONFIRMA DOS VECES. Un código mal leído en la recepción
// carga cajas al producto equivocado, y eso se descubre semanas después
// como un descuadre sin explicación. Por eso no se acepta la primera
// lectura: hace falta leer el mismo código dos veces seguidas. Cuesta
// una décima de segundo y evita el error caro.

import { validarEAN13, normalizarCodigoEscaneado } from './ean13.js';
import { abrirModal, cerrarModal } from './modal.js';

const RUTA_QUAGGA = new URL('../vendor/quagga.min.js', import.meta.url).href;

let quaggaCargado = null;

/**
 * Qué puede hacer este dispositivo.
 * @returns {Promise<{camara: boolean, nativo: boolean, motivo: string}>}
 */
export async function soporteEscaner() {
  const camara = Boolean(navigator.mediaDevices?.getUserMedia);
  let nativo = false;

  if ('BarcodeDetector' in window) {
    try {
      const formatos = await window.BarcodeDetector.getSupportedFormats();
      nativo = formatos.includes('ean_13');
    } catch { nativo = false; }
  }

  return {
    camara,
    nativo,
    motivo: camara
      ? (nativo ? 'Lector del propio navegador' : 'Lector incluido en la aplicación')
      : 'Este dispositivo no tiene cámara disponible para el navegador',
  };
}

/**
 * Abre la cámara y devuelve el código leído.
 *
 * @param {object} opciones
 * @param {string} [opciones.titulo]
 * @param {string} [opciones.ayuda]
 * @param {(codigo: string) => (void|Promise<void>)} opciones.alLeer
 *   Se llama con el código ya normalizado. Si devuelve la cadena
 *   'seguir', la cámara no se cierra: sirve para escanear en serie.
 */
export async function abrirEscaner({ titulo = 'Escanear código', ayuda = '', alLeer }) {
  const soporte = await soporteEscaner();

  abrirModal({
    titulo,
    ancho: '30rem',
    contenido: `
      <div class="escaner">
        ${soporte.camara ? `
          <div class="escaner-visor">
            <video id="esc-video" playsinline muted></video>
            <div class="escaner-mira"></div>
          </div>
          <p id="esc-estado" class="escaner-estado">Pidiendo permiso para usar la cámara…</p>
        ` : `
          <p class="aviso-inline">${escapar(soporte.motivo)}. Escriba el código a mano.</p>
        `}

        ${ayuda ? `<p class="nota">${escapar(ayuda)}</p>` : ''}

        <div class="escaner-manual">
          <label for="esc-manual">O escríbalo</label>
          <input type="text" id="esc-manual" inputmode="numeric" autocomplete="off"
                 placeholder="7861000100014" />
          <button type="button" id="esc-manual-ok" class="btn-secundario">Usar</button>
        </div>
        <p id="esc-msg" class="form-msg"></p>
      </div>`,
    botones: [{ texto: 'Cerrar', clase: 'btn-secundario', accion: cerrar }],
    alAbrir: (modal) => iniciar(modal, soporte),
    alCerrar: detener,
  });

  // -------------------------------------------------------
  let flujo = null;          // MediaStream
  let animando = false;
  let usandoQuagga = false;
  let ultimo = null;         // para la doble confirmación
  let cerrado = false;

  function cerrar() {
    detener();
    cerrarModal();
  }

  function detener() {
    cerrado = true;
    animando = false;
    if (flujo) {
      flujo.getTracks().forEach((t) => t.stop());
      flujo = null;
    }
    if (usandoQuagga && window.Quagga) {
      try { window.Quagga.stop(); } catch { /* ya estaba parado */ }
      usandoQuagga = false;
    }
  }

  async function iniciar(modal, sop) {
    const manual = modal.querySelector('#esc-manual');
    const msg = modal.querySelector('#esc-msg');

    modal.querySelector('#esc-manual-ok').addEventListener('click', () => usar(manual.value, msg));
    manual.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); usar(manual.value, msg); }
    });
    // En el mostrador el lector USB se comporta como teclado: si hay uno
    // conectado, escribe aquí solo. Por eso el foco arranca en el campo.
    manual.focus();

    if (!sop.camara) return;

    const estado = modal.querySelector('#esc-estado');
    const video = modal.querySelector('#esc-video');

    try {
      flujo = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },   // la cámara de atrás
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (err) {
      estado.textContent = err?.name === 'NotAllowedError'
        ? 'No se dio permiso para usar la cámara. Puede escribir el código a mano.'
        : `No se pudo abrir la cámara: ${err?.message ?? err}. Escriba el código a mano.`;
      estado.classList.add('escaner-estado-error');
      return;
    }

    if (cerrado) { flujo.getTracks().forEach((t) => t.stop()); return; }

    video.srcObject = flujo;
    await video.play().catch(() => {});

    if (sop.nativo) {
      estado.textContent = 'Apunte al código de barras';
      leerConElNavegador(video, estado, msg);
    } else {
      estado.textContent = 'Preparando el lector…';
      await leerConQuagga(modal, estado, msg);
    }
  }

  // Camino 1: el decodificador del propio navegador.
  async function leerConElNavegador(video, estado, msg) {
    const detector = new window.BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
    });
    animando = true;

    const paso = async () => {
      if (!animando) return;
      try {
        const codigos = await detector.detect(video);
        if (codigos.length) confirmarDoble(codigos[0].rawValue, estado, msg);
      } catch { /* un fotograma ilegible no es un error */ }
      if (animando) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  // Camino 2: el decodificador que viaja con la aplicación. Quagga
  // maneja su propia cámara, así que se suelta la que se abrió antes
  // para no tener dos encendidas gastando batería.
  async function leerConQuagga(modal, estado, msg) {
    try {
      await cargarQuagga();
    } catch (err) {
      estado.textContent = `No se pudo cargar el lector: ${err.message}. Escriba el código a mano.`;
      estado.classList.add('escaner-estado-error');
      return;
    }
    if (cerrado) return;

    if (flujo) { flujo.getTracks().forEach((t) => t.stop()); flujo = null; }
    const visor = modal.querySelector('.escaner-visor');
    visor.querySelector('#esc-video')?.remove();

    usandoQuagga = true;
    window.Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: visor,
        constraints: { facingMode: 'environment', width: 1280, height: 720 },
      },
      locator: { patchSize: 'medium', halfSample: true },
      numOfWorkers: navigator.hardwareConcurrency > 2 ? 2 : 0,
      decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'code_128_reader'] },
      locate: true,
    }, (err) => {
      if (cerrado) { try { window.Quagga.stop(); } catch { /* */ } return; }
      if (err) {
        estado.textContent = `No se pudo abrir la cámara: ${err.message}. Escriba el código a mano.`;
        estado.classList.add('escaner-estado-error');
        return;
      }
      window.Quagga.start();
      estado.textContent = 'Apunte al código de barras';
    });

    window.Quagga.onDetected((r) => {
      const codigo = r?.codeResult?.code;
      if (codigo) confirmarDoble(codigo, estado, msg);
    });
  }

  /**
   * No se acepta la primera lectura: hace falta leer lo mismo dos veces.
   * Un dígito mal leído en la recepción termina en mercadería cargada al
   * producto equivocado.
   */
  function confirmarDoble(bruto, estado, msg) {
    const codigo = normalizarCodigoEscaneado(bruto) ?? String(bruto).trim();
    if (!codigo) return;

    if (ultimo !== codigo) {
      ultimo = codigo;
      estado.textContent = `Leyendo ${codigo}… confirme apuntando otra vez`;
      return;
    }
    avisarLectura();
    estado.textContent = `Leído: ${codigo}`;
    usar(codigo, msg);
  }

  async function usar(valor, msg) {
    const codigo = normalizarCodigoEscaneado(valor) ?? String(valor ?? '').trim();
    if (!codigo) {
      msg.textContent = 'Escriba o escanee un código';
      msg.className = 'form-msg error';
      return;
    }
    // Se avisa, pero no se bloquea: hay códigos internos y de balanza
    // que no son EAN-13 y el operador tiene que poder usarlos.
    if (/^[0-9]{13}$/.test(codigo) && !validarEAN13(codigo)) {
      msg.textContent = `Ojo: ${codigo} tiene 13 dígitos pero el verificador no cuadra. ` +
                        'Puede ser un dígito mal leído.';
      msg.className = 'form-msg error';
    }

    const r = await alLeer(codigo);
    if (r === 'seguir') {
      ultimo = null;              // listo para el siguiente
      const manual = document.querySelector('#esc-manual');
      if (manual) { manual.value = ''; manual.focus(); }
      return;
    }
    cerrar();
  }
}

/** Carga el decodificador propio, una sola vez y solo si hace falta. */
function cargarQuagga() {
  if (window.Quagga) return Promise.resolve();
  if (quaggaCargado) return quaggaCargado;

  quaggaCargado = new Promise((resolver, rechazar) => {
    const s = document.createElement('script');
    s.src = RUTA_QUAGGA;
    s.onload = () => (window.Quagga ? resolver() : rechazar(new Error('el archivo se cargó vacío')));
    s.onerror = () => rechazar(new Error('no se encontró el archivo del lector'));
    document.head.appendChild(s);
  });
  return quaggaCargado;
}

/**
 * Un pitido y una vibración corta. En la bodega, con ruido y sin mirar
 * la pantalla, es la única confirmación de que la lectura entró.
 */
function avisarLectura() {
  try { navigator.vibrate?.(60); } catch { /* el escritorio no vibra */ }
  try {
    const Ctx = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.frequency.value = 1760;          // el agudo corto del lector de caja
    vol.gain.value = 0.08;
    osc.connect(vol).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
    setTimeout(() => ctx.close(), 300);
  } catch { /* sin sonido se sigue igual */ }
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}
