// Administración avanzada: sedes, matriz de permisos, correo y plantillas.
//
// Todo lo que antes había que cambiar editando archivos se edita aquí.

import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';
import { abrirModal, cerrarModal } from './lib/modal.js';
import { traducirErrorSupabase } from './lib/errores.js';
import { ICONOS_DISPONIBLES, icono } from './lib/iconos.js';

// =========================================================
// Sedes
// =========================================================
export async function vistaSedes(destino) {
  destino.innerHTML = `
    <div class="panel">
      <h3>Locales del negocio</h3>
      <p class="nota">Cada sede es un <b>establecimiento</b> ante el SRI y numera sus
      comprobantes por separado: la matriz emite 001-001-000000001 y una sucursal
      002-001-000000001, sin pisarse. Un cajero solo factura por la sede que tenga
      asignada en su perfil.</p>
      <form id="form-sede" class="inline-form">
        <input type="text" id="sd-codigo" placeholder="Código (001)" required
               pattern="[0-9]{3}" maxlength="3" inputmode="numeric" />
        <input type="text" id="sd-nombre" placeholder="Nombre del local" required />
        <input type="text" id="sd-direccion" placeholder="Dirección" />
        <input type="text" id="sd-telefono" placeholder="Teléfono" />
        <input type="text" id="sd-pto" placeholder="Pto. emisión (001)" value="001"
               pattern="[0-9]{3}" maxlength="3" inputmode="numeric" />
        <button type="submit">Agregar sede</button>
        <span id="sd-msg" class="form-msg"></span>
      </form>
    </div>
    <div id="tabla-sedes"></div>`;

  destino.querySelector('#form-sede').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = destino.querySelector('#sd-msg');
    msg.textContent = 'Guardando…';
    msg.className = 'form-msg';

    const { error } = await supabase.from('sedes').insert({
      codigo: destino.querySelector('#sd-codigo').value.trim(),
      nombre: destino.querySelector('#sd-nombre').value.trim(),
      direccion: destino.querySelector('#sd-direccion').value.trim() || null,
      telefono: destino.querySelector('#sd-telefono').value.trim() || null,
      punto_emision: destino.querySelector('#sd-pto').value.trim() || '001',
    });

    if (error) {
      msg.textContent = error.message.includes('duplicate')
        ? 'Ya existe una sede con ese código.' : error.message;
      msg.className = 'form-msg error';
      return;
    }
    msg.textContent = 'Sede creada.';
    msg.className = 'form-msg ok';
    e.target.reset();
    destino.querySelector('#sd-pto').value = '001';
    cargar();
  });

  async function cargar() {
    const tabla = destino.querySelector('#tabla-sedes');
    const { data, error } = await supabase
      .from('sedes')
      .select('id, codigo, nombre, direccion, telefono, punto_emision, es_matriz, activa')
      .order('codigo');

    if (error) {
      tabla.innerHTML = traducirErrorSupabase(error, 'sedes');
      return;
    }
    renderTable(tabla, {
      columns: [
        { key: 'codigo', label: 'Establecimiento' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'direccion', label: 'Dirección' },
        { key: 'punto_emision', label: 'Pto. emisión' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'estado', label: 'Estado' },
      ],
      rows: (data ?? []).map((s) => ({
        ...s,
        direccion: s.direccion ?? '—',
        tipo: s.es_matriz ? 'Matriz' : 'Sucursal',
        estado: s.activa ? 'Activa' : 'Inactiva',
      })),
      rowClass: (r) => (r.activa ? '' : 'row-warning'),
      emptyMessage: 'No hay sedes registradas.',
    });
  }

  await cargar();
}

