// Lectura del XML de una factura electrónica del SRI.
//
// POR QUÉ ESTE CAMINO Y NO LEER LA FOTO
//
// Toda factura autorizada por el SRI existe como un XML firmado. El
// papel que entrega el proveedor no es la factura: es su RIDE, una
// impresión de ese XML. Leer el XML no es "reconocer" nada — es abrir
// el documento original. Cantidades, precios, descuentos e IVA salen
// exactos, no aproximados.
//
// Reconocer la foto del papel (OCR) parece más cómodo porque no hay que
// conseguir ningún archivo, pero confunde 0 con O, 1 con 7 y 5 con 6, y
// en una factura esas confusiones son cantidades y precios. Un OCR del
// 97 % suena bien hasta que se recuerda que una factura de treinta
// líneas tiene unos doscientos números: al 97 % se equivoca en seis, y
// nadie sabe en cuáles. El XML no se equivoca en ninguno.
//
// FORMATOS QUE ENTRAN AQUÍ
//   · El XML del comprobante tal cual (<factura>…</factura>).
//   · El XML de autorización que devuelve el SRI, que trae el
//     comprobante dentro de <comprobante> como texto: se desenvuelve.
// Las versiones 1.0, 1.1, 2.0 y 2.1 del esquema comparten las etiquetas
// que interesan aquí, así que se leen todas igual.

/**
 * @typedef {object} LineaFactura
 * @property {string} codigo        código del proveedor (codigoPrincipal)
 * @property {string} codigoAux     código auxiliar, a veces el EAN del producto
 * @property {string} descripcion
 * @property {number} cantidad      en la unidad del PROVEEDOR (puede ser cajas)
 * @property {number} precioUnitario
 * @property {number} descuento
 * @property {number} subtotal
 * @property {number} tarifaIva     porcentaje
 * @property {number} valorIva
 */

/**
 * Lee el XML y devuelve la factura en datos utilizables.
 * @param {string} texto contenido del archivo .xml
 * @returns {{
 *   ok: boolean, error?: string,
 *   claveAcceso?: string, ruc?: string, razonSocial?: string, nombreComercial?: string,
 *   numero?: string, estab?: string, ptoEmi?: string, secuencial?: string,
 *   fechaEmision?: string, ambiente?: string,
 *   rucComprador?: string, razonSocialComprador?: string,
 *   subtotal?: number, descuento?: number, iva?: number, total?: number,
 *   lineas?: LineaFactura[],
 * }}
 */
export function leerFacturaXML(texto) {
  if (!texto || !String(texto).trim()) {
    return { ok: false, error: 'El archivo está vacío.' };
  }

  let doc = parsear(texto);
  if (!doc) return { ok: false, error: 'El archivo no es un XML válido.' };

  // El SRI entrega la autorización con el comprobante dentro, como
  // texto escapado o en CDATA. Se desenvuelve antes de seguir.
  const dentro = doc.querySelector('comprobante');
  if (dentro && dentro.textContent.includes('<')) {
    doc = parsear(dentro.textContent) ?? doc;
  }

  const raiz = doc.querySelector('factura');
  if (!raiz) {
    const otro = doc.querySelector('notaCredito, notaDebito, guiaRemision, comprobanteRetencion');
    if (otro) {
      return {
        ok: false,
        error: `Este XML es un ${nombreDocumento(otro.tagName)}, no una factura. ` +
               'El ingreso de mercadería se hace con la factura de compra.',
      };
    }
    return {
      ok: false,
      error: 'El XML no contiene una factura. Si lo descargó del correo del proveedor, ' +
             'revise que sea el archivo del comprobante y no el acuse de recibo.',
    };
  }

  const t = (sel, base = doc) => base.querySelector(sel)?.textContent?.trim() ?? '';
  const n = (sel, base = doc) => numero(t(sel, base));

  const estab = t('infoTributaria estab');
  const ptoEmi = t('infoTributaria ptoEmi');
  const secuencial = t('infoTributaria secuencial');

  const lineas = [...doc.querySelectorAll('detalles > detalle')].map((d) => {
    const imp = d.querySelector('impuestos > impuesto');
    const tarifa = imp ? numero(imp.querySelector('tarifa')?.textContent) : 0;
    const codigoPorcentaje = imp?.querySelector('codigoPorcentaje')?.textContent?.trim() ?? '';

    return {
      codigo: t('codigoPrincipal', d) || t('codigoInterno', d),
      codigoAux: t('codigoAuxiliar', d),
      descripcion: t('descripcion', d),
      cantidad: n('cantidad', d),
      precioUnitario: n('precioUnitario', d),
      descuento: n('descuento', d),
      subtotal: n('precioTotalSinImpuesto', d),
      // La tarifa viene explícita casi siempre; cuando no, se deduce
      // del código de porcentaje del SRI.
      tarifaIva: tarifa || tarifaDesdeCodigo(codigoPorcentaje),
      valorIva: imp ? numero(imp.querySelector('valor')?.textContent) : 0,
    };
  });

  if (!lineas.length) {
    return { ok: false, error: 'La factura no tiene líneas de detalle.' };
  }

  return {
    ok: true,
    claveAcceso: t('infoTributaria claveAcceso'),
    ruc: t('infoTributaria ruc'),
    razonSocial: t('infoTributaria razonSocial'),
    nombreComercial: t('infoTributaria nombreComercial'),
    estab,
    ptoEmi,
    secuencial,
    numero: estab && ptoEmi && secuencial ? `${estab}-${ptoEmi}-${secuencial}` : '',
    fechaEmision: fechaISO(t('infoFactura fechaEmision')),
    ambiente: t('infoTributaria ambiente') === '1' ? 'PRUEBAS' : 'PRODUCCION',
    rucComprador: t('infoFactura identificacionComprador'),
    razonSocialComprador: t('infoFactura razonSocialComprador'),
    subtotal: n('infoFactura totalSinImpuestos'),
    descuento: n('infoFactura totalDescuento'),
    iva: [...doc.querySelectorAll('infoFactura totalConImpuestos totalImpuesto')]
      .reduce((a, x) => a + numero(x.querySelector('valor')?.textContent), 0),
    total: n('infoFactura importeTotal'),
    lineas,
  };
}

