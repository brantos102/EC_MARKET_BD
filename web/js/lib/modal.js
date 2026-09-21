// Modal reutilizable, sin dependencias.
// Un solo modal a la vez; se cierra con Escape o clic en el fondo.

let contenedorActual = null;
// Lo que hay que hacer al cerrar, se cierre como se cierre: con el
// botón, con Escape o pulsando el fondo. Sin esto, un modal que dejó
// algo encendido —la cámara del escáner, por ejemplo— lo dejaba
// encendido al salir por cualquier camino que no fuera su propio botón.
let alCerrarActual = null;

/**
 * @param {{
 *   titulo: string,
 *   contenido: string,
 *   botones?: {texto:string, clase?:string, accion:Function, id?:string}[],
 *   alAbrir?: (modal: HTMLElement) => void,
 *   alCerrar?: () => void,
 *   ancho?: string,
 * }} opts
 */
export function abrirModal(opts) {
  cerrarModal();

  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';

  const modal = document.createElement('div');
  modal.className = 'modal';
  if (opts.ancho) modal.style.maxWidth = opts.ancho;

  modal.innerHTML = `
    <div class="modal-head">
      <h3>${opts.titulo}</h3>
      <button class="modal-cerrar" aria-label="Cerrar">✕</button>
    </div>
    <div class="modal-cuerpo">${opts.contenido}</div>
    <div class="modal-pie"></div>
  `;

  const pie = modal.querySelector('.modal-pie');
  (opts.botones ?? []).forEach((b) => {
    const btn = document.createElement('button');
    btn.textContent = b.texto;
    btn.className = b.clase ?? 'btn-secundario';
    if (b.id) btn.id = b.id;
    btn.addEventListener('click', () => b.accion(modal));
    pie.appendChild(btn);
  });

  modal.querySelector('.modal-cerrar').addEventListener('click', cerrarModal);
  fondo.addEventListener('click', (e) => {
    if (e.target === fondo) cerrarModal();
  });

  fondo.appendChild(modal);
  document.body.appendChild(fondo);
  contenedorActual = fondo;

  document.addEventListener('keydown', alPresionarEscape);
  alCerrarActual = opts.alCerrar ?? null;
  opts.alAbrir?.(modal);
  return modal;
}

export function cerrarModal() {
  if (contenedorActual) {
    contenedorActual.remove();
    contenedorActual = null;
    document.removeEventListener('keydown', alPresionarEscape);

    const alCerrar = alCerrarActual;
    alCerrarActual = null;
    // Se llama al final y aislado: si la limpieza falla, el modal ya
    // desapareció de la pantalla igual.
    try { alCerrar?.(); } catch (err) { console.error(err); }
  }
}

function alPresionarEscape(e) {
  if (e.key === 'Escape') cerrarModal();
}
