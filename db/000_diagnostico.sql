-- =========================================================
-- CENTRO DE CONTROL
-- DIAGNÓSTICO: ¿qué migraciones están aplicadas?
--
-- Pega esto en el SQL Editor de Supabase y dale Run.
-- No modifica nada: solo reporta y refresca el caché al final.
--
-- La primera tabla dice el estado de cada migración. Debajo, en la
-- pestaña de mensajes, sale la lista exacta de archivos que faltan por
-- ejecutar, en orden.
-- =========================================================

with esperado (orden, archivo, objeto, tipo) as (
  values
    -- 001 --------------------------------------------------
    (1,  'db/schema.sql',                    'productos',                'tabla'),
    (1,  'db/schema.sql',                    'bodegas',                  'tabla'),
    (1,  'db/schema.sql',                    'categorias',               'tabla'),
    (1,  'db/schema.sql',                    'movimientos_inventario',   'tabla'),
    (1,  'db/schema.sql',                    'inventario_saldos',        'tabla'),
    -- 002 --------------------------------------------------
    (2,  'db/002_catalogos_ubicaciones.sql', 'unidades_medida',          'tabla'),
    (2,  'db/002_catalogos_ubicaciones.sql', 'tarifas_impuesto',         'tabla'),
    (2,  'db/002_catalogos_ubicaciones.sql', 'proveedores',              'tabla'),
    (2,  'db/002_catalogos_ubicaciones.sql', 'clientes',                 'tabla'),
    (2,  'db/002_catalogos_ubicaciones.sql', 'zonas',                    'tabla'),
    (2,  'db/002_catalogos_ubicaciones.sql', 'ubicaciones',              'tabla'),
    (2,  'db/002_catalogos_ubicaciones.sql', 'producto_ubicacion',       'tabla'),
    (2,  'db/002_catalogos_ubicaciones.sql', 'lotes',                    'tabla'),
    -- 003 --------------------------------------------------
    (3,  'db/003_ingresos.sql',              'documentos_ingreso',       'tabla'),
    (3,  'db/003_ingresos.sql',              'ingreso_detalle',          'tabla'),
    (3,  'db/003_ingresos.sql',              'secuencias',               'tabla'),
    -- 004 --------------------------------------------------
    (4,  'db/004_ventas_promociones.sql',    'promociones',              'tabla'),
    (4,  'db/004_ventas_promociones.sql',    'promocion_alcance',        'tabla'),
    (4,  'db/004_ventas_promociones.sql',    'ventas',                   'tabla'),
    (4,  'db/004_ventas_promociones.sql',    'venta_detalle',            'tabla'),
    (4,  'db/004_ventas_promociones.sql',    'pagos_venta',              'tabla'),
    -- 005 --------------------------------------------------
    (5,  'db/005_auditoria_vistas.sql',      'auditoria_log',            'tabla'),
    (5,  'db/005_auditoria_vistas.sql',      'v_stock_actual',           'vista'),
    (5,  'db/005_auditoria_vistas.sql',      'v_alertas_caducidad',      'vista'),
    (5,  'db/005_auditoria_vistas.sql',      'v_ocupacion_layout',       'vista'),
    (5,  'db/005_auditoria_vistas.sql',      'v_pos_productos',          'vista'),
    (5,  'db/005_auditoria_vistas.sql',      'v_ventas_resumen',         'vista'),
    (5,  'db/005_auditoria_vistas.sql',      'v_productos_mas_vendidos', 'vista'),
    -- 008 (la 006 es catálogo de ejemplo y la 007 no crea tablas) ----
    (8,  'db/008_roles_seguridad.sql',       'empresa',                  'tabla'),
    (8,  'db/008_roles_seguridad.sql',       'perfiles_usuario',         'tabla'),
    (8,  'db/008_roles_seguridad.sql',       'tokens_autorizacion',      'tabla'),
    (8,  'db/008_roles_seguridad.sql',       'tokens_uso',               'tabla'),
    -- 009 --------------------------------------------------
    (9,  'db/009_comprobantes_clientes.sql', 'v_comprobante',            'vista'),
    -- 010 --------------------------------------------------
    (10, 'db/010_operacion_multisede.sql',   'sedes',                    'tabla'),
    (10, 'db/010_operacion_multisede.sql',   'roles_catalogo',           'tabla'),
    (10, 'db/010_operacion_multisede.sql',   'modulos_sistema',          'tabla'),
    (10, 'db/010_operacion_multisede.sql',   'permisos_rol',             'tabla'),
    (10, 'db/010_operacion_multisede.sql',   'correo_config',            'tabla'),
    (10, 'db/010_operacion_multisede.sql',   'plantillas_correo',        'tabla'),
    (10, 'db/010_operacion_multisede.sql',   'cola_correo',              'tabla'),
    (10, 'db/010_operacion_multisede.sql',   'ordenes_compra',           'tabla'),
    (10, 'db/010_operacion_multisede.sql',   'orden_compra_detalle',     'tabla'),
    (10, 'db/010_operacion_multisede.sql',   'v_sugerencia_reposicion',  'vista'),
    -- 011 --------------------------------------------------
    (11, 'db/011_instalacion_deuna.sql',     'tipos_negocio',            'tabla'),
    (11, 'db/011_instalacion_deuna.sql',     'instalacion',              'tabla'),
    (11, 'db/011_instalacion_deuna.sql',     'deuna_transacciones',      'tabla'),
    -- 012 --------------------------------------------------
    (12, 'db/012_estructuras_servicios.sql', 'tipos_estructura',         'tabla'),
    (12, 'db/012_estructuras_servicios.sql', 'estructuras',              'tabla'),
    (12, 'db/012_estructuras_servicios.sql', 'servicios_catalogo',       'tabla'),
    (12, 'db/012_estructuras_servicios.sql', 'ventas_servicio',          'tabla'),
    (12, 'db/012_estructuras_servicios.sql', 'accesos_externos',         'tabla'),
    (12, 'db/012_estructuras_servicios.sql', 'v_estructuras_ocupacion',  'vista'),
    (12, 'db/012_estructuras_servicios.sql', 'v_posiciones',             'vista'),
    (12, 'db/012_estructuras_servicios.sql', 'v_servicios_detalle',      'vista'),
    (12, 'db/012_estructuras_servicios.sql', 'v_resumen_mensual',        'vista'),
    -- 013 --------------------------------------------------
    (13, 'db/013_seguridad_vistas.sql',      'v_lotes_disponibles',      'vista'),
    -- 014 --------------------------------------------------
    -- Esta no crea tablas: agrega una columna y rehace una vista. Se
    -- comprueba la columna, que es lo único que prueba que se ejecutó.
    (14, 'db/014_impresion_termica.sql',     'empresa.ancho_papel_mm',   'columna'),
    -- 015 --------------------------------------------------
    (15, 'db/015_presentaciones_codigos.sql', 'presentaciones',          'tabla'),
    (15, 'db/015_presentaciones_codigos.sql', 'producto_codigos',        'tabla'),
    (15, 'db/015_presentaciones_codigos.sql', 'v_stock_presentacion',    'vista'),
    (15, 'db/015_presentaciones_codigos.sql', 'v_producto_codigos',      'vista'),
    (15, 'db/015_presentaciones_codigos.sql', 'v_recepcion_vs_orden',    'vista'),
    (15, 'db/015_presentaciones_codigos.sql', 'ingreso_detalle.presentacion_id', 'columna'),
    (15, 'db/015_presentaciones_codigos.sql', 'empresa.margen_menor',    'columna'),
    -- 016 --------------------------------------------------
    (16, 'db/016_plano_editable.sql',        'sedes.ancho_local_cm',     'columna'),
    (16, 'db/016_plano_editable.sql',        'estructuras.calle',        'columna'),
    -- 017 --------------------------------------------------
    (17, 'db/017_facturas_proveedor.sql',    'proveedor_producto',       'tabla'),
    (17, 'db/017_facturas_proveedor.sql',    'documentos_ingreso.clave_acceso', 'columna')
),
estado as (
  select
    e.orden,
    e.archivo,
    e.objeto,
    e.tipo,
    case e.tipo
      when 'columna' then exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name   = split_part(e.objeto, '.', 1)
          and column_name  = split_part(e.objeto, '.', 2))
      else to_regclass('public.' || e.objeto) is not null
    end as existe
  from esperado e
)
select
  archivo                                                        as "Archivo a ejecutar",
  count(*) filter (where existe)::text || ' / ' || count(*)::text as "Objetos presentes",
  case
    when count(*) filter (where not existe) = 0 then 'APLICADA'
    when count(*) filter (where existe) = 0     then 'FALTA — ejecútala'
    else 'INCOMPLETA — vuelve a ejecutarla'
  end                                                            as "Estado",
  coalesce(string_agg(objeto, ', ' order by objeto) filter (where not existe), '—') as "Qué falta"
