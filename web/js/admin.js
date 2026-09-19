import { supabase } from './supabaseClient.js';
import { renderTable } from './lib/table.js';
import { abrirModal, cerrarModal } from './lib/modal.js';
import { traducirErrorSupabase } from './lib/errores.js';
import { perfilActual, refrescarPerfil } from './lib/sesion.js';

export async function renderAdmin(container) {
  const perfil = await perfilActual();

  if (perfil?.rol !== 'ADMIN') {
    container.innerHTML = `
      <div class="aviso-migracion">
        <h3>Solo para administradores</h3>
        <p>Tu perfil es <b>${perfil?.rol ?? 'sin perfil'}</b>. Este módulo lo abre únicamente
        un usuario con rol ADMIN.</p>
        <p class="nota">Si necesitas hacer un ajuste o anular una venta, pide un token de
        autorización al administrador: lo digitas en la operación y queda registrado a nombre de ambos.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-a="usuarios">Usuarios y roles</button>
      <button class="tab" data-a="tokens">Tokens de autorización</button>
      <button class="tab" data-a="proveedores">Proveedores</button>
      <button class="tab" data-a="empresa">Datos de la empresa</button>
    </div>
    <div id="admin-vista"></div>
  `;

  const vista = container.querySelector('#admin-vista');
  container.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      pintar(btn.dataset.a);
    });
  });

  function pintar(cual) {
    if (cual === 'usuarios') vistaUsuarios(vista);
    else if (cual === 'tokens') vistaTokens(vista);
    else if (cual === 'proveedores') vistaProveedores(vista);
    else vistaEmpresa(vista);
  }

  pintar('usuarios');
}

