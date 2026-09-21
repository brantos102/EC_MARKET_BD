// Generación e impresión del comprobante de venta.
//
// Formato para impresora térmica de rollo, siguiendo la estructura que
// usan los locales en Ecuador: cabecera con razón social y RUC, detalle
// con código/cantidad/precio, desglose de IVA por tarifa, forma de pago
// con efectivo y cambio, y datos del cliente.
//
// DOS COSAS QUE SE CORRIGIERON AQUÍ, Y POR QUÉ
//
// 1. SALÍA EN A4. El comprobante se componía dentro de un iframe oculto
//    y se imprimía con iframe.contentWindow.print(). Chrome, al imprimir
//    un marco, aplica el tamaño de página del DOCUMENTO PRINCIPAL y no
//    el @page del marco, así que el rollo de 80 mm terminaba maquetado
//    en una hoja A4 con el recibo pegado arriba a la izquierda —
//    exactamente lo que se veía en el diálogo de impresión.
//    Ahora el comprobante se inserta en la propia página, dentro de un
//    contenedor que solo existe mientras dura la impresión, y la regla
//    @page se inyecta en el documento principal. Chrome sí la respeta.
//
// 2. EL LOGOTIPO. Una térmica imprime a 203 puntos por pulgada y en un
//    solo color: un logotipo a color sale como una mancha gris, gasta
//    papel y tarda en salir. Se quitó del papel. Sigue en pantalla, en
//    la aplicación y en los reportes PDF, que sí van a impresora normal.
//
// MEDIDAS DEL ROLLO
// El ancho del PAPEL y el ancho IMPRIMIBLE no son lo mismo: el cabezal
// no llega hasta el borde. En el rollo de 80 mm —la térmica de mostrador
// estándar en Ecuador, tipo Epson TM-T20/T88, Xprinter XP-80— la zona
// útil son 72 mm. En el de 58 mm, habitual en portátiles y parqueaderos,
// son 48 mm. Maquetar a 80 sobre papel de 80 recorta la columna de la
// derecha, que es justo donde van los valores.
//
// ADVERTENCIA IMPORTANTE SOBRE LA FACTURA ELECTRÓNICA
// Este documento NO lleva clave de acceso ni número de autorización,
// y lo dice de forma visible. Esos dos datos solo existen cuando el
// XML fue firmado con el certificado del contribuyente y autorizado
// por el SRI, cosa que requiere el módulo de facturación electrónica
// (todavía no construido). Imprimir un número de autorización
// inventado convertiría el papel en un comprobante falso, así que el
// documento sale marcado como no tributario hasta que ese módulo
// exista.

import { supabase } from '../supabaseClient.js';

const ID_CONTENEDOR = 'comprobante-impresion';
const ID_ESTILO = 'comprobante-impresion-estilo';

/** Carga los datos de una venta: cabecera, detalle y pagos. */
async function datosDeVenta(ventaId) {
  const [{ data: cab, error: errCab }, { data: det, error: errDet }, { data: pagos }] =
    await Promise.all([
      supabase.from('v_comprobante').select('*').eq('venta_id', ventaId).maybeSingle(),
      supabase.from('venta_detalle')
        .select('cantidad, precio_unitario, descuento, subtotal, valor_impuesto, productos(codigo, nombre, codigo_impuesto)')
        .eq('venta_id', ventaId),
      supabase.from('pagos_venta').select('*').eq('venta_id', ventaId),
    ]);

  if (errCab) throw new Error(errCab.message);
  if (errDet) throw new Error(errDet.message);
  if (!cab) throw new Error('No se encontró la venta');

  return { cab, detalle: det ?? [], pagos: pagos ?? [] };
}

/**
 * Devuelve el comprobante como documento HTML completo. Se usa para la
 * vista previa y para las pruebas; la impresión real no pasa por aquí,
 * porque un documento aparte vuelve a caer en el problema del A4.
 * @param {string} ventaId
 */