from estado
group by orden, archivo
order by orden;

-- =========================================================
-- Resumen en palabras, en la pestaña de mensajes
-- =========================================================
do $$
declare
  m record;
  i int;
  v_faltan text[] := '{}';
  v_incompletas text[] := '{}';
begin
  raise notice '';
  raise notice '=========================================================';
  raise notice ' DIAGNÓSTICO DEL SISTEMA';
  raise notice '=========================================================';

  for m in
    with esperado (orden, archivo, objeto) as (
      values
        (1,'db/schema.sql','productos'),(1,'db/schema.sql','bodegas'),
        (1,'db/schema.sql','categorias'),(1,'db/schema.sql','movimientos_inventario'),
        (1,'db/schema.sql','inventario_saldos'),
        (2,'db/002_catalogos_ubicaciones.sql','unidades_medida'),
        (2,'db/002_catalogos_ubicaciones.sql','tarifas_impuesto'),
        (2,'db/002_catalogos_ubicaciones.sql','proveedores'),
        (2,'db/002_catalogos_ubicaciones.sql','clientes'),
        (2,'db/002_catalogos_ubicaciones.sql','zonas'),
        (2,'db/002_catalogos_ubicaciones.sql','ubicaciones'),
        (2,'db/002_catalogos_ubicaciones.sql','producto_ubicacion'),
        (2,'db/002_catalogos_ubicaciones.sql','lotes'),
        (3,'db/003_ingresos.sql','documentos_ingreso'),
        (3,'db/003_ingresos.sql','ingreso_detalle'),
        (3,'db/003_ingresos.sql','secuencias'),
        (4,'db/004_ventas_promociones.sql','promociones'),
        (4,'db/004_ventas_promociones.sql','ventas'),
        (4,'db/004_ventas_promociones.sql','venta_detalle'),
        (4,'db/004_ventas_promociones.sql','pagos_venta'),
        (5,'db/005_auditoria_vistas.sql','auditoria_log'),
        (5,'db/005_auditoria_vistas.sql','v_stock_actual'),
        (5,'db/005_auditoria_vistas.sql','v_pos_productos'),
        (8,'db/008_roles_seguridad.sql','empresa'),
        (8,'db/008_roles_seguridad.sql','perfiles_usuario'),
        (8,'db/008_roles_seguridad.sql','tokens_autorizacion'),
        (9,'db/009_comprobantes_clientes.sql','v_comprobante'),
        (10,'db/010_operacion_multisede.sql','sedes'),
        (10,'db/010_operacion_multisede.sql','roles_catalogo'),
        (10,'db/010_operacion_multisede.sql','modulos_sistema'),
        (10,'db/010_operacion_multisede.sql','permisos_rol'),
        (10,'db/010_operacion_multisede.sql','cola_correo'),
        (10,'db/010_operacion_multisede.sql','ordenes_compra'),
        (11,'db/011_instalacion_deuna.sql','tipos_negocio'),
        (11,'db/011_instalacion_deuna.sql','instalacion'),
        (12,'db/012_estructuras_servicios.sql','estructuras'),
        (12,'db/012_estructuras_servicios.sql','tipos_estructura'),
        (12,'db/012_estructuras_servicios.sql','servicios_catalogo'),
        (12,'db/012_estructuras_servicios.sql','ventas_servicio'),
        (12,'db/012_estructuras_servicios.sql','v_estructuras_ocupacion'),
        (12,'db/012_estructuras_servicios.sql','v_posiciones'),
        (13,'db/013_seguridad_vistas.sql','v_lotes_disponibles'),
        -- La 014 no crea tablas: se reconoce por la columna que agrega.
        (14,'db/014_impresion_termica.sql','empresa.ancho_papel_mm'),
        (15,'db/015_presentaciones_codigos.sql','presentaciones'),
        (15,'db/015_presentaciones_codigos.sql','producto_codigos'),
        (15,'db/015_presentaciones_codigos.sql','v_stock_presentacion'),
        (15,'db/015_presentaciones_codigos.sql','empresa.margen_menor'),
        (16,'db/016_plano_editable.sql','sedes.ancho_local_cm'),
        (16,'db/016_plano_editable.sql','estructuras.calle'),
        (17,'db/017_facturas_proveedor.sql','proveedor_producto'),
        (17,'db/017_facturas_proveedor.sql','documentos_ingreso.clave_acceso')
    )
    select e.orden, e.archivo,
           count(*) as total,
           count(*) filter (
             where case when e.objeto like '%.%'
               then exists (select 1 from information_schema.columns
                            where table_schema = 'public'
                              and table_name   = split_part(e.objeto, '.', 1)
                              and column_name  = split_part(e.objeto, '.', 2))
               else to_regclass('public.' || e.objeto) is not null
             end) as presentes
    from esperado e
    group by e.orden, e.archivo
    order by e.orden
  loop
    if m.presentes = 0 then
      v_faltan := v_faltan || m.archivo;
    elsif m.presentes < m.total then
      v_incompletas := v_incompletas || m.archivo;
    end if;
  end loop;

  if array_length(v_faltan, 1) is null and array_length(v_incompletas, 1) is null then
    raise notice '';
    raise notice ' Todas las migraciones están aplicadas.';
    raise notice '';
    raise notice ' Si la aplicación sigue diciendo que falta una tabla, es el caché';
    raise notice ' de PostgREST: este mismo script lo refresca al final. Recargue la';
    raise notice ' página del sistema (Ctrl+F5) y vuelva a intentar.';
  else
    raise notice '';
    raise notice ' EJECUTE ESTOS ARCHIVOS, EN ESTE ORDEN:';
    raise notice '';

    -- Un raise por archivo: un solo mensaje con saltos de línea se ve
    -- recortado en el panel de mensajes de Supabase, y el instalador
    -- terminaba ejecutando solo el primero de la lista.
    if array_length(v_incompletas, 1) > 0 then
      raise notice '   Quedaron a medias (vuelva a ejecutarlas enteras):';
      for i in 1..array_length(v_incompletas, 1) loop
        raise notice '     %. %', i, v_incompletas[i];
      end loop;
      raise notice '';
    end if;

    if array_length(v_faltan, 1) > 0 then
      raise notice '   Faltan por completo:';
      for i in 1..array_length(v_faltan, 1) loop
        raise notice '     %. %', i, v_faltan[i];
      end loop;
      raise notice '';
    end if;

    raise notice ' Son re-ejecutables: volver a correr una ya aplicada no rompe nada.';
    raise notice ' El catálogo de ejemplo (db/006_seed_ecuador.sql) es opcional y solo';
    raise notice ' sirve para probar; no lo ejecute sobre una base con inventario real.';
  end if;

  raise notice '';
