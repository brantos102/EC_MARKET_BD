-- =========================================================
-- CENTRO DE CONTROL - MARKET
-- DIAGNÓSTICO: ¿qué migraciones están aplicadas?
--
-- Pega esto en el SQL Editor de Supabase y dale Run.
-- No modifica nada, solo reporta.
-- =========================================================

with esperado (orden, migracion, objeto, tipo) as (
  values
    (1, '001 schema.sql',                'productos',                'tabla'),
    (1, '001 schema.sql',                'movimientos_inventario',   'tabla'),
    (1, '001 schema.sql',                'inventario_saldos',        'tabla'),
    (2, '002 catalogos_ubicaciones.sql', 'unidades_medida',          'tabla'),
    (2, '002 catalogos_ubicaciones.sql', 'tarifas_impuesto',         'tabla'),
    (2, '002 catalogos_ubicaciones.sql', 'proveedores',              'tabla'),
    (2, '002 catalogos_ubicaciones.sql', 'clientes',                 'tabla'),
    (2, '002 catalogos_ubicaciones.sql', 'zonas',                    'tabla'),
    (2, '002 catalogos_ubicaciones.sql', 'ubicaciones',              'tabla'),
    (2, '002 catalogos_ubicaciones.sql', 'producto_ubicacion',       'tabla'),
    (2, '002 catalogos_ubicaciones.sql', 'lotes',                    'tabla'),
    (3, '003 ingresos.sql',              'documentos_ingreso',       'tabla'),
    (3, '003 ingresos.sql',              'ingreso_detalle',          'tabla'),
    (3, '003 ingresos.sql',              'secuencias',               'tabla'),
    (4, '004 ventas_promociones.sql',    'promociones',              'tabla'),
    (4, '004 ventas_promociones.sql',    'promocion_alcance',        'tabla'),
    (4, '004 ventas_promociones.sql',    'ventas',                   'tabla'),
    (4, '004 ventas_promociones.sql',    'venta_detalle',            'tabla'),
    (4, '004 ventas_promociones.sql',    'pagos_venta',              'tabla'),
    (5, '005 auditoria_vistas.sql',      'auditoria_log',            'tabla'),
    (5, '005 auditoria_vistas.sql',      'v_stock_actual',           'vista'),
    (5, '005 auditoria_vistas.sql',      'v_alertas_caducidad',      'vista'),
    (5, '005 auditoria_vistas.sql',      'v_ocupacion_layout',       'vista'),
    (5, '005 auditoria_vistas.sql',      'v_pos_productos',          'vista'),
    (5, '005 auditoria_vistas.sql',      'v_ventas_resumen',         'vista'),
    (5, '005 auditoria_vistas.sql',      'v_productos_mas_vendidos', 'vista')
),
estado as (
  select
    e.orden,
    e.migracion,
    e.objeto,
    e.tipo,
    exists (
      select 1 from information_schema.tables t
      where t.table_schema = 'public' and t.table_name = e.objeto
    ) as existe
  from esperado e
)
select
  migracion                                                as "Migración",
  count(*) filter (where existe)::text || ' / ' || count(*)::text as "Objetos presentes",
  case
    when count(*) filter (where not existe) = 0 then 'APLICADA'
    when count(*) filter (where existe) = 0     then 'FALTA — ejecútala'
    else 'INCOMPLETA — vuelve a ejecutarla'
  end                                                      as "Estado",
  coalesce(string_agg(objeto, ', ') filter (where not existe), '—') as "Falta"
from estado
group by orden, migracion
order by orden;

-- ---------------------------------------------------------
-- Contenido real de la base.
-- Se consulta con SQL dinámico porque si una migración falta,
-- sus columnas tampoco existen y una consulta directa fallaría.
-- ---------------------------------------------------------
do $$
declare
  v_productos int := 0;
  v_con_ean int := 0;
  v_zonas int := 0;
  v_ubic int := 0;
  v_lotes int := 0;
  v_ventas int := 0;
begin
  execute 'select count(*) from productos' into v_productos;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='productos' and column_name='ean13') then
    execute 'select count(*) from productos where ean13 is not null' into v_con_ean;
  end if;

  if to_regclass('public.zonas')       is not null then execute 'select count(*) from zonas'       into v_zonas; end if;
  if to_regclass('public.ubicaciones') is not null then execute 'select count(*) from ubicaciones' into v_ubic;  end if;
  if to_regclass('public.lotes')       is not null then execute 'select count(*) from lotes'       into v_lotes; end if;
  if to_regclass('public.ventas')      is not null then execute 'select count(*) from ventas'      into v_ventas; end if;

  raise notice '';
  raise notice '--- CONTENIDO DE LA BASE ---';
  raise notice 'Productos en catálogo : %  (%)', v_productos,
    case when v_productos > 50 then 'seed 006 aplicado'
         when v_productos > 0  then 'solo el seed de ejemplo inicial, falta el 006'
         else 'vacío' end;
  raise notice 'Productos con EAN-13  : %  (%)', v_con_ean,
    case when v_con_ean > 0 then 'ok' else 'falta la migración 002 o el seed 006' end;
  raise notice 'Zonas del market      : %', v_zonas;
  raise notice 'Ubicaciones           : %', v_ubic;
  raise notice 'Lotes con existencia  : %', v_lotes;
  raise notice 'Ventas registradas    : %', v_ventas;
  raise notice '';
end $$;

-- ---------------------------------------------------------
-- Si TODAS las migraciones aparecen como APLICADAS pero la
-- aplicación sigue diciendo "Could not find the table ... in
-- the schema cache", el problema es el caché de PostgREST.
-- Esta línea lo refresca al instante:
-- ---------------------------------------------------------
notify pgrst, 'reload schema';

select 'Caché de esquema recargado. Si el error persiste, la tabla realmente no existe.' as resultado;