export async function construirComprobante(ventaId) {
  const { cab, detalle, pagos } = await datosDeVenta(ventaId);
  const { papel, titulo, cuerpo } = componer(cab, detalle, pagos);

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=${papel.papel}mm" />
<title>${titulo} ${esc(cab.numero_comprobante ?? cab.numero_interno ?? '')}</title>
<style id="${ID_ESTILO}">${cssComprobante(papel, '')}</style>
</head>
<body data-papel-mm="${papel.papel}">
${cuerpo}
<script>
  // El mismo cálculo del alto que hace la impresión desde la caja: una
  // regla "size: ${papel.papel}mm auto" no es CSS válido y el navegador
  // se cae a A4. Ver alturaEnMilimetros() en comprobante.js.
  (function () {
    var px = Math.max(document.body.scrollHeight,
                      document.body.getBoundingClientRect().height);
    var mm = Math.min(Math.max(Math.ceil(px * 25.4 / 96) + 2, 30), 1500);
    document.body.dataset.altoMm = String(mm);
    var e = document.getElementById('${ID_ESTILO}');
    e.textContent = e.textContent.replace(/@page\\s*\\{[^}]*\\}/,
      '@page { size: ${papel.papel}mm ' + mm + 'mm; margin: 0; }');
  }());
<\/script>
</body></html>`;
}

/** Devuelve el HTML para previsualizar dentro de un modal. */
export async function vistaPreviaComprobante(ventaId) {
  return construirComprobante(ventaId);
}

/**
 * Abre el diálogo de impresión con el comprobante ya compuesto.
 *
 * El comprobante se inserta en ESTA página, no en un iframe ni en una
 * ventana nueva. Es la única forma de que Chrome aplique el @page de
 * 80 mm: al imprimir un marco usa el tamaño de página del documento
 * principal. Mientras dura la impresión, la hoja de estilos oculta todo
 * lo demás del documento y deja solo el recibo.
 */
export async function imprimirComprobante(ventaId) {
  const { cab, detalle, pagos } = await datosDeVenta(ventaId);
  const { papel, cuerpo } = componer(cab, detalle, pagos);

  limpiarImpresion();

  const estilo = document.createElement('style');
  estilo.id = ID_ESTILO;
  estilo.textContent = cssComprobante(papel, `#${ID_CONTENEDOR}`) + cssSoloComprobante(papel);
  document.head.appendChild(estilo);

  const caja = document.createElement('div');
  caja.id = ID_CONTENEDOR;
  caja.dataset.papelMm = String(papel.papel);
  caja.innerHTML = cuerpo;
  document.body.appendChild(caja);

  // El navegador tiene que haber aplicado el estilo antes de medir;
  // sin este respiro el alto sale en cero y el recibo se imprime en
  // una hoja entera.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const alto = alturaEnMilimetros(caja);
  caja.dataset.altoMm = String(alto);
  estilo.textContent = estilo.textContent.replace(
    /@page\s*\{[^}]*\}/,
    `@page { size: ${papel.papel}mm ${alto}mm; margin: 0; }`);

  const alTerminar = () => {
    window.removeEventListener('afterprint', alTerminar);
    limpiarImpresion();
  };
  window.addEventListener('afterprint', alTerminar);
  // Red de seguridad: si el navegador no dispara afterprint (pasa en
  // algunos kioscos y en modo sin interfaz), el recibo no se queda
  // pegado en la pantalla para siempre.
  setTimeout(alTerminar, 60000);

  window.print();
}

/**
 * Alto del recibo, en milímetros enteros.
 *
 * POR QUÉ HAY QUE MEDIRLO. La regla `@page { size: 80mm auto }` parece
 * lo natural para un rollo continuo, pero NO es CSS válido: la
 * propiedad `size` admite una o dos medidas, o una palabra clave, nunca
 * una medida y `auto` juntas. El navegador descarta la declaración
 * entera y vuelve al tamaño de hoja por defecto —A4 o carta—, que es
 * justo lo que se veía en el diálogo de impresión.
 *
 * Así que el alto se mide sobre el recibo ya maquetado y se escribe en
 * la regla. De paso evita el desperdicio: con una hoja A4 la térmica
 * saca casi veinte centímetros de papel en blanco después de cada
 * venta.
 */
function alturaEnMilimetros(caja) {
  const px = Math.max(caja.scrollHeight, caja.getBoundingClientRect().height);
  const mm = Math.ceil((px * 25.4) / 96) + 2;   // 96 px por pulgada + holgura
  // Un recibo de menos de 3 cm no existe, y uno de más de metro y medio
  // sería un error de medición: en ambos casos se prefiere algo sensato
  // a mandar el rollo entero a la basura.
  return Math.min(Math.max(mm, 30), 1500);
}

/** Quita el recibo y su hoja de estilos de la página. */
export function limpiarImpresion() {
  document.getElementById(ID_CONTENEDOR)?.remove();
  document.getElementById(ID_ESTILO)?.remove();
}

// ---------------------------------------------------------
// Medidas
// ---------------------------------------------------------