end $$;

-- =========================================================
-- Contenido real de la base
-- =========================================================
do $$
declare
  v_productos int := 0;
  v_con_ean int := 0;
  v_estructuras int := 0;
  v_ubic int := 0;
  v_ubic_nuevas int := 0;
  v_lotes int := 0;
  v_ventas int := 0;
  v_servicios int := 0;
  v_usuarios int := 0;
begin
  if to_regclass('public.productos') is not null then
    execute 'select count(*) from productos' into v_productos;
    if exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='productos' and column_name='ean13') then
      execute 'select count(*) from productos where ean13 is not null' into v_con_ean;
    end if;
  end if;

  if to_regclass('public.estructuras')      is not null then execute 'select count(*) from estructuras'      into v_estructuras; end if;
  if to_regclass('public.ubicaciones')      is not null then execute 'select count(*) from ubicaciones'      into v_ubic;  end if;
  if to_regclass('public.lotes')            is not null then execute 'select count(*) from lotes'            into v_lotes; end if;
  if to_regclass('public.ventas')           is not null then execute 'select count(*) from ventas'           into v_ventas; end if;
  if to_regclass('public.ventas_servicio')  is not null then execute 'select count(*) from ventas_servicio'  into v_servicios; end if;
  if to_regclass('public.perfiles_usuario') is not null then execute 'select count(*) from perfiles_usuario' into v_usuarios; end if;

  -- Ubicaciones ya con el código estándar NAVE-MUEBLE-COLUMNA-NIVEL
  if to_regclass('public.ubicaciones') is not null
     and exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='ubicaciones' and column_name='estructura_id') then
    execute 'select count(*) from ubicaciones where estructura_id is not null' into v_ubic_nuevas;
  end if;

  raise notice '--- CONTENIDO DE LA BASE ---';
  raise notice ' Productos en catálogo : %  (%)', v_productos,
    case when v_productos > 50 then 'catálogo cargado'
         when v_productos > 0  then 'pocos productos: puede que falte cargar el inventario'
         else 'vacío' end;
  raise notice ' Productos con EAN-13  : %', v_con_ean;
  raise notice ' Muebles (estructuras) : %  (%)', v_estructuras,
    case when v_estructuras > 0 then 'ok'
         else 'falta la migración 012, o no se han dado de alta' end;
  raise notice ' Posiciones            : %  (% con el código nuevo)', v_ubic, v_ubic_nuevas;
  raise notice ' Lotes con existencia  : %', v_lotes;
  raise notice ' Ventas registradas    : %', v_ventas;
  raise notice ' Servicios registrados : %', v_servicios;
  raise notice ' Usuarios del sistema  : %', v_usuarios;
  raise notice '';
