// Pruebas de las reglas de cantidad.
//
// El caso que originó este archivo: la caja mostraba "1,03" en un
// producto que se vende de uno en uno. Aquí queda fijado que eso no
// puede volver a pasar, y que lo que sí se pesa siga admitiendo
// decimales.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  paso, fracciona, decimales, formatear, normalizar, sumarPaso,
} from '../web/js/lib/cantidad.js';

const GUINEO_UNIDAD = {
  nombre: 'Guineo de seda',
  unidad: 'UND',
  unidad_nombre: 'Unidad',
  permite_fraccion: false,
  paso_venta: 1,
};

const TOMATE_LIBRA = {
  nombre: 'Tomate riñón',
  unidad: 'LB',
  unidad_nombre: 'Libra',
  permite_fraccion: true,
  paso_venta: 0.5,
};

const ACEITE_LITRO = {
  nombre: 'Aceite a granel',
  unidad: 'LT',
  unidad_nombre: 'Litro',
  permite_fraccion: true,
  paso_venta: 0.25,
};

test('un producto por unidad no admite decimales', () => {
  const r = normalizar(1.03, GUINEO_UNIDAD);
  assert.equal(r.cantidad, 1);
  assert.equal(r.ok, false);
  assert.match(r.mensaje, /unidad entera/);
});

test('un producto por unidad acepta enteros sin quejarse', () => {
  const r = normalizar(3, GUINEO_UNIDAD);
  assert.equal(r.cantidad, 3);
  assert.equal(r.ok, true);
  assert.equal(r.mensaje, undefined);
});

test('redondea al entero más cercano, no trunca', () => {
  assert.equal(normalizar(2.7, GUINEO_UNIDAD).cantidad, 3);
  assert.equal(normalizar(2.2, GUINEO_UNIDAD).cantidad, 2);
});

test('un producto a peso conserva sus decimales', () => {
  const r = normalizar(1.03, TOMATE_LIBRA);
  assert.equal(r.ok, true);
  assert.equal(r.cantidad, 1.03);
});

test('el ruido de la coma flotante se limpia', () => {
  // 0.1 + 0.2 = 0.30000000000000004 en JavaScript
  assert.equal(normalizar(0.1 + 0.2, TOMATE_LIBRA).cantidad, 0.3);
});

test('el paso sale de la unidad, no de un valor fijo', () => {
  assert.equal(paso(GUINEO_UNIDAD), 1);
  assert.equal(paso(TOMATE_LIBRA), 0.5);
  assert.equal(paso(ACEITE_LITRO), 0.25);
});

test('sin paso declarado se usa uno razonable según la unidad', () => {
  assert.equal(paso({ permite_fraccion: false }), 1);
  assert.equal(paso({ permite_fraccion: true }), 0.5);
  assert.equal(paso({ permite_fraccion: true, paso_venta: 0 }), 0.5);
  assert.equal(paso({ permite_fraccion: false, paso_venta: 'x' }), 1);
});

test('el botón + suma una unidad entera y nunca deja decimales', () => {
  assert.equal(sumarPaso(1, GUINEO_UNIDAD, 1), 2);
  assert.equal(sumarPaso(1.03, GUINEO_UNIDAD, 1), 2);
});

test('el botón + suma media libra y no acumula ruido', () => {
  let n = 0;
  for (let i = 0; i < 20; i++) n = sumarPaso(n, TOMATE_LIBRA, 1);
  assert.equal(n, 10);
});

test('el botón − no deja la cantidad en negativo', () => {
  assert.equal(sumarPaso(1, GUINEO_UNIDAD, -1), 0);
  assert.equal(sumarPaso(0, GUINEO_UNIDAD, -1), 0);
  assert.equal(sumarPaso(0.5, TOMATE_LIBRA, -1), 0);
});

test('el botón − sobre un peso raro se alinea al paso', () => {
  // 1,03 lb menos media libra: se alinea a 0,5 en vez de dejar 0,53
  assert.equal(sumarPaso(1.03, TOMATE_LIBRA, -1), 0.5);
});

test('se muestra la cantidad sin ceros de relleno', () => {
  assert.equal(decimales(GUINEO_UNIDAD), 0);
  assert.equal(decimales(TOMATE_LIBRA), 3);
  assert.equal(formatear(2, GUINEO_UNIDAD), '2');
  assert.equal(formatear(2.4, GUINEO_UNIDAD), '2');
  assert.equal(formatear(1.5, TOMATE_LIBRA), '1.5');
  assert.equal(formatear(1.03, TOMATE_LIBRA), '1.03');
  assert.equal(formatear(2, TOMATE_LIBRA), '2');
  assert.equal(formatear(0.25, ACEITE_LITRO), '0.25');
});

test('fracciona refleja la unidad', () => {
  assert.equal(fracciona(GUINEO_UNIDAD), false);
  assert.equal(fracciona(TOMATE_LIBRA), true);
  assert.equal(fracciona(undefined), false);
});

test('una cantidad que no es número se rechaza', () => {
  assert.equal(normalizar('abc', GUINEO_UNIDAD).ok, false);
  assert.equal(normalizar(-3, TOMATE_LIBRA).ok, false);
});
