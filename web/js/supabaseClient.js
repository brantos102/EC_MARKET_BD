// La librería de Supabase se sirve localmente (web/js/vendor/supabase.umd.js,
// cargada como <script> clásico en index.html) en lugar de un CDN externo,
// para que la app no dependa de terceros ni de que el navegador del usuario
// tenga salida a internet hacia un CDN.
const { createClient } = window.supabase;
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
