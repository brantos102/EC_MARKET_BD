// Perfil y rol del usuario de la sesión.
//
// El rol se lee de la base con fn_mi_perfil(). La interfaz lo usa para
// esconder lo que no corresponde, pero esconder NO es proteger: quien
// manda son las políticas RLS. Si alguien forzara la navegación a un
// módulo que no le toca, la base de datos igual le negaría los datos.

import { supabase } from '../supabaseClient.js';

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
  const { data, error } = await supabase.rpc('fn_mi_perfil');
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

/** Módulos que cada rol puede ver en el menú. */
const MODULOS_POR_ROL = {
  ADMIN: null,    // null = todos
  BODEGOERO: null,
  BODEGUERO: ['dashboard', 'pos', 'ingresos', 'layout', 'caducidades', 'kardex',
              'movimientos', 'productos', 'bodegas', 'reportes'],
  VENDEDOR: ['dashboard', 'pos', 'layout', 'caducidades', 'promociones', 'kardex'],
};

export function puedeVer(modulo, rol) {
  const permitidos = MODULOS_POR_ROL[rol];
  if (permitidos === null || permitidos === undefined) return true;  // admin o rol desconocido
  return permitidos.includes(modulo);
}

/**
 * Oculta del menú lo que el rol no debe ver y muestra el rol en el pie.
 * Se llama una vez al iniciar sesión.
 */
export async function aplicarRolEnMenu() {
  const p = await perfilActual();
  const rol = p?.rol ?? 'SIN_PERFIL';

  const etiqueta = document.getElementById('rol-actual');
  if (etiqueta) {
    etiqueta.textContent =
      rol === 'SIN_MIGRACION' ? 'roles no configurados' : rol.toLowerCase();
    etiqueta.className = `rol-chip rol-${rol.toLowerCase()}`;
  }

  // Sin la migración 008 aplicada no se esconde nada: sería dejar al
  // usuario sin menú por un problema de instalación, no de permisos.
  if (rol === 'SIN_MIGRACION') return;

  document.querySelectorAll('.nav-link').forEach((link) => {
    const modulo = link.getAttribute('href')?.replace('#', '');
    link.classList.toggle('hidden', !puedeVer(modulo, rol));
  });

  // Un grupo del menú que quedó sin enlaces visibles se oculta también
  document.querySelectorAll('.nav-grupo').forEach((grupo) => {
    let hayVisible = false;
    let el = grupo.nextElementSibling;
    while (el && !el.classList.contains('nav-grupo')) {
      if (el.classList.contains('nav-link') && !el.classList.contains('hidden')) hayVisible = true;
      el = el.nextElementSibling;
    }
    grupo.classList.toggle('hidden', !hayVisible);
  });
}
