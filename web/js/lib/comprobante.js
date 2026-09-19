// Generación e impresión del comprobante de venta.
//
// Formato pensado para impresora térmica de 80 mm, siguiendo la
// estructura que usan los locales en Ecuador: cabecera con razón
// social y RUC, detalle con código/cantidad/precio, desglose de IVA
// por tarifa, forma de pago con efectivo y cambio, y datos del cliente.
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

/**
 * Carga todos los datos de una venta y devuelve el HTML del comprobante.
 * @param {string} ventaId
 */
export async function construirComprobante(ventaId) {
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

  return plantilla(cab, det ?? [], pagos ?? []);
}

/** Abre el diálogo de impresión con el comprobante ya compuesto. */
export async function imprimirComprobante(ventaId) {
  const html = await construirComprobante(ventaId);

  // Se usa un iframe oculto en vez de window.open: los bloqueadores de
  // ventanas emergentes impiden abrir una pestaña nueva desde un botón.
  const marco = document.createElement('iframe');
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(marco);

  const doc = marco.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();

  await new Promise((r) => setTimeout(r, 350));   // deja cargar el logo
  marco.contentWindow.focus();
  marco.contentWindow.print();
  setTimeout(() => marco.remove(), 1500);
}

/** Devuelve el HTML para previsualizar dentro de un modal. */
export async function vistaPreviaComprobante(ventaId) {
  return construirComprobante(ventaId);
}

// ---------------------------------------------------------
// Composición
// ---------------------------------------------------------
function plantilla(c, detalle, pagos) {
  const esFactura = c.tipo_comprobante === 'FACTURA';
  const titulo = esFactura ? 'FACTURA' : 'NOTA DE VENTA';

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
    return `<tr>
      <td class="c">${Number(d.cantidad).toFixed(Number(d.cantidad) % 1 === 0 ? 0 : 2)}</td>
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

  const logo = c.logo_url
    ? `<img src="${esc(c.logo_url)}" class="logo" alt="" />`
    : `<img src="${ubicacionLogo()}" class="logo" alt="" onerror="this.style.display='none'" />`;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8" />
<title>${titulo} ${esc(c.numero_comprobante ?? c.numero_interno ?? '')}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Courier New", ui-monospace, monospace;
    font-size: 11px; line-height: 1.35; color: #000;
    width: 74mm; margin: 0 auto; padding: 2mm 0;
  }
  .centro { text-align: center; }
  .logo { display: block; margin: 0 auto 3px; width: 34mm; }
  .empresa { font-weight: bold; font-size: 13px; }
  .lema { font-style: italic; font-size: 10px; }
  .titulo {
    font-weight: bold; font-size: 13px; text-align: center;
    border-top: 1px dashed #000; border-bottom: 1px dashed #000;
    padding: 3px 0; margin: 5px 0;
  }
  table { width: 100%; border-collapse: collapse; }
  thead th {
    font-size: 9.5px; text-align: left; border-bottom: 1px solid #000;
    padding-bottom: 1px;
  }
  td { vertical-align: top; padding: 1px 0; font-size: 10.5px; }
  td.c { width: 8mm; }
  td.n { text-align: right; width: 13mm; }
  td.desc { padding-right: 2px; word-break: break-word; }
  .sep { border-top: 1px dashed #000; margin: 4px 0; }
  .linea { display: flex; justify-content: space-between; gap: 6px; }
  .linea.peq { font-size: 9.5px; }
  .linea.total { font-weight: bold; font-size: 13px; border-top: 1px solid #000; padding-top: 2px; margin-top: 2px; }
  .bloque { font-size: 10px; }
  .aviso {
    border: 1px solid #000; padding: 3px; margin-top: 5px;
    font-size: 9px; text-align: center; font-weight: bold;
  }
  .pie { font-size: 9px; text-align: center; margin-top: 5px; }
</style></head>
<body>
  <div class="centro">
    ${logo}
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
    <thead><tr><th>CANT</th><th>DESCRIPCIÓN</th><th style="text-align:right">P.UNIT</th><th style="text-align:right">VALOR</th></tr></thead>
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
  <div class="linea peq"><span>ÍTEMS: ${items}</span><span>UNIDADES: ${unidades.toFixed(2)}</span></div>

  <div class="aviso">
    DOCUMENTO SIN VALIDEZ TRIBUTARIA<br />
    No autorizado por el SRI · sin clave de acceso
  </div>

  <div class="pie">
    ${esc(c.pie_recibo ?? '¡Gracias por su compra!')}<br />
    ${c.ambiente === 'PRUEBAS' ? 'AMBIENTE DE PRUEBAS<br />' : ''}
    ${c.empresa_email ? esc(c.empresa_email) : ''}
  </div>
</body></html>`;
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

function ubicacionLogo() {
  // El comprobante se compone dentro de un iframe, así que la ruta del
  // logo debe ser absoluta respecto de la página que lo abre.
  return new URL('../../img/logo.png', import.meta.url).href;
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}
