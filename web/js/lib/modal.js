// Modal reutilizable, sin dependencias.
// Un solo modal a la vez; se cierra con Escape o clic en el fondo.

let contenedorActual = null;

/**
 * @param {{
 *   titulo: string,
 *   contenido: string,
 *   botones?: {texto:string, clase?:string, accion:Function, id?:string}[],
 *   alAbrir?: (modal: HTMLElement) => void,
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
  opts.alAbrir?.(modal);
  return modal;
}

export function cerrarModal() {
  if (contenedorActual) {
    contenedorActual.remove();
    contenedorActual = null;
    document.removeEventListener('keydown', alPresionarEscape);
  }
}

function alPresionarEscape(e) {
  if (e.key === 'Escape') cerrarModal();
}
