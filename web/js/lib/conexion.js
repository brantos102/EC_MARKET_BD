// A qué base se conecta esta copia del sistema.
//
// POR QUÉ NO BASTA config.js: el mismo paquete se instala en varios
// negocios. Obligar a editar un archivo JavaScript antes de cada
// instalación es pedirle a quien instala que programe, y basta un
// paréntesis mal puesto para dejar la aplicación en blanco sin ninguna
// pista de por qué.
//
// Así que la conexión se puede fijar desde la propia pantalla, y lo que
// se guarde en el navegador manda sobre lo que trae config.js. El
// archivo sigue siendo el valor de fábrica: si alguien borra los datos
// del navegador, la aplicación vuelve a la conexión de origen en vez de
// quedarse muerta.
//
// Lo que se guarda aquí es la URL del proyecto y la clave pública
// (anon). Esa clave está diseñada para ser pública: lo que protege los
// datos son las políticas RLS. La clave de servicio no entra aquí nunca.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

const CLAVE = 'elcultivo.conexion';

function leerGuardada() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const c = JSON.parse(crudo);
    if (c?.url && c?.anonKey) return c;
  } catch {
    // Navegador con almacenamiento bloqueado: se usa config.js y ya.
  }
  return null;
}

/** Conexión efectiva: la guardada si existe, si no la de fábrica. */
export function conexionActual() {
  const guardada = leerGuardada();
  return {
    url: guardada?.url ?? SUPABASE_URL,
    anonKey: guardada?.anonKey ?? SUPABASE_ANON_KEY,
    origen: guardada ? 'configurada' : 'archivo',
    etiqueta: guardada?.etiqueta ?? null,
  };
}

export function hayConexionConfigurada() {
  return leerGuardada() !== null;
}

/** Valida la forma de los datos antes de guardarlos. */
export function validarConexion(url, anonKey) {
  const problemas = [];

  let u;
  try {
    u = new URL(String(url).trim());
  } catch {
    problemas.push('La dirección del proyecto no es una URL válida. Debe verse como https://abcdefgh.supabase.co');
    return problemas;
  }

  if (u.protocol !== 'https:') {
    problemas.push('La dirección debe empezar con https://. Sin cifrado, las claves y las ventas viajarían en claro por la red.');
  }
  if (u.pathname !== '/' && u.pathname !== '') {
    problemas.push('Ponga solo el dominio del proyecto, sin nada después de .co');
  }

  const clave = String(anonKey ?? '').trim();
  if (clave.length < 20) {
    problemas.push('La clave pública parece incompleta.');
  }
  // La clave de servicio abre la base entera saltándose RLS. Si alguien
  // la pega aquí por error, acabaría publicada en el navegador de cada
  // caja. Vale la pena detectarla y rechazarla con nombre y apellido.
  if (/^sb_secret_/.test(clave) || /service_role/.test(clave)) {
    problemas.push(
      'Esa es la clave SECRETA (service_role). No la use aquí: abre la base entera ' +
      'saltándose todos los permisos, y en el navegador queda a la vista de cualquiera. ' +
      'Use la clave pública (anon / publishable).');
  }

  return problemas;
}

/**
 * Comprueba que la base responde de verdad antes de guardar.
 *
 * Se pregunta por el estado de la instalación porque es una función
 * abierta al rol anónimo: sirve para distinguir "la base no existe" de
 * "la base existe pero le faltan migraciones", que son dos problemas
 * muy distintos y el instalador debe decir cuál es.
 */
export async function probarConexion(url, anonKey) {
  const base = String(url).trim().replace(/\/+$/, '');
  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), 12000);

  try {
    const r = await fetch(`${base}/rest/v1/rpc/fn_estado_instalacion`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
      signal: control.signal,
    });

    if (r.status === 401 || r.status === 403) {
      return { ok: false, mensaje: 'La base respondió, pero rechazó la clave pública. Revise que sea la del mismo proyecto.' };
    }
    if (r.status === 404) {
      return {
        ok: false,
        migracionesFaltantes: true,
        mensaje: 'El proyecto existe pero le faltan las migraciones: no encuentra fn_estado_instalacion. ' +
                 'Aplique los archivos de db/ en orden desde el SQL Editor de Supabase y vuelva a probar.',
      };
    }
    if (!r.ok) {
      return { ok: false, mensaje: `La base respondió con un error ${r.status}.` };
    }

    const cuerpo = await r.json();
    const estado = Array.isArray(cuerpo) ? cuerpo[0] : cuerpo;
    return {
      ok: true,
      instalada: Boolean(estado?.completada),
      tipoNegocio: estado?.tipo_negocio ?? null,
      hayUsuarios: Boolean(estado?.hay_usuarios),
      mensaje: estado?.completada
        ? `Conectado. El sistema ya está instalado como ${estado.tipo_negocio}.`
        : 'Conectado. La base está lista y todavía sin instalar.',
    };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, mensaje: 'La base no respondió en 12 segundos. Revise la dirección y su conexión a internet.' };
    }
    return {
      ok: false,
      mensaje: `No se pudo contactar la base (${err.message}). ` +
               'Si la dirección es correcta, puede ser que el dominio de esta página no esté ' +
               'autorizado en Supabase → Settings → API → CORS.',
    };
  } finally {
    clearTimeout(corte);
  }
}

export function guardarConexion(url, anonKey, etiqueta = null) {
  const datos = {
    url: String(url).trim().replace(/\/+$/, ''),
    anonKey: String(anonKey).trim(),
    etiqueta,
    guardada_at: new Date().toISOString(),
  };
  localStorage.setItem(CLAVE, JSON.stringify(datos));
  return datos;
}

export function olvidarConexion() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento no había nada guardado que olvidar.
  }
}