// ---------------------------------------------------------
// Usuarios y roles
// ---------------------------------------------------------
async function vistaUsuarios(destino) {
  destino.innerHTML = '<p class="loading">Cargando usuarios...</p>';

  const { data, error } = await supabase
    .from('perfiles_usuario')
    .select('usuario_id, nombre, rol, activo, created_at')
    .order('created_at');

  if (error) {
    destino.innerHTML = traducirErrorSupabase(error, 'perfiles_usuario');
    return;
  }

  destino.innerHTML = `
    <div class="panel">
      <h3>Qué puede hacer cada rol</h3>
      <table class="dyn-table">
        <thead><tr><th>Acción</th><th>Admin</th><th>Bodeguero</th><th>Vendedor</th></tr></thead>
        <tbody>
          <tr><td>Vender y cobrar</td><td>Sí</td><td>Sí</td><td>Sí</td></tr>
          <tr><td>Consultar stock, ubicaciones y caducidades</td><td>Sí</td><td>Sí</td><td>Sí</td></tr>
          <tr><td>Ingresar mercadería</td><td>Sí</td><td>Sí</td><td>No</td></tr>
          <tr><td>Mover productos de ubicación</td><td>Sí</td><td>Sí</td><td>Con token</td></tr>
          <tr><td>Ajustar inventario</td><td>Sí</td><td>Con token</td><td>Con token</td></tr>
          <tr><td>Anular una venta</td><td>Sí</td><td>Con token</td><td>Con token</td></tr>
          <tr><td>Cambiar precios y promociones</td><td>Sí</td><td>No</td><td>No</td></tr>
          <tr><td>Administrar usuarios y emitir tokens</td><td>Sí</td><td>No</td><td>No</td></tr>
        </tbody>
      </table>
      <p class="nota">Estos permisos no son solo de pantalla: están aplicados como políticas
      en la base de datos, así que se respetan aunque alguien intente saltarse la interfaz.</p>
    </div>

    <div class="panel">
      <h3>Agregar un vendedor nuevo</h3>
      <p class="nota">Por seguridad, la creación de la cuenta se hace en Supabase →
      <b>Authentication → Users → Add user</b> (crear cuentas desde el navegador exigiría
      exponer la clave de administrador del proyecto, que nunca debe salir del servidor).
      Apenas esa persona entre por primera vez, aparecerá en esta lista como VENDEDOR y
      aquí le cambias el rol si corresponde.</p>
    </div>

    <div id="tabla-usuarios"></div>
  `;

  renderTable(destino.querySelector('#tabla-usuarios'), {
    columns: [
      { key: 'nombre', label: 'Usuario' },
      { key: 'rol', label: 'Rol' },
      { key: 'estado', label: 'Estado' },
      { key: 'desde', label: 'Desde' },
      { key: 'acciones', label: '' },
    ],
    rows: (data ?? []).map((u) => ({
      ...u,
      estado: u.activo ? 'Activo' : 'Inactivo',
      desde: u.created_at ? new Date(u.created_at).toLocaleDateString('es-EC') : '—',
      acciones: '',
    })),
    searchable: true,
    rowClass: (r) => (r.activo ? '' : 'row-warning'),
    emptyMessage: 'Aún no hay usuarios registrados.',
  });

  // Botones de acción por fila
  const filas = data ?? [];
  destino.querySelectorAll('#tabla-usuarios tbody tr').forEach((tr, i) => {
    const u = filas[i];
    if (!u) return;
    const celda = tr.lastElementChild;
    celda.innerHTML = `
      <select class="sel-rol" data-id="${u.usuario_id}">
        ${['ADMIN', 'BODEGUERO', 'VENDEDOR'].map((r) =>
          `<option value="${r}" ${r === u.rol ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
      <button class="btn-mini" data-toggle="${u.usuario_id}" data-activo="${u.activo}">
        ${u.activo ? 'Desactivar' : 'Activar'}
      </button>`;
  });

  destino.querySelectorAll('.sel-rol').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const { error } = await supabase.from('perfiles_usuario')
        .update({ rol: sel.value }).eq('usuario_id', sel.dataset.id);
      if (error) alert(`No se pudo cambiar el rol: ${error.message}`);
      else {
        await refrescarPerfil();
        vistaUsuarios(destino);
      }
    });
  });

  destino.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const activo = btn.dataset.activo !== 'true';
      const { error } = await supabase.from('perfiles_usuario')
        .update({ activo }).eq('usuario_id', btn.dataset.toggle);
      if (error) alert(`No se pudo cambiar el estado: ${error.message}`);
      else vistaUsuarios(destino);
    });
  });
}

// ---------------------------------------------------------
// Tokens de autorización
// ---------------------------------------------------------
async function vistaTokens(destino) {
  destino.innerHTML = `
    <div class="panel">
      <h3>Emitir un token de autorización</h3>
      <p class="nota">Sirve para que un vendedor haga una operación que normalmente no puede
      (un ajuste de inventario, anular una venta) sin que tú tengas que sentarte en la caja.
      El token se muestra una sola vez, dura pocos minutos y se consume al usarse.</p>
      <form id="form-token" class="inline-form">
        <select id="tk-accion">
          <option value="AJUSTE_INVENTARIO">Ajuste de inventario</option>
          <option value="ANULAR_VENTA">Anular una venta</option>
          <option value="TRANSFERENCIA">Mover producto de ubicación</option>
          <option value="CAMBIO_PRECIO">Cambio de precio</option>
          <option value="CUALQUIERA">Cualquier acción</option>
        </select>
        <input type="text" id="tk-desc" placeholder="Motivo (queda en la bitácora)" />
        <input type="number" id="tk-min" value="15" min="1" max="480" title="Minutos de vigencia" />
        <input type="number" id="tk-usos" value="1" min="1" max="20" title="Usos permitidos" />
        <button type="submit">Emitir token</button>
        <span id="tk-msg" class="form-msg"></span>
      </form>
    </div>
    <div id="tabla-tokens"></div>
  `;

  destino.querySelector('#form-token').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = destino.querySelector('#tk-msg');
    msg.textContent = 'Emitiendo...';
    msg.className = 'form-msg';

    const { data, error } = await supabase.rpc('fn_emitir_token', {
      p_accion: destino.querySelector('#tk-accion').value,
      p_descripcion: destino.querySelector('#tk-desc').value.trim() || null,
      p_minutos: Number(destino.querySelector('#tk-min').value),
      p_usos: Number(destino.querySelector('#tk-usos').value),
    });

    if (error) {
      msg.textContent = error.message;
      msg.className = 'form-msg error';
      return;
    }

    msg.textContent = '';
    abrirModal({
      titulo: 'Token emitido',
      contenido: `
        <p class="nota">Dicta este código al vendedor. <b>No se vuelve a mostrar</b>:
        en la base solo queda guardado su hash.</p>
        <div class="token-grande">${data}</div>
        <div class="comp-linea"><span>Acción</span><b>${destino.querySelector('#tk-accion').value}</b></div>
        <div class="comp-linea"><span>Vigencia</span><b>${destino.querySelector('#tk-min').value} minutos</b></div>
        <div class="comp-linea"><span>Usos</span><b>${destino.querySelector('#tk-usos').value}</b></div>`,
      botones: [{ texto: 'Listo', clase: 'btn-primary', accion: cerrarModal }],
    });
    cargarTokens();
  });

  async function cargarTokens() {
    const tabla = destino.querySelector('#tabla-tokens');
    const { data, error } = await supabase
      .from('tokens_autorizacion')
      .select('id, accion, descripcion, usos_maximos, usos_realizados, vence_at, anulado, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      tabla.innerHTML = traducirErrorSupabase(error, 'tokens_autorizacion');
      return;
    }

    const ahora = new Date();
    renderTable(tabla, {
      columns: [
        { key: 'emitido', label: 'Emitido' },
        { key: 'accion', label: 'Acción' },
        { key: 'descripcion', label: 'Motivo' },
        { key: 'usos', label: 'Usos' },
        { key: 'vence', label: 'Vence' },
        { key: 'estado', label: 'Estado' },
      ],
      rows: (data ?? []).map((t) => {
        const vencido = new Date(t.vence_at) < ahora;
        const agotado = t.usos_realizados >= t.usos_maximos;
        return {
          ...t,
          emitido: new Date(t.created_at).toLocaleString('es-EC'),
          descripcion: t.descripcion ?? '—',
          usos: `${t.usos_realizados} / ${t.usos_maximos}`,
          vence: new Date(t.vence_at).toLocaleString('es-EC'),
          estado: t.anulado ? 'Anulado' : agotado ? 'Usado' : vencido ? 'Expirado' : 'Vigente',
        };
      }),
      rowClass: (r) => (r.estado === 'Vigente' ? 'row-ok' : ''),
      emptyMessage: 'No se han emitido tokens.',
    });
  }

  await cargarTokens();
}

// ---------------------------------------------------------
// Datos de la empresa
// ---------------------------------------------------------
async function vistaEmpresa(destino) {
  destino.innerHTML = '<p class="loading">Cargando...</p>';

  const { data, error } = await supabase.from('empresa').select('*').limit(1).maybeSingle();
  if (error) {
    destino.innerHTML = traducirErrorSupabase(error, 'empresa');
    return;
  }
  const e = data ?? {};

  destino.innerHTML = `
    <div class="panel">
      <h3>Datos que salen en el recibo y la factura</h3>
      <form id="form-empresa" class="form-empresa">
        <label>Razón social<input name="razon_social" value="${v(e.razon_social)}" required /></label>
        <label>Nombre comercial<input name="nombre_comercial" value="${v(e.nombre_comercial)}" /></label>
        <label>RUC (13 dígitos)<input name="ruc" value="${v(e.ruc)}" pattern="[0-9]{13}" /></label>
        <label>Dirección matriz<input name="direccion_matriz" value="${v(e.direccion_matriz)}" /></label>
        <label>Dirección del establecimiento<input name="direccion_establecimiento" value="${v(e.direccion_establecimiento)}" /></label>
        <label>Teléfono<input name="telefono" value="${v(e.telefono)}" /></label>
        <label>Correo<input name="email" type="email" value="${v(e.email)}" /></label>
        <label>Establecimiento<input name="establecimiento" value="${v(e.establecimiento)}" maxlength="3" /></label>
        <label>Punto de emisión<input name="punto_emision" value="${v(e.punto_emision)}" maxlength="3" /></label>
        <label>Ambiente
          <select name="ambiente">
            <option value="PRUEBAS" ${e.ambiente === 'PRUEBAS' ? 'selected' : ''}>Pruebas</option>
            <option value="PRODUCCION" ${e.ambiente === 'PRODUCCION' ? 'selected' : ''}>Producción</option>
          </select>
        </label>
        <label>Tipo de negocio
          <select name="tipo_negocio">
            ${['MARKET', 'FERRETERIA', 'TECNOLOGIA', 'OTRO'].map((t) =>
              `<option value="${t}" ${e.tipo_negocio === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </label>
        <label class="ancho-completo">Obligado a llevar contabilidad
          <input type="checkbox" name="obligado_contabilidad" ${e.obligado_contabilidad ? 'checked' : ''} />
        </label>
        <label class="ancho-completo">Pie del recibo
          <input name="pie_recibo" value="${v(e.pie_recibo)}" />
        </label>
        <label class="ancho-completo">Logo (URL o data URI)
          <input name="logo_url" value="${v(e.logo_url)}" placeholder="https://... o data:image/png;base64,..." />
        </label>
        <div class="ancho-completo">
          <button type="submit" class="btn-primary">Guardar</button>
          <span id="emp-msg" class="form-msg"></span>
        </div>
      </form>
    </div>`;

  destino.querySelector('#form-empresa').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msg = destino.querySelector('#emp-msg');
    const fd = new FormData(ev.target);
    const payload = Object.fromEntries(fd.entries());
    payload.obligado_contabilidad = fd.get('obligado_contabilidad') === 'on';
    for (const k of Object.keys(payload)) {
      if (payload[k] === '') payload[k] = null;
    }
    payload.updated_at = new Date().toISOString();

    const { error: errUp } = await supabase.from('empresa').update(payload).eq('id', true);
    if (errUp) {
      msg.textContent = errUp.message;
      msg.className = 'form-msg error';
    } else {
      msg.textContent = 'Datos guardados.';
      msg.className = 'form-msg ok';
    }
  });
}

function v(x) {
  const d = document.createElement('div');
  d.textContent = x ?? '';
  return d.innerHTML.replace(/"/g, '&quot;');
}

// ---------------------------------------------------------
// Proveedores
// ---------------------------------------------------------
async function vistaProveedores(destino) {
  destino.innerHTML = `
    <div class="panel">
      <h3>Registrar proveedor</h3>
      <p class="nota">El RUC se valida antes de guardar: 13 dígitos terminados en 001 y,
      si es de persona natural, con dígito verificador correcto.</p>
      <form id="form-prov" class="inline-form">
        <input type="text" id="pv-ruc" placeholder="RUC (13 dígitos)" required
               pattern="[0-9]{13}" maxlength="13" inputmode="numeric" />
        <input type="text" id="pv-razon" placeholder="Razón social" required />
        <input type="text" id="pv-comercial" placeholder="Nombre comercial" />
        <input type="text" id="pv-direccion" placeholder="Dirección" />
        <input type="text" id="pv-telefono" placeholder="Teléfono" />
        <input type="email" id="pv-email" placeholder="Correo" />
        <button type="submit">Guardar proveedor</button>
        <span id="pv-msg" class="form-msg"></span>
      </form>
    </div>
    <div id="tabla-prov"></div>`;

  destino.querySelector('#form-prov').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = destino.querySelector('#pv-msg');
    msg.textContent = 'Guardando...';
    msg.className = 'form-msg';

    const { error } = await supabase.rpc('fn_registrar_proveedor', {
      p_ruc: destino.querySelector('#pv-ruc').value.trim(),
      p_razon_social: destino.querySelector('#pv-razon').value.trim(),
      p_nombre_comercial: destino.querySelector('#pv-comercial').value.trim() || null,
      p_direccion: destino.querySelector('#pv-direccion').value.trim() || null,
      p_telefono: destino.querySelector('#pv-telefono').value.trim() || null,
      p_email: destino.querySelector('#pv-email').value.trim() || null,
    });

    if (error) {
      msg.textContent = error.message;
      msg.className = 'form-msg error';
      return;
    }
    msg.textContent = 'Proveedor guardado.';
    msg.className = 'form-msg ok';
    e.target.reset();
    cargar();
  });

  async function cargar() {
    const tabla = destino.querySelector('#tabla-prov');
    const { data, error } = await supabase
      .from('proveedores')
      .select('ruc, razon_social, nombre_comercial, direccion, telefono, email, activo')
      .order('razon_social');

    if (error) {
      tabla.innerHTML = traducirErrorSupabase(error, 'proveedores');
      return;
    }
    renderTable(tabla, {
      columns: [
        { key: 'ruc', label: 'RUC' },
        { key: 'razon_social', label: 'Razón social' },
        { key: 'nombre_comercial', label: 'Nombre comercial' },
        { key: 'telefono', label: 'Teléfono' },
        { key: 'email', label: 'Correo' },
        { key: 'estado', label: 'Estado' },
      ],
      rows: (data ?? []).map((p) => ({ ...p, estado: p.activo ? 'Activo' : 'Inactivo' })),
      emptyMessage: 'No hay proveedores registrados.',
    });
  }

  await cargar();
}
