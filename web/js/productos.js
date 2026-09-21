// Catálogo de productos.
//
// Además del alta básica, desde aquí se administra lo que decide que el
// inventario cuadre:
//
//   · LAS PRESENTACIONES. Cómo se compra y cómo se vende el mismo
//     producto: "Caja x 12" para el proveedor, "Unidad" para el cliente.
//     El stock se lleva SIEMPRE en la unidad de venta; la presentación
//     solo multiplica al recibir y divide el costo. No es un segundo
//     inventario, y por eso no hay que "abrir paquetes" ni cuadrar dos
//     saldos que se separan.
//
//   · LOS CÓDIGOS DE BARRAS, en plural. El proveedor cambia el EAN del
//     mismo producto y en la percha conviven el viejo y el nuevo.
//     Guardar uno solo obliga a elegir cuál pasa por caja; guardarlos
//     todos hace que pase cualquiera.

import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';
import { abrirModal, cerrarModal } from './lib/modal.js';
import { traducirErrorSupabase } from './lib/errores.js';
import { validarEAN13 } from './lib/ean13.js';

export async function renderProductos(container) {
  container.innerHTML = `
    <form id="form-producto" class="inline-form">
      <input type="text" id="prod-codigo" placeholder="Código" required />
      <input type="text" id="prod-nombre" placeholder="Nombre" required />
      <select id="prod-categoria"><option value="">Sin categoría</option></select>
      <input type="text" id="prod-unidad" placeholder="Unidad (UND, KG, LT...)" value="UND" />
      <input type="number" id="prod-stock-min" placeholder="Stock mínimo" min="0" step="0.01" value="0" />
      <button type="submit">Agregar producto</button>
      <span id="prod-msg" class="form-msg"></span>
    </form>
    <div id="productos-table"></div>
  `;

  const msg = container.querySelector('#prod-msg');
  const tableEl = container.querySelector('#productos-table');
  const categoriaSelect = container.querySelector('#prod-categoria');

  const { data: categorias } = await supabase.from('categorias').select('id, nombre').order('nombre');
  (categorias ?? []).forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.nombre;
    categoriaSelect.appendChild(opt);
  });

  async function load() {
    const [{ data, error }, { data: pres }, { data: cods }] = await Promise.all([
      supabase.from('productos')
        .select('id, codigo, nombre, unidad_medida, stock_minimo, activo, categorias(nombre)')
        .order('nombre'),
      supabase.from('presentaciones').select('producto_id, factor').eq('activo', true),
      supabase.from('v_producto_codigos').select('producto_id').eq('activo', true),
    ]);

    if (error) {
      tableEl.innerHTML = traducirErrorSupabase(error, 'productos');
      return;
    }

    const cuentaPres = new Map();
    for (const p of pres ?? []) {
      // La presentación base (factor 1) no se cuenta: la tiene todo
      // producto y contarla haría creer que ya está configurado.
      if (Number(p.factor) === 1) continue;
      cuentaPres.set(p.producto_id, (cuentaPres.get(p.producto_id) ?? 0) + 1);
    }
    const cuentaCods = new Map();
    for (const c of cods ?? []) {
      cuentaCods.set(c.producto_id, (cuentaCods.get(c.producto_id) ?? 0) + 1);
    }

    renderTable(tableEl, {
      columns: [
        { key: 'codigo', label: 'Código' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'categoria', label: 'Categoría' },
        { key: 'unidad_medida', label: 'Unidad' },
        { key: 'stock_minimo', label: 'Stock mín.', numeric: true },
        { key: 'presentaciones', label: 'Present.', numeric: true,
          format: (v) => (v ? String(v) : '—') },
        { key: 'codigos', label: 'Códigos', numeric: true,
          format: (v) => (v ? String(v) : 'sin código') },
        { key: 'activo', label: 'Activo', format: (v) => (v ? 'Sí' : 'No') },
        {
          key: 'acciones', label: '', sortable: false,
          elemento: (row) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn-secundario btn-mini';
            b.textContent = 'Presentaciones y códigos';
            b.addEventListener('click', () => abrirFicha(row, load));
            return b;
          },
        },
      ],
      rows: (data ?? []).map((p) => ({
        ...p,
        categoria: p.categorias?.nombre ?? '—',
        presentaciones: cuentaPres.get(p.id) ?? 0,
        codigos: cuentaCods.get(p.id) ?? 0,
      })),
      rowClass: (r) => (r.codigos === 0 ? 'row-warning' : ''),
      emptyMessage: 'No hay productos registrados. Agrega el primero arriba.',
    });
  }

  container.querySelector('#form-producto').addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const payload = {
      codigo: container.querySelector('#prod-codigo').value.trim(),
      nombre: container.querySelector('#prod-nombre').value.trim(),
      categoria_id: categoriaSelect.value || null,
      unidad_medida: container.querySelector('#prod-unidad').value.trim() || 'UND',
      stock_minimo: Number(container.querySelector('#prod-stock-min').value || 0),
    };
    const { data, error } = await supabase.from('productos').insert(payload).select('id').single();
    if (error) {
      msg.textContent = error.message;
      msg.className = 'form-msg error';
      return;
    }

    // Todo producto nace con su presentación base. Sin ella, la
    // recepción no tendría de dónde sacar el factor y el bodeguero
    // tendría que escribir unidades a mano otra vez.
    if (data?.id) {
      await supabase.from('presentaciones').insert({
        producto_id: data.id,
        nombre: payload.unidad_medida,
        tipo: 'UNIDAD',
        factor: 1,
        es_base: true,
        para_compra: true,
      });
    }

    msg.textContent = 'Producto agregado. Cargue su código de barras antes de venderlo.';
    msg.className = 'form-msg ok';
    e.target.reset();
    container.querySelector('#prod-unidad').value = 'UND';
    load();
  });

  await load();
}

