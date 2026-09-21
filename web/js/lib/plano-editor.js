// Editor del plano del local: arrastrar los muebles a donde están.
//
// POR QUÉ SE EDITA EN PLANTA Y NO EN 3D
//
// Mover una estantería dentro de una escena en tres dimensiones obliga
// a girar la cámara para entender a qué profundidad quedó, y con el
// dedo en un celular es directamente imposible. Sobre el plano visto
// desde arriba —que es como se dibuja un local en un papel— arrastrar
// es exacto: lo que se ve es la huella real del mueble en el piso.
//
// El 3D sigue siendo el que se mira; este es el que se toca. Los dos
// leen las mismas coordenadas, así que lo que se acomoda aquí aparece
// allá.
//
// TODO ESTÁ A ESCALA. Un centímetro del local es siempre el mismo
// número de píxeles, así que dos estanterías de 120 cm se ven iguales y
// el pasillo que queda entre ellas es el pasillo que va a quedar. Un
// plano "bonito" pero fuera de escala engaña: se acomoda en la pantalla
// algo que en el local no cabe.

const REJILLA_CM = 10;   // a lo que se pega el mueble al soltarlo

/**
 * @param {HTMLElement} contenedor
 * @param {{
 *   estructuras: any[],
 *   alMover: (id: string, x: number, y: number, rot: number) => void,
 *   alSeleccionar?: (estructura: any|null) => void,
 * }} opciones
 */
