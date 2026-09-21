import { supabase } from './supabaseClient.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { renderTable } from './lib/table.js';
import { abrirModal, cerrarModal } from './lib/modal.js';
import { traducirErrorSupabase } from './lib/errores.js';
import { perfilActual, refrescarPerfil } from './lib/sesion.js';
import { vistaSedes, vistaRoles, vistaCorreo } from './admin-config.js';
import { refrescarMarca, redimensionarImagen, leerComoDataUri } from './lib/marca.js';

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
      <button class="tab active" data-a="usuarios">Usuarios</button>
      <button class="tab" data-a="roles">Roles y permisos</button>
      <button class="tab" data-a="sedes">Sedes</button>
      <button class="tab" data-a="tokens">Tokens</button>
      <button class="tab" data-a="proveedores">Proveedores</button>
      <button class="tab" data-a="correo">Correo y plantillas</button>
      <button class="tab" data-a="empresa">Empresa e identidad</button>
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

  const VISTAS = {
    usuarios: vistaUsuarios,
    roles: vistaRoles,
    sedes: vistaSedes,
    tokens: vistaTokens,
    proveedores: vistaProveedores,
    correo: vistaCorreo,
    empresa: vistaEmpresa,
  };

  function pintar(cual) {
    (VISTAS[cual] ?? vistaUsuarios)(vista);
  }

  pintar('usuarios');
}

