// Geometría del plano del local.
//
// Se prueba aparte del navegador porque es aritmética pura y es donde
// un error no se ve: un plano con dos góndolas superpuestas se dibuja
// perfecto en la pantalla y es imposible en el local. El día que el
// bodeguero no encuentre el producto, nadie va a sospechar del plano.

import test from 'node:test';
import assert from 'node:assert/strict';

// El módulo del editor toca el DOM al crearse, pero huella() y
// seSolapan() son funciones puras. Se importan con un document mínimo
// para que el módulo cargue.
globalThis.document = globalThis.document ?? {
  createElement: () => ({ set textContent(v) { this._t = v; }, get innerHTML() { return this._t ?? ''; } }),
};
globalThis.window = globalThis.window ?? { addEventListener() {}, removeEventListener() {} };

const { huella, seSolapan } = await import('../web/js/lib/plano-editor.js');

const gondola = { ancho_cm: 180, fondo_cm: 45, pos_x_cm: 0, pos_y_cm: 0, rotacion_grados: 0 };

test('sin girar, la huella es ancho por fondo', () => {
  assert.deepEqual(huella(gondola), { ancho: 180, fondo: 45 });
});

test('girada 90 grados, ancho y fondo se intercambian', () => {
  // Es el error que haría dibujar un pasillo que en el local no existe:
  // la góndola girada ocupa 45 cm de frente y 180 de fondo.
  assert.deepEqual(huella({ ...gondola, rotacion_grados: 90 }), { ancho: 45, fondo: 180 });
  assert.deepEqual(huella({ ...gondola, rotacion_grados: 270 }), { ancho: 45, fondo: 180 });
});

test('girada 180 grados ocupa lo mismo que sin girar', () => {
  assert.deepEqual(huella({ ...gondola, rotacion_grados: 180 }), { ancho: 180, fondo: 45 });
});

test('en un ángulo libre se usa el cuadrado que la envuelve', () => {
  const h = huella({ ...gondola, rotacion_grados: 30 });
  const diagonal = Math.hypot(180, 45);
  assert.equal(h.ancho, diagonal);
  assert.equal(h.fondo, diagonal);
  // Es deliberadamente exigente: prefiere avisar de más que dejar pasar
  // un solape que en el local sería un mueble encima de otro.
  assert.ok(h.ancho > 180);
});

test('dos muebles separados no se solapan', () => {
  const a = { ...gondola, pos_x_cm: 0, pos_y_cm: 0 };
  const b = { ...gondola, pos_x_cm: 200, pos_y_cm: 0 };
  assert.equal(seSolapan(a, b), false);
});

test('dos muebles pegados, sin invadirse, no se solapan', () => {
  // Borde con borde: 180 termina justo donde empieza 180.
  const a = { ...gondola, pos_x_cm: 0, pos_y_cm: 0 };
  const b = { ...gondola, pos_x_cm: 180, pos_y_cm: 0 };
  assert.equal(seSolapan(a, b), false);
});

test('un centímetro de invasión ya es solape', () => {
  const a = { ...gondola, pos_x_cm: 0, pos_y_cm: 0 };
  const b = { ...gondola, pos_x_cm: 179, pos_y_cm: 0 };
  assert.equal(seSolapan(a, b), true);
});

test('el solape también se detecta en el otro eje', () => {
  const a = { ...gondola, pos_x_cm: 0, pos_y_cm: 0 };
  const b = { ...gondola, pos_x_cm: 0, pos_y_cm: 44 };
  assert.equal(seSolapan(a, b), true);
});

test('girar un mueble puede crear un solape que antes no existía', () => {
  // La góndola A ocupa de y=0 a y=45. La B, sin girar, empieza en y=60:
  // no se tocan. Girada 90°, la A pasa a ocupar hasta y=180 y sí choca.
  const a = { ...gondola, pos_x_cm: 0, pos_y_cm: 0 };
  const b = { ...gondola, pos_x_cm: 0, pos_y_cm: 60 };
  assert.equal(seSolapan(a, b), false);
  assert.equal(seSolapan({ ...a, rotacion_grados: 90 }, b), true);
});

test('un frigorífico dentro de una góndola se detecta', () => {
  const gond = { ancho_cm: 180, fondo_cm: 60, pos_x_cm: 100, pos_y_cm: 100, rotacion_grados: 0 };
  const frig = { ancho_cm: 80, fondo_cm: 65, pos_x_cm: 120, pos_y_cm: 110, rotacion_grados: 0 };
  assert.equal(seSolapan(gond, frig), true);
});