export function crearEditorPlano(contenedor, { estructuras, alMover, alSeleccionar }) {
  let datos = clonar(estructuras);
  let seleccionado = null;
  let escala = 1;                  // píxeles por centímetro

  const local = medidasDelLocal(datos);

  contenedor.innerHTML = `
    <div class="plano-marco">
      <div class="plano-lienzo" id="plano-lienzo">
        <div class="plano-medida plano-medida-ancho"></div>
        <div class="plano-medida plano-medida-fondo"></div>
      </div>
    </div>`;

  const lienzo = contenedor.querySelector('#plano-lienzo');

  function recalcularEscala() {
    const disponible = contenedor.clientWidth || 600;
    escala = Math.max(0.05, (disponible - 8) / local.ancho);
    lienzo.style.width = `${local.ancho * escala}px`;
    lienzo.style.height = `${local.fondo * escala}px`;
    // La rejilla del fondo marca cada metro: da escala de un vistazo.
    lienzo.style.backgroundSize = `${100 * escala}px ${100 * escala}px`;
    contenedor.querySelector('.plano-medida-ancho').textContent =
      `${(local.ancho / 100).toFixed(1)} m`;
    contenedor.querySelector('.plano-medida-fondo').textContent =
      `${(local.fondo / 100).toFixed(1)} m`;
  }

  function pintar() {
    recalcularEscala();
    lienzo.querySelectorAll('.plano-mueble').forEach((n) => n.remove());

    for (const e of datos) {
      if (e.activa === false) continue;
      lienzo.appendChild(nodoMueble(e));
    }
    marcarSolapes();
  }

  function nodoMueble(e) {
    const caja = huella(e);
    const n = document.createElement('div');
    n.className = 'plano-mueble';
    n.dataset.id = e.estructura_id ?? e.id;
    n.style.left = `${e.pos_x_cm * escala}px`;
    n.style.top = `${e.pos_y_cm * escala}px`;
    n.style.width = `${caja.ancho * escala}px`;
    n.style.height = `${caja.fondo * escala}px`;
    n.style.background = e.color_hex ?? '#d8dee0';
    n.dataset.tipo = e.tipo ?? '';
    if ((e.estructura_id ?? e.id) === seleccionado) n.classList.add('seleccionado');

    n.innerHTML = `
      <span class="pm-literal">${escapar(e.literal ?? '')}</span>
      <span class="pm-nombre">${escapar(e.nombre ?? '')}</span>
      ${e.calle ? `<span class="pm-calle">${escapar(e.calle)}</span>` : ''}
      <span class="pm-medida">${e.ancho_cm}×${e.fondo_cm}${e.rotacion_grados ? ` · ${e.rotacion_grados}°` : ''}</span>`;

    n.addEventListener('pointerdown', (ev) => empezarArrastre(ev, n, e));
    return n;
  }

  // -------------------------------------------------------
  // Arrastre
  // -------------------------------------------------------
  function empezarArrastre(ev, nodo, e) {
    ev.preventDefault();
    seleccionar(e);

    const caja = huella(e);
    const rectLienzo = lienzo.getBoundingClientRect();
    // Dónde se agarró el mueble, para que no salte bajo el dedo.
    const agarreX = ev.clientX - (rectLienzo.left + e.pos_x_cm * escala);
    const agarreY = ev.clientY - (rectLienzo.top + e.pos_y_cm * escala);

    nodo.setPointerCapture(ev.pointerId);
    nodo.classList.add('arrastrando');

    const mover = (ev2) => {
      const xPx = ev2.clientX - rectLienzo.left - agarreX;
      const yPx = ev2.clientY - rectLienzo.top - agarreY;

      // Nunca fuera de la sala: se recorta aquí para que el mueble no
      // se pueda soltar en un sitio que la base va a rechazar.
      const x = acotar(xPx / escala, 0, local.ancho - caja.ancho);
      const y = acotar(yPx / escala, 0, local.fondo - caja.fondo);

      e.pos_x_cm = Math.round(x);
      e.pos_y_cm = Math.round(y);
      nodo.style.left = `${e.pos_x_cm * escala}px`;
      nodo.style.top = `${e.pos_y_cm * escala}px`;
      marcarSolapes();
    };

    const soltar = () => {
      nodo.releasePointerCapture(ev.pointerId);
      nodo.classList.remove('arrastrando');
      nodo.removeEventListener('pointermove', mover);
      nodo.removeEventListener('pointerup', soltar);
      nodo.removeEventListener('pointercancel', soltar);

      // Se pega a la rejilla de 10 cm: un mueble a 37 cm de la pared no
      // existe en una tienda, y las cifras redondas se dictan por radio
      // sin equivocarse.
      e.pos_x_cm = acotar(Math.round(e.pos_x_cm / REJILLA_CM) * REJILLA_CM,
                          0, local.ancho - caja.ancho);
      e.pos_y_cm = acotar(Math.round(e.pos_y_cm / REJILLA_CM) * REJILLA_CM,
                          0, local.fondo - caja.fondo);

      pintar();
      alMover?.(e.estructura_id ?? e.id, e.pos_x_cm, e.pos_y_cm, e.rotacion_grados ?? 0);
    };

    nodo.addEventListener('pointermove', mover);
    nodo.addEventListener('pointerup', soltar);
    nodo.addEventListener('pointercancel', soltar);
  }

  function seleccionar(e) {
    seleccionado = e ? (e.estructura_id ?? e.id) : null;
    lienzo.querySelectorAll('.plano-mueble').forEach((n) => {
      n.classList.toggle('seleccionado', n.dataset.id === seleccionado);
    });
    alSeleccionar?.(e ?? null);
  }

  /**
   * Marca en rojo los muebles montados uno sobre otro.
   *
   * La misma comprobación existe en la base (fn_mover_estructura). Aquí
   * se repite para que se vea MIENTRAS se arrastra: enterarse al
   * guardar, cuando ya se soltó, obliga a repetir el movimiento.
   */
  function marcarSolapes() {
    const nodos = [...lienzo.querySelectorAll('.plano-mueble')];
    nodos.forEach((n) => n.classList.remove('solapado'));

    const activas = datos.filter((e) => e.activa !== false);
    for (let i = 0; i < activas.length; i += 1) {
      for (let j = i + 1; j < activas.length; j += 1) {
        if (!seSolapan(activas[i], activas[j])) continue;
        for (const e of [activas[i], activas[j]]) {
          const id = e.estructura_id ?? e.id;
          nodos.find((n) => n.dataset.id === id)?.classList.add('solapado');
        }
      }
    }
  }

  window.addEventListener('resize', pintar);
  pintar();

  return {
    /** Gira el mueble seleccionado en pasos de 90 grados. */
    girar(id, grados = 90) {
      const e = datos.find((x) => (x.estructura_id ?? x.id) === id);
      if (!e) return null;
      e.rotacion_grados = ((Number(e.rotacion_grados ?? 0) + grados) % 360 + 360) % 360;

      // Al girar cambia la huella: si al mueble ya no le queda sitio,
      // se lo trae hacia adentro en vez de dejarlo colgando.
      const caja = huella(e);
      e.pos_x_cm = acotar(e.pos_x_cm, 0, Math.max(0, local.ancho - caja.ancho));
      e.pos_y_cm = acotar(e.pos_y_cm, 0, Math.max(0, local.fondo - caja.fondo));

      pintar();
      alMover?.(id, e.pos_x_cm, e.pos_y_cm, e.rotacion_grados);
      return e;
    },
    seleccionar(id) {
      seleccionar(datos.find((x) => (x.estructura_id ?? x.id) === id) ?? null);
    },
    datos: () => datos,
    haySolapes: () => lienzo.querySelectorAll('.plano-mueble.solapado').length > 0,
    refrescar(nuevas) {
      datos = clonar(nuevas);
      Object.assign(local, medidasDelLocal(datos));
      pintar();
    },
    destruir() {
      window.removeEventListener('resize', pintar);
      contenedor.innerHTML = '';
    },
  };
}

