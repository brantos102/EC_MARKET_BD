// Transformar un producto en otros: despiece y maquila.
//
// EL CASO: entra un pollo entero, sale en pechuga, piernas, alas y
// hueso. El quintal de arroz que se enfunda de a libra. El bloque de
// queso que se corta. El atado que se separa.
//
// Antes esto se hacía con dos ajustes manuales —una salida del pollo y
// una entrada de las presas "de la nada"— y eso rompía tres cosas: el
// kardex dejaba de explicar de dónde salió la mercadería, las presas
// entraban con costo cero o inventado, y la merma desaparecía.
//
// LO QUE MÁS IMPORTA DE ESTA PANTALLA es el reparto del costo. La
// tentación es repartir los $12 del pollo entre las 9 libras que
// salieron, a $1,33 cada una. Pero entonces la libra de hueso costaría
// lo mismo que la de pechuga, y eso es falso: haría parecer la pechuga
// mucho más rentable de lo que es. El sistema reparte por VALOR DE
// VENTA relativo, que es lo que pide la NIC 2 para productos
// conjuntos, y lo muestra en pantalla para que se vea cómo quedó.

import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';
import { abrirModal, cerrarModal } from './lib/modal.js';
import { traducirErrorSupabase } from './lib/errores.js';
import { aplicarReglaCantidad } from './lib/cantidad.js';
import { botonesExportar, conectarExportar, metaDeEmpresa } from './lib/exportar.js';

