import test from 'node:test';
import assert from 'node:assert/strict';
import { procesarMovimiento } from '../web/js/lib/costing.js';

test('ENTRADA desde saldo cero fija el costo promedio al costo de la primera entrada', () => {
  const r = procesarMovimiento({ stock: 0, costoPromedio: 0 }, { tipo: 'ENTRADA', cantidad: 100, costoUnitario: 0.8 });
  assert.equal(r.stock, 100);
  assert.equal(r.costoPromedio, 0.8);
  assert.equal(r.valorTotal, 80);
});

test('ENTRADA subsecuente recalcula el promedio ponderado', () => {
  // saldo: 100 @ 0.80 ; entra 50 @ 0.90 -> (100*0.8 + 50*0.9) / 150 = 0.8333...
  const r = procesarMovimiento({ stock: 100, costoPromedio: 0.8 }, { tipo: 'ENTRADA', cantidad: 50, costoUnitario: 0.9 });
  assert.equal(r.stock, 150);
  assert.ok(Math.abs(r.costoPromedio - 0.833333) < 1e-4);
});

test('SALIDA usa el costo promedio vigente y no lo modifica', () => {
  const r = procesarMovimiento({ stock: 150, costoPromedio: 0.833333 }, { tipo: 'SALIDA', cantidad: 30 });
  assert.equal(r.stock, 120);
  assert.equal(r.costoPromedio, 0.833333);
  assert.ok(Math.abs(r.costoTotal - 25) < 1e-2);
});

test('SALIDA mayor al stock disponible lanza error', () => {
  assert.throws(
    () => procesarMovimiento({ stock: 10, costoPromedio: 1 }, { tipo: 'SALIDA', cantidad: 20 }),
    /Stock insuficiente/
  );
});

test('ENTRADA sin costo unitario lanza error', () => {
  assert.throws(
    () => procesarMovimiento({ stock: 0, costoPromedio: 0 }, { tipo: 'ENTRADA', cantidad: 10 }),
    /costoUnitario/
  );
});

test('AJUSTE_POSITIVO suma cantidad al costo promedio vigente', () => {
  const r = procesarMovimiento({ stock: 50, costoPromedio: 2 }, { tipo: 'AJUSTE_POSITIVO', cantidad: 5 });
  assert.equal(r.stock, 55);
  assert.equal(r.costoPromedio, 2);
});

test('AJUSTE_NEGATIVO resta cantidad sin cambiar el costo promedio', () => {
  const r = procesarMovimiento({ stock: 55, costoPromedio: 2 }, { tipo: 'AJUSTE_NEGATIVO', cantidad: 5 });
  assert.equal(r.stock, 50);
  assert.equal(r.costoPromedio, 2);
});

test('cantidad <= 0 siempre lanza error', () => {
  assert.throws(() => procesarMovimiento({ stock: 10, costoPromedio: 1 }, { tipo: 'ENTRADA', cantidad: 0, costoUnitario: 1 }));
  assert.throws(() => procesarMovimiento({ stock: 10, costoPromedio: 1 }, { tipo: 'SALIDA', cantidad: -5 }));
});

test('tipo no soportado lanza error', () => {
  assert.throws(() => procesarMovimiento({ stock: 10, costoPromedio: 1 }, { tipo: 'OTRO', cantidad: 1 }));
});