// ---------------------------------------------------------
// Usuarios y roles
// ---------------------------------------------------------
async function vistaUsuarios(destino) {
  destino.innerHTML = '<p class="loading">Cargando usuarios...</p>';

  const [{ data, error }, { data: sedes }, { data: roles }] = await Promise.all([
    supabase.from('perfiles_usuario')
      .select('usuario_id, nombre, rol, activo, sede_id, created_at')
      .order('created_at'),
    supabase.from('sedes').select('id, codigo, nombre').eq('activa', true).order('codigo'),
    supabase.from('roles_catalogo').select('codigo, nombre, descripcion, nivel')
      .eq('activo', true).order('nivel'),
  ]);

  if (error) {
    destino.innerHTML = traducirErrorSupabase(error, 'perfiles_usuario');
    return;
  }

  // Si la migración 010 aún no está aplicada se usan los tres roles viejos,
  // para que la pantalla siga sirviendo en vez de quedarse vacía.
  const catalogo = (roles?.length ? roles : [
    { codigo: 'ADMIN', nombre: 'Administrador' },
    { codigo: 'BODEGUERO', nombre: 'Bodeguero' },
    { codigo: 'VENDEDOR', nombre: 'Cajero / Vendedor' },
  ]);

  destino.innerHTML = `
    <div class="panel">
      <h3>Crear un usuario</h3>
      <form id="form-usuario" class="inline-form">
        <input type="text" id="us-nombre" placeholder="Nombre y apellido" required />
        <input type="email" id="us-email" placeholder="Correo con el que va a entrar" required />
        <input type="password" id="us-clave" placeholder="Contraseña temporal" required minlength="8" />
        <select id="us-rol">
          ${catalogo.map((r) => `<option value="${r.codigo}" ${r.codigo === 'VENDEDOR' ? 'selected' : ''}>${r.nombre}</option>`).join('')}
        </select>
        <select id="us-sede">
          ${(sedes ?? []).map((s) => `<option value="${s.id}">${s.codigo} · ${s.nombre}</option>`).join('')}
        </select>
        <button type="submit">Crear usuario</button>
        <span id="us-msg" class="form-msg"></span>
      </form>
      <p class="nota">La contraseña es temporal: dígasela a la persona y pídale que la
      cambie en su primer ingreso. Esta pantalla no puede ver la contraseña de nadie
      una vez guardada, ni siquiera el administrador.</p>
    </div>

    <div class="panel" id="panel-manual" hidden>
      <h3>Alta manual (si el botón de arriba no está disponible)</h3>
      <ol class="pasos">
        <li>En Supabase, entre a <b>Authentication → Users → Add user</b> y cree la
            cuenta con el correo de la persona y una contraseña temporal. Marque
            <i>Auto Confirm User</i> para que pueda entrar sin verificar el correo.</li>
        <li>Pídale que ingrese una vez al sistema. En ese momento aparece en la lista
            de abajo con el rol <b>Cajero / Vendedor</b>, que es el más restringido.</li>
        <li>Aquí mismo le cambia el rol y le asigna la sede donde va a trabajar.</li>
      </ol>
      <p class="nota">Este camino es el de respaldo. El formulario de arriba hace lo
      mismo en un paso, y solo deja de funcionar si todavía no se ha publicado la
      función <code>crear-usuario</code> (el procedimiento está en
      <code>PUBLICACION.md</code>). Se hace con una función en el servidor y no
      directamente desde el navegador porque dar de alta cuentas exige la clave de
      servicio del proyecto, que abre la base entera: si viajara al navegador,
      cualquiera podría leerla en el código fuente de la página.</p>
      <p class="nota">Lo que puede hacer cada rol se configura en la pestaña
      <b>Roles y permisos</b>.</p>
    </div>

    <div id="tabla-usuarios"></div>
  `;

  destino.querySelector('#form-usuario')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = destino.querySelector('#us-msg');
    msg.textContent = 'Creando cuenta…';
    msg.className = 'form-msg';

    const { data: { session } } = await supabase.auth.getSession();

    try {
      const respuesta = await fetch(`${SUPABASE_URL}/functions/v1/crear-usuario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          nombre: destino.querySelector('#us-nombre').value.trim(),
          email: destino.querySelector('#us-email').value.trim(),
          password: destino.querySelector('#us-clave').value,
          rol: destino.querySelector('#us-rol').value,
          sede_id: destino.querySelector('#us-sede').value || null,
        }),
      });

      // 404 significa que la función todavía no está publicada. En ese
      // caso no se deja al administrador sin salida: se le muestra el
      // camino manual en vez de un error críptico.
      if (respuesta.status === 404) {
        destino.querySelector('#panel-manual').hidden = false;
        msg.textContent = 'Aún no se ha publicado la función crear-usuario. ' +
                          'Abajo quedó el procedimiento manual.';
        msg.className = 'form-msg error';
        return;
      }

      const cuerpo = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        msg.textContent = cuerpo.error ?? `Error ${respuesta.status}`;
        msg.className = 'form-msg error';
        return;
      }

      msg.textContent = `Usuario ${cuerpo.email} creado como ${cuerpo.rol}.`;
      msg.className = 'form-msg ok';
      e.target.reset();
      vistaUsuarios(destino);

    } catch (err) {
      destino.querySelector('#panel-manual').hidden = false;
      msg.textContent = `No se pudo contactar la función de alta (${err.message}). ` +
                        'Use el procedimiento manual de abajo.';
      msg.className = 'form-msg error';
    }
  });

  renderTable(destino.querySelector('#tabla-usuarios'), {
    columns: [
      { key: 'nombre', label: 'Usuario' },
      { key: 'rol', label: 'Rol actual' },
      { key: 'sede_txt', label: 'Sede' },
      { key: 'estado', label: 'Estado' },
      { key: 'desde', label: 'Desde' },
      { key: 'acciones', label: 'Cambiar' },
    ],
    rows: (data ?? []).map((u) => ({
      ...u,
      sede_txt: (sedes ?? []).find((s) => s.id === u.sede_id)?.nombre ?? '—',
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
      <select class="sel-rol" data-id="${u.usuario_id}" title="Rol del usuario">
        ${catalogo.map((r) =>
          `<option value="${r.codigo}" ${r.codigo === u.rol ? 'selected' : ''}>${r.nombre}</option>`).join('')}
      </select>
      <select class="sel-sede" data-id="${u.usuario_id}" title="Sede donde trabaja">
        ${(sedes ?? []).map((s) =>
          `<option value="${s.id}" ${s.id === u.sede_id ? 'selected' : ''}>${s.codigo} · ${s.nombre}</option>`).join('')}
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

  destino.querySelectorAll('.sel-sede').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const { error: err } = await supabase.from('perfiles_usuario')
        .update({ sede_id: sel.value }).eq('usuario_id', sel.dataset.id);
      if (err) alert(`No se pudo cambiar la sede: ${err.message}`);
      else vistaUsuarios(destino);
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

        <div class="ancho-completo bloque-logo">
          <h4>Impresora de recibos</h4>
          <p class="nota">Elija el ancho del rollo que usa la térmica del mostrador.
          El recibo se maqueta con esa medida exacta: si se escoge mal, la columna de
          los valores sale cortada o el papel queda con un margen enorme a la derecha.
          Lo normal en Ecuador es el rollo de <b>80 mm</b>; el de 58 mm se ve en
          impresoras portátiles y de parqueadero.</p>
          <label>Ancho del rollo
            <select name="ancho_papel_mm">
              <option value="80" ${Number(e.ancho_papel_mm) === 58 ? '' : 'selected'}>80 mm (estándar de mostrador)</option>
              <option value="58" ${Number(e.ancho_papel_mm) === 58 ? 'selected' : ''}>58 mm (portátil)</option>
            </select>
          </label>
          <p class="nota">En el diálogo de impresión del navegador, el destino debe ser
          la térmica y los márgenes «Ninguno». Si aparece «A4», es que está seleccionada
          otra impresora.</p>
        </div>

        <div class="ancho-completo bloque-logo">
          <h4>Logotipo</h4>
          <p class="nota">Se usa en el menú, en la pantalla de ingreso, en el ícono de
          la pestaña y en los reportes en PDF. La imagen se reduce a 256 px antes de
          guardarla: así el logotipo se ve nítido y la aplicación sigue abriendo rápido
          (un PNG de varios megabytes dentro de la base haría lenta cada carga de la caja).</p>
          <p class="nota">En el recibo de la térmica no se imprime: esa impresora
          trabaja a 203 puntos por pulgada y en un solo color, así que un logotipo sale
          como una mancha gris, gasta papel y hace más lenta cada venta.</p>
          <div class="logo-editor">
            <img id="logo-previa" class="logo-previa"
                 src="${e.logo_url || 'img/logo-menu.png'}" alt="Vista previa del logotipo" />
            <div class="logo-controles">
              <input type="file" id="logo-archivo" accept="image/png,image/jpeg,image/svg+xml,image/webp" />
              <button type="button" class="btn-secundario" id="logo-quitar">Volver al logotipo del archivo</button>
              <span id="logo-msg" class="form-msg"></span>
            </div>
          </div>
          <label>O pegue una dirección de imagen
            <input name="logo_url" id="logo-url" value="${v(e.logo_url)}"
                   placeholder="https://… o data:image/png;base64,…" />
          </label>
        </div>

        <div class="ancho-completo bloque-logo">
          <h4>Cobro con De Una!</h4>
          <p class="nota">Descargue su código de cobro desde la banca en línea del
          Banco Pichincha (Cobros → Mi QR) y cárguelo aquí, tal como venga:
          <b>PNG, JPG o el PDF</b> que entrega el banco. La caja lo muestra en grande
          al elegir De Una como forma de pago.</p>
          <p class="nota">Un archivo de Word no sirve para esto: el navegador no lo
          puede dibujar en pantalla. Si solo tiene el QR dentro de un .docx, ábralo,
          haga clic derecho sobre la imagen y guárdela como PNG.</p>

          <div class="logo-editor">
            <div id="deuna-previa-caja" class="deuna-previa-caja ${e.deuna_qr_url ? '' : 'hidden'}"></div>
            <div class="logo-controles">
              <input type="file" id="deuna-archivo"
                     accept="image/png,image/jpeg,image/webp,image/svg+xml,application/pdf" />
              <button type="button" class="btn-secundario" id="deuna-quitar">Quitar el código</button>
              <span id="deuna-msg" class="form-msg"></span>
            </div>
          </div>

          <input type="hidden" name="deuna_qr_url" id="deuna-url" value="${v(e.deuna_qr_url)}" />
          <input type="hidden" name="deuna_qr_mime" id="deuna-mime" value="${v(e.deuna_qr_mime)}" />
          <input type="hidden" name="deuna_qr_nombre" id="deuna-nombre" value="${v(e.deuna_qr_nombre)}" />

          <label>Titular de la cuenta De Una
            <input name="deuna_titular" value="${v(e.deuna_titular)}" />
          </label>
          <label>Teléfono asociado
            <input name="deuna_telefono" value="${v(e.deuna_telefono)}" />
          </label>
          <label class="ancho-completo">Instrucción que lee el cajero al cliente
            <input name="deuna_instrucciones" value="${v(e.deuna_instrucciones)}"
                   placeholder="Escanee el código y envíe el valor indicado en pantalla." />
          </label>

          <label>Modo de cobro
            <select name="deuna_modo" id="deuna-modo">
              <option value="QR_ESTATICO" ${e.deuna_modo !== 'API_TOKEN' ? 'selected' : ''}>
                QR fijo — el cliente digita el monto
              </option>
              <option value="API_TOKEN" ${e.deuna_modo === 'API_TOKEN' ? 'selected' : ''}>
                API con token — el QR lleva el monto (requiere contrato)
              </option>
            </select>
          </label>
          <label>Mostrar De Una en la caja
            <input type="checkbox" name="deuna_activo" ${e.deuna_activo ? 'checked' : ''} />
          </label>

          <div class="ancho-completo" id="deuna-api" ${e.deuna_modo === 'API_TOKEN' ? '' : 'hidden'}>
            <div class="aviso-migracion">
              <b>El modo con API todavía no está conectado.</b>
              <p class="nota">Cuando el Banco Pichincha le habilite el servicio, el QR
              llevará el monto incluido y un aviso del banco marcará la venta como
              pagada sola, sin que el cajero anote nada. Hasta entonces la caja sigue
              funcionando con el QR fijo aunque deje este modo elegido.</p>
              <p class="nota">La clave del API <b>no se guarda aquí</b>: va como secreto
              en el servidor. Si estuviera en esta pantalla, cualquiera que abra el
              código fuente de la página podría cobrar a nombre del negocio.</p>
              <label>Identificador de comercio
                <input name="deuna_comercio_id" value="${v(e.deuna_comercio_id)}" />
              </label>
              <label>Dirección del servicio
                <input name="deuna_api_base" value="${v(e.deuna_api_base)}"
                       placeholder="https://api.deuna.com" />
              </label>
            </div>
          </div>
        </div>

        <div class="ancho-completo">
          <button type="submit" class="btn-primary">Guardar</button>
          <span id="emp-msg" class="form-msg"></span>
        </div>
      </form>
    </div>`;

  // ---- Carga del logotipo ----
  const campoUrl = destino.querySelector('#logo-url');
  const previa = destino.querySelector('#logo-previa');
  const logoMsg = destino.querySelector('#logo-msg');

  destino.querySelector('#logo-archivo').addEventListener('change', async (ev) => {
    const archivo = ev.target.files?.[0];
    if (!archivo) return;
    logoMsg.textContent = 'Procesando imagen…';
    logoMsg.className = 'form-msg';
    try {
      const dataUri = await redimensionarImagen(archivo, 256);
      campoUrl.value = dataUri;
      previa.src = dataUri;
      logoMsg.textContent = `Listo (${Math.round(dataUri.length / 1024)} KB). Pulse Guardar para aplicarlo.`;
      logoMsg.className = 'form-msg ok';
    } catch (err) {
      logoMsg.textContent = err.message;
      logoMsg.className = 'form-msg error';
    }
  });

  destino.querySelector('#logo-quitar').addEventListener('click', () => {
    campoUrl.value = '';
    previa.src = 'img/logo-menu.png';
    logoMsg.textContent = 'Se usará el archivo del servidor. Pulse Guardar.';
    logoMsg.className = 'form-msg';
  });

  // ---- Modo de cobro ----
  destino.querySelector('#deuna-modo')?.addEventListener('change', (ev) => {
    destino.querySelector('#deuna-api').hidden = ev.target.value !== 'API_TOKEN';
  });

  // ---- Carga del código de cobro De Una ----
  const deunaUrl = destino.querySelector('#deuna-url');
  const deunaMime = destino.querySelector('#deuna-mime');
  const deunaNombre = destino.querySelector('#deuna-nombre');
  const deunaCaja = destino.querySelector('#deuna-previa-caja');
  const deunaMsg = destino.querySelector('#deuna-msg');

  function pintarPreviaDeuna(url, mime) {
    if (!url) {
      deunaCaja.innerHTML = '';
      deunaCaja.classList.add('hidden');
      return;
    }
    deunaCaja.classList.remove('hidden');
    deunaCaja.innerHTML = mime === 'application/pdf'
      ? `<embed src="${url}#toolbar=0&navpanes=0" type="application/pdf" class="deuna-previa-pdf" />`
      : `<img src="${url}" alt="Código de cobro De Una" class="logo-previa" />`;
  }

  pintarPreviaDeuna(e.deuna_qr_url, e.deuna_qr_mime);

  destino.querySelector('#deuna-archivo').addEventListener('change', async (ev) => {
    const archivo = ev.target.files?.[0];
    if (!archivo) return;
    deunaMsg.textContent = 'Procesando…';
    deunaMsg.className = 'form-msg';

    try {
      let dataUri;

      if (archivo.type === 'application/pdf') {
        // El PDF se guarda tal cual: recomprimirlo no tendría sentido y
        // el navegador lo dibuja sin ayuda. Solo se vigila el tamaño,
        // porque este archivo viaja en cada carga de la aplicación.
        if (archivo.size > 900 * 1024) {
          throw new Error(
            `El PDF pesa ${Math.round(archivo.size / 1024)} KB y el límite práctico es 900 KB. ` +
            'Abra el PDF, recorte solo el código y guárdelo como PNG: pesa mucho menos y ' +
            'se ve igual de bien en la caja.');
        }
        dataUri = await leerComoDataUri(archivo);
        deunaMime.value = 'application/pdf';
      } else {
        // A 512 px el lector del teléfono distingue bien los módulos del
        // código; más pequeño empieza a fallar el escaneo.
        dataUri = await redimensionarImagen(archivo, 512);
        deunaMime.value = 'image/png';
      }

      deunaUrl.value = dataUri;
      deunaNombre.value = archivo.name;
      pintarPreviaDeuna(dataUri, deunaMime.value);
      deunaMsg.textContent =
        `Código cargado (${Math.round(dataUri.length / 1024)} KB). Pulse Guardar para aplicarlo.`;
      deunaMsg.className = 'form-msg ok';

    } catch (err) {
      deunaMsg.textContent = err.message;
      deunaMsg.className = 'form-msg error';
    }
  });

  destino.querySelector('#deuna-quitar').addEventListener('click', () => {
    deunaUrl.value = '';
    deunaMime.value = '';
    deunaNombre.value = '';
    pintarPreviaDeuna(null);
    deunaMsg.textContent = 'Se quitará el código al guardar.';
    deunaMsg.className = 'form-msg';
  });

  destino.querySelector('#form-empresa').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const msg = destino.querySelector('#emp-msg');
    const fd = new FormData(ev.target);
    const payload = Object.fromEntries(fd.entries());
    payload.obligado_contabilidad = fd.get('obligado_contabilidad') === 'on';
    payload.deuna_activo = fd.get('deuna_activo') === 'on';
    payload.ancho_papel_mm = Number(fd.get('ancho_papel_mm')) === 58 ? 58 : 80;
    for (const k of Object.keys(payload)) {
      if (payload[k] === '') payload[k] = null;
    }
    payload.updated_at = new Date().toISOString();

    msg.textContent = 'Guardando…';
    msg.className = 'form-msg';

    const { error: errUp } = await supabase.from('empresa').update(payload).eq('id', true);
    if (errUp) {
      msg.textContent = errUp.message;
      msg.className = 'form-msg error';
      return;
    }

    // ESTO ES LO QUE FALTABA ANTES: guardar en la base no bastaba, porque
    // el logotipo estaba escrito a mano en index.html. Ahora se relee la
    // fila y se repinta la identidad en el acto, sin recargar la página.
    await refrescarMarca();
    msg.textContent = 'Datos guardados y aplicados.';
    msg.className = 'form-msg ok';
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