end $$;

-- =========================================================
-- Salud de la seguridad
--
-- Es lo que el analizador de Supabase marca en rojo. Si aquí sale algo,
-- ejecute db/013_seguridad_vistas.sql.
-- =========================================================
do $$
declare
  v_vistas_abiertas text;
  v_func_sin_path text;
  v_sin_rls text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_vistas_abiertas
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and coalesce((select option_value from pg_options_to_table(c.reloptions)
                  where option_name = 'security_invoker'), 'false') not in ('true','on');

  select string_agg(p.proname, ', ' order by p.proname) into v_func_sin_path
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and (p.proconfig is null
         or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));

  select string_agg(c.relname, ', ' order by c.relname) into v_sin_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    and c.relname not like 'pg_%';

  raise notice '--- SEGURIDAD ---';

  if v_vistas_abiertas is null then
    raise notice ' Vistas: todas respetan RLS (security_invoker).';
  else
    raise notice ' [!] Vistas que SE SALTAN las políticas: %', v_vistas_abiertas;
    raise notice '     Ejecute db/013_seguridad_vistas.sql para corregirlo.';
  end if;

  if v_func_sin_path is null then
    raise notice ' Funciones: todas con search_path fijo.';
  else
    raise notice ' [!] Funciones SECURITY DEFINER sin search_path: %', v_func_sin_path;
    raise notice '     Ejecute db/013_seguridad_vistas.sql para corregirlo.';
  end if;

  if v_sin_rls is null then
    raise notice ' Tablas: todas con RLS activado.';
  else
    raise notice ' [!] Tablas SIN RLS (cualquiera con la clave pública las lee): %', v_sin_rls;
  end if;

  raise notice '';
end $$;

-- =========================================================
-- Si todo aparece aplicado y la aplicación sigue diciendo
-- "Could not find the table ... in the schema cache", es el caché de
-- PostgREST. Esta línea lo refresca al instante.
-- =========================================================
notify pgrst, 'reload schema';

select 'Diagnóstico terminado. Revise la pestaña de mensajes para ver qué falta. Caché de esquema recargado.' as resultado;