// =========================================================
// Ficha: presentaciones y códigos de un producto
// =========================================================
async function abrirFicha(producto, alCerrar) {
  abrirModal({
    titulo: `${producto.codigo} — ${producto.nombre}`,
    ancho: '46rem',
    contenido: `
      <div class="ficha-producto">
        <section>
          <h4>Presentaciones</h4>
          <p class="nota">Cómo viene del proveedor y cómo sale al cliente. El
          <b>factor</b> dice cuántas ${escapar(producto.unidad_medida ?? 'unidades')} contiene el
          bulto. El inventario se guarda siempre en ${escapar(producto.unidad_medida ?? 'unidades')}:
          la presentación solo cuenta, no crea un segundo stock.</p>
          <div id="fp-pres"></div>
          <form id="fp-form-pres" class="inline-form">
            <input type="text" id="fp-nombre" placeholder="Caja x 24" required />
            <select id="fp-tipo">
              <option value="CAJA">Caja</option>
              <option value="PAQUETE">Paquete</option>
              <option value="DISPLAY">Display</option>
              <option value="FARDO">Fardo</option>
              <option value="SACO">Saco</option>
              <option value="QUINTAL">Quintal</option>
              <option value="DOCENA">Docena</option>
              <option value="BANDEJA">Bandeja</option>
              <option value="GAVETA">Gaveta</option>
              <option value="OTRO">Otro</option>
            </select>
            <input type="number" id="fp-factor" placeholder="Unidades que trae" min="0.001" step="0.001" required />
            <input type="number" id="fp-precio" placeholder="Precio del bulto (opcional)" min="0" step="0.01" />
            <label class="chk"><input type="checkbox" id="fp-venta" /> se vende así, al por mayor</label>
            <button type="submit">Agregar presentación</button>
          </form>
          <span id="fp-msg-pres" class="form-msg"></span>
        </section>

        <section>
          <h4>Códigos de barras</h4>
          <p class="nota">Todos los que existan. Cuando el proveedor cambia el código, se agrega
          el nuevo y <b>el anterior se queda</b>: la mercadería que está en percha se seguirá
          vendiendo con el de antes. Un código no se borra, se desactiva.</p>
          <div id="fp-cods"></div>
          <form id="fp-form-cod" class="inline-form">
            <input type="text" id="fp-codigo" placeholder="7861000100014" required
                   inputmode="numeric" autocomplete="off" />
            <select id="fp-cod-tipo">
              <option value="EAN13">EAN-13</option>
              <option value="EAN8">EAN-8</option>
              <option value="UPC">UPC</option>
              <option value="INTERNO">Interno</option>
            </select>
            <select id="fp-cod-pres"><option value="">Es el código de la unidad</option></select>
            <button type="submit">Agregar código</button>
            <button type="button" id="fp-camara" class="btn-escanear" title="Leer con la cámara">📷</button>
          </form>
          <span id="fp-msg-cod" class="form-msg"></span>
        </section>
      </div>`,
    botones: [{ texto: 'Cerrar', clase: 'btn-secundario', accion: () => { cerrarModal(); alCerrar(); } }],
    alAbrir: (modal) => montar(modal, producto),
  });
}

