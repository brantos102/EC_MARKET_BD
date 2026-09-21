// Lectura del XML de una factura electrónica del SRI.
//
// El XML es la factura de verdad; el papel es solo su impresión. Si
// esta lectura se equivoca, se equivoca el costo de compra, y de ahí
// sale el precio de venta y el margen de todo el negocio. Por eso se
// prueba con el XML completo, con el envoltorio de autorización que
// devuelve el SRI y con los casos que rompen: nota de crédito en vez de
// factura, archivo vacío, XML roto.
//
// Los datos del ejemplo son los de una factura real de proveedor
// (3B DISTRIBUCION) con el RUC y la clave cambiados.

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';

// El módulo usa DOMParser y querySelector, que en Node no existen. Se
// monta un mínimo equivalente para poder probar la lógica sin navegador.
const { document: _d } = montarDOM();
const { leerFacturaXML, validarClaveAcceso, descomponerClaveAcceso, digitoVerificadorClave } =
  await import('../web/js/lib/factura-xml.js');

const FACTURA = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>2</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>3B DISTRIBUCION S.A.S</razonSocial>
    <nombreComercial>3B</nombreComercial>
    <ruc>1793223186001</ruc>
    <claveAcceso>CLAVE_AQUI</claveAcceso>
    <codDoc>01</codDoc>
    <estab>001</estab>
    <ptoEmi>003</ptoEmi>
    <secuencial>000024778</secuencial>
    <dirMatriz>PICHINCHA / QUITO / CALACALI</dirMatriz>
  </infoTributaria>
  <infoFactura>
    <fechaEmision>09/09/2026</fechaEmision>
    <obligadoContabilidad>SI</obligadoContabilidad>
    <tipoIdentificacionComprador>04</tipoIdentificacionComprador>
    <razonSocialComprador>BARRERA QUISHPE MATIAS DANIEL</razonSocialComprador>
    <identificacionComprador>1728605070001</identificacionComprador>
    <totalSinImpuestos>7.98</totalSinImpuestos>
    <totalDescuento>0.00</totalDescuento>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>
        <baseImponible>7.98</baseImponible><valor>1.20</valor>
      </totalImpuesto>
    </totalConImpuestos>
    <importeTotal>9.18</importeTotal>
  </infoFactura>
  <detalles>
    <detalle>
      <codigoPrincipal>Q-10001203</codigoPrincipal>
      <codigoAuxiliar>7861000100014</codigoAuxiliar>
      <descripcion>BONICESSOTE FRESA X 10</descripcion>
      <cantidad>1.00</cantidad>
      <precioUnitario>1.74</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>1.74</precioTotalSinImpuesto>
      <impuestos><impuesto>
        <codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>
        <tarifa>15.00</tarifa><baseImponible>1.74</baseImponible><valor>0.26</valor>
      </impuesto></impuestos>
    </detalle>
    <detalle>
      <codigoPrincipal>Q-10001204</codigoPrincipal>
      <codigoAuxiliar>0</codigoAuxiliar>
      <descripcion>BONICESSOTE MANGO X10</descripcion>
      <cantidad>1.00</cantidad>
      <precioUnitario>1.74</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>1.74</precioTotalSinImpuesto>
      <impuestos><impuesto>
        <codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>
        <tarifa>15.00</tarifa><baseImponible>1.74</baseImponible><valor>0.26</valor>
      </impuesto></impuestos>
    </detalle>
    <detalle>
      <codigoPrincipal>20740052</codigoPrincipal>
      <codigoAuxiliar>0</codigoAuxiliar>
      <descripcion>NB TRATAMIENTO ARGAN 15 DISPLAYS X 12 70ml</descripcion>
      <cantidad>1.00</cantidad>
      <precioUnitario>4.50</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>4.50</precioTotalSinImpuesto>
      <impuestos><impuesto>
        <codigo>2</codigo><codigoPorcentaje>4</codigoPorcentaje>
        <tarifa>15.00</tarifa><baseImponible>4.50</baseImponible><valor>0.68</valor>
      </impuesto></impuestos>
    </detalle>
  </detalles>