/**
 * Medidas del rollo según lo configurado en la empresa.
 * @param {{ancho_papel_mm?: number|string}} empresa
 * @returns {{papel: number, util: number, fuente: number, titulo: number}}
 */
export function anchoPapel(empresa) {
  const mm = Number(empresa?.ancho_papel_mm);
  if (mm === 58) return { papel: 58, util: 48, fuente: 9.5, titulo: 11.5 };
  return { papel: 80, util: 72, fuente: 11, titulo: 13 };
}

// ---------------------------------------------------------
// Composición
// ---------------------------------------------------------
function componer(c, detalle, pagos) {
  const esFactura = c.tipo_comprobante === 'FACTURA';
  const titulo = esFactura ? 'FACTURA' : 'NOTA DE VENTA';
  const papel = anchoPapel(c);

  const fecha = new Date(c.confirmada_at ?? c.created_at ?? Date.now());
  const fechaTexto = fecha.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const horaTexto = fecha.toLocaleTimeString('es-EC', { hour12: false });

  const items = detalle.length;
  const unidades = detalle.reduce((a, d) => a + Number(d.cantidad || 0), 0);

  // Desglose de IVA por tarifa, como exige el comprobante ecuatoriano
  const porTarifa = new Map();
  for (const d of detalle) {
    const base = Number(d.subtotal || 0);
    const iva = Number(d.valor_impuesto || 0);
    const tarifa = base > 0 ? Math.round((iva / base) * 100) : 0;
    const actual = porTarifa.get(tarifa) ?? { base: 0, iva: 0 };
    actual.base += base;
    actual.iva += iva;
    porTarifa.set(tarifa, actual);
  }

  const efectivo = pagos.filter((p) => p.forma_pago === 'EFECTIVO');
  const recibido = efectivo.reduce((a, p) => a + Number(p.recibido || p.monto || 0), 0);
  const cambio = efectivo.reduce((a, p) => a + Number(p.cambio || 0), 0);

  const filasDetalle = detalle.map((d) => {
    const p = d.productos ?? {};
    return `
    <tr>
      <td class="c">${formatearCantidad(d.cantidad)}</td>
      <td class="desc">${esc(p.codigo ?? '')} ${esc(p.nombre ?? '')}</td>
      <td class="n">${Number(d.precio_unitario).toFixed(2)}</td>
      <td class="n">${Number(d.subtotal).toFixed(2)}</td>
    </tr>`;
  }).join('');

  const filasIva = [...porTarifa.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tarifa, v]) => `
      <div class="linea"><span>SUBTOTAL ${tarifa}%</span><span>${v.base.toFixed(2)}</span></div>
      ${tarifa > 0 ? `<div class="linea"><span>I.V.A. ${tarifa}%</span><span>${v.iva.toFixed(2)}</span></div>` : ''}`)
    .join('');

  const filasPago = pagos.map((p) => `
    <div class="linea"><span>${nombreFormaPago(p.forma_pago)}</span><span>${Number(p.monto).toFixed(2)}</span></div>
    ${p.codigo_transaccion ? `<div class="linea peq"><span>Comprob. ${esc(p.codigo_transaccion)}</span><span></span></div>` : ''}
  `).join('');

  const cuerpo = `
  <div class="centro">
    <div class="empresa">${esc(c.razon_social ?? '')}</div>
    ${c.nombre_comercial ? `<div>${esc(c.nombre_comercial)}</div>` : ''}
    <div>RUC: ${esc(c.ruc ?? '—')}</div>
    ${c.direccion_establecimiento || c.direccion_matriz
      ? `<div class="bloque">${esc(c.direccion_establecimiento ?? c.direccion_matriz)}</div>` : ''}
    ${c.empresa_telefono ? `<div class="bloque">Telf: ${esc(c.empresa_telefono)}</div>` : ''}
    ${c.obligado_contabilidad ? '<div class="bloque">OBLIGADO A LLEVAR CONTABILIDAD</div>' : ''}
    ${c.contribuyente_especial ? `<div class="bloque">CONTRIB. ESPECIAL ${esc(c.contribuyente_especial)}</div>` : ''}
  </div>

  <div class="titulo">${titulo}<br />${esc(c.numero_comprobante ?? c.numero_interno ?? '')}</div>

  <div class="bloque">
    <div class="linea"><span>Fecha</span><span>${fechaTexto} ${horaTexto}</span></div>
    <div class="linea"><span>Cajero/a</span><span>${esc(c.cajero_nombre ?? '—')}</span></div>
    <div class="linea"><span>Venta</span><span>${esc(c.numero_interno ?? '')} (${esc(c.tipo_venta ?? '')})</span></div>
  </div>

  <div class="sep"></div>
  <div class="bloque">
    <div class="linea"><span>Cliente</span><span>${esc(c.cliente_nombre ?? 'CONSUMIDOR FINAL')}</span></div>
    <div class="linea"><span>${etiquetaId(c.tipo_identificacion)}</span><span>${esc(c.cliente_identificacion ?? '9999999999999')}</span></div>
    ${c.cliente_direccion ? `<div class="linea peq"><span>Dirección</span><span>${esc(c.cliente_direccion)}</span></div>` : ''}
    ${c.cliente_telefono ? `<div class="linea peq"><span>Teléfono</span><span>${esc(c.cliente_telefono)}</span></div>` : ''}
  </div>

  <div class="sep"></div>
  <table>
    <thead><tr>
      <th class="c">CANT</th>
      <th>DESCRIPCIÓN</th>
      <th class="n">${papel.papel === 58 ? 'P.U' : 'P.UNIT'}</th>
      <th class="n">VALOR</th>
    </tr></thead>
    <tbody>${filasDetalle}</tbody>
  </table>

  <div class="sep"></div>
  ${filasIva}
  ${Number(c.descuento) > 0
    ? `<div class="linea"><span>DESCUENTOS</span><span>-${Number(c.descuento).toFixed(2)}</span></div>` : ''}
  <div class="linea total"><span>TOTAL</span><span>${Number(c.total).toFixed(2)}</span></div>

  <div class="sep"></div>
  ${filasPago}
  ${recibido > 0 ? `<div class="linea"><span>RECIBIDO</span><span>${recibido.toFixed(2)}</span></div>` : ''}
  ${cambio > 0 ? `<div class="linea"><span>CAMBIO</span><span>${cambio.toFixed(2)}</span></div>` : ''}

  <div class="sep"></div>
  <div class="linea peq"><span>ÍTEMS: ${items}</span><span>UNIDADES: ${formatearCantidad(unidades)}</span></div>

  <div class="aviso">
    DOCUMENTO SIN VALIDEZ TRIBUTARIA<br />
    No autorizado por el SRI · sin clave de acceso
  </div>

  <div class="pie">
    ${esc(c.pie_recibo ?? '¡Gracias por su compra!')}<br />
    ${c.ambiente === 'PRUEBAS' ? 'AMBIENTE DE PRUEBAS<br />' : ''}
    ${c.empresa_email ? esc(c.empresa_email) : ''}
  </div>

  <div class="corte"></div>`;

  return { papel, titulo, cuerpo };
}