/**
 * Comprueba la clave de acceso de 49 dígitos.
 *
 * El último dígito es un verificador módulo 11, igual que el de una
 * cuenta bancaria. Sirve para detectar en el acto una clave mal
 * tecleada o mal leída por el escáner, antes de salir a buscarla.
 */
export function validarClaveAcceso(clave) {
  const c = String(clave ?? '').replace(/\D/g, '');
  if (c.length !== 49) return false;
  return Number(c[48]) === digitoVerificadorClave(c.slice(0, 48));
}

export function digitoVerificadorClave(base48) {
  // Pesos 2..7 recorriendo de derecha a izquierda, que es como lo
  // define la ficha técnica del SRI.
  let suma = 0;
  let peso = 2;
  for (let i = base48.length - 1; i >= 0; i -= 1) {
    suma += Number(base48[i]) * peso;
    peso = peso === 7 ? 2 : peso + 1;
  }
  const resto = suma % 11;
  const dv = 11 - resto;
  if (dv === 11) return 0;
  if (dv === 10) return 1;
  return dv;
}

/**
 * Datos que la clave de acceso lleva dentro.
 *
 * Es útil antes de tener el XML: con solo escanear el código de barras
 * del papel ya se sabe de qué proveedor es la factura y de qué fecha,
 * y se puede avisar si es de otro RUC o si ya se ingresó.
 */
export function descomponerClaveAcceso(clave) {
  const c = String(clave ?? '').replace(/\D/g, '');
  if (c.length !== 49) return null;
  return {
    fecha: `${c.slice(4, 8)}-${c.slice(2, 4)}-${c.slice(0, 2)}`,   // ddmmaaaa → ISO
    tipoComprobante: c.slice(8, 10),
    ruc: c.slice(10, 23),
    ambiente: c.slice(23, 24) === '1' ? 'PRUEBAS' : 'PRODUCCION',
    estab: c.slice(24, 27),
    ptoEmi: c.slice(27, 30),
    secuencial: c.slice(30, 39),
    numero: `${c.slice(24, 27)}-${c.slice(27, 30)}-${c.slice(30, 39)}`,
    valida: validarClaveAcceso(c),
  };
}

// ---------------------------------------------------------
function parsear(texto) {
  try {
    const doc = new DOMParser().parseFromString(String(texto).trim(), 'text/xml');
    if (doc.querySelector('parsererror')) return null;
    return doc;
  } catch {
    return null;
  }
}

function numero(v) {
  const x = Number(String(v ?? '').trim().replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
}

/** El SRI usa dd/mm/aaaa; la base y los campos de fecha usan ISO. */
function fechaISO(v) {
  const m = String(v ?? '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/**
 * Código de porcentaje del SRI → tarifa.
 * El 15 % rige desde 2024; los códigos del 12 % y el 14 % siguen
 * apareciendo en facturas viejas, así que se mantienen.
 */
function tarifaDesdeCodigo(codigo) {
  return ({
    0: 0,      // 0 %
    2: 12,     // 12 %
    3: 14,     // 14 %
    4: 15,     // 15 %
    5: 5,      // 5 % diferenciado
    6: 0,      // no objeto de impuesto
    7: 0,      // exento
    8: 8,      // diferenciado
  })[String(codigo).trim()] ?? 0;
}

function nombreDocumento(tag) {
  return ({
    notaCredito: 'nota de crédito',
    notaDebito: 'nota de débito',
    guiaRemision: 'guía de remisión',
    comprobanteRetencion: 'comprobante de retención',
  })[tag] ?? tag;
}