async function montar(modal, producto) {
  const msgPres = modal.querySelector('#fp-msg-pres');
  const msgCod = modal.querySelector('#fp-msg-cod');
  const selPresCod = modal.querySelector('#fp-cod-pres');

  async function pintarPresentaciones() {
    const { data, error } = await supabase.from('presentaciones')
      .select('id, nombre, tipo, factor, es_base, para_compra, para_venta, precio_venta, activo')
      .eq('producto_id', producto.id).order('factor');

    const destino = modal.querySelector('#fp-pres');
    if (error) { destino.innerHTML = traducirErrorSupabase(error, 'presentaciones'); return; }

    // El desplegable del código se rellena con las mismas filas: el
    // código de la caja tiene que poder apuntar a la caja.
    selPresCod.length = 1;
    for (const p of data ?? []) {
      if (p.es_base || !p.activo) continue;
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = `Es el código de: ${p.nombre} (${p.factor})`;
      selPresCod.appendChild(o);
    }

    renderTable(destino, {
      columns: [
        { key: 'nombre', label: 'Presentación' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'factor', label: `${producto.unidad_medida ?? 'Unidades'} que trae`, numeric: true },
        { key: 'para_venta', label: 'Se vende así', format: (v) => (v ? 'Sí' : '—') },
        { key: 'precio_venta', label: 'Precio del bulto', numeric: true,
          format: (v) => (v == null ? '—' : `$${Number(v).toFixed(2)}`) },
        {
          key: 'x', label: '', sortable: false,
          elemento: (row) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn-secundario btn-mini';
            if (row.es_base) {
              b.textContent = 'base';
              b.disabled = true;
              b.title = 'La presentación base representa la unidad de venta y no se puede quitar';
              return b;
            }
            b.textContent = row.activo ? 'Desactivar' : 'Activar';
            b.addEventListener('click', async () => {
              const { error: e2 } = await supabase.from('presentaciones')
                .update({ activo: !row.activo }).eq('id', row.id);
              msgPres.textContent = e2 ? e2.message : 'Listo.';
              msgPres.className = `form-msg ${e2 ? 'error' : 'ok'}`;
              pintarPresentaciones();
            });
            return b;
          },
        },
      ],
      rows: data ?? [],
      rowClass: (r) => (r.activo ? '' : 'row-inactiva'),
      searchable: false,
      emptyMessage: 'Este producto no tiene ni su presentación base. Agregue una con factor 1.',
    });
  }

  async function pintarCodigos() {
    const { data, error } = await supabase.from('v_producto_codigos')
      .select('*').eq('producto_id', producto.id);

    const destino = modal.querySelector('#fp-cods');
    if (error) { destino.innerHTML = traducirErrorSupabase(error, 'v_producto_codigos'); return; }

    renderTable(destino, {
      columns: [
        { key: 'codigo', label: 'Código' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'presentacion', label: 'Corresponde a',
          format: (v, r) => v ?? `${producto.unidad_medida ?? 'unidad'} (1)` },
        { key: 'unidades_por_lectura', label: 'Vale por', numeric: true },
        { key: 'principal', label: 'Principal', format: (v) => (v ? '★' : '') },
        { key: 'origen', label: 'Origen' },
        { key: 'created_at', label: 'Registrado', format: (v) => (v ? String(v).slice(0, 10) : '') },
        { key: 'activo', label: 'Activo', format: (v) => (v ? 'Sí' : 'No') },
      ],
      rows: data ?? [],
      rowClass: (r) => (r.activo ? '' : 'row-inactiva'),
      searchable: false,
      emptyMessage: 'Sin códigos. Este producto no puede pasar por la caja con el lector.',
    });
  }

  modal.querySelector('#fp-form-pres').addEventListener('submit', async (e) => {
    e.preventDefault();
    const factor = Number(modal.querySelector('#fp-factor').value);
    msgPres.textContent = 'Guardando…';
    msgPres.className = 'form-msg';

    const { error } = await supabase.from('presentaciones').insert({
      producto_id: producto.id,
      nombre: modal.querySelector('#fp-nombre').value.trim(),
      tipo: modal.querySelector('#fp-tipo').value,
      factor,
      es_base: false,
      para_compra: true,
      para_venta: modal.querySelector('#fp-venta').checked,
      precio_venta: modal.querySelector('#fp-precio').value
        ? Number(modal.querySelector('#fp-precio').value) : null,
    });

    if (error) {
      msgPres.textContent = error.message;
      msgPres.className = 'form-msg error';
      return;
    }
    msgPres.textContent = `Presentación agregada: 1 bulto = ${factor} ${producto.unidad_medida ?? 'un'}.`;
    msgPres.className = 'form-msg ok';
    e.target.reset();
    pintarPresentaciones();
  });

  modal.querySelector('#fp-form-cod').addEventListener('submit', async (e) => {
    e.preventDefault();
    await guardarCodigo(modal.querySelector('#fp-codigo').value.trim());
  });

  modal.querySelector('#fp-camara').addEventListener('click', async () => {
    const { abrirEscaner } = await import('./lib/escaner.js');
    abrirEscaner({
      titulo: `Código de ${producto.nombre}`,
      ayuda: 'Apunte al código impreso en el envase.',
      alLeer: async (codigo) => { await guardarCodigo(codigo); },
    });
  });

  async function guardarCodigo(codigo) {
    const tipo = modal.querySelector('#fp-cod-tipo').value;
    msgCod.textContent = 'Guardando…';
    msgCod.className = 'form-msg';

    // Se avisa antes de llamar a la base: el mensaje aquí puede explicar
    // qué significa, y el de PostgreSQL no.
    if (tipo === 'EAN13' && /^[0-9]{13}$/.test(codigo) && !validarEAN13(codigo)) {
      msgCod.textContent =
        `${codigo} tiene 13 dígitos pero el verificador no cuadra: suele ser un dígito mal ` +
        'leído. Vuelva a escanearlo.';
      msgCod.className = 'form-msg error';
      return;
    }

    const { data, error } = await supabase.rpc('fn_registrar_codigo_producto', {
      p_producto_id: producto.id,
      p_codigo: codigo,
      p_tipo: tipo,
      p_presentacion_id: selPresCod.value || null,
      p_observacion: null,
    });

    if (error) {
      msgCod.textContent = error.message;
      msgCod.className = 'form-msg error';
      return;
    }
    const r = Array.isArray(data) ? data[0] : data;
    msgCod.textContent = r?.mensaje ?? 'Código registrado.';
    msgCod.className = `form-msg ${['CONFLICTO', 'ERROR'].includes(r?.estado) ? 'error' : 'ok'}`;
    if (!['CONFLICTO', 'ERROR'].includes(r?.estado)) {
      modal.querySelector('#fp-codigo').value = '';
      pintarCodigos();
    }
  }

  await pintarPresentaciones();
  await pintarCodigos();
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}