</factura>`;

test('lee la cabecera de la factura', () => {
  const f = leerFacturaXML(FACTURA);
  assert.equal(f.ok, true);
  assert.equal(f.ruc, '1793223186001');
  assert.equal(f.razonSocial, '3B DISTRIBUCION S.A.S');
  assert.equal(f.numero, '001-003-000024778');
  assert.equal(f.fechaEmision, '2026-09-09');   // dd/mm/aaaa del SRI → ISO
  assert.equal(f.total, 9.18);
  assert.equal(f.iva, 1.2);
});

test('lee cada línea con su cantidad, precio e IVA', () => {
  const f = leerFacturaXML(FACTURA);
  assert.equal(f.lineas.length, 3);

  const [a, , b] = f.lineas;
  assert.equal(a.codigo, 'Q-10001203');
  assert.equal(a.descripcion, 'BONICESSOTE FRESA X 10');
  assert.equal(a.cantidad, 1);
  assert.equal(a.precioUnitario, 1.74);
  assert.equal(a.tarifaIva, 15);
  assert.equal(a.valorIva, 0.26);

  assert.equal(b.codigo, '20740052');
  assert.equal(b.subtotal, 4.5);
});

test('el código auxiliar del proveedor puede ser el EAN del producto', () => {
  // Cuando viene, ahorra el paso de emparejar a mano: el sistema puede
  // reconocer el producto solo.
  const f = leerFacturaXML(FACTURA);
  assert.equal(f.lineas[0].codigoAux, '7861000100014');
});

test('las líneas suman lo que dice la cabecera', () => {
  // Si esto no cuadra, la lectura se comió una línea o un decimal, y
  // el costo de compra saldría mal sin que nadie lo note.
  const f = leerFacturaXML(FACTURA);
  const suma = f.lineas.reduce((a, l) => a + l.subtotal, 0);
  assert.equal(Number(suma.toFixed(2)), f.subtotal);

  const iva = f.lineas.reduce((a, l) => a + l.valorIva, 0);
  assert.equal(Number((f.subtotal + iva).toFixed(2)), f.total);
});

test('desenvuelve el XML de autorización que devuelve el SRI', () => {
  const envuelto = `<?xml version="1.0" encoding="UTF-8"?>
    <autorizacion>
      <estado>AUTORIZADO</estado>
      <numeroAutorizacion>0909202601179322318600120010030000247786316875011</numeroAutorizacion>
      <fechaAutorizacion>2026-09-09T17:03:03-05:00</fechaAutorizacion>
      <comprobante><![CDATA[${FACTURA}]]></comprobante>
    </autorizacion>`;
  const f = leerFacturaXML(envuelto);
  assert.equal(f.ok, true);
  assert.equal(f.numero, '001-003-000024778');
  assert.equal(f.lineas.length, 3);
});

test('deduce la tarifa cuando la línea no la trae explícita', () => {
  // Facturas viejas y algunos emisores omiten <tarifa>; el código de
  // porcentaje del SRI sigue estando.
  const sinTarifa = FACTURA.replace(/<tarifa>15.00<\/tarifa>/g, '');
  const f = leerFacturaXML(sinTarifa);
  assert.equal(f.lineas[0].tarifaIva, 15);   // codigoPorcentaje 4 = 15 %
});

test('rechaza una nota de crédito explicando por qué', () => {
  const nc = FACTURA.replace(/factura/g, 'notaCredito');
  const f = leerFacturaXML(nc);
  assert.equal(f.ok, false);
  assert.match(f.error, /nota de crédito/);
});

test('rechaza un archivo vacío o roto sin reventar', () => {
  assert.equal(leerFacturaXML('').ok, false);
  assert.equal(leerFacturaXML('   ').ok, false);
  assert.equal(leerFacturaXML('esto no es xml <<<').ok, false);
});

test('una factura sin detalles no sirve para ingresar mercadería', () => {
  const vacia = FACTURA.replace(/<detalles>[\s\S]*<\/detalles>/, '<detalles></detalles>');
  const f = leerFacturaXML(vacia);
  assert.equal(f.ok, false);
  assert.match(f.error, /detalle/);
});

// ---------------------------------------------------------
// Clave de acceso
// ---------------------------------------------------------
const CLAVE = '0909202601179322318600120010030000247786316875011';

test('la clave de acceso de la factura real es válida', () => {
  assert.equal(CLAVE.length, 49);
  assert.equal(validarClaveAcceso(CLAVE), true);
});

test('un dígito cambiado invalida la clave', () => {
  // Es justo lo que pasa al teclear 49 dígitos a mano o al leer mal el
  // código de barras: el verificador lo detecta en el acto.
  const mala = CLAVE.slice(0, 20) + (Number(CLAVE[20]) === 9 ? '8' : '9') + CLAVE.slice(21);
  assert.equal(validarClaveAcceso(mala), false);
});

test('una clave de otra longitud se rechaza', () => {
  assert.equal(validarClaveAcceso(CLAVE.slice(0, 48)), false);
  assert.equal(validarClaveAcceso(''), false);
  assert.equal(validarClaveAcceso(null), false);
});

test('el dígito verificador se calcula módulo 11', () => {
  assert.equal(digitoVerificadorClave(CLAVE.slice(0, 48)), Number(CLAVE[48]));
});

test('la clave lleva dentro el proveedor, la fecha y el número', () => {
  // Con solo escanear el código de barras del papel ya se sabe de quién
  // es la factura, sin haber descargado nada todavía.
  const d = descomponerClaveAcceso(CLAVE);
  assert.equal(d.fecha, '2026-09-09');
  assert.equal(d.ruc, '1793223186001');
  assert.equal(d.tipoComprobante, '01');        // 01 = factura
  assert.equal(d.numero, '001-003-000024778');
  assert.equal(d.valida, true);
});

test('descomponer una clave mal formada devuelve nulo', () => {
  assert.equal(descomponerClaveAcceso('123'), null);
});

// ---------------------------------------------------------
// DOM mínimo para correr en Node
// ---------------------------------------------------------
function montarDOM() {
  const parser = new DOMParser({ onError: () => {} });

  // xmldom no trae querySelector. Se implementa lo poco que usa el
  // módulo: nombre de etiqueta, y descendencia con "a > b" y "a b".
  function buscarTodos(nodo, selector) {
    const partes = selector.split(',').map((s) => s.trim()).filter(Boolean);
    const salida = [];
    for (const parte of partes) {
      const pasos = parte.split('>').map((s) => s.trim());
      let actuales = [nodo];
      for (const paso of pasos) {
        const subpasos = paso.split(/\s+/).filter(Boolean);
        for (const sp of subpasos) {
          const siguientes = [];
          for (const a of actuales) {
            const hijos = a.getElementsByTagName ? a.getElementsByTagName(sp) : [];
            for (let i = 0; i < hijos.length; i += 1) siguientes.push(hijos[i]);
          }
          actuales = siguientes;
        }
      }
      salida.push(...actuales);
    }
    return salida;
  }

  function equipar(nodo) {
    if (!nodo || nodo.__equipado) return nodo;
    Object.defineProperty(nodo, '__equipado', { value: true, enumerable: false });
    nodo.querySelector = function (sel) { return equipar(buscarTodos(this, sel)[0] ?? null); };
    nodo.querySelectorAll = function (sel) { return buscarTodos(this, sel).map(equipar); };
    return nodo;
  }

  globalThis.DOMParser = class {
    parseFromString(texto, tipo) {
      const doc = parser.parseFromString(texto, tipo);
      return equipar(doc);
    }
  };
  return { document: null };
}
