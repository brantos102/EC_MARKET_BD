// Reglas de cantidad, en un solo lugar.
//
// EL PROBLEMA QUE RESUELVE: la caja podía quedar con "1,03 guineos". Un
// guineo se despacha de uno en uno; 1,03 es un error de captura que
// después aparece como un inventario que no cuadra y nadie sabe por qué.
//
// LA REGLA: la unidad de medida manda.
//   · Unidad, funda, docena, gaveta → solo enteros. El campo no deja
//     escribir una coma y la base de datos lo rechaza igual (trigger
//     trg_cantidad_venta), por si alguien entra por otro camino.
//   · Libra, kilo, litro → admiten decimales, porque el producto se
//     pesa. Pero los botones + y − se mueven en el paso del producto
//     (media libra, un cuarto de kilo), no de centésima en centésima.
//     Para el peso exacto de la balanza está el teclado de peso.
//
// Las dos cosas son necesarias: la interfaz evita el error, la base lo
// hace imposible.

/** Cuánto suma o resta cada toque de los botones + y −. */
export function paso(producto) {
  const p = Number(producto?.paso_venta);
  if (Number.isFinite(p) && p > 0) return p;
  return fracciona(producto) ? 0.5 : 1;
}

export function fracciona(producto) {
  return Boolean(producto?.permite_fraccion);
}

/**
 * Decimales con los que se guarda la cantidad.
 *
 * Ojo: no son los decimales del paso, son los de la balanza. El paso de
 * un tomate es media libra, pero la balanza puede marcar 1,03 lb y ese
 * valor tiene que conservarse tal cual. Tres decimales es lo que admite
 * la columna numeric(14,4) de la base con margen de sobra.
 */
export function decimales(producto) {
  return fracciona(producto) ? 3 : 0;
}

/**
 * Texto de la cantidad tal como debe verse en pantalla: sin ceros de
 * relleno. 2 se ve "2", no "2.000"; 1,03 se ve "1.03".
 */
export function formatear(cantidad, producto) {
  const n = Number(cantidad);
  if (!Number.isFinite(n)) return '0';
  if (!fracciona(producto)) return String(Math.round(n));
  return String(Number(n.toFixed(decimales(producto))));
}

/**
 * Ajusta una cantidad a lo que la unidad permite.
 * @returns {{cantidad: number, ok: boolean, mensaje?: string}}
 */
export function normalizar(cantidad, producto) {
  const n = Number(cantidad);

  if (!Number.isFinite(n) || n < 0) {
    return { cantidad: 0, ok: false, mensaje: 'La cantidad no es un número válido' };
  }

  if (!fracciona(producto)) {
    const entero = Math.round(n);
    if (Math.abs(n - entero) > 1e-9) {
      return {
        cantidad: entero,
        ok: false,
        mensaje: `"${producto?.nombre ?? 'El producto'}" se vende por ${unidadSingular(producto)} entera: ` +
                 `se ajustó ${n} a ${entero}.`,
      };
    }
    return { cantidad: entero, ok: true };
  }

  // Producto a peso: se conserva lo que marque la balanza, solo se
  // recorta el ruido de la coma flotante (un 1,0299999999 que sale de
  // una resta se guarda como 1,03).
  return { cantidad: Number(n.toFixed(decimales(producto))), ok: true };
}

/** Siguiente cantidad al tocar + (o − con signo negativo). */
export function sumarPaso(cantidadActual, producto, signo = 1) {
  const p = paso(producto);
  const bruto = Number(cantidadActual) + p * signo;
  if (bruto <= 0) return 0;

  if (!fracciona(producto)) return Math.max(0, Math.round(bruto));

  // Se alinea al múltiplo del paso para que 0,5 + 0,5 dé 1 exacto y no
  // se acumule ruido decimal tras veinte toques. Esto sí redondea el
  // peso de la balanza: es lo que se espera al tocar + o −, mientras
  // que el teclado de peso guarda el valor exacto sin pasar por aquí.
  const alineado = Math.round(bruto / p) * p;
  return Number(alineado.toFixed(decimales(producto)));
}

function unidadSingular(producto) {
  const n = (producto?.unidad_nombre ?? 'unidad').toLowerCase();
  return n;
}
