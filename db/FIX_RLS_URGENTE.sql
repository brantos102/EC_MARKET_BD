-- =========================================================
-- ARREGLO URGENTE — "new row violates row-level security
-- policy for table inventario_saldos"
--
-- Pega TODO este archivo en Supabase → SQL Editor → Run.
-- Es corto, no borra datos y se puede ejecutar varias veces.
-- Al final imprime una verificación: si dice OK, ya quedó.
--
-- QUÉ ESTÁ PASANDO
-- Los triggers que mantienen la tabla inventario_saldos corrían con
-- los permisos del usuario que hace la operación. Esa tabla tiene RLS
-- y no tiene política de escritura (a propósito: nadie debe tocar los
-- saldos a mano), así que el propio motor de costeo se quedaba
-- bloqueado y fallaba todo ajuste, ingreso o venta.
--
-- POR QUÉ NO SE ARREGLA APAGANDO RLS
-- La anon key está en el JavaScript, o sea que es pública. RLS es lo
-- ÚNICO que impide que cualquiera con esa clave lea o borre todo tu
-- inventario. Apagarlo deja la base abierta a internet.
--
-- LA SOLUCIÓN CORRECTA
-- Marcar esas funciones como SECURITY DEFINER: son lógica del sistema,
-- no entrada del usuario, así que corren con los permisos del dueño del
-- esquema. RLS sigue protegiendo todo lo demás.
-- =========================================================

do $$
declare
  v_funciones text[] := array[
    'fn_procesar_movimiento_inventario()',
    'fn_procesar_confirmacion_venta()',
    'fn_confirmar_ingreso()',
    'fn_recalcular_totales_venta()',
    'fn_recalcular_totales_ingreso()',
    'fn_calcular_linea_venta()',
    'fn_verificar_pago_venta()',
    'fn_consumir_lotes_fefo(uuid, uuid, numeric)'
  ];
  f text;
  v_nombre text;
begin
  foreach f in array v_funciones loop
    v_nombre := split_part(f, '(', 1);
    -- Solo se toca lo que exista: así el archivo sirve aunque falten
    -- migraciones posteriores.
    if exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = v_nombre
    ) then
      execute format('alter function %s security definer', f);
      execute format('alter function %s set search_path = public', f);
      raise notice 'Corregida: %', v_nombre;
    else
      raise notice 'No existe todavía (se omite): %', v_nombre;
    end if;
  end loop;
end $$;

-- Refrescar el caché de esquema de la API
notify pgrst, 'reload schema';

-- ---------------------------------------------------------
-- VERIFICACIÓN — lee la columna "Resultado"
-- ---------------------------------------------------------
select
  p.proname as "Función",
  case when p.prosecdef then 'OK — corregida' else 'FALTA' end as "Resultado"
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'fn_procesar_movimiento_inventario',
    'fn_procesar_confirmacion_venta',
    'fn_confirmar_ingreso',
    'fn_consumir_lotes_fefo'
  )
order by p.proname;

-- Si todas dicen "OK — corregida", ya puedes registrar ajustes,
-- ingresos y ventas. Si alguna dice FALTA, avísame con esta salida.
