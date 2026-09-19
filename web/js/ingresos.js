import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';
import { normalizarCodigoEscaneado } from './lib/ean13.js';
import { traducirErrorSupabase } from './lib/errores.js';

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
    <div class="panel">
      <h3>Documento del proveedor</h3>
      <form id="form-cabecera" class="inline-form">
        <select id="ing-proveedor" required><option value="">Proveedor...</option></select>
        <select id="ing-bodega" required><option value="">Bodega...</option></select>
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
      <h3>Detalle — <span id="ing-numero-interno"></span></h3>
      <form id="form-detalle" class="inline-form">
        <input type="text" id="det-scan" placeholder="Escanear EAN-13 o escribir código" autocomplete="off" />
        <select id="det-producto" required><option value="">Producto...</option></select>
        <input type="number" id="det-cantidad" placeholder="Cantidad" min="0.0001" step="0.0001" required />
        <input type="number" id="det-costo" placeholder="Costo unitario" min="0.0001" step="0.0001" required />
        <input type="text" id="det-lote" placeholder="N.º de lote (opcional)" />
        <input type="date" id="det-caducidad" title="Fecha de caducidad" />
        <button type="submit">Agregar línea</button>
        <span id="det-msg" class="form-msg"></span>
      </form>
      <div id="detalle-table"></div>
      <div class="acciones-pie">
        <div id="ing-totales" class="totales"></div>
        <button id="btn-confirmar" class="btn-primary">Confirmar ingreso e ingresar a stock</button>
      </div>
      <p class="nota">Al confirmar se generan los lotes y los movimientos de kardex. El documento queda cerrado y no se puede editar.</p>
    </div>
  `;

  const hoy = new Date().toISOString().slice(0, 10);
  root.querySelector('#ing-fecha').value = hoy;

  const [{ data: proveedores }, { data: bodegas }, { data: productos }] = await Promise.all([
    supabase.from('proveedores').select('id, ruc, nombre_comercial, razon_social').eq('activo', true).order('razon_social'),
    supabase.from('bodegas').select('id, nombre').eq('activa', true).order('nombre'),
    supabase.from('productos').select('id, codigo, nombre, ean13, maneja_lote').eq('activo', true).order('nombre'),
  ]);

  const selProveedor = root.querySelector('#ing-proveedor');
  (proveedores ?? []).forEach((p) => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.nombre_comercial ?? p.razon_social} (${p.ruc})`;
    selProveedor.appendChild(o);
  });

  const selBodega = root.querySelector('#ing-bodega');
  (bodegas ?? []).forEach((b) => {
    const o = document.createElement('option');
    o.value = b.id;
    o.textContent = b.nombre;
    selBodega.appendChild(o);
  });
  if (bodegas?.length === 1) selBodega.value = bodegas[0].id;

  const selProducto = root.querySelector('#det-producto');
  (productos ?? []).forEach((p) => {
    const o = document.createElement('option');
    o.value = p.id;
    o.textContent = `${p.codigo} — ${p.nombre}`;
    o.dataset.lote = p.maneja_lote;
    selProducto.appendChild(o);
  });

  let documentoId = null;
  const msg = root.querySelector('#ing-msg');
  const detMsg = root.querySelector('#det-msg');

  root.querySelector('#form-cabecera').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase.from('documentos_ingreso').insert({
      proveedor_id: selProveedor.value,
      bodega_id: selBodega.value,
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
    root.querySelector('#ing-numero-interno').textContent = data.numero_interno;
    root.querySelector('#panel-detalle').classList.remove('hidden');
    msg.textContent = `Ingreso ${data.numero_interno} creado. Agrega las líneas.`;
    msg.className = 'form-msg ok';
    e.target.querySelectorAll('input, select, button').forEach((el) => (el.disabled = true));
    root.querySelector('#det-scan').focus();
  });

  // Escaneo: al leer un EAN-13 válido selecciona el producto automáticamente
  const scan = root.querySelector('#det-scan');
  scan.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const texto = scan.value.trim();
    const ean = normalizarCodigoEscaneado(texto);
    const encontrado = (productos ?? []).find(
      (p) => (ean && p.ean13 === ean) || p.codigo.toLowerCase() === texto.toLowerCase()
    );
    if (encontrado) {
      selProducto.value = encontrado.id;
      detMsg.textContent = `${encontrado.nombre}`;
      detMsg.className = 'form-msg ok';
      root.querySelector('#det-cantidad').focus();
    } else {
      detMsg.textContent = `No se encontró un producto con el código "${texto}"`;
      detMsg.className = 'form-msg error';
    }
    scan.value = '';
  });

  async function cargarDetalle() {
    const { data, error } = await supabase
      .from('ingreso_detalle')
      .select('cantidad, costo_unitario, subtotal, codigo_lote, fecha_caducidad, productos(codigo, nombre)')
      .eq('documento_ingreso_id', documentoId);

    const destino = root.querySelector('#detalle-table');
    if (error) {
      destino.innerHTML = traducirErrorSupabase(error, 'documentos_ingreso');
      return;
    }
    renderTable(destino, {
      columns: [
        { key: 'codigo', label: 'Código' },
        { key: 'producto', label: 'Producto' },
        { key: 'cantidad', label: 'Cantidad', numeric: true },
        { key: 'costo_unitario', label: 'Costo unit.', numeric: true, format: (v) => `$${Number(v).toFixed(4)}` },
        { key: 'subtotal', label: 'Subtotal', numeric: true, format: (v) => `$${Number(v).toFixed(2)}` },
        { key: 'codigo_lote', label: 'Lote' },
        { key: 'fecha_caducidad', label: 'Caducidad' },
      ],
      rows: (data ?? []).map((d) => ({
        ...d,
        codigo: d.productos?.codigo,
        producto: d.productos?.nombre,
      })),
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
  }

  root.querySelector('#form-detalle').addEventListener('submit', async (e) => {
    e.preventDefault();
    detMsg.textContent = '';
    const { error } = await supabase.from('ingreso_detalle').insert({
      documento_ingreso_id: documentoId,
      producto_id: selProducto.value,
      cantidad: Number(root.querySelector('#det-cantidad').value),
      costo_unitario: Number(root.querySelector('#det-costo').value),
      codigo_lote: root.querySelector('#det-lote').value.trim() || null,
      fecha_caducidad: root.querySelector('#det-caducidad').value || null,
    });
    if (error) {
      detMsg.textContent = error.message;
      detMsg.className = 'form-msg error';
      return;
    }
    detMsg.textContent = 'Línea agregada.';
    detMsg.className = 'form-msg ok';
    root.querySelector('#det-cantidad').value = '';
    root.querySelector('#det-costo').value = '';
    root.querySelector('#det-lote').value = '';
    root.querySelector('#det-caducidad').value = '';
    scan.focus();
    cargarDetalle();
  });

  root.querySelector('#btn-confirmar').addEventListener('click', async () => {
    if (!confirm('¿Confirmar el ingreso? Una vez confirmado no se puede editar.')) return;
    const { error } = await supabase
      .from('documentos_ingreso')
      .update({ estado: 'CONFIRMADO' })
      .eq('id', documentoId);

    if (error) {
      detMsg.textContent = error.message;
      detMsg.className = 'form-msg error';
      return;
    }
    detMsg.textContent = 'Ingreso confirmado: el stock ya está actualizado.';
    detMsg.className = 'form-msg ok';
    root.querySelector('#form-detalle').querySelectorAll('input, select, button').forEach((el) => (el.disabled = true));
    root.querySelector('#btn-confirmar').disabled = true;
  });
}
