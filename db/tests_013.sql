-- =========================================================
-- Pruebas de la migración 013: las vistas respetan RLS
--
-- La parte importante corre como un rol SIN privilegios, igual que la
-- aplicación. Activar security_invoker puede dejar una vista vacía si
-- a la tabla de abajo le falta una política de lectura, y ese fallo
-- solo se ve desde un usuario normal: como superusuario todo sigue
-- devolviendo filas y la prueba mentiría.
--
--   psql -f db/tests_013.sql
-- =========================================================
\set ON_ERROR_STOP on

-- ---------------------------------------------------------
-- Preparación: rol de aplicación, como en tests_rls.sql
-- ---------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_vistas') then
    create role app_vistas login;
  end if;
end $$;

grant usage on schema public to app_vistas;
grant select on all tables in schema public to app_vistas;
grant execute on all functions in schema public to app_vistas;

do $$
declare
  v_id uuid;
begin
  delete from perfiles_usuario where nombre = 'Cajero de vistas';
  delete from auth.users where email = 'vistas@prueba.ec';

  insert into auth.users (id, email) values (gen_random_uuid(), 'vistas@prueba.ec')
  returning id into v_id;

  -- La migración 008 crea el perfil sola con un trigger, así que aquí
  -- solo se le pone el nombre y el rol que necesita la prueba.
  insert into perfiles_usuario (usuario_id, nombre, rol)
  values (v_id, 'Cajero de vistas', 'VENDEDOR')
  on conflict (usuario_id) do update
    set nombre = excluded.nombre, rol = excluded.rol;
end $$;

-- ---------------------------------------------------------
-- Comprobaciones estructurales (como superusuario)
-- ---------------------------------------------------------
do $$
declare
  v_ok int := 0;
  v_sin text;
begin
  -- 1. Ninguna vista de public se salta ya las políticas
  select string_agg(c.relname, ', ') into v_sin
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
    and coalesce(
      (select option_value from pg_options_to_table(c.reloptions)
       where option_name = 'security_invoker'), 'false') not in ('true', 'on');

  if v_sin is not null then
    raise exception 'FALLA 1: siguen en SECURITY DEFINER: %', v_sin;
  end if;
  v_ok := v_ok + 1;

  -- 2. La vista que faltaba existe
  if to_regclass('public.v_lotes_disponibles') is null then
    raise exception 'FALLA 2: falta v_lotes_disponibles';
  end if;
  v_ok := v_ok + 1;

  -- 3. Ninguna función SECURITY DEFINER quedó sin search_path fijo
  select string_agg(p.proname, ', ') into v_sin
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and (p.proconfig is null
         or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));

  if v_sin is not null then
    raise exception 'FALLA 3: funciones SECURITY DEFINER sin search_path: %', v_sin;
  end if;
  v_ok := v_ok + 1;

  -- 4. Toda tabla con RLS tiene política de lectura
  select string_agg(c.relname, ', ') into v_sin
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    and not exists (
      select 1 from pg_policy p where p.polrelid = c.oid and p.polcmd in ('r', '*'));

  if v_sin is not null then
    raise exception 'FALLA 4: tablas con RLS sin política de lectura: %', v_sin;
  end if;
  v_ok := v_ok + 1;

  raise notice 'Comprobaciones estructurales: % de 4 correctas', v_ok;
end $$;

-- ---------------------------------------------------------
-- Lo que de verdad importa: ¿la aplicación sigue viendo datos?
--
-- Se consulta cada vista como app_vistas, con RLS aplicado. Si alguna
-- devuelve cero filas cuando la tabla de abajo sí las tiene, la
-- migración rompió esa pantalla y hay que saberlo aquí.
-- ---------------------------------------------------------
\echo '--- Leyendo las vistas como un usuario sin privilegios ---'

-- El cambio de rol tiene que ir dentro de una transacción: fuera de
-- ella, PostgreSQL avisa y NO cambia el rol, así que la prueba correría
-- como superusuario y pasaría siempre sin probar nada. Ya pasó una vez.
begin;

