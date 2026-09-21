-- =========================================================
-- CENTRO DE CONTROL
-- Migración 013: las vistas dejan de saltarse RLS
--
-- QUÉ PROBLEMA RESUELVE
--
-- El analizador de seguridad de Supabase marcó ocho vistas como
-- CRITICAL: "Security Definer View". No es un falso positivo.
--
-- En PostgreSQL, una vista se ejecuta por defecto con los permisos de
-- QUIEN LA CREÓ, no de quien la consulta. Como todas estas vistas las
-- creó el dueño del esquema, cualquier usuario autenticado que las
-- consultara veía TODAS las filas de las tablas de abajo, aunque las
-- políticas RLS de esas tablas dijeran otra cosa.
--
-- En la práctica, hoy, el daño era limitado: las políticas de lectura
-- del sistema permiten a cualquier autenticado leer el catálogo y el
-- stock. Pero el agujero es real y crece solo: el día que se restrinja
-- una tabla por sede o por rol —algo que ya empezó con las sedes— la
-- restricción no se aplicaría a través de las vistas, y nadie se
-- enteraría porque desde la aplicación todo "funciona".
--
-- LA CORRECCIÓN es una opción de la vista, disponible desde PostgreSQL
-- 15: security_invoker. Con ella, la vista consulta con los permisos
-- del usuario que la llama, así que las políticas de las tablas de
-- abajo se aplican como corresponde.
--
-- Requiere: 012_estructuras_servicios.sql
-- =========================================================

-- ---------------------------------------------------------
-- PARTE 1 — security_invoker en todas las vistas del esquema
--
-- Se recorren todas las vistas de public en vez de nombrarlas una por
-- una: así cubre también las que se agreguen en el futuro cuando se
-- vuelva a ejecutar esta migración, y no hay forma de olvidarse de
-- ninguna.
-- ---------------------------------------------------------
do $$
declare
  v record;
  v_corregidas int := 0;
begin
  if current_setting('server_version_num')::int < 150000 then
    raise notice 'PostgreSQL % no admite security_invoker (hace falta la 15). Se omite.',
      current_setting('server_version');
    return;
  end if;

  for v in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and coalesce(
        (select option_value from pg_options_to_table(c.reloptions)
         where option_name = 'security_invoker'), 'false') not in ('true', 'on')
    order by c.relname
  loop
    execute format('alter view public.%I set (security_invoker = true)', v.relname);
    v_corregidas := v_corregidas + 1;
    raise notice '  security_invoker activado en %', v.relname;
  end loop;

  raise notice 'Vistas corregidas: %', v_corregidas;
end $$;

-- ---------------------------------------------------------
-- PARTE 2 — La vista de lotes que faltaba
--
-- El detalle de una posición en el mapa pedía v_lotes_disponibles, y
-- esa vista nunca se creó: el módulo mostraba "no se pudieron leer los
-- lotes" sin que nadie supiera por qué. Se crea aquí, ya con
-- security_invoker.
-- ---------------------------------------------------------
drop view if exists v_lotes_disponibles cascade;
create view v_lotes_disponibles
with (security_invoker = true)
as
select
  l.id as lote_id,
  l.producto_id,
  p.codigo as producto_codigo,
  p.nombre as producto,
  l.bodega_id,
  b.nombre as bodega,
  l.codigo_lote,
  l.fecha_caducidad,
  l.cantidad_inicial,
  l.cantidad_disponible,
  l.costo_unitario,
  case
    when l.fecha_caducidad is null then null
    else (l.fecha_caducidad - current_date)
  end as dias_para_caducar,
  case
    when l.fecha_caducidad is null then 'SIN_CADUCIDAD'
    when l.fecha_caducidad < current_date then 'VENCIDO'
    when l.fecha_caducidad <= current_date + coalesce(p.dias_alerta_caducidad, 7) then 'POR_VENCER'
    else 'VIGENTE'
  end as estado_caducidad
from lotes l
join productos p on p.id = l.producto_id
left join bodegas b on b.id = l.bodega_id
where l.cantidad_disponible > 0
order by l.fecha_caducidad nulls last, l.created_at;

comment on view v_lotes_disponibles is
  'Lotes con existencia, ordenados por caducidad (FEFO). La usa el detalle de posición del mapa.';

-- ---------------------------------------------------------
-- PARTE 3 — Comprobación de que no se rompió la lectura
--
-- Activar security_invoker puede dejar una vista vacía si a la tabla de
-- abajo le falta una política de lectura. Es mejor enterarse ahora, con
-- un aviso en el SQL Editor, que el lunes cuando el cajero abra la caja
-- y no vea productos.
-- ---------------------------------------------------------
do $$
declare
  v record;
  v_sin_politica text[] := '{}';
begin
  for v in
    select c.relname as tabla
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity                       -- tiene RLS activado
      and not exists (
        select 1 from pg_policy p
        where p.polrelid = c.oid
          and p.polcmd in ('r', '*')             -- SELECT o ALL
      )
    order by c.relname
  loop
    v_sin_politica := v_sin_politica || v.tabla;
  end loop;

  if array_length(v_sin_politica, 1) > 0 then
    raise warning
      'Estas tablas tienen RLS sin política de lectura, así que ahora saldrán vacías '
      'a través de las vistas: %. Revise las políticas antes de usar el sistema.',
      array_to_string(v_sin_politica, ', ');
  else
    raise notice 'Todas las tablas con RLS tienen política de lectura. Las vistas seguirán devolviendo datos.';
  end if;
end $$;

-- ---------------------------------------------------------
-- PARTE 4 — Funciones sin search_path fijo
--
-- El mismo analizador avisa de las funciones SECURITY DEFINER sin
-- search_path fijo: una función así puede ser engañada para ejecutar
-- código de otro esquema. Las de las migraciones anteriores ya lo
-- traen; esto barre las que se hayan quedado atrás.
-- ---------------------------------------------------------
do $$
declare
  f record;
  v_corregidas int := 0;
begin
  for f in
    select p.oid::regprocedure as firma, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef                              -- SECURITY DEFINER
      and (p.proconfig is null
           or not exists (
             select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
  loop
    execute format('alter function %s set search_path = public', f.firma);
    v_corregidas := v_corregidas + 1;
    raise notice '  search_path fijado en %', f.proname;
  end loop;

  raise notice 'Funciones corregidas: %', v_corregidas;
end $$;

notify pgrst, 'reload schema';

select 'Migración 013 aplicada: las vistas respetan RLS y se agregó v_lotes_disponibles.' as resultado;
