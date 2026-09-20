// Recargas y servicios.
//
// POR QUÉ ESTE MÓDULO NO HACE LA RECARGA:
//
// La recarga se ejecuta en POSVirtual, que es un sistema de otra empresa
// (Ponle Más). No tenemos su API ni sus credenciales, y su servidor no
// permite que otra página lo incruste en un marco —los sistemas
// financieros lo prohíben a propósito, para que nadie monte una pantalla
// falsa encima. Prometer una integración que no existe sería peor que no
// tenerla.
//
// Lo que sí resuelve este módulo es el problema real del negocio: hoy
// las recargas se hacen en otra pantalla y no quedan en ningún lado, así
// que a fin de mes nadie sabe cuánto se vendió ni cuánta comisión se
// ganó. Aquí se abre POSVirtual en su ventana, y al volver se registra
// el monto en dos clics. Ese registro entra al cierre de caja y al
// análisis mensual junto con la mercadería.

import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';
import { abrirModal, cerrarModal } from './lib/modal.js';
import { traducirErrorSupabase } from './lib/errores.js';
import { icono } from './lib/iconos.js';
import { botonesExportar, conectarExportar, metaDeEmpresa } from './lib/exportar.js';
import { empresaActual } from './lib/marca.js';

let catalogo = [];
let accesos = [];