// ---------------------------------------------------------
// Estilos
// ---------------------------------------------------------

/**
 * Hoja de estilos del recibo.
 *
 * @param {object} p medidas devueltas por anchoPapel()
 * @param {string} alcance selector bajo el que se anidan las reglas. Con
 *   cadena vacía el recibo ES el documento (vista previa); con
 *   "#comprobante-impresion" vive dentro de la aplicación y cada regla
 *   se acota para que el CSS del sistema no se le meta dentro.
 */
function cssComprobante(p, alcance) {
  const raiz = alcance || 'body';
  const bajo = alcance ? `${alcance} ` : '';

  return `
  @page { size: ${p.papel}mm auto; margin: 0; }
  ${alcance ? '' : `html { width: ${p.papel}mm; margin: 0; padding: 0; background: #fff; }`}
  ${bajo}* { box-sizing: border-box; }
  ${raiz} {
    font-family: "Courier New", ui-monospace, monospace;
    font-size: ${p.fuente}px;
    line-height: 1.32;
    color: #000;
    background: #fff;
    width: ${p.util}mm;
    max-width: ${p.util}mm;
    margin: 0 auto;
    padding: 2mm 0 6mm;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* Todo en negro sobre blanco, sin excepción. La térmica no tiene
     tinta de color: cualquier cosa que no sea negro sale como una trama
     de puntos grises, borrosa y lenta. Este bloque también blinda el
     recibo del CSS de la aplicación, que sí usa color. */
  ${bajo}*, ${bajo}*::before, ${bajo}*::after {
    color: #000 !important;
    background-image: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
    filter: none !important;
  }
  ${bajo}img, ${bajo}svg, ${bajo}canvas, ${bajo}picture { display: none !important; }
  ${bajo}div, ${bajo}span, ${bajo}table, ${bajo}td, ${bajo}th { border: 0; background: none; }
  ${bajo}.centro { text-align: center; }
  ${bajo}.empresa { font-weight: bold; font-size: ${p.titulo}px; }
  ${bajo}.titulo {
    font-weight: bold; font-size: ${p.titulo}px; text-align: center;
    border-top: 1px dashed #000; border-bottom: 1px dashed #000;
    padding: 3px 0; margin: 5px 0;
  }
  ${bajo}table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  ${bajo}thead th {
    font-size: ${p.papel === 58 ? 8 : 9.5}px; text-align: left;
    border-bottom: 1px solid #000; padding-bottom: 1px; font-weight: bold;
  }
  ${bajo}td { vertical-align: top; padding: 1px 0; font-size: ${p.papel === 58 ? 9.5 : 10.5}px; }
  ${bajo}td.c, ${bajo}th.c { width: ${p.papel === 58 ? 6 : 8}mm; text-align: left; }
  ${bajo}td.n, ${bajo}th.n { text-align: right; width: ${p.papel === 58 ? 10 : 12}mm; }
  ${bajo}td.desc { padding-right: 2px; word-break: break-word; }
  ${bajo}.sep { border-top: 1px dashed #000; margin: 4px 0; height: 0; }
  ${bajo}.linea { display: flex; justify-content: space-between; gap: 6px; }
  ${bajo}.linea.peq { font-size: 9.5px; }
  ${bajo}.linea.total {
    font-weight: bold; font-size: ${p.titulo}px;
    border-top: 1px solid #000; padding-top: 2px; margin-top: 2px;
  }
  ${bajo}.bloque { font-size: 10px; }
  ${bajo}.aviso {
    border: 1px solid #000; padding: 3px; margin-top: 5px;
    font-size: 9px; text-align: center; font-weight: bold;
  }
  ${bajo}.pie { font-size: 9px; text-align: center; margin-top: 5px; }
  /* Un corte en blanco al final: sin él la térmica corta sobre la
     última línea y el pie del recibo queda comido. */
  ${bajo}.corte { height: 8mm; }
`;
}

/**
 * Reglas que solo existen mientras el recibo vive dentro de la
 * aplicación: ocultarlo en pantalla y, al imprimir, ocultar todo lo
 * demás y forzar el ancho del rollo sobre html/body, que el CSS del
 * sistema deja en 100% con overflow oculto.
 */
function cssSoloComprobante(p) {
  return `
  /* En pantalla el recibo no se ve, pero SÍ se maqueta: se aparta
     fuera de la ventana en vez de ocultarse con display:none, porque
     un elemento oculto mide cero y entonces no se podría calcular el
     alto del papel. */
  #${ID_CONTENEDOR} {
    position: absolute;
    left: -10000px;
    top: 0;
    visibility: hidden;
  }

  @media print {
    html, body {
      width: ${p.papel}mm !important;
      min-width: 0 !important;
      max-width: ${p.papel}mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      overflow: visible !important;
      height: auto !important;
    }
    body > * { display: none !important; }
    body > #${ID_CONTENEDOR} {
      display: block !important;
      position: static !important;
      visibility: visible !important;
      left: auto !important;
    }
  }
`;
}

// ---------------------------------------------------------
// Utilidades
// ---------------------------------------------------------

/**
 * Cantidad sin ceros de relleno: 2 se imprime "2", 1,03 se imprime
 * "1.03". El recibo no sabe si el producto se pesa o se cuenta —esa
 * regla vive en cantidad.js y ya se aplicó al guardar la venta—, así
 * que aquí solo se muestra lo que quedó guardado, tal cual.
 */
function formatearCantidad(cantidad) {
  const n = Number(cantidad);
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(3)));
}

function nombreFormaPago(f) {
  return {
    EFECTIVO: 'EFECTIVO',
    TARJETA_CREDITO: 'TARJETA CRÉDITO',
    TARJETA_DEBITO: 'TARJETA DÉBITO',
    TRANSFERENCIA_DEUNA: 'DE UNA',
    TRANSFERENCIA_OTRO: 'TRANSFERENCIA',
  }[f] ?? f;
}

function etiquetaId(tipo) {
  return {
    CEDULA: 'Cédula',
    RUC: 'RUC',
    PASAPORTE: 'Pasaporte',
    CONSUMIDOR_FINAL: 'Ident.',
  }[tipo] ?? 'Ident.';
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}
