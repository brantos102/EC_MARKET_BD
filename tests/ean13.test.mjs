import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularDigitoEAN13,
  validarEAN13,
  normalizarCodigoEscaneado,
  paisDesdeEAN13,
} from '../web/js/lib/ean13.js';

test('calcula el dígito verificador de códigos conocidos', () => {
  // Casos de referencia públicos de la especificación GS1
  assert.equal(calcularDigitoEAN13('400638133393'), '1');   // 4006381333931
  assert.equal(calcularDigitoEAN13('590123412345'), '7');   // 5901234123457
  assert.equal(calcularDigitoEAN13('978020137962'), '4');   // 9780201379624
});

test('valida EAN-13 correctos', () => {
  assert.ok(validarEAN13('4006381333931'));
  assert.ok(validarEAN13('5901234123457'));
  assert.ok(validarEAN13('9780201379624'));
});

test('rechaza EAN-13 con dígito verificador incorrecto', () => {
  assert.ok(!validarEAN13('4006381333932'));
  assert.ok(!validarEAN13('5901234123450'));
});

test('rechaza formatos inválidos', () => {
  assert.ok(!validarEAN13('123'));
  assert.ok(!validarEAN13('40063813339311'));
  assert.ok(!validarEAN13('400638133393A'));
  assert.ok(!validarEAN13(''));
  assert.ok(!validarEAN13(null));
  assert.ok(!validarEAN13(undefined));
});

test('la base debe tener 12 dígitos exactos', () => {
  assert.throws(() => calcularDigitoEAN13('123'), /12 dígitos/);
  assert.throws(() => calcularDigitoEAN13('4006381333931'), /12 dígitos/);
});

test('normaliza lo que entrega el lector de código de barras', () => {
  assert.equal(normalizarCodigoEscaneado('  4006381333931\n'), '4006381333931');
  assert.equal(normalizarCodigoEscaneado('4006381333931'), '4006381333931');
});

test('convierte UPC-A de 12 dígitos a EAN-13', () => {
  // 036000291452 (UPC-A válido) -> 0036000291452
  assert.equal(normalizarCodigoEscaneado('036000291452'), '0036000291452');
});

test('devuelve null cuando el escaneo no es un código válido', () => {
  assert.equal(normalizarCodigoEscaneado('4006381333932'), null);
  assert.equal(normalizarCodigoEscaneado('abc'), null);
  assert.equal(normalizarCodigoEscaneado('12345'), null);
  assert.equal(normalizarCodigoEscaneado(null), null);
});

test('identifica el prefijo de país de Ecuador', () => {
  const base = '786100010001';
  const ean = base + calcularDigitoEAN13(base);
  assert.ok(validarEAN13(ean));
  assert.equal(paisDesdeEAN13(ean), 'Ecuador');
});

test('todo código generado con calcularDigitoEAN13 se valida', () => {
  for (let i = 0; i < 500; i++) {
    const base = String(786000000000 + i * 7919).slice(0, 12);
    const ean = base + calcularDigitoEAN13(base);
    assert.ok(validarEAN13(ean), `falló para ${ean}`);
  }
});
