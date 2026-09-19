// Cálculo del precio de una línea de venta: resuelve precio mayor/menor
// y aplica la promoción vigente.
//
// Espejo en SQL de fn_calcular_precio_linea (db/004_ventas_promociones.sql).
// El frontend lo usa para mostrar el total en vivo mientras el cajero
// escanea; la base de datos vuelve a calcularlo al guardar y es la que manda.

/**
 * @typedef {Object} Promocion
 * @property {string} id
 * @property {string} nombre
 * @property {'N_POR_DOLAR'|'N_POR_M'|'PORCENTAJE'|'PRECIO_FIJO'} tipo
 * @property {number|null} cantidad
 * @property {number} valor
 */

/**
 * @param {{precio_venta_menor:number, precio_venta_mayor:number, cantidad_minima_mayor:number}} producto
 * @param {'MENOR'|'MAYOR'} tipoVenta
 * @param {number} cantidad
 * @returns {number}
 */
export function precioBase(producto, tipoVenta, cantidad) {
  const menor = Number(producto.precio_venta_menor ?? 0);
  const mayor = Number(producto.precio_venta_mayor ?? 0);
  const minimo = Number(producto.cantidad_minima_mayor ?? 0);

  if (tipoVenta === 'MAYOR' && mayor > 0 && cantidad >= minimo) {
    return mayor;
  }
  return menor;
}

/**
 * Calcula el total de una línea aplicando la promoción si conviene.
 * @param {{precio_venta_menor:number, precio_venta_mayor:number, cantidad_minima_mayor:number}} producto
 * @param {'MENOR'|'MAYOR'} tipoVenta
 * @param {number} cantidad
 * @param {Promocion|null} promocion
 * @returns {{precioBase:number, totalSinPromo:number, totalConPromo:number, descuento:number, promocionAplicada:Promocion|null}}
 */
export function calcularLinea(producto, tipoVenta, cantidad, promocion = null) {
  if (!(cantidad > 0)) {
    throw new Error('La cantidad debe ser mayor a 0');
  }

  const precio = precioBase(producto, tipoVenta, cantidad);
  const totalSinPromo = redondear(cantidad * precio);
  let total = totalSinPromo;

  if (promocion) {
    const n = Number(promocion.cantidad ?? 0);
    const valor = Number(promocion.valor ?? 0);

    if (promocion.tipo === 'N_POR_DOLAR' && n > 0) {
      const grupos = Math.floor(cantidad / n);
      const resto = cantidad - grupos * n;
      total = redondear(grupos * valor + resto * precio);

    } else if (promocion.tipo === 'N_POR_M' && n > 0) {
      const grupos = Math.floor(cantidad / n);
      const resto = cantidad - grupos * n;
      total = redondear((grupos * valor + resto) * precio);

    } else if (promocion.tipo === 'PORCENTAJE') {
      total = redondear(totalSinPromo * (1 - valor / 100));

    } else if (promocion.tipo === 'PRECIO_FIJO') {
      total = redondear(cantidad * valor);
    }

    // Una promoción nunca debe encarecer el producto
    if (total > totalSinPromo) {
      total = totalSinPromo;
    }
  }

  return {
    precioBase: precio,
    totalSinPromo,
    totalConPromo: total,
    descuento: redondear(totalSinPromo - total),
    promocionAplicada: total < totalSinPromo ? promocion : null,
  };
}

/**
 * Calcula el impuesto de una línea ya neta de promoción.
 * @param {number} subtotal
 * @param {number} tarifaPorcentaje
 * @returns {number}
 */
export function calcularImpuesto(subtotal, tarifaPorcentaje) {
  return redondear(subtotal * (Number(tarifaPorcentaje) || 0) / 100);
}

/**
 * Totaliza un carrito completo.
 * @param {{subtotal:number, valor_impuesto:number, descuento:number}[]} lineas
 */
export function totalizarCarrito(lineas) {
  const subtotal = redondear(lineas.reduce((a, l) => a + Number(l.subtotal || 0), 0));
  const impuesto = redondear(lineas.reduce((a, l) => a + Number(l.valor_impuesto || 0), 0));
  const descuento = redondear(lineas.reduce((a, l) => a + Number(l.descuento || 0), 0));
  return { subtotal, impuesto, descuento, total: redondear(subtotal + impuesto) };
}

function redondear(n) {
  return Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
}
