// Íconos del menú, dibujados como SVG dentro del propio archivo.
//
// POR QUÉ ASÍ: un paquete de íconos traído de un CDN deja de funcionar
// el día que la tienda se quede sin internet, y el punto de venta tiene
// que seguir abriendo. Son trazos simples sobre una rejilla de 24, con
// `currentColor`, para que tomen el color del enlace sin duplicar CSS.

const TRAZOS = {
  tablero:   '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/>' +
             '<rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  carrito:   '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/>' +
             '<path d="M2 3h2.2l2.5 12.2a1.5 1.5 0 0 0 1.5 1.2h9.1a1.5 1.5 0 0 0 1.5-1.2L21 7H5.2"/>',
  entrada:   '<path d="M12 3v10"/><path d="M8 9l4 4 4-4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  mapa:      '<path d="M9 3 3 5.5v15L9 18l6 3 6-2.5v-15L15 6 9 3z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
  reloj:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.4 2"/>',
  libro:     '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v18H5.5A1.5 1.5 0 0 1 4 19.5z"/><path d="M8 7h7"/><path d="M8 11h7"/><path d="M8 15h4"/>',
  ajuste:    '<path d="M5 6h14"/><path d="M5 12h14"/><path d="M5 18h14"/><circle cx="9" cy="6" r="2"/>' +
             '<circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  caja:      '<path d="M3 8 12 3l9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  etiqueta:  '<path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
  almacen:   '<path d="M3 10 12 4l9 6v10H3z"/><rect x="8" y="13" width="8" height="7"/>',
  camion:    '<rect x="1" y="6" width="13" height="10" rx="1"/><path d="M14 9h4l3 3.5V16h-7z"/>' +
             '<circle cx="6" cy="18.5" r="1.7"/><circle cx="17" cy="18.5" r="1.7"/>',
  grafico:   '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  escudo:    '<path d="M12 3l8 3v6c0 5-3.4 8.4-8 9.8C7.4 20.4 4 17 4 12V6z"/><path d="m9 12 2 2 4-4"/>',
  engranaje: '<circle cx="12" cy="12" r="3.2"/>' +
             '<path d="M20 12a8 8 0 0 0-.2-1.7l2-1.6-2-3.4-2.4 1a8 8 0 0 0-2.9-1.7L14 2h-4l-.5 2.6a8 8 0 0 0-2.9 1.7l-2.4-1-2 3.4 2 1.6a8 8 0 0 0 0 3.4l-2 1.6 2 3.4 2.4-1a8 8 0 0 0 2.9 1.7L10 22h4l.5-2.6a8 8 0 0 0 2.9-1.7l2.4 1 2-3.4-2-1.6c.1-.6.2-1.1.2-1.7z"/>',
  correo:    '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  local:     '<path d="M4 9h16v11H4z"/><path d="M3 9l1.5-5h15L21 9"/><path d="M9 20v-6h6v6"/>',
  personas:  '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/>' +
             '<path d="M16 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M17.5 14.2A6.5 6.5 0 0 1 21.5 20"/>',
  llave:     '<circle cx="7.5" cy="14.5" r="3.5"/><path d="m10.5 12 8-8 2.5 2.5-1.8 1.8 1.6 1.6-2.2 2.2-1.6-1.6L15 12.8"/>',
  senal:     '<path d="M4.5 19.5V14"/><path d="M9.5 19.5V10"/><path d="M14.5 19.5V6"/><path d="M19.5 19.5V3"/>',
  rayo:      '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z"/>',
  gota:      '<path d="M12 3s6 6.4 6 10.4a6 6 0 0 1-12 0C6 9.4 12 3 12 3z"/>',
  enlace:    '<path d="M10 13a4.5 4.5 0 0 0 6.4.2l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4L11 5.8"/>' +
             '<path d="M14 11a4.5 4.5 0 0 0-6.4-.2L5 13.4a4.5 4.5 0 0 0 6.4 6.4L13 18.2"/>',
  qr:        '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>' +
             '<rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/>' +
             '<path d="M20 14v3"/><path d="M14 20h3"/><path d="M20 20h1"/>',
  lupa:      '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  punto:     '<circle cx="12" cy="12" r="4"/>',
};

/** Devuelve el SVG del ícono pedido (o un punto si no existe). */
export function icono(nombre, clase = 'nav-icono') {
  const trazo = TRAZOS[nombre] ?? TRAZOS.punto;
  return `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${trazo}</svg>`;
}

/** Flecha del desplegable. Gira con CSS cuando el grupo está abierto. */
export function flecha() {
  return `<svg class="nav-flecha" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6"/></svg>`;
}

export const ICONOS_DISPONIBLES = Object.keys(TRAZOS);