export async function renderTransformaciones(container) {
  container.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="nueva">Nueva transformación</button>
      <button class="tab" data-tab="recetas">Recetas</button>
      <button class="tab" data-tab="historial">Historial</button>
    </div>
    <div id="tab-nueva"></div>
    <div id="tab-recetas" class="hidden"></div>
    <div id="tab-historial" class="hidden"></div>`;

  const [{ data: productos, error: errP }, { data: bodegas }, { data: recetas }] =
    await Promise.all([
      supabase.from('productos')
        .select('id, codigo, nombre, unidad_medida, permite_fraccion, precio_venta_menor, ' +
                'unidades_medida(permite_fraccion)')
        .eq('activo', true).order('nombre'),
      supabase.from('bodegas').select('id, nombre').eq('activa', true).order('nombre'),
      supabase.from('recetas')
        .select('id, codigo, nombre, cantidad_origen, merma_esperada_pct, activa, ' +
                'productos(nombre, unidad_medida)')
        .eq('activa', true).order('nombre'),
    ]);

  if (errP) {
    container.innerHTML = traducirErrorSupabase(errP, 'productos');
    return;
  }

  const aplanado = (productos ?? []).map((p) => ({
    ...p,
    permite_fraccion: Boolean(p.unidades_medida?.permite_fraccion ?? p.permite_fraccion),
  }));

  container.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      for (const t of ['nueva', 'recetas', 'historial']) {
        container.querySelector(`#tab-${t}`).classList.toggle('hidden', t !== btn.dataset.tab);
      }
      if (btn.dataset.tab === 'recetas') vistaRecetas();
      if (btn.dataset.tab === 'historial') vistaHistorial();
    });
  });

  vistaNueva();

  // =======================================================
  // Nueva transformación
  // =======================================================
  function vistaNueva() {
    const destino = container.querySelector('#tab-nueva');
    destino.innerHTML = `
      <div class="panel">
        <h3>¿Qué se va a transformar?</h3>
        <form id="form-tr" class="inline-form">
          <select id="tr-bodega" required>
            ${(bodegas ?? []).map((b) => `<option value="${b.id}">${esc(b.nombre)}</option>`).join('')}
          </select>
          <select id="tr-receta">
            <option value="">Sin receta (a mano)</option>
            ${(recetas ?? []).map((r) =>
              `<option value="${r.id}">${esc(r.nombre)} — ${esc(r.productos?.nombre ?? '')}</option>`).join('')}
          </select>
          <input type="number" id="tr-veces" min="1" step="1" value="1"
                 title="Cuánto del producto de origen se va a procesar" />
          <button type="button" id="tr-cargar" class="btn-secundario">Cargar la receta</button>
        </form>
        <p class="nota">La receta es una propuesta: el despiece real nunca sale exactamente
        igual. Corrija las cantidades con lo que de verdad salió de la balanza antes de confirmar.</p>
      </div>

      <div class="panel">
        <h3>Entra</h3>
        <div id="tr-entradas" class="tr-lineas"></div>
        <button type="button" class="btn-secundario btn-mini" data-agregar="entrada">+ agregar</button>
      </div>

      <div class="panel">
        <h3>Sale</h3>
        <div id="tr-salidas" class="tr-lineas"></div>
        <button type="button" class="btn-secundario btn-mini" data-agregar="salida">+ agregar</button>
      </div>

      <div class="panel">
        <div id="tr-resumen" class="fr-calculo">
          Agregue lo que entra y lo que sale para ver cómo queda el costo.
        </div>
        <div class="acciones-pie">
          <button id="tr-ejecutar" class="btn-primary">Confirmar la transformación</button>
        </div>
        <p id="tr-msg" class="form-msg"></p>
      </div>`;

    const entradas = destino.querySelector('#tr-entradas');
    const salidas = destino.querySelector('#tr-salidas');
    const resumen = destino.querySelector('#tr-resumen');
    const msg = destino.querySelector('#tr-msg');

    // Costos actuales, para poder anticipar el reparto sin tocar nada.
    let costos = new Map();

    async function cargarCostos() {
      const { data } = await supabase.from('inventario_saldos')
        .select('producto_id, stock, costo_promedio')
        .eq('bodega_id', destino.querySelector('#tr-bodega').value);
      costos = new Map((data ?? []).map((s) => [s.producto_id, s]));
      recalcular();
    }

    function filaLinea(lado, productoId = '', cantidad = '') {
      const fila = document.createElement('div');
      fila.className = 'tr-linea';
      fila.innerHTML = `
        <select data-prod>
          <option value="">— producto —</option>
          ${aplanado.map((p) =>
            `<option value="${p.id}" ${p.id === productoId ? 'selected' : ''}>
               ${esc(p.codigo)} — ${esc(p.nombre)}</option>`).join('')}
        </select>
        <input type="number" data-cant value="${cantidad}" placeholder="cantidad" />
        <span data-unidad class="pista-unidad"></span>
        <span data-info class="tr-info"></span>
        <button type="button" class="btn-quitar" title="Quitar">✕</button>`;

      const sel = fila.querySelector('[data-prod]');
      const cant = fila.querySelector('[data-cant]');

      const ajustar = () => {
        const p = aplanado.find((x) => x.id === sel.value);
        if (p) {
          const r = aplicarReglaCantidad(cant, p);
          fila.querySelector('[data-unidad]').textContent = r.unidad;
        } else {
          fila.querySelector('[data-unidad]').textContent = '';
        }
        pintarInfo(fila, lado);
        recalcular();
      };

      sel.addEventListener('change', ajustar);
      cant.addEventListener('input', () => { pintarInfo(fila, lado); recalcular(); });
      fila.querySelector('.btn-quitar').addEventListener('click', () => {
        fila.remove();
        recalcular();
      });

      ajustar();
      return fila;
    }

    function pintarInfo(fila, lado) {
      const sel = fila.querySelector('[data-prod]');
      const p = aplanado.find((x) => x.id === sel.value);
      const info = fila.querySelector('[data-info]');
      if (!p) { info.textContent = ''; return; }

      if (lado === 'entrada') {
        const s = costos.get(p.id);
        info.textContent = s
          ? `hay ${Number(s.stock).toFixed(3)} · costo $${Number(s.costo_promedio).toFixed(4)}`
          : 'sin existencia en esta bodega';
        info.classList.toggle('tr-info-alerta', !s || Number(s.stock) <= 0);
      } else {
        info.textContent = `se vende a $${Number(p.precio_venta_menor ?? 0).toFixed(2)}`;
        // Sin precio de venta no hay forma de repartir el costo por
        // valor, y el reparto caería a "por cantidad", que distorsiona.
        info.classList.toggle('tr-info-alerta', !(Number(p.precio_venta_menor) > 0));
      }
    }

    function leer(caja) {
      return [...caja.querySelectorAll('.tr-linea')].map((f) => ({
        producto_id: f.querySelector('[data-prod]').value,
        cantidad: Number(f.querySelector('[data-cant]').value),
      })).filter((l) => l.producto_id && l.cantidad > 0);
    }

    /**
     * El reparto, calculado en el navegador para que se vea ANTES de
     * confirmar. La base lo vuelve a calcular al guardar: esto es una
     * vista previa, no la fuente de la verdad.
     */
    function recalcular() {
      const ent = leer(entradas);
      const sal = leer(salidas);

      if (!ent.length || !sal.length) {
        resumen.textContent = 'Agregue lo que entra y lo que sale para ver cómo queda el costo.';
        return;
      }

      const costoTotal = ent.reduce((a, l) =>
        a + l.cantidad * Number(costos.get(l.producto_id)?.costo_promedio ?? 0), 0);

      const conValor = sal.map((l) => {
        const p = aplanado.find((x) => x.id === l.producto_id);
        return { ...l, p, valor: l.cantidad * Number(p?.precio_venta_menor ?? 0) };
      });
      const valorTotal = conValor.reduce((a, l) => a + l.valor, 0);

      const porCantidad = valorTotal <= 0;
      const cantTotal = conValor.reduce((a, l) => a + l.cantidad, 0);

      const filas = conValor.map((l) => {
        const parte = porCantidad ? l.cantidad / cantTotal : l.valor / valorTotal;
        const costo = costoTotal * parte;
        return `<tr>
          <td>${esc(l.p?.nombre ?? '')}</td>
          <td class="num">${l.cantidad} ${esc(l.p?.unidad_medida ?? '')}</td>
          <td class="num">${(parte * 100).toFixed(1)} %</td>
          <td class="num">$${costo.toFixed(2)}</td>
          <td class="num"><b>$${(costo / l.cantidad).toFixed(4)}</b></td>
          <td class="num">$${Number(l.p?.precio_venta_menor ?? 0).toFixed(2)}</td>
          <td class="num ${costo / l.cantidad >= Number(l.p?.precio_venta_menor ?? 0) ? 'texto-alerta' : ''}">
            ${Number(l.p?.precio_venta_menor ?? 0) > 0
              ? `${(100 * (1 - (costo / l.cantidad) / Number(l.p.precio_venta_menor))).toFixed(0)} %`
              : '—'}</td>
        </tr>`;
      }).join('');

      // Merma solo cuando entra y sale la misma unidad: dos unidades
      // menos nueve libras no es un número que signifique nada.
      const unidadesEnt = new Set(ent.map((l) =>
        aplanado.find((x) => x.id === l.producto_id)?.unidad_medida));
      const unidadesSal = new Set(conValor.map((l) => l.p?.unidad_medida));
      const mismaUnidad = [...unidadesEnt].some((u) => unidadesSal.has(u));
      const cantEnt = ent.reduce((a, l) => a + l.cantidad, 0);
      const merma = mismaUnidad ? cantEnt - cantTotal : null;

      resumen.innerHTML = `
        <div class="tr-resumen-cabecera">
          Costo de lo que entra: <b>$${costoTotal.toFixed(2)}</b>
          ${merma != null
            ? ` · merma <b>${merma.toFixed(3)}</b> (${(100 * merma / cantEnt).toFixed(1)} %)`
            : ' · la merma no se puede calcular: entra y sale en unidades distintas'}
        </div>
        ${porCantidad ? `
          <p class="aviso-inline">Ninguna salida tiene precio de venta, así que el costo se
          repartiría <b>por cantidad</b>. Eso hace que la libra de hueso cueste lo mismo que la
          de pechuga, y el margen que vea después será falso. Póngales precio primero.</p>` : ''}
        <table class="dyn-table tabla-reparto">
          <thead><tr>
            <th>Sale</th><th class="num">Cantidad</th><th class="num">Absorbe</th>
            <th class="num">Costo</th><th class="num">Costo unit.</th>
            <th class="num">P. venta</th><th class="num">Margen</th>
          </tr></thead>
          <tbody>${filas}</tbody>
        </table>`;
    }

    destino.querySelectorAll('[data-agregar]').forEach((b) => {
      b.addEventListener('click', () => {
        const caja = b.dataset.agregar === 'entrada' ? entradas : salidas;
        caja.appendChild(filaLinea(b.dataset.agregar));
      });
    });

    destino.querySelector('#tr-bodega').addEventListener('change', cargarCostos);

    destino.querySelector('#tr-cargar').addEventListener('click', async () => {
      const recetaId = destino.querySelector('#tr-receta').value;
      if (!recetaId) {
        msg.textContent = 'Elija una receta, o agregue las líneas a mano.';
        msg.className = 'form-msg error';
        return;
      }
      const { data, error } = await supabase.rpc('fn_preparar_transformacion', {
        p_receta_id: recetaId,
        p_bodega_id: destino.querySelector('#tr-bodega').value,
        p_cantidad: Number(destino.querySelector('#tr-veces').value),
      });
      if (error) {
        msg.innerHTML = traducirErrorSupabase(error);
        msg.className = 'form-msg error';
        return;
      }
      entradas.innerHTML = '';
      salidas.innerHTML = '';
      for (const l of data ?? []) {
        const caja = l.es_origen ? entradas : salidas;
        caja.appendChild(filaLinea(l.es_origen ? 'entrada' : 'salida', l.producto_id, l.cantidad));
      }
      msg.textContent = 'Receta cargada. Corrija las cantidades con lo que salió de la balanza.';
      msg.className = 'form-msg ok';
      recalcular();
    });

    destino.querySelector('#tr-ejecutar').addEventListener('click', async () => {
      const ent = leer(entradas);
      const sal = leer(salidas);
      if (!ent.length || !sal.length) {
        msg.textContent = 'Hace falta al menos un producto que entre y uno que salga.';
        msg.className = 'form-msg error';
        return;
      }

      msg.textContent = 'Transformando…';
      msg.className = 'form-msg';

      const { data, error } = await supabase.rpc('fn_ejecutar_transformacion', {
        p_bodega_id: destino.querySelector('#tr-bodega').value,
        p_entradas: ent,
        p_salidas: sal,
        p_receta_id: destino.querySelector('#tr-receta').value || null,
        p_observacion: null,
      });

      if (error) {
        const explicado = traducirErrorSupabase(error);
        if (explicado.includes('aviso-migracion')) msg.innerHTML = explicado;
        else msg.textContent = error.message;
        msg.className = 'form-msg error';
        return;
      }

      const r = Array.isArray(data) ? data[0] : data;
      msg.textContent = r?.mensaje ?? 'Transformación registrada.';
      msg.className = 'form-msg ok';
      entradas.innerHTML = '';
      salidas.innerHTML = '';
      await cargarCostos();
    });

    entradas.appendChild(filaLinea('entrada'));
    salidas.appendChild(filaLinea('salida'));
    cargarCostos();
  }

  // =======================================================
  // Recetas
  // =======================================================
  async function vistaRecetas() {
    const destino = container.querySelector('#tab-recetas');
    destino.innerHTML = `
      <div class="panel">
        <h3>Recetas de despiece y maquila</h3>
        <p class="nota">Se escribe una vez cómo se despieza cada producto y después se reutiliza.
        La <b>merma esperada</b> sirve para comparar: un despiece que rinde menos de lo normal,
        repetidamente, es algo que conviene mirar de cerca.</p>
        <form id="form-receta" class="inline-form">
          <input type="text" id="rc-codigo" placeholder="Código" required />
          <input type="text" id="rc-nombre" placeholder="Despiece de pollo" required />
          <select id="rc-origen" required>
            <option value="">Producto de origen…</option>
            ${aplanado.map((p) => `<option value="${p.id}">${esc(p.codigo)} — ${esc(p.nombre)}</option>`).join('')}
          </select>
          <input type="number" id="rc-cantidad" min="0.001" step="0.001" value="1"
                 title="Cantidad de origen que describe la receta" />
          <input type="number" id="rc-merma" min="0" max="99" step="0.1" value="0"
                 title="Merma esperada, en por ciento" />
          <button type="submit">Crear receta</button>
          <span id="rc-msg" class="form-msg"></span>
        </form>
      </div>
      <div id="tabla-recetas"></div>`;

    const { data, error } = await supabase.from('recetas')
      .select('id, codigo, nombre, cantidad_origen, merma_esperada_pct, activa, productos(nombre)')
      .order('nombre');

    const tabla = destino.querySelector('#tabla-recetas');
    if (error) { tabla.innerHTML = traducirErrorSupabase(error, 'recetas'); return; }

    renderTable(tabla, {
      columns: [
        { key: 'codigo', label: 'Código' },
        { key: 'nombre', label: 'Receta' },
        { key: 'origen', label: 'De' },
        { key: 'cantidad_origen', label: 'Por cada', numeric: true },
        { key: 'merma_esperada_pct', label: 'Merma esperada', numeric: true,
          format: (v) => `${Number(v).toFixed(1)} %` },
        {
          key: 'x', label: '', sortable: false,
          elemento: (row) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'btn-secundario btn-mini';
            b.textContent = 'Qué sale';
            b.addEventListener('click', () => abrirSalidasReceta(row, vistaRecetas));
            return b;
          },
        },
      ],
      rows: (data ?? []).map((r) => ({ ...r, origen: r.productos?.nombre ?? '—' })),
      emptyMessage: 'Todavía no hay recetas. Cree la primera arriba.',
    });

    destino.querySelector('#form-receta').addEventListener('submit', async (e) => {
      e.preventDefault();
      const m = destino.querySelector('#rc-msg');
      const { error: err } = await supabase.from('recetas').insert({
        codigo: destino.querySelector('#rc-codigo').value.trim().toUpperCase(),
        nombre: destino.querySelector('#rc-nombre').value.trim(),
        producto_origen_id: destino.querySelector('#rc-origen').value,
        cantidad_origen: Number(destino.querySelector('#rc-cantidad').value),
        merma_esperada_pct: Number(destino.querySelector('#rc-merma').value),
      });
      if (err) {
        m.textContent = err.message;
        m.className = 'form-msg error';
        return;
      }
      m.textContent = 'Receta creada. Ahora diga qué sale de ella.';
      m.className = 'form-msg ok';
      vistaRecetas();
    });
  }

  function abrirSalidasReceta(receta, alCerrar) {
    abrirModal({
      titulo: `Qué sale de "${receta.nombre}"`,
      ancho: '40rem',
      contenido: `
        <p class="nota">Por cada <b>${receta.cantidad_origen}</b> de
        ${esc(receta.origen)}. Al transformar más, las cantidades se escalan solas.</p>
        <div id="rs-tabla"></div>
        <form id="form-rs" class="inline-form">
          <select id="rs-producto" required>
            <option value="">Producto que sale…</option>
            ${aplanado.map((p) => `<option value="${p.id}">${esc(p.codigo)} — ${esc(p.nombre)}</option>`).join('')}
          </select>
          <input type="number" id="rs-cantidad" min="0.001" step="0.001" required placeholder="cantidad" />
          <button type="submit">Agregar</button>
        </form>
        <p id="rs-msg" class="form-msg"></p>`,
      botones: [{ texto: 'Cerrar', clase: 'btn-primary', accion: () => { cerrarModal(); alCerrar(); } }],
      alAbrir: (modal) => {
        pintar(modal);
        modal.querySelector('#form-rs').addEventListener('submit', async (e) => {
          e.preventDefault();
          const m = modal.querySelector('#rs-msg');
          const { error } = await supabase.from('receta_salida').insert({
            receta_id: receta.id,
            producto_id: modal.querySelector('#rs-producto').value,
            cantidad: Number(modal.querySelector('#rs-cantidad').value),
          });
          m.textContent = error ? error.message : 'Agregado.';
          m.className = `form-msg ${error ? 'error' : 'ok'}`;
          if (!error) { e.target.reset(); pintar(modal); }
        });
      },
    });

    async function pintar(modal) {
      const { data } = await supabase.from('receta_salida')
        .select('id, cantidad, productos(codigo, nombre, unidad_medida, precio_venta_menor)')
        .eq('receta_id', receta.id);

      renderTable(modal.querySelector('#rs-tabla'), {
        columns: [
          { key: 'producto', label: 'Sale' },
          { key: 'cantidad', label: 'Cantidad', numeric: true },
          { key: 'unidad', label: 'Unidad' },
          { key: 'precio', label: 'P. venta', numeric: true,
            format: (v) => (Number(v) > 0 ? `$${Number(v).toFixed(2)}` : 'sin precio') },
          {
            key: 'x', label: '', sortable: false,
            elemento: (row) => {
              const b = document.createElement('button');
              b.type = 'button';
              b.className = 'btn-quitar';
              b.textContent = '✕';
              b.addEventListener('click', async () => {
                await supabase.from('receta_salida').delete().eq('id', row.id);
                pintar(modal);
              });
              return b;
            },
          },
        ],
        rows: (data ?? []).map((r) => ({
          ...r,
          producto: r.productos?.nombre,
          unidad: r.productos?.unidad_medida,
          precio: r.productos?.precio_venta_menor,
        })),
        searchable: false,
        rowClass: (r) => (Number(r.precio) > 0 ? '' : 'row-warning'),
        emptyMessage: 'Esta receta todavía no produce nada.',
      });
    }
  }

  // =======================================================
  // Historial
  // =======================================================
  async function vistaHistorial() {
    const destino = container.querySelector('#tab-historial');
    destino.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h3>Transformaciones realizadas</h3>
          ${botonesExportar('exp-transf')}
        </div>
        <p class="nota">La columna <b>rendimiento</b> compara la merma real con la esperada de
        la receta. Un despiece que rinde menos de la cuenta, y siempre el mismo, es lo primero
        que se mira cuando el inventario no cuadra.</p>
        <div id="tabla-transf"></div>
      </div>`;

    const { data, error } = await supabase.from('v_transformaciones')
      .select('*').order('fecha', { ascending: false }).limit(300);

    const tabla = destino.querySelector('#tabla-transf');
    if (error) { tabla.innerHTML = traducirErrorSupabase(error, 'v_transformaciones'); return; }

    const columnas = [
      { key: 'numero', label: 'N.º' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'receta', label: 'Receta' },
      { key: 'entro', label: 'Entró' },
      { key: 'salio', label: 'Salió' },
      { key: 'costo_total', label: 'Costo', numeric: true, format: (v) => `$${Number(v).toFixed(2)}` },
      { key: 'merma_pct', label: 'Merma', numeric: true,
        format: (v) => (v == null ? '—' : `${Number(v).toFixed(1)} %`) },
      { key: 'rendimiento', label: 'Rendimiento' },
      { key: 'estado', label: 'Estado' },
    ];

    renderTable(tabla, {
      columns: columnas,
      rows: data ?? [],
      rowClass: (r) => (r.rendimiento === 'RINDIÓ MENOS' ? 'row-warning' : ''),
      emptyMessage: 'Todavía no se ha transformado nada.',
    });

    conectarExportar('exp-transf', {
      nombre: 'transformaciones',
      titulo: 'Transformaciones de producto',
      columnas,
      filas: () => data ?? [],
      meta: await metaDeEmpresa(),
    });
  }
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}
