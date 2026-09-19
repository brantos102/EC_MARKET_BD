// Lógica de costeo por PROMEDIO PONDERADO.
// Espejo en JavaScript de la función SQL fn_procesar_movimiento_inventario
// (db/schema.sql). Se usa en el frontend para previsualizar el efecto de un
// movimiento antes de guardarlo; la fuente de verdad sigue siendo la base
// de datos (el trigger recalcula todo del lado del servidor).
//
// Funciona igual en el navegador (<script type="module">) y en Node
// (usado por tests/costing.test.mjs), sin dependencias externas.

/**
 * @typedef {Object} Saldo
 * @property {number} stock
 * @property {number} costoPromedio
 */

/**
 * Calcula el nuevo saldo tras un movimiento de inventario.
 * @param {Saldo} saldoActual
 * @param {{tipo: 'ENTRADA'|'SALIDA'|'AJUSTE_POSITIVO'|'AJUSTE_NEGATIVO', cantidad: number, costoUnitario?: number}} movimiento
 * @returns {{stock: number, costoPromedio: number, costoUnitarioAplicado: number, costoTotal: number, valorTotal: number}}
 */
export function procesarMovimiento(saldoActual, movimiento) {
  const { stock, costoPromedio } = saldoActual;
  const { tipo, cantidad, costoUnitario } = movimiento;

  if (!(cantidad > 0)) {
    throw new Error('La cantidad debe ser mayor a 0');
  }

  if (tipo === 'ENTRADA') {
    if (!(costoUnitario > 0)) {
      throw new Error('costoUnitario es obligatorio y debe ser > 0 en una ENTRADA');
    }
    const nuevoStock = stock + cantidad;
    const nuevoCostoPromedio = (stock * costoPromedio + cantidad * costoUnitario) / nuevoStock;
    return {
      stock: nuevoStock,
      costoPromedio: nuevoCostoPromedio,
      costoUnitarioAplicado: costoUnitario,
      costoTotal: cantidad * costoUnitario,
      valorTotal: nuevoStock * nuevoCostoPromedio,
    };
  }

  if (tipo === 'AJUSTE_POSITIVO') {
    const nuevoStock = stock + cantidad;
    return {
      stock: nuevoStock,
      costoPromedio,
      costoUnitarioAplicado: costoPromedio,
      costoTotal: cantidad * costoPromedio,
      valorTotal: nuevoStock * costoPromedio,
    };
  }

  if (tipo === 'SALIDA' || tipo === 'AJUSTE_NEGATIVO') {
    if (cantidad > stock) {
      throw new Error(`Stock insuficiente: disponible ${stock}, solicitado ${cantidad}`);
    }
    const nuevoStock = stock - cantidad;
    return {
      stock: nuevoStock,
      costoPromedio,
      costoUnitarioAplicado: costoPromedio,
      costoTotal: cantidad * costoPromedio,
      valorTotal: nuevoStock * costoPromedio,
    };
  }

  throw new Error(`Tipo de movimiento no soportado: ${tipo}`);
}
