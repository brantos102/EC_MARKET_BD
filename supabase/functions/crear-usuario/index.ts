// Alta de usuarios desde la pantalla de Administración.
//
// EL PROBLEMA: crear una cuenta en Supabase Auth exige la clave de
// servicio del proyecto, que abre la base entera saltándose RLS. Esa
// clave no puede estar en el navegador. Por eso la pantalla de
// Administración no creaba usuarios y había que ir a Supabase a mano.
//
// LA SOLUCIÓN: esta función corre en el servidor, guarda la clave como
// secreto y, antes de crear nada, comprueba tres cosas:
//   1. Que quien llama traiga una sesión válida (su token JWT).
//   2. Que esa sesión pertenezca a un usuario con rol ADMIN.
//   3. Que el rol y la sede que pide sean válidos.
// Sin las tres, no crea nada. Un vendedor que descubra la dirección de
// la función y la llame a mano recibe un 403.
//
// Despliegue:
//   supabase functions deploy crear-usuario
//   (la clave de servicio y la URL las inyecta Supabase solo)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ROLES_VALIDOS = ['ADMIN', 'SUPERVISOR', 'BODEGUERO', 'VENDEDOR'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // ---- 1. ¿Quién llama? ----
  const autorizacion = req.headers.get('Authorization') ?? '';
  if (!autorizacion.startsWith('Bearer ')) {
    return json({ error: 'Falta la sesión' }, 401);
  }

  // Cliente que actúa como el usuario que llama, para leer su perfil
  // pasando por RLS igual que lo haría la aplicación.
  const comoUsuario = createClient(url, anon, {
    global: { headers: { Authorization: autorizacion } },
  });

  const { data: { user }, error: errUser } = await comoUsuario.auth.getUser();
  if (errUser || !user) return json({ error: 'Sesión no válida' }, 401);

  // ---- 2. ¿Es administrador? ----
  const { data: perfil } = await comoUsuario
    .from('perfiles_usuario')
    .select('rol, activo')
    .eq('usuario_id', user.id)
    .maybeSingle();

  if (perfil?.rol !== 'ADMIN' || !perfil?.activo) {
    return json({ error: 'Solo un administrador activo puede crear usuarios' }, 403);
  }

  // ---- 3. ¿Los datos son válidos? ----
  let cuerpo: { email?: string; password?: string; nombre?: string; rol?: string; sede_id?: string };
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: 'El cuerpo de la petición no es JSON válido' }, 400);
  }

  const email = (cuerpo.email ?? '').trim().toLowerCase();
  const password = cuerpo.password ?? '';
  const nombre = (cuerpo.nombre ?? '').trim();
  const rol = (cuerpo.rol ?? 'VENDEDOR').toUpperCase();

  if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(email)) {
    return json({ error: 'El correo no tiene un formato válido' }, 400);
  }
  if (password.length < 8) {
    return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
  }
  if (!nombre) {
    return json({ error: 'El nombre del usuario es obligatorio' }, 400);
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return json({ error: `Rol no válido. Use uno de: ${ROLES_VALIDOS.join(', ')}` }, 400);
  }

  // ---- 4. Crear la cuenta ----
  const admin = createClient(url, servicio, { auth: { persistSession: false } });

  const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,          // el dueño ya verificó quién es la persona
    user_metadata: { nombre },
  });

  if (errCrear) {
    const mensaje = /already registered|already been registered/i.test(errCrear.message)
      ? 'Ya existe un usuario con ese correo'
      : errCrear.message;
    return json({ error: mensaje }, 400);
  }

  // ---- 5. Perfil con su rol y su sede ----
  // El trigger de la migración 008 crea el perfil solo; aquí se ajusta al
  // rol y la sede que eligió el administrador.
  const { error: errPerfil } = await admin.from('perfiles_usuario').upsert({
    usuario_id: creado.user!.id,
    nombre,
    rol,
    sede_id: cuerpo.sede_id ?? null,
    activo: true,
    creado_por: user.id,
  }, { onConflict: 'usuario_id' });

  if (errPerfil) {
    // Si el perfil no se pudo dejar bien, se borra la cuenta para no
    // dejar un usuario a medio crear que después nadie entiende.
    await admin.auth.admin.deleteUser(creado.user!.id);
    return json({ error: `Cuenta revertida: ${errPerfil.message}` }, 500);
  }

  return json({ ok: true, usuario_id: creado.user!.id, email, rol });
});

function json(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
