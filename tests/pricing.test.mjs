import test from 'node:test';
import assert from 'node:assert/strict';
import {
  precioBase,
  calcularLinea,
  calcularImpuesto,
  totalizarCarrito,
} from '../web/js/lib/pricing.js';

const producto = {
  precio_venta_menor: 1.00,
  precio_venta_mayor: 0.80,
  cantidad_minima_mayor: 12,
};

test('venta al detalle usa siempre el precio menor', () => {
  assert.equal(precioBase(producto, 'MENOR', 1), 1.00);
  assert.equal(precioBase(producto, 'MENOR', 100), 1.00);
});

test('venta al por mayor solo aplica si alcanza la cantidad mínima', () => {
  assert.equal(precioBase(producto, 'MAYOR', 11), 1.00);
  assert.equal(precioBase(producto, 'MAYOR', 12), 0.80);
  assert.equal(precioBase(producto, 'MAYOR', 50), 0.80);
});

test('línea sin promoción es cantidad por precio', () => {
  const r = calcularLinea(producto, 'MENOR', 5);
  assert.equal(r.totalConPromo, 5);
  assert.equal(r.descuento, 0);
  assert.equal(r.promocionAplicada, null);
});

test('promoción "3 por $1" cobra los grupos completos y el resto al precio normal', () => {
  const promo = { id: 'p1', nombre: '3 x $1', tipo: 'N_POR_DOLAR', cantidad: 3, valor: 1.00 };
  // 7 unidades = 2 grupos ($2) + 1 suelta ($1) = $3
  const r = calcularLinea(producto, 'MENOR', 7, promo);
  assert.equal(r.totalSinPromo, 7);
  assert.equal(r.totalConPromo, 3);
  assert.equal(r.descuento, 4);
  assert.equal(r.promocionAplicada.id, 'p1');
});

test('promoción "3 por $1" con menos del grupo no descuenta nada', () => {
  const promo = { id: 'p1', nombre: '3 x $1', tipo: 'N_POR_DOLAR', cantidad: 3, valor: 1.00 };
  const r = calcularLinea(producto, 'MENOR', 2, promo);
  assert.equal(r.totalConPromo, 2);
  assert.equal(r.descuento, 0);
});

test('promoción 2x1 paga una de cada dos', () => {
  const promo = { id: 'p2', nombre: '2x1', tipo: 'N_POR_M', cantidad: 2, valor: 1 };
  // 5 unidades = 2 grupos (paga 2) + 1 suelta = paga 3
  const r = calcularLinea(producto, 'MENOR', 5, promo);
  assert.equal(r.totalConPromo, 3);
  assert.equal(r.descuento, 2);
});

test('promoción por porcentaje descuenta sobre el total', () => {
  const promo = { id: 'p3', nombre: '20%', tipo: 'PORCENTAJE', cantidad: null, valor: 20 };
  const r = calcularLinea(producto, 'MENOR', 10, promo);
  assert.equal(r.totalConPromo, 8);
  assert.equal(r.descuento, 2);
});

test('promoción de precio fijo reemplaza el precio unitario', () => {
  const promo = { id: 'p4', nombre: 'Fijo 0.40', tipo: 'PRECIO_FIJO', cantidad: null, valor: 0.40 };
  const r = calcularLinea(producto, 'MENOR', 10, promo);
  assert.equal(r.totalConPromo, 4);
  assert.equal(r.descuento, 6);
});

test('una promoción nunca encarece el producto', () => {
  // Precio fijo por ENCIMA del precio de lista: debe ignorarse
  const promo = { id: 'p5', nombre: 'Malo', tipo: 'PRECIO_FIJO', cantidad: null, valor: 5.00 };
  const r = calcularLinea(producto, 'MENOR', 3, promo);
  assert.equal(r.totalConPromo, 3);
  assert.equal(r.descuento, 0);
  assert.equal(r.promocionAplicada, null);
});

test('la promoción se combina con el precio mayorista', () => {
  const promo = { id: 'p3', nombre: '10%', tipo: 'PORCENTAJE', cantidad: null, valor: 10 };
  // 20 unidades a precio mayor 0.80 = 16, menos 10% = 14.40
  const r = calcularLinea(producto, 'MAYOR', 20, promo);
  assert.equal(r.precioBase, 0.80);
  assert.equal(r.totalConPromo, 14.4);
});

test('cantidad inválida lanza error', () => {
  assert.throws(() => calcularLinea(producto, 'MENOR', 0));
  assert.throws(() => calcularLinea(producto, 'MENOR', -3));
});

test('calcula IVA sobre el subtotal neto', () => {
  assert.equal(calcularImpuesto(100, 15), 15);
  assert.equal(calcularImpuesto(100, 0), 0);
  assert.equal(calcularImpuesto(8.5, 15), 1.275);
});

test('totaliza el carrito sumando subtotales e impuestos', () => {
  const lineas = [
    { subtotal: 10, valor_impuesto: 1.5, descuento: 2 },
    { subtotal: 5, valor_impuesto: 0, descuento: 0 },
  ];
  const t = totalizarCarrito(lineas);
  assert.equal(t.subtotal, 15);
  assert.equal(t.impuesto, 1.5);
  assert.equal(t.descuento, 2);
  assert.equal(t.total, 16.5);
});
