// Recepción de mercadería.
//
// CÓMO SE RECIBE DE VERDAD, Y POR QUÉ ESTA PANTALLA ES ASÍ
//
// El camión llega, el transportista tiene prisa y hay que contar bultos
// contra una factura. Todo lo que obligue a hacer una cuenta mental en
// ese momento se hace mal. Por eso aquí:
//
//   · Se cuenta en BULTOS, como viene la mercadería. "6 cajas a $9,00"
//     y el sistema saca las 144 unidades y el costo de $0,0625 cada una.
//     Nadie multiplica ni divide con el camión esperando.
//
//   · Se anotan DOS cantidades: la de la factura y la que realmente
//     bajó. Antes solo había una, así que el faltante se perdía y
//     aparecía semanas después como un descuadre sin explicación. Ahora
//     al stock entra lo físico y la diferencia queda escrita para
//     reclamar.
//
//   · Se ESCANEA el producto en la mano. Es la única forma de saber que
//     el código impreso en el envase es el que tiene el sistema. Si el
//     proveedor lo cambió —y lo cambia— se registra el nuevo ahí mismo,
//     sin borrar el viejo: la mercadería que ya está en percha se
//     seguirá vendiendo con el código de antes.
//
//   · Con el costo real ya calculado, el sistema PROPONE el precio al
//     público y el de mayorista. Propone: decide una persona.

import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';
import { normalizarCodigoEscaneado } from './lib/ean13.js';
import { traducirErrorSupabase } from './lib/errores.js';
import { abrirModal, cerrarModal } from './lib/modal.js';
import { leerFacturaXML } from './lib/factura-xml.js';

