// Configuración pública del proyecto Supabase.
//
// La "anon/publishable key" está diseñada para ser pública: la seguridad
// real la da Row Level Security (RLS), definido en db/schema.sql — no la
// confidencialidad de esta clave. NUNCA coloques aquí la "service_role /
// secret key": esa clave sí es privada y solo debe usarse en un backend
// de confianza (nunca en código que corre en el navegador).
export const SUPABASE_URL = 'https://bhomrrmhbcnyqrdzoiqt.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_IKodlEbuU7N61WysvByHcQ_eqdmKEX3';