// =========================================================
// Roles y permisos
// =========================================================
export async function vistaRoles(destino) {
  destino.innerHTML = '<p class="loading">Cargando roles…</p>';

  const [{ data: roles, error: errR }, { data: modulos }, { data: permisos }] = await Promise.all([
    supabase.from('roles_catalogo').select('*').eq('activo', true).order('nivel'),
    supabase.from('modulos_sistema').select('*').eq('activo', true).order('orden'),
    supabase.from('permisos_rol').select('*'),
  ]);

  if (errR) {
    destino.innerHTML = traducirErrorSupabase(errR, 'roles_catalogo');
    return;
  }

  const mapa = new Map((permisos ?? []).map((p) => [`${p.rol}|${p.modulo}`, p]));
  const perm = (rol, mod) => mapa.get(`${rol}|${mod}`) ?? {};

  destino.innerHTML = `
    <div class="panel">
      <h3>Qué es cada rol</h3>
      <div class="roles-tarjetas">
        ${(roles ?? []).map((r) => `
          <div class="rol-tarjeta">
            <div class="rol-cabecera">
              <span class="rol-nivel">${r.nivel}</span>
              <b>${escapar(r.nombre)}</b>
              <code>${escapar(r.codigo)}</code>
            </div>
            <p>${escapar(r.descripcion)}</p>
          </div>`).join('')}
      </div>
    </div>

    <div class="panel">
      <h3>Qué puede hacer cada rol</h3>
      <p class="nota">Marque <b>Ver</b> para que el módulo aparezca en su menú y
      <b>Editar</b> para que además pueda guardar cambios ahí. <b>Token</b> exige
      una autorización del administrador para cada operación sensible.
      Los cambios se guardan al instante y se aplican en el siguiente ingreso del usuario.</p>

      <div class="tabla-scroll">
        <table class="dyn-table matriz-permisos">
          <thead>
            <tr>
              <th class="col-modulo">Módulo</th>
              ${(roles ?? []).map((r) => `<th colspan="3">${escapar(r.nombre)}</th>`).join('')}
            </tr>
            <tr class="sub">
              <th></th>
              ${(roles ?? []).map(() => '<th>Ver</th><th>Editar</th><th>Token</th>').join('')}
            </tr>
          </thead>
          <tbody>
            ${(modulos ?? []).map((m) => `
              <tr>
                <td class="col-modulo">
                  ${icono(m.icono, 'mod-icono')}
                  <div>
                    <b>${escapar(m.nombre)}</b>
                    <small>${escapar(m.grupo)}</small>
                  </div>
                </td>
                ${(roles ?? []).map((r) => {
                  const p = perm(r.codigo, m.codigo);
                  const fijo = r.codigo === 'ADMIN' ? 'disabled title="El administrador siempre ve y edita todo"' : '';
                  return `
                    <td><input type="checkbox" class="chk-perm" data-rol="${r.codigo}" data-mod="${m.codigo}"
                               data-campo="puede_ver" ${p.puede_ver ? 'checked' : ''} ${fijo} /></td>
                    <td><input type="checkbox" class="chk-perm" data-rol="${r.codigo}" data-mod="${m.codigo}"
                               data-campo="puede_editar" ${p.puede_editar ? 'checked' : ''} ${fijo} /></td>
                    <td><input type="checkbox" class="chk-perm" data-rol="${r.codigo}" data-mod="${m.codigo}"
                               data-campo="requiere_token" ${p.requiere_token ? 'checked' : ''} ${fijo} /></td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div id="perm-msg" class="form-msg"></div>
    </div>`;

  const msg = destino.querySelector('#perm-msg');
  destino.querySelectorAll('.chk-perm').forEach((chk) => {
    chk.addEventListener('change', async () => {
      const campo = chk.dataset.campo;
      const valor = chk.checked;

      // Marcar "editar" sin "ver" dejaría a alguien con permiso de
      // guardar en una pantalla que no puede abrir. Se corrige solo.
      const extra = {};
      if (campo === 'puede_editar' && valor) {
        extra.puede_ver = true;
        const hermano = destino.querySelector(
          `.chk-perm[data-rol="${chk.dataset.rol}"][data-mod="${chk.dataset.mod}"][data-campo="puede_ver"]`);
        if (hermano) hermano.checked = true;
      }

      const { error } = await supabase.from('permisos_rol').upsert({
        rol: chk.dataset.rol,
        modulo: chk.dataset.mod,
        [campo]: valor,
        ...extra,
      }, { onConflict: 'rol,modulo' });

      if (error) {
        chk.checked = !valor;
        msg.textContent = error.message;
        msg.className = 'form-msg error';
      } else {
        msg.textContent = 'Permiso actualizado.';
        msg.className = 'form-msg ok';
      }
    });
  });
}

// =========================================================
// Correo: configuración, plantillas y bandeja de salida
// =========================================================
export async function vistaCorreo(destino) {
  destino.innerHTML = `
    <div class="sub-tabs">
      <button class="sub-tab active" data-s="config">Configuración</button>
      <button class="sub-tab" data-s="plantillas">Plantillas</button>
      <button class="sub-tab" data-s="bandeja">Bandeja de salida</button>
    </div>
    <div id="correo-vista"></div>`;

  const vista = destino.querySelector('#correo-vista');
  destino.querySelectorAll('.sub-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      destino.querySelectorAll('.sub-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.s === 'config') correoConfig(vista);
      else if (btn.dataset.s === 'plantillas') correoPlantillas(vista);
      else correoBandeja(vista);
    });
  });

  await correoConfig(vista);
}

