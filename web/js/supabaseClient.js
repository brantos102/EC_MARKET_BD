// La librería de Supabase se sirve localmente (web/js/vendor/supabase.umd.js,
// cargada como <script> clásico en index.html) en lugar de un CDN externo,
// para que la app no dependa de terceros ni de que el navegador del usuario
// tenga salida a internet hacia un CDN.
const { createClient } = window.supabase;

import { conexionActual } from './lib/conexion.js';

// La conexión sale de lo que se haya configurado en esta instalación y,
// si no hay nada configurado, de config.js. Ver lib/conexion.js.
const { url, anonKey } = conexionActual();

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