set local role app_vistas;
select set_config('request.jwt.claim.sub',
                  (select usuario_id::text from perfiles_usuario where nombre = 'Cajero de vistas'),
                  true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v record;
  v_filas int;
  v_vacias text[] := '{}';
  v_leidas int := 0;
begin
  for v in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
    order by c.relname
  loop
    begin
      execute format('select count(*) from public.%I', v.relname) into v_filas;
      v_leidas := v_leidas + 1;
      raise notice '  %  % filas', rpad(v.relname, 26), v_filas;
      if v_filas = 0 then
        v_vacias := v_vacias || v.relname;
      end if;
    exception when others then
      raise exception 'FALLA: la vista % no se puede consultar como usuario normal: %',
        v.relname, sqlerrm;
    end;
  end loop;

  raise notice '';
  raise notice 'Vistas consultadas sin error: %', v_leidas;

  -- Estas cuatro sí pueden estar vacías en una base recién sembrada:
  -- no hay ventas, ni servicios, ni órdenes, ni productos bajo mínimo.
  v_vacias := array(
    select x from unnest(v_vacias) x
    where x not in ('v_ventas_resumen', 'v_productos_mas_vendidos',
                    'v_resumen_mensual', 'v_servicios_detalle',
                    'v_sugerencia_reposicion', 'v_comprobante'));

  if array_length(v_vacias, 1) > 0 then
    raise exception
      'FALLA: estas vistas quedaron vacías para un usuario normal, así que la '
      'pantalla que las usa salió en blanco: %. Falta política de lectura en alguna '
      'de sus tablas.', array_to_string(v_vacias, ', ');
  end if;

  raise notice 'Ninguna vista quedó vacía por culpa de las políticas.';
end $$;

-- Se comprueba, dentro de la misma transacción, que el cambio de rol
-- surtió efecto. Sin esto la sección entera podría estar corriendo como
-- superusuario y las comprobaciones no valdrían nada.
do $$
begin
  if current_user <> 'app_vistas' then
    raise exception
      'FALLA: la prueba está corriendo como "%" y no como app_vistas, así que no '
      'comprobó nada. Revise el cambio de rol.', current_user;
  end if;
end $$;

commit;
reset role;

-- ---------------------------------------------------------
-- Y la comprobación inversa: que security_invoker esté HACIENDO algo.
--
-- Si la opción no tuviera efecto, esta prueba pasaría igual y no
-- probaría nada. Se crea una tabla con RLS que no deja ver nada, una
-- vista encima, y se comprueba que la vista tampoco deja ver nada.
-- ---------------------------------------------------------
do $$
declare
  v_filas int;
begin
  drop view if exists v_prueba_invoker cascade;
  drop table if exists tabla_prueba_invoker cascade;

  create table tabla_prueba_invoker (id int primary key, dato text);
  insert into tabla_prueba_invoker values (1, 'secreto'), (2, 'otro secreto');

  alter table tabla_prueba_invoker enable row level security;
  -- RLS activado y ninguna política: nadie normal debería ver nada.

  execute 'create view v_prueba_invoker with (security_invoker = true)
           as select * from tabla_prueba_invoker';

  grant select on tabla_prueba_invoker, v_prueba_invoker to app_vistas;

  -- Como superusuario sí se ven las dos filas
  select count(*) into v_filas from v_prueba_invoker;
  if v_filas <> 2 then
    raise exception 'FALLA 5: el superusuario debería ver las 2 filas, vio %', v_filas;
  end if;
end $$;

begin;
set local role app_vistas;

do $$
declare
  v_filas int;
begin
  if current_user <> 'app_vistas' then
    raise exception 'FALLA: no se cambió de rol, la prueba no comprobaría nada';
  end if;

  select count(*) into v_filas from v_prueba_invoker;
  if v_filas <> 0 then
    raise exception
      'FALLA 6: security_invoker no está surtiendo efecto. Un usuario sin política '
      'vio % filas a través de la vista, cuando debería ver 0.', v_filas;
  end if;
  raise notice 'security_invoker comprobado: la vista respeta RLS de verdad.';
end $$;

commit;
reset role;

drop view if exists v_prueba_invoker cascade;
drop table if exists tabla_prueba_invoker cascade;

select 'tests_013: OK' as resultado;
