// Modal del perfil del usuario actual.
//
// Muestra quién está operando, con qué rol y qué puede hacer con ese
// rol. Sirve para que el cajero sepa por qué una opción no aparece,
// en vez de pensar que el sistema está roto.

import { abrirModal, cerrarModal } from './modal.js';
import { perfilActual } from './sesion.js';
import { supabase } from '../supabaseClient.js';

const PERMISOS = {
  ADMIN: [
    'Vender, cobrar e imprimir comprobantes',
    'Ingresar mercadería y mover ubicaciones',
    'Ajustar inventario y anular ventas sin token',
    'Cambiar precios, promociones y catálogo',
    'Administrar usuarios, proveedores y datos de la empresa',
    'Emitir tokens de autorización',
  ],
  BODEGUERO: [
    'Vender, cobrar e imprimir comprobantes',
    'Ingresar mercadería y mover ubicaciones',
    'Consultar stock, kardex y caducidades',
    'Ajustar inventario y anular ventas: requiere token del administrador',
  ],
  VENDEDOR: [
    'Vender, cobrar e imprimir comprobantes',
    'Consultar stock, ubicaciones, caducidades y promociones',
    'Registrar clientes nuevos al facturar',
    'Ajustar inventario y anular ventas: requiere token del administrador',
  ],
};

export async function abrirPerfil() {
  const p = await perfilActual();
  const { data: { user } } = await supabase.auth.getUser();

  const rol = p?.rol ?? 'SIN_PERFIL';
  const lista = PERMISOS[rol];

  const aviso = rol === 'SIN_MIGRACION'
    ? `<div class="aviso-migracion" style="margin-top:0.75rem">
         <h3>Roles no configurados</h3>
         <p>Falta aplicar <code>db/008_roles_seguridad.sql</code>. Mientras tanto la
         aplicación no distingue permisos por usuario.</p>
       </div>`
    : rol === 'SIN_PERFIL'
      ? `<p class="nota">Tu usuario no tiene perfil asignado. Pide al administrador
         que te asigne un rol desde Administración → Usuarios.</p>`
      : '';

  abrirModal({
    ancho: '480px',
    titulo: 'Mi perfil',
    contenido: `
      <div class="perfil-cabecera">
        <span class="perfil-avatar grande">${(user?.email ?? '?').charAt(0)}</span>
        <div>
          <b>${esc(p?.nombre ?? user?.email ?? 'Usuario')}</b>
          <div class="nota">${esc(user?.email ?? '')}</div>
          <span class="rol-chip rol-${rol.toLowerCase()}">${rol.toLowerCase()}</span>
        </div>
      </div>
      ${lista ? `<h4>Lo que puedes hacer con este rol</h4>
        <ul class="lista-permisos">${lista.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${aviso}
      <p class="nota">Estos permisos los aplica la base de datos, no solo la pantalla:
      aunque se fuerce la navegación, los datos restringidos no se entregan.</p>`,
    botones: [{ texto: 'Cerrar', clase: 'btn-secundario', accion: cerrarModal }],
  });
}

function esc(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML;
}