// ---------------------------------------------------------
// Geometría
// ---------------------------------------------------------

/**
 * Huella del mueble en el piso.
 *
 * Girado 90 o 270 grados, lo que era ancho pasa a ser fondo. Ignorarlo
 * hace que una góndola de 180x45 girada se dibuje como si siguiera
 * ocupando 180 cm de frente, y el pasillo que aparece en el plano no es
 * el que queda en el local.
 */
export function huella(e) {
  const rot = ((Number(e.rotacion_grados ?? 0) % 360) + 360) % 360;
  if (rot === 90 || rot === 270) {
    return { ancho: Number(e.fondo_cm), fondo: Number(e.ancho_cm) };
  }
  if (rot === 0 || rot === 180) {
    return { ancho: Number(e.ancho_cm), fondo: Number(e.fondo_cm) };
  }
  // Ángulo libre: el cuadrado que envuelve al mueble en cualquier giro.
  const d = Math.hypot(Number(e.ancho_cm), Number(e.fondo_cm));
  return { ancho: d, fondo: d };
}

export function seSolapan(a, b) {
  const ca = huella(a);
  const cb = huella(b);
  return a.pos_x_cm < b.pos_x_cm + cb.ancho
      && a.pos_x_cm + ca.ancho > b.pos_x_cm
      && a.pos_y_cm < b.pos_y_cm + cb.fondo
      && a.pos_y_cm + ca.fondo > b.pos_y_cm;
}

function medidasDelLocal(estructuras) {
  const conMedida = (estructuras ?? []).find((e) => Number(e.ancho_local_cm) > 0);
  if (conMedida) {
    return {
      ancho: Number(conMedida.ancho_local_cm),
      fondo: Number(conMedida.fondo_local_cm),
    };
  }
  // Sin medidas cargadas se deduce de lo que ocupan los muebles, con
  // sitio para circular. Es un respaldo: lo correcto es medir el local.
  const activas = (estructuras ?? []).filter((e) => e.activa !== false);
  if (!activas.length) return { ancho: 800, fondo: 600 };
  return {
    ancho: Math.max(800, ...activas.map((e) => e.pos_x_cm + huella(e).ancho + 150)),
    fondo: Math.max(600, ...activas.map((e) => e.pos_y_cm + huella(e).fondo + 150)),
  };
}

function acotar(v, min, max) {
  return Math.min(Math.max(v, min), Math.max(min, max));
}

function clonar(xs) {
  return (xs ?? []).map((e) => ({ ...e }));
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}
