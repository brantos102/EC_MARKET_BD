// Validación de códigos de barras EAN-13 (ISO/IEC 15420, simbología GS1).
//
// El dígito 13 es un verificador: se suman los 12 primeros dígitos dando
// peso 1 a las posiciones impares y peso 3 a las pares; el verificador es
// lo que falta para llegar a la siguiente decena.
//
// Espejo en SQL: fn_validar_ean13 (db/002_catalogos_ubicaciones.sql)

/**
 * Calcula el dígito verificador de una base de 12 dígitos.
 * @param {string} base12
 * @returns {string} un dígito
 */
export function calcularDigitoEAN13(base12) {
  if (!/^[0-9]{12}$/.test(base12)) {
    throw new Error('La base del EAN-13 debe tener exactamente 12 dígitos');
  }
  let suma = 0;
  for (let i = 0; i < 12; i++) {
    const digito = Number(base12[i]);
    // i es 0-based: la posición 1 (impar) es i=0 -> peso 1
    suma += (i % 2 === 0) ? digito : digito * 3;
  }
  return String((10 - (suma % 10)) % 10);
}

/**
 * Valida un EAN-13 completo (13 dígitos con verificador correcto).
 * @param {string} codigo
 * @returns {boolean}
 */
export function validarEAN13(codigo) {
  if (typeof codigo !== 'string') return false;
  const limpio = codigo.trim();
  if (!/^[0-9]{13}$/.test(limpio)) return false;
  return calcularDigitoEAN13(limpio.slice(0, 12)) === limpio[12];
}

/**
 * Normaliza lo que entrega un lector de código de barras.
 * Los lectores suelen añadir espacios o un Enter final; algunos
 * entregan EAN-8 o UPC-A (12 dígitos), que se convierte a EAN-13
 * anteponiendo un cero.
 * @param {string} entrada
 * @returns {string|null} EAN-13 normalizado, o null si no es válido
 */
export function normalizarCodigoEscaneado(entrada) {
  if (typeof entrada !== 'string') return null;
  const limpio = entrada.replace(/[^0-9]/g, '');

  if (limpio.length === 13) {
    return validarEAN13(limpio) ? limpio : null;
  }
  // UPC-A (12 dígitos) -> EAN-13 con cero a la izquierda
  if (limpio.length === 12) {
    const ean = '0' + limpio;
    return validarEAN13(ean) ? ean : null;
  }
  return null;
}

/**
 * País de origen según el prefijo GS1 (solo los más relevantes aquí).
 * @param {string} codigo
 * @returns {string}
 */
export function paisDesdeEAN13(codigo) {
  if (!validarEAN13(codigo)) return 'Desconocido';
  const prefijo = Number(codigo.slice(0, 3));
  if (prefijo === 786) return 'Ecuador';
  if (prefijo >= 770 && prefijo <= 771) return 'Colombia';
  if (prefijo === 775) return 'Perú';
  if (prefijo >= 780 && prefijo <= 781) return 'Chile';
  if (prefijo >= 779 && prefijo <= 779) return 'Argentina';
  if (prefijo >= 789 && prefijo <= 790) return 'Brasil';
  if (prefijo >= 750 && prefijo <= 750) return 'México';
  if (prefijo >= 0 && prefijo <= 139) return 'Estados Unidos / Canadá';
  if (prefijo >= 840 && prefijo <= 849) return 'España';
  if (prefijo >= 690 && prefijo <= 699) return 'China';
  return 'Otro';
}