async function correoConfig(destino) {
  destino.innerHTML = '<p class="loading">Cargando…</p>';
  const { data, error } = await supabase.from('correo_config').select('*').limit(1).maybeSingle();
  if (error) {
    destino.innerHTML = traducirErrorSupabase(error, 'correo_config');
    return;
  }
  const c = data ?? {};

  destino.innerHTML = `
    <div class="panel">
      <h3>Desde qué dirección sale el correo de la empresa</h3>
      <p class="nota">La clave del proveedor <b>no se guarda aquí</b>: va como secreto
      de la función que envía, en el servidor. Si estuviera en esta tabla, cualquiera
      que abra la aplicación podría leerla y mandar correos a nombre del negocio.</p>
      <form id="form-correo" class="form-empresa">
        <label>Proveedor
          <select name="proveedor">
            ${['RESEND', 'SMTP', 'NINGUNO'].map((p) =>
              `<option value="${p}" ${c.proveedor === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </label>
        <label>Correo remitente
          <input name="remitente_email" type="email" value="${v(c.remitente_email)}"
                 placeholder="facturacion@sudominio.com" />
        </label>
        <label>Nombre que ve el destinatario
          <input name="remitente_nombre" value="${v(c.remitente_nombre)}" />
        </label>
        <label>Responder a
          <input name="responder_a" type="email" value="${v(c.responder_a)}" />
        </label>
        <label>Copia oculta interna
          <input name="copia_oculta" type="email" value="${v(c.copia_oculta)}"
                 placeholder="archivo@sudominio.com" />
        </label>
        <label class="ancho-completo">Activo
          <input type="checkbox" name="activo" ${c.activo ? 'checked' : ''} />
        </label>
        <label class="ancho-completo">Firma (HTML) que se agrega al final de todo correo
          <textarea name="firma_html" rows="4">${v(c.firma_html)}</textarea>
        </label>
        <div class="ancho-completo">
          <button type="submit" class="btn-primary">Guardar</button>
          <span id="cc-msg" class="form-msg"></span>
        </div>
      </form>
    </div>

    <div class="panel">
      <h3>Antes de activarlo</h3>
      <p class="nota">Un correo enviado desde <code>@gmail.com</code> hacia proveedores
      y clientes termina en spam o rebota, porque el dominio de Gmail no autoriza a
      otro servidor a firmar por él. Para que las facturas y las órdenes de compra
      lleguen, el remitente tiene que ser una dirección del dominio propio del negocio
      y ese dominio debe tener SPF, DKIM y DMARC publicados.
      El paso a paso está en <code>PUBLICACION.md</code>.</p>
    </div>`;

  destino.querySelector('#form-correo').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msg = destino.querySelector('#cc-msg');
    const fd = new FormData(ev.target);
    const payload = Object.fromEntries(fd.entries());
    payload.activo = fd.get('activo') === 'on';
    for (const k of Object.keys(payload)) if (payload[k] === '') payload[k] = null;
    payload.updated_at = new Date().toISOString();

    const { error: err } = await supabase.from('correo_config').update(payload).eq('id', true);
    msg.textContent = err ? err.message : 'Configuración guardada.';
    msg.className = `form-msg ${err ? 'error' : 'ok'}`;
  });
}

// ---------------------------------------------------------
// Plantillas con editor HTML y etiquetas
// ---------------------------------------------------------
const ETIQUETAS = {
  COMPROBANTE_CLIENTE: [
    ['cliente.nombre', 'Nombre del cliente'],
    ['cliente.identificacion', 'Cédula o RUC'],
    ['cliente.direccion', 'Dirección del cliente'],
    ['venta.numero_comprobante', 'Número del comprobante'],
    ['venta.tipo', 'Nota de venta o Factura'],
    ['venta.fecha', 'Fecha de la venta'],
    ['venta.subtotal', 'Subtotal'],
    ['venta.descuento', 'Descuentos'],
    ['venta.iva', 'IVA'],
    ['venta.total', 'Total cobrado'],
    ['venta.cajero', 'Quién atendió'],
    ['venta.detalle_html', 'Tabla con los productos vendidos'],
    ['empresa.nombre_comercial', 'Nombre comercial'],
    ['empresa.razon_social', 'Razón social'],
    ['empresa.ruc', 'RUC'],
    ['empresa.direccion_establecimiento', 'Dirección del local'],
    ['empresa.telefono', 'Teléfono'],
    ['empresa.email', 'Correo'],
    ['empresa.pie_recibo', 'Lema del recibo'],
  ],
  ORDEN_COMPRA_PROVEEDOR: [
    ['orden.numero', 'Número de la orden'],
    ['orden.fecha', 'Fecha de emisión'],
    ['orden.fecha_requerida', 'Fecha en que se necesita'],
    ['orden.observaciones', 'Observación escrita al generarla'],
    ['orden.detalle_html', 'Tabla de productos solicitados'],
    ['proveedor.razon_social', 'Razón social del proveedor'],
    ['proveedor.ruc', 'RUC del proveedor'],
    ['sede.nombre', 'Local donde se entrega'],
    ['sede.direccion', 'Dirección de entrega'],
    ['empresa.razon_social', 'Razón social'],
    ['empresa.ruc', 'RUC'],
    ['empresa.telefono', 'Teléfono'],
    ['empresa.email', 'Correo'],
  ],
  ALERTA_STOCK_BAJO: [
    ['alerta.fecha', 'Fecha del corte'],
    ['alerta.cantidad_productos', 'Cuántos productos están bajo el mínimo'],
    ['alerta.detalle_html', 'Tabla con los productos'],
    ['sede.nombre', 'Local'],
  ],
};

// Datos de mentira para la vista previa. Se usan solo en pantalla.
const EJEMPLO = {
  'cliente.nombre': 'MARÍA FERNANDA LOOR',
  'cliente.identificacion': '1712345678',
  'cliente.direccion': 'Av. Amazonas N34-120',
  'venta.numero_comprobante': '001-001-000000147',
  'venta.tipo': 'Factura',
  'venta.fecha': '19/09/2026',
  'venta.subtotal': '$18.40',
  'venta.descuento': '$1.10',
  'venta.iva': '$0.86',
  'venta.total': '$18.16',
  'venta.cajero': 'Bryan Espinoza',
  'venta.detalle_html':
    '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<tr style="border-bottom:1px solid #d8e6d9"><th align="left">Producto</th><th align="center">Cant.</th><th align="right">Valor</th></tr>' +
    '<tr><td>Guineo de seda</td><td align="center">2.5</td><td align="right">$0.88</td></tr>' +
    '<tr><td>Arroz Gustadina 2 kg</td><td align="center">1</td><td align="right">$3.10</td></tr></table>',
  'orden.numero': 'OC-2026-00012',
  'orden.fecha': '19/09/2026',
  'orden.fecha_requerida': '22/09/2026',
  'orden.observaciones': 'Entregar en horario de la mañana',
  'orden.detalle_html':
    '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
    '<tr style="background:#eef6ef"><th align="left">Código</th><th align="left">Producto</th><th align="center">Cantidad</th></tr>' +
    '<tr><td>FRU-001</td><td>Guineo de seda</td><td align="center">50</td></tr></table>',
  'proveedor.razon_social': 'DISTRIBUIDORA ANDINA S.A.',
  'proveedor.ruc': '1790012345001',
  'sede.nombre': 'Matriz',
  'sede.direccion': 'Alfaro, Quito',
  'alerta.fecha': '19/09/2026',
  'alerta.cantidad_productos': '7',
  'alerta.detalle_html': '<ul><li>Guineo de seda — quedan 3 lb</li></ul>',
  'empresa.nombre_comercial': 'Minimarket El Cultivo',
  'empresa.razon_social': 'MINIMARKET EL CULTIVO',
  'empresa.ruc': '1728605070001',
  'empresa.direccion_establecimiento': 'Alfaro, Pichincha',
  'empresa.telefono': '02 000 0000',
  'empresa.email': 'contacto@elcultivo.ec',
  'empresa.pie_recibo': 'Frescura y calidad en cada compra',
};

async function correoPlantillas(destino) {
  destino.innerHTML = '<p class="loading">Cargando plantillas…</p>';
  const { data, error } = await supabase
    .from('plantillas_correo').select('*').order('codigo');

  if (error) {
    destino.innerHTML = traducirErrorSupabase(error, 'plantillas_correo');
    return;
  }

  destino.innerHTML = `
    <div class="panel">
      <h3>Plantillas de correo</h3>
      <p class="nota">Cada plantilla es HTML. Lo que va entre llaves dobles se
      reemplaza al enviar con el dato real: <code>{{cliente.nombre}}</code> se
      convierte en el nombre de quien compró. Una etiqueta mal escrita no rompe
      nada, simplemente sale vacía.</p>
      <div id="lista-plantillas" class="lista-plantillas"></div>
    </div>`;

  const lista = destino.querySelector('#lista-plantillas');
  lista.innerHTML = (data ?? []).map((p) => `
    <div class="plantilla-fila">
      <div>
        <b>${escapar(p.nombre)}</b> <code>${escapar(p.codigo)}</code>
        <div class="nota">${escapar(p.descripcion ?? '')}</div>
      </div>
      <button class="btn-mini" data-editar="${escapar(p.codigo)}">Editar</button>
    </div>`).join('') || '<p class="nota">No hay plantillas cargadas.</p>';

  lista.querySelectorAll('[data-editar]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = (data ?? []).find((x) => x.codigo === btn.dataset.editar);
      if (p) abrirEditorPlantilla(p, () => correoPlantillas(destino));
    });
  });
}

function abrirEditorPlantilla(plantilla, alGuardar) {
  const etiquetas = ETIQUETAS[plantilla.codigo] ?? [];

  abrirModal({
    titulo: `Plantilla: ${plantilla.nombre}`,
    ancho: '980px',
    contenido: `
      <div class="editor-plantilla">
        <div class="ep-izquierda">
          <label>Asunto</label>
          <input type="text" id="ep-asunto" value="${v(plantilla.asunto)}" />

          <div class="ep-barra">
            <label>Cuerpo HTML</label>
            <div class="ep-modos">
              <button type="button" class="ep-modo activa" data-m="codigo">Código</button>
              <button type="button" class="ep-modo" data-m="previa">Vista previa</button>
            </div>
          </div>

          <textarea id="ep-cuerpo" rows="18" spellcheck="false">${v(plantilla.cuerpo_html)}</textarea>
          <iframe id="ep-previa" class="hidden" sandbox=""></iframe>

          <div id="ep-msg" class="form-msg"></div>
        </div>

        <aside class="ep-derecha">
          <h4>Etiquetas disponibles</h4>
          <p class="nota">Haga clic para insertarla donde está el cursor.</p>
          <div class="ep-etiquetas">
            ${etiquetas.map(([clave, desc]) => `
              <button type="button" class="ep-etiqueta" data-clave="${clave}" title="${escapar(desc)}">
                <code>{{${clave}}}</code><small>${escapar(desc)}</small>
              </button>`).join('') || '<p class="nota">Esta plantilla no declara etiquetas.</p>'}
          </div>
        </aside>
      </div>`,
    botones: [
      { texto: 'Cancelar', clase: 'btn-secundario', accion: cerrarModal },
      { texto: 'Guardar plantilla', clase: 'btn-primary', accion: guardar },
    ],
    alAbrir: (modal) => {
      const cuerpo = modal.querySelector('#ep-cuerpo');
      const previa = modal.querySelector('#ep-previa');

      modal.querySelectorAll('.ep-etiqueta').forEach((b) => {
        b.addEventListener('click', () => {
          const texto = `{{${b.dataset.clave}}}`;
          const ini = cuerpo.selectionStart ?? cuerpo.value.length;
          const fin = cuerpo.selectionEnd ?? ini;
          cuerpo.value = cuerpo.value.slice(0, ini) + texto + cuerpo.value.slice(fin);
          cuerpo.focus();
          cuerpo.selectionStart = cuerpo.selectionEnd = ini + texto.length;
        });
      });

      modal.querySelectorAll('.ep-modo').forEach((b) => {
        b.addEventListener('click', () => {
          modal.querySelectorAll('.ep-modo').forEach((x) => x.classList.remove('activa'));
          b.classList.add('activa');
          const esPrevia = b.dataset.m === 'previa';
          cuerpo.classList.toggle('hidden', esPrevia);
          previa.classList.toggle('hidden', !esPrevia);
          if (esPrevia) {
            // La vista previa corre dentro de un iframe con sandbox vacío:
            // el HTML de la plantilla no puede ejecutar scripts ni tocar
            // la aplicación, aunque alguien pegue algo raro.
            previa.srcdoc = renderizar(cuerpo.value, EJEMPLO);
          }
        });
      });
    },
  });

  async function guardar() {
    const modal = document.querySelector('.modal');
    const msg = modal.querySelector('#ep-msg');
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('plantillas_correo').update({
      asunto: modal.querySelector('#ep-asunto').value,
      cuerpo_html: modal.querySelector('#ep-cuerpo').value,
      actualizada_at: new Date().toISOString(),
      actualizada_por: user?.id ?? null,
    }).eq('codigo', plantilla.codigo);

    if (error) {
      msg.textContent = error.message;
      msg.className = 'form-msg error';
      return;
    }
    cerrarModal();
    alGuardar();
  }
}

/** Mismo reemplazo que hace la base, para que la vista previa no mienta. */
function renderizar(texto, datos) {
  return (texto ?? '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g,
    (_, clave) => datos[clave] ?? '');
}

// ---------------------------------------------------------
// Bandeja de salida
// ---------------------------------------------------------
async function correoBandeja(destino) {
  destino.innerHTML = '<p class="loading">Cargando bandeja…</p>';

  const { data, error } = await supabase
    .from('cola_correo')
    .select('id, plantilla, destinatario, asunto, estado, intentos, ultimo_error, created_at, enviado_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    destino.innerHTML = traducirErrorSupabase(error, 'cola_correo');
    return;
  }

  const pendientes = (data ?? []).filter((c) => c.estado === 'PENDIENTE').length;

  destino.innerHTML = `
    <div class="panel">
      <h3>Correos preparados por el sistema</h3>
      <p class="nota">Aquí queda todo lo que el sistema genera: comprobantes al
      cliente, órdenes de compra y avisos de stock bajo. Salen cuando la función de
      envío corre en el servidor. Mientras no esté configurada, los mensajes se
      acumulan en <b>PENDIENTE</b> — no se pierden.</p>
      ${pendientes ? `<div class="tarjeta-mini aviso"><span>${pendientes}</span><small>en espera de envío</small></div>` : ''}
    </div>
    <div id="tabla-cola"></div>`;

  renderTable(destino.querySelector('#tabla-cola'), {
    columns: [
      { key: 'fecha', label: 'Generado' },
      { key: 'destinatario', label: 'Para' },
      { key: 'asunto', label: 'Asunto' },
      { key: 'plantilla', label: 'Plantilla' },
      { key: 'estado', label: 'Estado' },
      { key: 'detalle', label: 'Detalle' },
    ],
    rows: (data ?? []).map((c) => ({
      ...c,
      fecha: new Date(c.created_at).toLocaleString('es-EC'),
      detalle: c.ultimo_error ?? (c.enviado_at ? new Date(c.enviado_at).toLocaleString('es-EC') : '—'),
    })),
    searchable: true,
    rowClass: (r) => (r.estado === 'ERROR' ? 'row-error'
                    : r.estado === 'ENVIADO' ? 'row-ok' : 'row-warning'),
    emptyMessage: 'No hay correos generados todavía.',
  });
}

// ---------------------------------------------------------
function v(x) {
  const d = document.createElement('div');
  d.textContent = x ?? '';
  return d.innerHTML.replace(/"/g, '&quot;');
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}

export { ICONOS_DISPONIBLES };
