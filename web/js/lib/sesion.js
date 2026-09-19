// Perfil y rol del usuario de la sesión.
//
// El rol se lee de la base con fn_mi_perfil(). La interfaz lo usa para
// esconder lo que no corresponde, pero esconder NO es proteger: quien
// manda son las políticas RLS. Si alguien forzara la navegación a un
// módulo que no le toca, la base de datos igual le negaría los datos.

import { supabase } from '../supabaseClient.js';
import { construirMenu, modulosVisibles } from './menu.js';

let perfil = null;
let promesa = null;

export async function perfilActual() {
  if (perfil) return perfil;
  if (!promesa) promesa = cargar();
  return promesa;
}

export async function refrescarPerfil() {
  perfil = null;
  promesa = null;
  return perfilActual();
}

export function limpiarPerfil() {
  perfil = null;
  promesa = null;
}

async function cargar() {
  // Desde la migración 010 el perfil trae además la sede y el nombre
  // legible del rol. Si esa función todavía no existe se cae a la
  // anterior, para que una base a medio migrar siga abriendo.
  let { data, error } = await supabase.rpc('fn_mi_perfil_completo');
  if (error) {
    ({ data, error } = await supabase.rpc('fn_mi_perfil'));
  }

  if (error || !data?.length) {
    // Base sin la migración 008, o usuario sin perfil: se asume el
    // perfil más restrictivo y se deja que RLS decida el resto.
    perfil = { rol: error ? 'SIN_MIGRACION' : 'SIN_PERFIL', nombre: null };
  } else {
    perfil = Array.isArray(data) ? data[0] : data;
  }
  promesa = null;
  return perfil;
}

/**
 * ¿El usuario puede abrir este módulo?
 *
 * La respuesta viene del menú que armó la base (permisos_rol). Si por
 * cualquier motivo el menú aún no se cargó, se deja pasar: la base de
 * datos sigue siendo la que decide, y bloquear aquí solo conseguiría
 * dejar al usuario mirando una pantalla en blanco.
 */
export function puedeVer(modulo) {
  const lista = modulosVisibles();
  if (!lista.length) return true;
  return lista.some((m) => m.codigo === modulo);
}

/**
 * Arma el menú según el rol y muestra rol y sede en el pie.
 * Se llama una vez al iniciar sesión.
 */
export async function aplicarRolEnMenu() {
  const p = await perfilActual();
  const rol = p?.rol ?? 'SIN_PERFIL';

  const etiqueta = document.getElementById('rol-actual');
  if (etiqueta) {
    etiqueta.textContent =
      rol === 'SIN_MIGRACION' ? 'roles no configurados'
      : (p?.rol_nombre ?? rol).toLowerCase();
    etiqueta.className = `rol-chip rol-${rol.toLowerCase()}`;
    etiqueta.title = p?.rol_descripcion ?? '';
  }

  // Sede en la que está operando esta caja. Importa: los comprobantes se
  // numeran por sede, así que el cajero tiene que ver dónde está parado.
  const chipSede = document.getElementById('sede-actual');
  if (chipSede) {
    if (p?.sede_nombre) {
      chipSede.textContent = `${p.sede_codigo ?? ''} · ${p.sede_nombre}`.trim();
      chipSede.classList.remove('hidden');
    } else {
      chipSede.classList.add('hidden');
    }
  }

  await construirMenu(document.getElementById('nav-modulos'));
}