export async function renderServicios(container) {
  container.innerHTML = '<p class="loading">Cargando servicios…</p>';

  const [{ data: serv, error: errS }, { data: acc }] = await Promise.all([
    supabase.from('servicios_catalogo').select('*').eq('activo', true).order('orden'),
    supabase.from('accesos_externos').select('*').eq('activo', true).order('orden'),
  ]);

  if (errS) {
    container.innerHTML = traducirErrorSupabase(errS, 'servicios_catalogo');
    return;
  }

  catalogo = serv ?? [];
  accesos = acc ?? [];

  container.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-v="registrar">Registrar</button>
      <button class="tab" data-v="movimientos">Movimientos</button>
      <button class="tab" data-v="resumen">Resumen del mes</button>
    </div>
    <div id="serv-vista"></div>`;

  const vista = container.querySelector('#serv-vista');
  container.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.v === 'registrar') vistaRegistrar(vista, container);
      else if (btn.dataset.v === 'movimientos') vistaMovimientos(vista);
      else vistaResumen(vista);
    });
  });

  vistaRegistrar(vista, container);
}

// =========================================================
// Registrar
// =========================================================
function vistaRegistrar(destino, container) {
  destino.innerHTML = `
    ${accesos.length ? `
      <div class="panel panel-externo">
        <h3>Sistemas externos</h3>
        ${accesos.map((a) => `
          <div class="acceso-externo" style="--acc:${escapar(a.color_hex)}">
            ${icono(a.icono, 'acceso-icono')}
            <div class="acceso-datos">
              <b>${escapar(a.nombre)}</b>
              <span>${escapar(a.descripcion ?? '')}</span>
              ${a.instrucciones ? `<small>${escapar(a.instrucciones)}</small>` : ''}
            </div>
            <button class="btn-primary" data-abrir="${escapar(a.codigo)}">Abrir</button>
          </div>`).join('')}
      </div>` : ''}

    <div class="panel">
      <h3>Registrar una recarga o un pago</h3>
      <p class="nota">Haga la operación en el sistema del proveedor y después
      regístrela aquí. La comisión la calcula el sistema con el porcentaje del
      servicio: no se digita, para que todas las cajas reporten lo mismo.</p>
      <div class="servicios-rejilla">
        ${catalogo.map((s) => `
          <button class="servicio-tarjeta" data-servicio="${escapar(s.codigo)}"
                  style="--srv:${escapar(s.color_hex)}">
            ${icono(s.icono, 'servicio-icono')}
            <b>${escapar(s.nombre)}</b>
            <small>${s.comision_tipo === 'PORCENTAJE'
                      ? `comisión ${s.comision_valor}%`
                      : s.comision_tipo === 'FIJA'
                        ? `comisión $${Number(s.comision_valor).toFixed(2)}`
                        : 'sin comisión'}</small>
          </button>`).join('') ||
          '<p class="nota">No hay servicios configurados. Agréguelos en Administración.</p>'}
      </div>
      <div id="serv-msg" class="form-msg"></div>
    </div>

    <div class="panel">
      <h3>Lo registrado hoy</h3>
      <div id="serv-hoy"></div>
    </div>`;

  destino.querySelectorAll('[data-abrir]').forEach((btn) => {
    btn.addEventListener('click', () => abrirExterno(btn.dataset.abrir));
  });

  destino.querySelectorAll('[data-servicio]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = catalogo.find((x) => x.codigo === btn.dataset.servicio);
      if (s) abrirFormulario(s, destino, container);
    });
  });

  cargarHoy(destino);
}

/**
 * Abre el sistema externo en su propia ventana.
 *
 * No se usa un iframe: POSVirtual —como cualquier sistema con login—
 * manda cabeceras que impiden que otra página lo incruste, y el marco
 * saldría en blanco. Además, incrustar un sistema con credenciales
 * dentro de otro entrena al cajero a escribir su clave en cualquier
 * pantalla que se la pida, que es exactamente lo que no queremos.
 */
function abrirExterno(codigo) {
  const a = accesos.find((x) => x.codigo === codigo);
  if (!a) return;

  abrirModal({
    titulo: a.nombre,
    contenido: `
      <div class="externo-aviso">
        ${icono(a.icono, 'externo-icono')}
        <p>${escapar(a.descripcion ?? '')}</p>
        <p class="nota">${escapar(a.instrucciones ?? '')}</p>
        <div class="externo-url"><code>${escapar(a.url)}</code></div>
        <p class="nota"><b>Se abre en una ventana aparte.</b> Es un sistema de otra
        empresa: sus credenciales son distintas de las de este sistema y no viajan
        por aquí. Desconfíe de cualquier pantalla que le pida la clave de POSVirtual
        dentro de esta aplicación.</p>
      </div>`,
    botones: [
      { texto: 'Cancelar', clase: 'btn-secundario', accion: cerrarModal },
      { texto: 'Abrir y registrar después', clase: 'btn-primary', accion: () => {
          // noopener evita que la página abierta pueda manipular esta.
          window.open(a.url, '_blank', 'noopener,noreferrer');
          cerrarModal();
        } },
    ],
  });
}

function abrirFormulario(s, destino, container) {
  const max = s.monto_maximo ? Number(s.monto_maximo) : null;

  abrirModal({
    titulo: s.nombre,
    contenido: `
      <form id="form-servicio" class="form-servicio">
        <label>Monto
          <div class="monto-caja">
            <span>$</span>
            <input type="number" id="sv-monto" step="0.01"
                   min="${s.monto_minimo}" ${max ? `max="${max}"` : ''}
                   placeholder="0.00" required autocomplete="off" />
          </div>
          <small>Entre $${Number(s.monto_minimo).toFixed(2)}${max ? ` y $${max.toFixed(2)}` : ' y sin tope'}</small>
        </label>

        <div class="montos-rapidos">
          ${[1, 3, 5, 10, 20].filter((m) => m >= s.monto_minimo && (!max || m <= max))
            .map((m) => `<button type="button" class="monto-rapido" data-m="${m}">$${m}</button>`).join('')}
        </div>

        ${s.requiere_referencia ? `
          <label>${escapar(s.etiqueta_referencia)}
            <input type="text" id="sv-ref" inputmode="numeric" required autocomplete="off" />
          </label>` : ''}

        <label>Código que devolvió el sistema (opcional)
          <input type="text" id="sv-codigo" autocomplete="off"
                 placeholder="Número de transacción de POSVirtual" />
        </label>

        <label>Forma de pago
          <select id="sv-pago">
            <option value="EFECTIVO">Efectivo</option>
            <option value="TRANSFERENCIA_DEUNA">De Una</option>
            <option value="TARJETA_DEBITO">Tarjeta débito</option>
            <option value="TARJETA_CREDITO">Tarjeta crédito</option>
            <option value="TRANSFERENCIA_OTRO">Transferencia</option>
          </select>
        </label>

        <div class="comision-previa">
          Comisión estimada: <b id="sv-comision">$0.00</b>
          <small>La calcula la base al guardar; esto es solo referencia.</small>
        </div>

        <div id="sv-error" class="form-msg"></div>
      </form>`,
    botones: [
      { texto: 'Cancelar', clase: 'btn-secundario', accion: cerrarModal },
      { texto: 'Registrar', clase: 'btn-primary', accion: guardar },
    ],
    alAbrir: (modal) => {
      const monto = modal.querySelector('#sv-monto');
      const com = modal.querySelector('#sv-comision');

      const recalcular = () => {
        const m = Number(monto.value || 0);
        const c = s.comision_tipo === 'PORCENTAJE'
          ? m * Number(s.comision_valor) / 100
          : s.comision_tipo === 'FIJA' ? Number(s.comision_valor) : 0;
        com.textContent = `$${c.toFixed(2)}`;
      };

      monto.addEventListener('input', recalcular);
      modal.querySelectorAll('.monto-rapido').forEach((b) => {
        b.addEventListener('click', () => {
          monto.value = b.dataset.m;
          recalcular();
        });
      });
      monto.focus();
      recalcular();
    },
  });

  async function guardar() {
    const modal = document.querySelector('.modal');
    const err = modal.querySelector('#sv-error');
    err.textContent = 'Registrando…';
    err.className = 'form-msg';

    const { data, error } = await supabase.rpc('fn_registrar_servicio', {
      p_servicio_codigo: s.codigo,
      p_monto: Number(modal.querySelector('#sv-monto').value),
      p_referencia: modal.querySelector('#sv-ref')?.value.trim() || null,
      p_forma_pago: modal.querySelector('#sv-pago').value,
      p_codigo_operadora: modal.querySelector('#sv-codigo').value.trim() || null,
    });

    if (error) {
      err.textContent = error.message;
      err.className = 'form-msg error';
      return;
    }

    cerrarModal();
    const msg = destino.querySelector('#serv-msg');
    msg.innerHTML =
      `<b>${escapar(data.servicio)} ${data.numero}</b> · $${Number(data.monto).toFixed(2)} ` +
      `· comisión $${Number(data.comision).toFixed(2)}`;
    msg.className = 'form-msg ok';
    cargarHoy(destino);
  }
}

async function cargarHoy(destino) {
  const caja = destino.querySelector('#serv-hoy');
  if (!caja) return;

  const hoy = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('v_servicios_detalle')
    .select('*')
    .eq('fecha', hoy)
    .order('created_at', { ascending: false });

  if (error) {
    caja.innerHTML = traducirErrorSupabase(error, 'v_servicios_detalle');
    return;
  }

  const vivos = (data ?? []).filter((r) => r.estado === 'COMPLETADA');
  const total = vivos.reduce((a, r) => a + Number(r.monto), 0);
  const comision = vivos.reduce((a, r) => a + Number(r.comision), 0);

  caja.innerHTML = `
    <div class="tarjetas-resumen">
      <div class="tarjeta-mini"><span>${vivos.length}</span><small>operaciones</small></div>
      <div class="tarjeta-mini"><span>$${total.toFixed(2)}</span><small>recargado</small></div>
      <div class="tarjeta-mini"><span>$${comision.toFixed(2)}</span><small>comisión</small></div>
    </div>
    <div id="tabla-hoy"></div>`;

  renderTable(caja.querySelector('#tabla-hoy'), {
    columns: [
      { key: 'hora', label: 'Hora' },
      { key: 'numero', label: 'Número' },
      { key: 'servicio', label: 'Servicio' },
      { key: 'referencia', label: 'Referencia' },
      { key: 'monto_txt', label: 'Monto', numeric: true },
      { key: 'comision_txt', label: 'Comisión', numeric: true },
      { key: 'estado', label: 'Estado' },
    ],
    rows: (data ?? []).map((r) => ({
      ...r,
      hora: new Date(r.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
      referencia: r.referencia ?? '—',
      monto_txt: `$${Number(r.monto).toFixed(2)}`,
      comision_txt: `$${Number(r.comision).toFixed(2)}`,
    })),
    rowClass: (r) => (r.estado === 'ANULADA' ? 'row-warning' : ''),
    emptyMessage: 'Todavía no se ha registrado ninguna recarga hoy.',
  });
}

// =========================================================
// Movimientos
// =========================================================
const COLS_MOV = [
  { key: 'fecha_txt', label: 'Fecha' },
  { key: 'numero', label: 'Número' },
  { key: 'servicio', label: 'Servicio' },
  { key: 'proveedor', label: 'Proveedor' },
  { key: 'referencia', label: 'Referencia' },
  { key: 'monto', label: 'Monto', numeric: true },
  { key: 'comision', label: 'Comisión', numeric: true },
  { key: 'forma_pago', label: 'Forma de pago' },
  { key: 'cajero_nombre', label: 'Cajero' },
  { key: 'estado', label: 'Estado' },
];

async function vistaMovimientos(destino) {
  const desde = new Date();
  desde.setDate(desde.getDate() - 30);

  destino.innerHTML = `
    <div class="panel">
      <div class="panel-cabecera">
        <h3>Recargas y servicios registrados</h3>
        ${botonesExportar('srv')}
      </div>
      <form id="form-rango" class="inline-form">
        <label>Desde <input type="date" id="mv-desde" value="${desde.toISOString().slice(0, 10)}" /></label>
        <label>Hasta <input type="date" id="mv-hasta" value="${new Date().toISOString().slice(0, 10)}" /></label>
        <button type="submit">Consultar</button>
      </form>
    </div>
    <div id="tabla-mov"><p class="loading">Cargando…</p></div>`;

  let filas = [];

  async function cargar() {
    const tabla = destino.querySelector('#tabla-mov');
    const { data, error } = await supabase
      .from('v_servicios_detalle')
      .select('*')
      .gte('fecha', destino.querySelector('#mv-desde').value)
      .lte('fecha', destino.querySelector('#mv-hasta').value)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      tabla.innerHTML = traducirErrorSupabase(error, 'v_servicios_detalle');
      return;
    }

    filas = (data ?? []).map((r) => ({
      ...r,
      fecha_txt: new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-EC'),
      referencia: r.referencia ?? '—',
      proveedor: r.proveedor ?? '—',
      cajero_nombre: r.cajero_nombre ?? '—',
      monto: Number(r.monto).toFixed(2),
      comision: Number(r.comision).toFixed(2),
    }));

    renderTable(tabla, {
      columns: COLS_MOV,
      rows: filas,
      searchable: true,
      rowClass: (r) => (r.estado === 'ANULADA' ? 'row-warning' : ''),
      emptyMessage: 'No hay servicios registrados en ese rango.',
    });
  }

  destino.querySelector('#form-rango').addEventListener('submit', (e) => {
    e.preventDefault();
    cargar();
  });

  conectarExportar(destino, 'srv',
    () => ({ columnas: COLS_MOV, filas }),
    'Recargas y servicios',
    () => metaDeEmpresa(empresaActual(), {
      filtro: `Del ${destino.querySelector('#mv-desde').value} al ${destino.querySelector('#mv-hasta').value}`,
      totalizar: ['monto', 'comision'],
    }));

  await cargar();
}

// =========================================================
// Resumen del mes
// =========================================================
async function vistaResumen(destino) {
  destino.innerHTML = '<p class="loading">Calculando…</p>';

  const { data, error } = await supabase
    .from('v_resumen_mensual')
    .select('*')
    .order('mes', { ascending: false });

  if (error) {
    destino.innerHTML = traducirErrorSupabase(error, 'v_resumen_mensual');
    return;
  }

  // Un renglón por mes con las dos columnas: es como el dueño piensa el
  // negocio, no como está guardado.
  const meses = new Map();
  for (const r of data ?? []) {
    const clave = r.mes;
    if (!meses.has(clave)) {
      meses.set(clave, { mes: clave, mercaderia: 0, servicios: 0, comision: 0, transacciones: 0 });
    }
    const m = meses.get(clave);
    if (r.origen === 'MERCADERIA') m.mercaderia += Number(r.monto);
    else {
      m.servicios += Number(r.monto);
      m.comision += Number(r.comision);
    }
    m.transacciones += Number(r.transacciones);
  }

  const filas = [...meses.values()]
    .sort((a, b) => (a.mes < b.mes ? 1 : -1))
    .map((m) => ({
      mes: new Date(m.mes + 'T00:00:00').toLocaleDateString('es-EC', { year: 'numeric', month: 'long' }),
      mercaderia: m.mercaderia.toFixed(2),
      servicios: m.servicios.toFixed(2),
      comision: m.comision.toFixed(2),
      total: (m.mercaderia + m.servicios).toFixed(2),
      transacciones: m.transacciones,
    }));

  const columnas = [
    { key: 'mes', label: 'Mes' },
    { key: 'mercaderia', label: 'Mercadería', numeric: true },
    { key: 'servicios', label: 'Servicios', numeric: true },
    { key: 'comision', label: 'Comisión ganada', numeric: true },
    { key: 'total', label: 'Total movido', numeric: true },
    { key: 'transacciones', label: 'Transacciones', numeric: true },
  ];

  destino.innerHTML = `
    <div class="panel">
      <div class="panel-cabecera">
        <h3>Cuánto se vendió cada mes</h3>
        ${botonesExportar('res')}
      </div>
      <p class="nota">La <b>comisión</b> es lo que realmente gana el negocio con las
      recargas: el resto es dinero del cliente que pasa de largo. Por eso se muestra
      en su propia columna y no mezclada con el total movido.</p>
    </div>
    <div id="tabla-resumen"></div>`;

  renderTable(destino.querySelector('#tabla-resumen'), {
    columns: columnas,
    rows: filas,
    emptyMessage: 'Todavía no hay meses con movimiento.',
  });

  conectarExportar(destino, 'res',
    () => ({ columnas, filas }),
    'Resumen mensual de ventas y servicios',
    () => metaDeEmpresa(empresaActual(), {
      totalizar: ['mercaderia', 'servicios', 'comision'],
    }));
}

// =========================================================
function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML.replace(/"/g, '&quot;');
}