export async function renderIngresos(container) {
  container.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="nuevo">Nuevo ingreso</button>
      <button class="tab" data-tab="historial">Historial</button>
    </div>
    <div id="tab-nuevo"></div>
    <div id="tab-historial" class="hidden"></div>
  `;

  container.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      container.querySelector('#tab-nuevo').classList.toggle('hidden', btn.dataset.tab !== 'nuevo');
      container.querySelector('#tab-historial').classList.toggle('hidden', btn.dataset.tab !== 'historial');
      if (btn.dataset.tab === 'historial') cargarHistorial();
    });
  });

  await renderNuevoIngreso(container.querySelector('#tab-nuevo'));

  async function cargarHistorial() {
    const destino = container.querySelector('#tab-historial');
    destino.innerHTML = '<p class="loading">Cargando...</p>';
    const { data, error } = await supabase
      .from('documentos_ingreso')
      .select('numero_interno, numero_documento, tipo_documento, fecha_recepcion, subtotal, valor_impuesto, total, estado, proveedores(nombre_comercial)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      destino.innerHTML = traducirErrorSupabase(error, 'documentos_ingreso');
      return;
    }
    destino.innerHTML = '';
    renderTable(destino, {
      columns: [
        { key: 'numero_interno', label: 'N.º interno' },
        { key: 'proveedor', label: 'Proveedor' },
        { key: 'tipo_documento', label: 'Tipo' },
        { key: 'numero_documento', label: 'Documento externo' },
        { key: 'fecha_recepcion', label: 'Recepción' },
        { key: 'subtotal', label: 'Subtotal', numeric: true, format: (v) => `$${Number(v).toFixed(2)}` },
        { key: 'total', label: 'Total', numeric: true, format: (v) => `$${Number(v).toFixed(2)}` },
        { key: 'estado', label: 'Estado' },
      ],
      rows: (data ?? []).map((d) => ({ ...d, proveedor: d.proveedores?.nombre_comercial ?? '—' })),
      rowClass: (r) => (r.estado === 'CONFIRMADO' ? '' : 'row-warning'),
      emptyMessage: 'Aún no hay ingresos registrados.',
    });
  }
}

async function renderNuevoIngreso(root) {
  root.innerHTML = `
    <div class="panel panel-importar">
      <h3>Traer la factura del proveedor</h3>
      <p class="nota">Toda factura autorizada por el SRI existe como un archivo XML; el papel
      que le entregan es solo su impresión. Si abre ese XML aquí, las cantidades, los precios y
      el IVA entran <b>exactos</b>, sin digitar ni una cifra. El proveedor lo manda por correo,
      y también se descarga de <b>SRI en línea → Comprobantes electrónicos recibidos</b>.</p>
      <div class="importar-caja" id="zona-xml">
        <input type="file" id="xml-archivo" accept=".xml,text/xml,application/xml" multiple />
        <span>o arrastre aquí el archivo .xml de la factura</span>
      </div>
      <p id="xml-msg" class="form-msg"></p>
    </div>

    <div class="panel">
      <h3>Documento del proveedor</h3>
      <form id="form-cabecera" class="inline-form">
        <select id="ing-proveedor" required><option value="">Proveedor...</option></select>
        <select id="ing-bodega" required><option value="">Bodega...</option></select>
        <select id="ing-orden"><option value="">Sin orden de compra</option></select>
        <select id="ing-tipo">
          <option value="FACTURA">Factura</option>
          <option value="NOTA_ENTREGA">Nota de entrega</option>
          <option value="GUIA_REMISION">Guía de remisión</option>
          <option value="AJUSTE_INICIAL">Ajuste inicial</option>
        </select>
        <input type="text" id="ing-numero" placeholder="001-001-000000123" required
               pattern="[0-9]{3}-[0-9]{3}-[0-9]{9}" title="Formato SRI: 001-001-000000123" />
        <input type="date" id="ing-fecha" required />
        <input type="text" id="ing-autorizacion" placeholder="N.º autorización SRI (opcional)" />
        <button type="submit">Crear ingreso</button>
        <span id="ing-msg" class="form-msg"></span>
      </form>
    </div>

    <div id="panel-detalle" class="panel hidden">
      <h3>Recepción — <span id="ing-numero-interno"></span></h3>

      <div class="recepcion-scan">
        <label for="det-scan">Escanee el producto que tiene en la mano</label>
        <div class="scan-fila">
          <input type="text" id="det-scan" placeholder="EAN-13 del envase o de la caja"
                 autocomplete="off" inputmode="numeric" />
          <button type="button" id="det-camara" class="btn-escanear"
                  title="Leer con la cámara del celular">📷</button>
        </div>
        <p class="nota">El escaneo es lo que confirma que el código impreso coincide con el que
        tiene el sistema. Si el proveedor lo cambió, aquí se registra el nuevo sin borrar el viejo.</p>
      </div>

      <form id="form-detalle" class="form-recepcion">
        <label class="fr-producto">Producto
          <select id="det-producto" required><option value="">Producto...</option></select>
        </label>

        <label>Presentación
          <select id="det-presentacion"><option value="">Unidad</option></select>
        </label>

        <label>Bultos según la factura
          <input type="number" id="det-bultos-doc" min="0" step="1" placeholder="6" />
        </label>

        <label>Bultos recibidos
          <input type="number" id="det-bultos" min="1" step="1" required placeholder="6" />
        </label>

        <label>Costo por bulto (sin IVA)
          <input type="number" id="det-costo" min="0.0001" step="0.0001" required placeholder="9.0000" />
        </label>

        <label>N.º de lote
          <input type="text" id="det-lote" placeholder="opcional" />
        </label>

        <label>Caducidad
          <input type="date" id="det-caducidad" />
        </label>

        <div class="fr-calculo" id="det-calculo">
          Escriba bultos y costo para ver las unidades y el costo por unidad.
        </div>

        <div class="fr-acciones">
          <button type="submit" class="btn-primary">Agregar línea</button>
          <button type="button" id="det-precios" class="btn-secundario"
                  title="Calcula el precio al público y el de mayorista sobre el costo real">
            Sugerir precios
          </button>
          <span id="det-msg" class="form-msg"></span>
        </div>
      </form>

      <div id="detalle-table"></div>

      <div id="cotejo-panel" class="cotejo-panel hidden">
        <h4>Lo pedido, lo facturado y lo recibido</h4>
        <div id="cotejo-table"></div>
      </div>

      <div class="acciones-pie">
        <div id="ing-totales" class="totales"></div>
        <button id="btn-confirmar" class="btn-primary">Confirmar recepción e ingresar a stock</button>
      </div>
      <p class="nota">Al confirmar se generan los lotes y los movimientos de kardex con las
      cantidades <b>recibidas</b>, no con las facturadas. El documento queda cerrado y no se
      puede editar.</p>
    </div>
  `;

  root.querySelector('#ing-fecha').value = new Date().toISOString().slice(0, 10);

  const [{ data: proveedores }, { data: bodegas }, { data: productos, error: errProd }] =
    await Promise.all([
      supabase.from('proveedores').select('id, ruc, nombre_comercial, razon_social')
        .eq('activo', true).order('razon_social'),
      supabase.from('bodegas').select('id, nombre').eq('activa', true).order('nombre'),
      supabase.from('productos')
        .select('id, codigo, nombre, ean13, maneja_lote, unidad_medida, paso_venta, categoria_id, ' +
                'precio_venta_menor, permite_fraccion, unidades_medida(permite_fraccion)')
        .eq('activo', true).order('nombre'),
    ]);

  if (errProd) {
    root.innerHTML = traducirErrorSupabase(errProd, 'productos');
    return;
  }

  // Presentaciones y códigos de todos los productos, en dos consultas.
  // Traerlos por producto haría una consulta por escaneo y la bodega
  // suele tener peor señal que la caja.
  const [{ data: presentaciones }, { data: codigos }] = await Promise.all([
    supabase.from('presentaciones')
      .select('id, producto_id, nombre, tipo, factor, es_base, para_compra, costo_ultimo')
      .eq('activo', true).order('factor'),
    supabase.from('v_producto_codigos').select('*').eq('activo', true),
  ]);

  const presPorProducto = new Map();
  for (const p of presentaciones ?? []) {
    if (!presPorProducto.has(p.producto_id)) presPorProducto.set(p.producto_id, []);
    presPorProducto.get(p.producto_id).push(p);
  }

  const llenar = (sel, filas, texto) => {
    for (const f of filas ?? []) {
      const o = document.createElement('option');
      o.value = f.id;
      o.textContent = texto(f);
      sel.appendChild(o);
    }
  };

  const selProveedor = root.querySelector('#ing-proveedor');
  const selBodega = root.querySelector('#ing-bodega');
  const selOrden = root.querySelector('#ing-orden');
  const selProducto = root.querySelector('#det-producto');
  const selPresentacion = root.querySelector('#det-presentacion');

  llenar(selProveedor, proveedores, (p) => `${p.nombre_comercial ?? p.razon_social} (${p.ruc})`);
  llenar(selBodega, bodegas, (b) => b.nombre);
  llenar(selProducto, productos, (p) => `${p.codigo} — ${p.nombre}`);
  if (bodegas?.length === 1) selBodega.value = bodegas[0].id;

  // Órdenes pendientes del proveedor elegido: recibir contra la orden es
  // lo que permite contestar "¿me mandaron todo lo que pedí?".
  selProveedor.addEventListener('change', async () => {
    selOrden.length = 1;
    if (!selProveedor.value) return;
    const { data } = await supabase.from('ordenes_compra')
      .select('id, numero, estado, fecha_requerida')
      .eq('proveedor_id', selProveedor.value)
      .in('estado', ['BORRADOR', 'ENVIADA', 'PARCIAL'])
      .order('created_at', { ascending: false });
    llenar(selOrden, data, (o) => `${o.numero} (${o.estado})`);
  });

  let documentoId = null;

  // ---------------------------------------------------------
  // Traer la factura del proveedor desde su XML
  //
  // El XML es la factura de verdad: el papel es su impresión. Leerlo no
  // es "reconocer" nada, es abrir el documento original, así que
  // cantidades, precios e IVA entran exactos.
  //
  // Lo difícil no es leerlo: es que el proveedor factura con SU código
  // ("Q-10001203"), SU descripción ("BONICESSOTE FRESA X 10") y SU
  // presentación (la caja de 10). Nada de eso está en el catálogo del
  // market. Por eso el sistema lo aprende una vez por producto y desde
  // la segunda factura entra solo.
  // ---------------------------------------------------------
  const zonaXml = root.querySelector('#zona-xml');
  const xmlMsg = root.querySelector('#xml-msg');

  root.querySelector('#xml-archivo').addEventListener('change', (e) => {
    procesarArchivos([...e.target.files]);
  });

  ['dragenter', 'dragover'].forEach((ev) => zonaXml.addEventListener(ev, (e) => {
    e.preventDefault();
    zonaXml.classList.add('arrastrando');
  }));
  ['dragleave', 'drop'].forEach((ev) => zonaXml.addEventListener(ev, (e) => {
    e.preventDefault();
    zonaXml.classList.remove('arrastrando');
  }));
  zonaXml.addEventListener('drop', (e) => {
    procesarArchivos([...(e.dataTransfer?.files ?? [])]);
  });

  async function procesarArchivos(archivos) {
    const xmls = archivos.filter((f) => /\.xml$/i.test(f.name) || /xml/.test(f.type));
    if (!xmls.length) {
      xmlMsg.textContent = 'Eso no es un archivo XML. Busque el adjunto .xml del correo del ' +
                           'proveedor, o descárguelo de SRI en línea.';
      xmlMsg.className = 'form-msg error';
      return;
    }
    // De a una: cada factura es un ingreso distinto y hay que revisarla.
    if (xmls.length > 1) {
      xmlMsg.textContent = `Se abrirá la primera (${xmls[0].name}). Las facturas se ingresan ` +
                           'de una en una, porque cada una se cuenta contra su propia mercadería.';
      xmlMsg.className = 'form-msg';
    }
    const texto = await xmls[0].text();
    abrirImportacion(leerFacturaXML(texto));
  }

  async function abrirImportacion(factura) {
    if (!factura.ok) {
      xmlMsg.textContent = factura.error;
      xmlMsg.className = 'form-msg error';
      return;
    }

    // ¿Es para nosotros? Una factura a otro RUC en nuestro inventario
    // es un error caro y silencioso.
    const { data: emp } = await supabase.from('empresa').select('ruc').limit(1).maybeSingle();
    const ajeno = emp?.ruc && factura.rucComprador && emp.ruc !== factura.rucComprador;

    // ¿Ya se ingresó? La clave de acceso es la identidad del documento.
    let repetida = null;
    if (factura.claveAcceso) {
      const { data } = await supabase.from('documentos_ingreso')
        .select('numero_interno, estado').eq('clave_acceso', factura.claveAcceso).maybeSingle();
      repetida = data;
    }

    const prov = (proveedores ?? []).find((x) => x.ruc === factura.ruc);

    abrirModal({
      titulo: `Factura ${factura.numero} — ${factura.razonSocial}`,
      ancho: '62rem',
      contenido: `
        ${repetida ? `
          <div class="aviso-inline">
            <b>Esta factura ya se ingresó</b> como ${escapar(repetida.numero_interno)}
            (${escapar(repetida.estado)}). Ingresarla otra vez duplicaría el stock y arruinaría
            el costo promedio.
          </div>` : ''}
        ${ajeno ? `
          <div class="aviso-inline">
            <b>Esta factura no está a nombre del negocio.</b> Está emitida a
            ${escapar(factura.rucComprador)} y el RUC configurado es ${escapar(emp.ruc)}.
          </div>` : ''}
        ${!prov ? `
          <div class="aviso-inline">
            El proveedor con RUC ${escapar(factura.ruc)} no está en el catálogo.
            <b>Créelo primero</b> en Compras → Proveedores; sin él no se puede registrar la compra.
          </div>` : ''}

        <div class="imp-resumen">
          <div><span>Proveedor</span><b>${escapar(factura.razonSocial)}</b></div>
          <div><span>RUC</span><b>${escapar(factura.ruc)}</b></div>
          <div><span>Fecha</span><b>${escapar(factura.fechaEmision)}</b></div>
          <div><span>Subtotal</span><b>$${Number(factura.subtotal).toFixed(2)}</b></div>
          <div><span>IVA</span><b>$${Number(factura.iva).toFixed(2)}</b></div>
          <div><span>Total</span><b>$${Number(factura.total).toFixed(2)}</b></div>
        </div>

        <p class="nota">Cada línea trae el código y la descripción <b>del proveedor</b>. Diga una
        sola vez a qué producto suyo corresponde y cuántas unidades trae; de la próxima factura
        en adelante entrará sola.</p>

        <div id="imp-lineas"><p class="loading">Buscando equivalencias…</p></div>
        <p id="imp-msg" class="form-msg"></p>`,
      botones: [
        { texto: 'Cancelar', clase: 'btn-secundario', accion: cerrarModal },
        { texto: 'Crear el ingreso', clase: 'btn-primary', accion: crear },
      ],
      alAbrir: (modal) => pintarLineas(modal, factura, prov),
    });

    let traducidas = [];

    async function pintarLineas(modal, f, proveedor) {
      const caja = modal.querySelector('#imp-lineas');
      if (!proveedor) { caja.innerHTML = ''; return; }

      const { data, error } = await supabase.rpc('fn_traducir_factura', {
        p_proveedor_id: proveedor.id,
        p_lineas: f.lineas,
      });
      if (error) {
        caja.innerHTML = traducirErrorSupabase(error, 'proveedor_producto');
        return;
      }
      traducidas = data ?? [];

      caja.innerHTML = `
        <table class="dyn-table tabla-importacion">
          <thead>
            <tr>
              <th>Código prov.</th><th>Descripción en la factura</th>
              <th class="num">Cant.</th><th class="num">P. unit.</th>
              <th>Producto del market</th><th class="num">Trae</th>
              <th class="num">Al stock</th><th class="num">Costo unit.</th>
            </tr>
          </thead>
          <tbody>
            ${traducidas.map((l, i) => filaImportacion(l, i)).join('')}
          </tbody>
        </table>`;

      // Cada desplegable y cada factor recalculan su fila en vivo.
      caja.querySelectorAll('[data-prod]').forEach((sel) => {
        sel.addEventListener('change', () => recalcularFila(caja, Number(sel.dataset.prod)));
      });
      caja.querySelectorAll('[data-factor]').forEach((inp) => {
        inp.addEventListener('input', () => recalcularFila(caja, Number(inp.dataset.factor)));
      });
    }

    function filaImportacion(l, i) {
      const opciones = (productos ?? []).map((p) =>
        `<option value="${p.id}" ${p.id === (l.producto_id ?? l.sugerencia_id) ? 'selected' : ''}>
           ${escapar(p.codigo)} — ${escapar(p.nombre)}</option>`).join('');

      return `
        <tr class="${l.reconocido ? '' : 'row-warning'}" data-fila="${i}">
          <td>${escapar(l.codigo_proveedor)}</td>
          <td>${escapar(l.descripcion)}
            ${l.motivo ? `<div class="nota">${escapar(l.motivo)}</div>` : ''}</td>
          <td class="num">${Number(l.cantidad_factura)}</td>
          <td class="num">$${Number(l.precio_factura).toFixed(4)}</td>
          <td>
            <select data-prod="${i}">
              <option value="">— elija el producto —</option>
              ${opciones}
            </select>
          </td>
          <td class="num">
            <input type="number" data-factor="${i}" min="0.001" step="0.001"
                   value="${Number(l.factor ?? 1)}" title="Unidades que trae cada uno" />
          </td>
          <td class="num" data-real="${i}">${Number(l.cantidad_real ?? 0)}</td>
          <td class="num" data-costo="${i}">$${Number(l.costo_unitario ?? 0).toFixed(4)}</td>
        </tr>`;
    }

    function recalcularFila(caja, i) {
      const l = traducidas[i];
      const factor = Number(caja.querySelector(`[data-factor="${i}"]`).value) || 1;
      const real = Number(l.cantidad_factura) * factor;
      caja.querySelector(`[data-real="${i}"]`).textContent = real;
      caja.querySelector(`[data-costo="${i}"]`).textContent =
        `$${(Number(l.precio_factura) / factor).toFixed(4)}`;

      const elegido = caja.querySelector(`[data-prod="${i}"]`).value;
      caja.querySelector(`tr[data-fila="${i}"]`).classList.toggle('row-warning', !elegido);
    }

    async function crear(modal) {
      const msg = modal.querySelector('#imp-msg');
      if (!prov) {
        msg.textContent = 'Primero cree el proveedor en Compras → Proveedores.';
        msg.className = 'form-msg error';
        return;
      }
      if (repetida) {
        msg.textContent = 'Esta factura ya está ingresada. No se puede ingresar dos veces.';
        msg.className = 'form-msg error';
        return;
      }

      const caja = modal.querySelector('#imp-lineas');
      const elecciones = traducidas.map((l, i) => ({
        linea: l,
        productoId: caja.querySelector(`[data-prod="${i}"]`)?.value || '',
        factor: Number(caja.querySelector(`[data-factor="${i}"]`)?.value) || 1,
      }));

      const sinProducto = elecciones.filter((e) => !e.productoId);
      if (sinProducto.length) {
        msg.textContent =
          `Faltan ${sinProducto.length} línea(s) por emparejar: ` +
          sinProducto.map((e) => e.linea.descripcion).join(', ') +
          '. Si alguna es un producto nuevo, créelo primero en Catálogo → Productos.';
        msg.className = 'form-msg error';
        return;
      }

      msg.textContent = 'Creando el ingreso…';
      msg.className = 'form-msg';

      const { data: { user } } = await supabase.auth.getUser();
      const { data: doc, error: errDoc } = await supabase.from('documentos_ingreso').insert({
        proveedor_id: prov.id,
        bodega_id: selBodega.value || bodegas?.[0]?.id,
        tipo_documento: 'FACTURA',
        numero_documento: factura.numero,
        autorizacion_sri: factura.claveAcceso || null,
        clave_acceso: factura.claveAcceso || null,
        origen: 'XML_SRI',
        fecha_emision: factura.fechaEmision,
        usuario_id: user?.id ?? null,
      }).select('id, numero_interno').single();

      if (errDoc) {
        msg.textContent = /ux_ingreso_clave_acceso|duplicate/i.test(errDoc.message)
          ? 'Esta factura ya está ingresada: la clave de acceso ya existe en el sistema.'
          : errDoc.message;
        msg.className = 'form-msg error';
        return;
      }

      // Se recuerdan las equivalencias ANTES de crear las líneas: si
      // algo falla a mitad, lo aprendido no se pierde y el segundo
      // intento ya entra solo.
      for (const e of elecciones) {
        await supabase.rpc('fn_vincular_producto_proveedor', {
          p_proveedor_id: prov.id,
          p_codigo_proveedor: e.linea.codigo_proveedor,
          p_producto_id: e.productoId,
          p_factor: e.factor,
          p_descripcion: e.linea.descripcion,
        });
      }

      let fallidas = 0;
      for (const e of elecciones) {
        const { data, error } = await supabase.rpc('fn_agregar_linea_ingreso', {
          p_documento_id: doc.id,
          p_producto_id: e.productoId,
          p_bultos: Number(e.linea.cantidad_factura),
          p_costo_bulto: Number(e.linea.precio_factura),
          p_presentacion_id: null,
          p_bultos_documento: Number(e.linea.cantidad_factura),
          p_codigo_escaneado: null,
          p_codigo_lote: null,
          p_fecha_caducidad: null,
          p_observacion: `Importado del XML · ${e.linea.codigo_proveedor} · ${e.linea.descripcion}`,
        });
        const r = Array.isArray(data) ? data[0] : data;
        if (error || r?.estado === 'ERROR') fallidas += 1;
      }

      cerrarModal();
      documentoId = doc.id;
      ordenId = null;
      root.querySelector('#ing-numero-interno').textContent = doc.numero_interno;
      root.querySelector('#panel-detalle').classList.remove('hidden');
      root.querySelector('#form-cabecera')
        .querySelectorAll('input, select, button').forEach((el) => (el.disabled = true));

      xmlMsg.innerHTML = fallidas
        ? `Ingreso ${escapar(doc.numero_interno)} creado, pero ${fallidas} línea(s) no entraron. ` +
          'Revise abajo y agréguelas a mano.'
        : `Ingreso <b>${escapar(doc.numero_interno)}</b> creado con ${elecciones.length} ` +
          'líneas. <b>Ahora cuente la mercadería</b> y corrija las cantidades que no coincidan: ' +
          'al stock entra lo que llegó, no lo que dice la factura.';
      xmlMsg.className = `form-msg ${fallidas ? 'error' : 'ok'}`;

      cargarDetalle();
    }
  }
  let ordenId = null;
  const msg = root.querySelector('#ing-msg');
  const detMsg = root.querySelector('#det-msg');

  // ---------------------------------------------------------
  // Cabecera
  // ---------------------------------------------------------
  root.querySelector('#form-cabecera').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = 'Creando…';
    msg.className = 'form-msg';
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.from('documentos_ingreso').insert({
      proveedor_id: selProveedor.value,
      bodega_id: selBodega.value,
      orden_compra_id: selOrden.value || null,
      tipo_documento: root.querySelector('#ing-tipo').value,
      numero_documento: root.querySelector('#ing-numero').value.trim(),
      autorizacion_sri: root.querySelector('#ing-autorizacion').value.trim() || null,
      fecha_emision: root.querySelector('#ing-fecha').value,
      usuario_id: user?.id ?? null,
    }).select('id, numero_interno').single();

    if (error) {
      msg.textContent = error.message;
      msg.className = 'form-msg error';
      return;
    }
    documentoId = data.id;
    ordenId = selOrden.value || null;
    root.querySelector('#ing-numero-interno').textContent = data.numero_interno;
    root.querySelector('#panel-detalle').classList.remove('hidden');
    root.querySelector('#cotejo-panel').classList.toggle('hidden', !ordenId);
    msg.textContent = `Ingreso ${data.numero_interno} creado. Escanee el primer producto.`;
    msg.className = 'form-msg ok';
    e.target.querySelectorAll('input, select, button').forEach((el) => (el.disabled = true));
    root.querySelector('#det-scan').focus();
  });

  // ---------------------------------------------------------
  // Escaneo del producto físico
  // ---------------------------------------------------------
  const scan = root.querySelector('#det-scan');
  let codigoVerificado = null;      // el código que confirmó esta línea

  function buscarPorCodigo(texto) {
    const limpio = String(texto ?? '').trim();
    if (!limpio) return null;
    const ean = normalizarCodigoEscaneado(limpio);

    const hallado = (codigos ?? []).find(
      (c) => c.codigo === limpio || (ean && c.codigo === ean));
    if (hallado) {
      return {
        producto: (productos ?? []).find((p) => p.id === hallado.producto_id),
        presentacionId: hallado.presentacion_id,
        codigo: hallado.codigo,
      };
    }

    // Respaldo: código interno del producto, o base sin migrar
    const p = (productos ?? []).find(
      (x) => x.codigo.toLowerCase() === limpio.toLowerCase() || (ean && x.ean13 === ean));
    return p ? { producto: p, presentacionId: null, codigo: ean ?? limpio } : null;
  }

  async function procesarCodigo(texto) {
    const limpio = String(texto ?? '').trim();
    if (!limpio) return;

    const hallazgo = buscarPorCodigo(limpio);
    if (hallazgo?.producto) {
      selProducto.value = hallazgo.producto.id;
      cargarPresentaciones();
      if (hallazgo.presentacionId) selPresentacion.value = hallazgo.presentacionId;
      codigoVerificado = hallazgo.codigo;
      detMsg.innerHTML =
        `<b>${escapar(hallazgo.producto.nombre)}</b> — código verificado ✔`;
      detMsg.className = 'form-msg ok';
      root.querySelector('#det-bultos').focus();
      recalcular();
      return;
    }

    // Código desconocido: es el caso del proveedor que lo cambió.
    codigoVerificado = null;
    await preguntarCodigoNuevo(normalizarCodigoEscaneado(limpio) ?? limpio);
  }

  scan.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = scan.value;
    scan.value = '';
    procesarCodigo(v);
  });

  root.querySelector('#det-camara').addEventListener('click', async () => {
    const { abrirEscaner } = await import('./lib/escaner.js');
    abrirEscaner({
      titulo: 'Escanear el producto recibido',
      ayuda: 'Apunte al código impreso en el envase, no al de la guía de remisión.',
      alLeer: (codigo) => { procesarCodigo(codigo); },
    });
  });

  /**
   * El código no está registrado. Puede ser un producto nuevo o —lo más
   * frecuente— un producto conocido cuyo código cambió el proveedor.
   *
   * Registrarlo NO cambia stock ni precios: solo agrega una forma más de
   * reconocer el producto. Por eso es seguro hacerlo en la bodega.
   */
  async function preguntarCodigoNuevo(codigo) {
    abrirModal({
      titulo: `El código ${codigo} no está registrado`,
      contenido: `
        <p>Esto pasa cuando el proveedor cambia el código de barras del mismo producto.
        Elija a qué producto pertenece y quedará registrado <b>además</b> del que ya tenía:
        la mercadería que está en percha con el código viejo se seguirá vendiendo igual.</p>
        <label class="ancho-completo">Producto
          <select id="cod-producto">
            <option value="">Elija el producto…</option>
            ${(productos ?? []).map((p) =>
              `<option value="${p.id}">${escapar(p.codigo)} — ${escapar(p.nombre)}</option>`).join('')}
          </select>
        </label>
        <label class="ancho-completo">Es el código de
          <select id="cod-presentacion"><option value="">La unidad de venta</option></select>
        </label>
        <label class="ancho-completo">Nota (opcional)
          <input type="text" id="cod-nota" placeholder="Cambio de código, septiembre 2026" />
        </label>
        <p id="cod-msg" class="form-msg"></p>
        <p class="nota">Si es un producto que el market nunca ha vendido, ciérrelo y créelo
        primero en <b>Catálogo → Productos</b>.</p>`,
      botones: [
        { texto: 'Cancelar', clase: 'btn-secundario', accion: cerrarModal },
        { texto: 'Registrar el código', clase: 'btn-primary', accion: guardar },
      ],
      alAbrir: (modal) => {
        const sel = modal.querySelector('#cod-producto');
        const selPres = modal.querySelector('#cod-presentacion');
        sel.addEventListener('change', () => {
          selPres.length = 1;
          for (const pr of presPorProducto.get(sel.value) ?? []) {
            if (pr.es_base) continue;
            const o = document.createElement('option');
            o.value = pr.id;
            o.textContent = `${pr.nombre} (${pr.factor} unidades)`;
            selPres.appendChild(o);
          }
        });
      },
    });

    async function guardar(modal) {
      const productoId = modal.querySelector('#cod-producto').value;
      const cmsg = modal.querySelector('#cod-msg');
      if (!productoId) {
        cmsg.textContent = 'Elija el producto al que pertenece este código';
        cmsg.className = 'form-msg error';
        return;
      }
      cmsg.textContent = 'Registrando…';
      cmsg.className = 'form-msg';

      const { data, error } = await supabase.rpc('fn_registrar_codigo_producto', {
        p_producto_id: productoId,
        p_codigo: codigo,
        p_tipo: 'EAN13',
        p_presentacion_id: modal.querySelector('#cod-presentacion').value || null,
        p_observacion: modal.querySelector('#cod-nota').value.trim() || null,
      });

      if (error) {
        cmsg.textContent = error.message;
        cmsg.className = 'form-msg error';
        return;
      }
      const r = Array.isArray(data) ? data[0] : data;
      if (r?.estado === 'CONFLICTO' || r?.estado === 'ERROR') {
        cmsg.textContent = r.mensaje;
        cmsg.className = 'form-msg error';
        return;
      }

      codigos.push({
        producto_id: productoId,
        codigo,
        presentacion_id: modal.querySelector('#cod-presentacion').value || null,
        activo: true,
      });
      cerrarModal();

      selProducto.value = productoId;
      cargarPresentaciones();
      codigoVerificado = codigo;
      detMsg.textContent = r?.mensaje ?? 'Código registrado.';
      detMsg.className = 'form-msg ok';
      root.querySelector('#det-bultos').focus();
    }
  }

  // ---------------------------------------------------------
  // Presentaciones y cálculo en vivo
  // ---------------------------------------------------------
  const campoBultos = root.querySelector('#det-bultos');
  const campoBultosDoc = root.querySelector('#det-bultos-doc');
  const campoCosto = root.querySelector('#det-costo');
  const calculo = root.querySelector('#det-calculo');

  const fraccionable = (p) =>
    Boolean(p?.unidades_medida?.permite_fraccion ?? p?.permite_fraccion);

  function productoActual() {
    return (productos ?? []).find((x) => x.id === selProducto.value) ?? null;
  }

  function presentacionActual() {
    const lista = presPorProducto.get(selProducto.value) ?? [];
    return lista.find((x) => x.id === selPresentacion.value) ?? null;
  }

  function factorActual() {
    return Number(presentacionActual()?.factor ?? 1) || 1;
  }

  function cargarPresentaciones() {
    selPresentacion.length = 0;
    const p = productoActual();
    const lista = presPorProducto.get(selProducto.value) ?? [];

    if (!lista.length) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = `${p?.unidad_medida ?? 'Unidad'} (sin presentaciones cargadas)`;
      selPresentacion.appendChild(o);
    } else {
      for (const pr of lista) {
        if (!pr.para_compra) continue;
        const o = document.createElement('option');
        o.value = pr.es_base ? '' : pr.id;
        o.textContent = pr.es_base ? pr.nombre : `${pr.nombre} — ${pr.factor} ${p?.unidad_medida ?? 'un'}`;
        selPresentacion.appendChild(o);
      }
    }

    ajustarPasoBultos();
    recalcular();
  }

  /**
   * El campo de bultos admite decimales solo si el producto se pesa y
   * se recibe suelto: 12,5 lb de pollo sí, 12,5 cajas no.
   *
   * El mínimo y el paso se fijan SIEMPRE juntos. Ese fue el error que
   * producía el 1.0001: con min="0.0001" y step="1", el navegador solo
   * aceptaba 0,0001 · 1,0001 · 2,0001, porque cuenta los pasos desde el
   * mínimo y no desde cero.
   */
  function ajustarPasoBultos() {
    const p = productoActual();
    const suelto = !presentacionActual() || factorActual() === 1;
    if (suelto && fraccionable(p)) {
      campoBultos.min = '0.001'; campoBultos.step = '0.001';
      campoBultosDoc.min = '0';  campoBultosDoc.step = '0.001';
    } else {
      campoBultos.min = '1'; campoBultos.step = '1';
      campoBultosDoc.min = '0'; campoBultosDoc.step = '1';
    }
  }

  function recalcular() {
    const p = productoActual();
    if (!p) { calculo.textContent = 'Elija o escanee un producto.'; return; }

    const factor = factorActual();
    const bultos = Number(campoBultos.value);
    const costo = Number(campoCosto.value);
    const unidad = p.unidad_medida ?? 'un';

    if (!Number.isFinite(bultos) || bultos <= 0) {
      calculo.textContent = `1 bulto = ${factor} ${unidad}. Escriba cuántos bultos recibió.`;
      return;
    }

    const unidades = bultos * factor;
    const partes = [`<b>${unidades} ${escapar(unidad)}</b> entran al stock`];

    if (Number.isFinite(costo) && costo > 0) {
      partes.push(`costo por ${escapar(unidad)}: <b>$${(costo / factor).toFixed(4)}</b>`);
    }

    const bultosDoc = Number(campoBultosDoc.value);
    if (Number.isFinite(bultosDoc) && bultosDoc > 0 && bultosDoc !== bultos) {
      const dif = (bultos - bultosDoc) * factor;
      partes.push(
        `<span class="fr-diferencia">${dif > 0 ? 'sobrante' : 'faltante'} de ` +
        `${Math.abs(dif)} ${escapar(unidad)} respecto de la factura</span>`);
    }

    if (!fraccionable(p) && unidades !== Math.round(unidades)) {
      partes.push('<span class="fr-diferencia">la cuenta no da un número entero: ' +
                  'revise el factor de la presentación</span>');
    }

    calculo.innerHTML = partes.join(' · ');
  }

  selProducto.addEventListener('change', () => { codigoVerificado = null; cargarPresentaciones(); });
  // Solo recalcula: reconstruir la lista aquí borraría la presentación
  // que el bodeguero acaba de elegir y volvería siempre a la unidad.
  selPresentacion.addEventListener('change', () => { ajustarPasoBultos(); recalcular(); });
  campoBultos.addEventListener('input', recalcular);
  campoBultosDoc.addEventListener('input', recalcular);
  campoCosto.addEventListener('input', recalcular);

  // ---------------------------------------------------------
  // Sugerencia de precios sobre el costo real
  // ---------------------------------------------------------
  root.querySelector('#det-precios').addEventListener('click', async () => {
    const p = productoActual();
    const costo = Number(campoCosto.value) / factorActual();
    if (!p || !Number.isFinite(costo) || costo <= 0) {
      detMsg.textContent = 'Primero elija el producto y escriba el costo del bulto';
      detMsg.className = 'form-msg error';
      return;
    }

    const { data, error } = await supabase.rpc('fn_sugerir_precios', {
      p_costo_unitario: costo,
      p_categoria_id: p.categoria_id ?? null,
      p_factor_mayor: factorActual(),
    });
    if (error) {
      detMsg.textContent = error.message;
      detMsg.className = 'form-msg error';
      return;
    }
    const s = Array.isArray(data) ? data[0] : data;
    abrirSugerenciaPrecios(p, s, costo);
  });

  function abrirSugerenciaPrecios(p, s, costo) {
    abrirModal({
      titulo: `Precios sugeridos para ${p.nombre}`,
      contenido: `
        <table class="dyn-table tabla-precios">
          <tbody>
            <tr><td>Costo real por ${escapar(p.unidad_medida ?? 'unidad')}</td>
                <td class="num"><b>$${Number(costo).toFixed(4)}</b></td></tr>
            <tr><td>Precio actual al público</td>
                <td class="num">$${Number(p.precio_venta_menor ?? 0).toFixed(2)}</td></tr>
            <tr><td>Sugerido al público (margen ${Number(s?.margen_menor ?? 0)}%)</td>
                <td class="num"><b>$${Number(s?.precio_menor ?? 0).toFixed(2)}</b></td></tr>
            <tr><td>Sugerido al por mayor (margen ${Number(s?.margen_mayor ?? 0)}%)</td>
                <td class="num"><b>$${Number(s?.precio_mayor ?? 0).toFixed(2)}</b></td></tr>
            <tr><td>Utilidad por ${escapar(p.unidad_medida ?? 'unidad')} al público</td>
                <td class="num">$${Number(s?.utilidad_menor ?? 0).toFixed(4)}</td></tr>
          </tbody>
        </table>
        <p class="nota">${escapar(s?.nota ?? '')}</p>
        <p class="nota">Los márgenes objetivo se configuran por categoría en
        <b>Catálogo → Categorías</b>, y el general en <b>Administración → Empresa</b>.</p>
        <p id="pre-msg" class="form-msg"></p>`,
      botones: [
        { texto: 'Solo mirar', clase: 'btn-secundario', accion: cerrarModal },
        { texto: 'Aplicar estos precios', clase: 'btn-primary', accion: aplicar },
      ],
    });

    async function aplicar(modal) {
      const pmsg = modal.querySelector('#pre-msg');
      pmsg.textContent = 'Guardando…';
      pmsg.className = 'form-msg';
      const { error } = await supabase.from('productos').update({
        precio_venta_menor: Number(s.precio_menor),
        precio_venta_mayor: Number(s.precio_mayor),
      }).eq('id', p.id);

      if (error) {
        pmsg.textContent = /permission|row-level|42501/i.test(error.message)
          ? 'Su usuario no tiene permiso para cambiar precios.'
          : error.message;
        pmsg.className = 'form-msg error';
        return;
      }
      p.precio_venta_menor = Number(s.precio_menor);
      cerrarModal();
      detMsg.textContent = `Precios actualizados para ${p.nombre}.`;
      detMsg.className = 'form-msg ok';
    }
  }

  // ---------------------------------------------------------
  // Agregar la línea
  // ---------------------------------------------------------
  root.querySelector('#form-detalle').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = productoActual();
    if (!p) {
      detMsg.textContent = 'Elija o escanee el producto';
      detMsg.className = 'form-msg error';
      return;
    }

    detMsg.textContent = 'Agregando…';
    detMsg.className = 'form-msg';

    const { data, error } = await supabase.rpc('fn_agregar_linea_ingreso', {
      p_documento_id: documentoId,
      p_producto_id: p.id,
      p_bultos: Number(campoBultos.value),
      p_costo_bulto: Number(campoCosto.value),
      p_presentacion_id: selPresentacion.value || null,
      p_bultos_documento: campoBultosDoc.value === '' ? null : Number(campoBultosDoc.value),
      p_codigo_escaneado: codigoVerificado,
      p_codigo_lote: root.querySelector('#det-lote').value.trim() || null,
      p_fecha_caducidad: root.querySelector('#det-caducidad').value || null,
      p_observacion: null,
    });

    if (error) {
      detMsg.textContent = error.message;
      detMsg.className = 'form-msg error';
      return;
    }

    const r = Array.isArray(data) ? data[0] : data;
    if (r?.estado === 'ERROR' || r?.estado === 'CODIGO_DESCONOCIDO') {
      detMsg.textContent = r.mensaje;
      detMsg.className = 'form-msg error';
      return;
    }

    detMsg.textContent = r?.mensaje ?? 'Línea agregada.';
    // Una diferencia con la factura no es un error, pero tampoco es
    // rutina: se muestra en ámbar para que alguien la mire.
    detMsg.className = `form-msg ${r?.estado === 'DIFERENCIA' ? 'aviso' : 'ok'}`;

    campoBultos.value = '';
    campoBultosDoc.value = '';
    campoCosto.value = '';
    root.querySelector('#det-lote').value = '';
    root.querySelector('#det-caducidad').value = '';
    codigoVerificado = null;
    recalcular();
    scan.focus();
    cargarDetalle();
  });

  // ---------------------------------------------------------
  // Tablas
  // ---------------------------------------------------------
  async function cargarDetalle() {
    const { data, error } = await supabase
      .from('ingreso_detalle')
      .select('cantidad, cantidad_documento, bultos, costo_unitario, costo_bulto, subtotal, ' +
              'codigo_lote, fecha_caducidad, codigo_verificado, presentaciones(nombre, factor), ' +
              'productos(codigo, nombre, unidad_medida)')
      .eq('documento_ingreso_id', documentoId);

    const destino = root.querySelector('#detalle-table');
    if (error) {
      destino.innerHTML = traducirErrorSupabase(error, 'ingreso_detalle');
      return;
    }

    renderTable(destino, {
      columns: [
        { key: 'codigo', label: 'Código' },
        { key: 'producto', label: 'Producto' },
        { key: 'presentacion', label: 'Presentación' },
        { key: 'bultos', label: 'Bultos', numeric: true },
        { key: 'cantidad_documento', label: 'Factura', numeric: true },
        { key: 'cantidad', label: 'Recibido', numeric: true },
        { key: 'diferencia', label: 'Dif.', numeric: true,
          format: (v) => (Number(v) === 0 ? '—' : Number(v).toFixed(2)) },
        { key: 'verificado', label: 'Escaneado' },
        { key: 'costo_unitario', label: 'Costo unit.', numeric: true, format: (v) => `$${Number(v).toFixed(4)}` },
        { key: 'subtotal', label: 'Subtotal', numeric: true, format: (v) => `$${Number(v).toFixed(2)}` },
        { key: 'codigo_lote', label: 'Lote' },
        { key: 'fecha_caducidad', label: 'Caducidad' },
      ],
      rows: (data ?? []).map((d) => ({
        ...d,
        codigo: d.productos?.codigo,
        producto: d.productos?.nombre,
        presentacion: d.presentaciones?.nombre ?? d.productos?.unidad_medida ?? '—',
        diferencia: Number(d.cantidad ?? 0) - Number(d.cantidad_documento ?? d.cantidad ?? 0),
        verificado: d.codigo_verificado ? '✔' : '—',
      })),
      rowClass: (r) => (Number(r.diferencia) !== 0 ? 'row-warning' : ''),
      searchable: false,
      emptyMessage: 'Todavía no hay líneas en este ingreso.',
    });

    const { data: doc } = await supabase
      .from('documentos_ingreso')
      .select('subtotal, valor_impuesto, total')
      .eq('id', documentoId).single();

    root.querySelector('#ing-totales').innerHTML = doc
      ? `<div>Subtotal: <b>$${Number(doc.subtotal).toFixed(2)}</b></div>
         <div>IVA: <b>$${Number(doc.valor_impuesto).toFixed(2)}</b></div>
         <div class="total-grande">Total: <b>$${Number(doc.total).toFixed(2)}</b></div>`
      : '';

    if (ordenId) cargarCotejo();
  }

  async function cargarCotejo() {
    const { data, error } = await supabase
      .from('v_recepcion_vs_orden').select('*').eq('documento_id', documentoId);
    const destino = root.querySelector('#cotejo-table');
    if (error) { destino.innerHTML = traducirErrorSupabase(error, 'v_recepcion_vs_orden'); return; }

    renderTable(destino, {
      columns: [
        { key: 'producto_codigo', label: 'Código' },
        { key: 'producto', label: 'Producto' },
        { key: 'pedido', label: 'Pedido', numeric: true },
        { key: 'facturado', label: 'Facturado', numeric: true },
        { key: 'recibido', label: 'Recibido', numeric: true },
        { key: 'diferencia', label: 'Diferencia', numeric: true },
        { key: 'resultado', label: 'Resultado' },
      ],
      rows: data ?? [],
      rowClass: (r) => (r.resultado === 'CONFORME' ? '' : 'row-warning'),
      searchable: false,
      emptyMessage: 'Sin líneas que cotejar todavía.',
    });
  }

  // ---------------------------------------------------------
  // Confirmar
  // ---------------------------------------------------------
  root.querySelector('#btn-confirmar').addEventListener('click', async () => {
    const { data: lineas } = await supabase
      .from('ingreso_detalle')
      .select('cantidad, cantidad_documento, codigo_verificado, productos(nombre)')
      .eq('documento_ingreso_id', documentoId);

    if (!lineas?.length) {
      detMsg.textContent = 'No hay líneas que confirmar.';
      detMsg.className = 'form-msg error';
      return;
    }

    const sinEscanear = lineas.filter((l) => !l.codigo_verificado);
    const conDiferencia = lineas.filter(
      (l) => l.cantidad_documento != null && Number(l.cantidad) !== Number(l.cantidad_documento));

    abrirModal({
      titulo: 'Confirmar la recepción',
      contenido: `
        <p>Al confirmar entran al stock <b>las cantidades recibidas</b>, se crean los lotes y
        se escriben los movimientos de kardex. El documento queda cerrado: después no se
        puede editar.</p>

        ${conDiferencia.length ? `
          <div class="aviso-inline">
            <b>${conDiferencia.length} línea(s) no cuadran con la factura.</b> La diferencia
            queda registrada para reclamar al proveedor, y al stock entra lo que llegó:
            <ul>${conDiferencia.map((l) => `<li>${escapar(l.productos?.nombre ?? '')}:
              factura ${l.cantidad_documento}, recibido ${l.cantidad}</li>`).join('')}</ul>
          </div>` : '<p class="nota">Todo lo recibido cuadra con la factura.</p>'}

        ${sinEscanear.length ? `
          <div class="aviso-inline">
            <b>${sinEscanear.length} línea(s) se cargaron sin pasar el escáner.</b> Si el
            proveedor cambió el código de barras, esa mercadería no va a pasar por la caja y
            nadie se enterará hasta que un cliente esté esperando.
          </div>` : '<p class="nota">Todas las líneas se verificaron con el escáner.</p>'}

        <p id="conf-msg" class="form-msg"></p>`,
      botones: [
        { texto: 'Volver a revisar', clase: 'btn-secundario', accion: cerrarModal },
        { texto: 'Confirmar e ingresar a stock', clase: 'btn-primary', accion: confirmar },
      ],
    });

    async function confirmar(modal) {
      const cmsg = modal.querySelector('#conf-msg');
      cmsg.textContent = 'Confirmando…';
      cmsg.className = 'form-msg';

      const { error } = await supabase
        .from('documentos_ingreso')
        .update({ estado: 'CONFIRMADO' })
        .eq('id', documentoId);

      if (error) {
        cmsg.textContent = error.message;
        cmsg.className = 'form-msg error';
        return;
      }
      cerrarModal();
      detMsg.textContent = 'Recepción confirmada: el stock ya está actualizado.';
      detMsg.className = 'form-msg ok';
      root.querySelector('#form-detalle')
        .querySelectorAll('input, select, button').forEach((el) => (el.disabled = true));
      root.querySelector('#btn-confirmar').disabled = true;
      scan.disabled = true;
    }
  });
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}
