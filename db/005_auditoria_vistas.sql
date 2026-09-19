-- =========================================================
-- CENTRO DE CONTROL - MARKET
-- Migración 005: bitácora de auditoría y vistas de negocio.
--
-- La bitácora responde al control A.8.15 (registro de eventos) de
-- ISO/IEC 27001:2022: quién, qué, cuándo y el estado anterior.
--
-- Requiere: 004_ventas_promociones.sql
-- =========================================================

-- ---------------------------------------------------------
-- BITÁCORA DE AUDITORÍA
-- ---------------------------------------------------------
create table if not exists auditoria_log (
  id bigserial primary key,
  tabla text not null,
  registro_id text,
  operacion text not null check (operacion in ('INSERT','UPDATE','DELETE')),
  datos_anteriores jsonb,
  datos_nuevos jsonb,
  campos_modificados text[],
  usuario_id uuid,
  usuario_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_auditoria_tabla on auditoria_log(tabla, created_at desc);
create index if not exists idx_auditoria_registro on auditoria_log(registro_id);
create index if not exists idx_auditoria_fecha on auditoria_log(created_at desc);

create or replace function fn_auditar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_campos text[];
  v_id text;
  v_email text;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_id  := (v_old ->> 'id');
  elsif tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_id  := (v_new ->> 'id');
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_id  := (v_new ->> 'id');
    select array_agg(key) into v_campos
    from jsonb_each(v_new)
    where v_new -> key is distinct from v_old -> key;

    -- No registrar updates que no cambiaron nada
    if v_campos is null then
      return coalesce(new, old);
    end if;
  end if;

  begin
    select email into v_email from auth.users where id = auth.uid();
  exception when others then
    v_email := null;
  end;

  insert into auditoria_log (
    tabla, registro_id, operacion, datos_anteriores, datos_nuevos,
    campos_modificados, usuario_id, usuario_email
  ) values (
    tg_table_name, v_id, tg_op, v_old, v_new, v_campos, auth.uid(), v_email
  );

  return coalesce(new, old);
end;
$$;

-- Aplicar la bitácora a las tablas sensibles
do $$
declare t text;
begin
  foreach t in array array[
    'productos','bodegas','categorias','proveedores','clientes',
    'movimientos_inventario','documentos_ingreso','ingreso_detalle',
    'ventas','venta_detalle','pagos_venta','promociones',
    'lotes','ubicaciones','producto_ubicacion','tarifas_impuesto'
  ] loop
    execute format('drop trigger if exists trg_auditar_%s on %I', t, t);
    execute format(
      'create trigger trg_auditar_%s after insert or update or delete on %I
       for each row execute function fn_auditar()', t, t);
  end loop;
end $$;

alter table auditoria_log enable row level security;
drop policy if exists "auth_read_auditoria" on auditoria_log;
create policy "auth_read_auditoria" on auditoria_log
  for select using (auth.role() = 'authenticated');
-- Sin políticas de INSERT/UPDATE/DELETE: la bitácora solo la escribe
-- el trigger (security definer) y nadie la puede alterar desde la app.

-- ---------------------------------------------------------
-- VISTA: stock actual enriquecido (reemplaza la de la migración 001)
-- Se elimina primero porque "create or replace view" no permite
-- cambiar el nombre ni el orden de las columnas existentes.
-- ---------------------------------------------------------
drop view if exists v_stock_actual cascade;
create view v_stock_actual as
select
  p.id as producto_id,
  p.codigo,
  p.ean13,
  p.nombre as producto,
  p.marca,
  c.nombre as categoria,
  b.id as bodega_id,
  b.nombre as bodega,
  um.codigo as unidad,
  coalesce(s.stock, 0) as stock,
  coalesce(s.costo_promedio, 0) as costo_promedio,
  coalesce(s.stock, 0) * coalesce(s.costo_promedio, 0) as valor_total,
  p.precio_venta_menor,
  p.precio_venta_mayor,
  p.stock_minimo,
  (coalesce(s.stock, 0) < p.stock_minimo) as bajo_minimo,
  u.codigo as ubicacion,
  z.nombre as zona
from productos p
cross join bodegas b
left join inventario_saldos s on s.producto_id = p.id and s.bodega_id = b.id
left join categorias c on c.id = p.categoria_id
left join unidades_medida um on um.id = p.unidad_medida_id
left join producto_ubicacion pu on pu.producto_id = p.id and pu.es_principal
left join ubicaciones u on u.id = pu.ubicacion_id
left join zonas z on z.id = u.zona_id
where p.activo = true and b.activa = true;

-- ---------------------------------------------------------
-- VISTA: alertas de caducidad
-- ---------------------------------------------------------
drop view if exists v_alertas_caducidad cascade;
create view v_alertas_caducidad as
select
  l.id as lote_id,
  l.codigo_lote,
  p.id as producto_id,
  p.codigo,
  p.nombre as producto,
  c.nombre as categoria,
  b.nombre as bodega,
  l.fecha_caducidad,
  (l.fecha_caducidad - current_date) as dias_restantes,
  l.cantidad_disponible,
  l.costo_unitario,
  l.cantidad_disponible * l.costo_unitario as valor_en_riesgo,
  u.codigo as ubicacion,
  case
    when l.fecha_caducidad < current_date then 'VENCIDO'
    when l.fecha_caducidad <= current_date + 7 then 'CRITICO'
    when l.fecha_caducidad <= current_date + p.dias_alerta_caducidad then 'PROXIMO'
    else 'VIGENTE'
  end as nivel_alerta
from lotes l
join productos p on p.id = l.producto_id
join bodegas b on b.id = l.bodega_id
left join categorias c on c.id = p.categoria_id
left join producto_ubicacion pu on pu.producto_id = p.id and pu.es_principal
left join ubicaciones u on u.id = pu.ubicacion_id
where l.cantidad_disponible > 0
  and l.fecha_caducidad is not null;

-- ---------------------------------------------------------
-- VISTA: ocupación del layout
-- ---------------------------------------------------------
drop view if exists v_ocupacion_layout cascade;
create view v_ocupacion_layout as
select
  z.id as zona_id,
  z.codigo as zona_codigo,
  z.nombre as zona,
  z.color_hex,
  z.tipo_conservacion,
  z.orden,
  u.id as ubicacion_id,
  u.codigo as ubicacion,
  u.pasillo,
  u.estante,
  u.nivel,
  u.capacidad_maxima,
  p.id as producto_id,
  p.codigo as producto_codigo,
  p.nombre as producto,
  p.ean13,
  coalesce(s.stock, 0) as stock,
  case
    when u.capacidad_maxima is null or u.capacidad_maxima = 0 then null
    else round((coalesce(s.stock, 0) / u.capacidad_maxima) * 100, 1)
  end as porcentaje_ocupacion
from zonas z
join ubicaciones u on u.zona_id = z.id and u.activa
left join producto_ubicacion pu on pu.ubicacion_id = u.id
left join productos p on p.id = pu.producto_id and p.activo
left join inventario_saldos s on s.producto_id = p.id;

-- ---------------------------------------------------------
-- VISTA: búsqueda rápida para el punto de venta
-- ---------------------------------------------------------
drop view if exists v_pos_productos cascade;
create view v_pos_productos as
select
  p.id as producto_id,
  p.codigo,
  p.ean13,
  p.nombre,
  p.marca,
  c.id as categoria_id,
  c.nombre as categoria,
  um.codigo as unidad,
  um.permite_fraccion,
  p.precio_venta_menor,
  p.precio_venta_mayor,
  p.cantidad_minima_mayor,
  p.codigo_impuesto,
  coalesce(fn_tarifa_impuesto(p.codigo_impuesto), 0) as tarifa_impuesto,
  b.id as bodega_id,
  coalesce(s.stock, 0) as stock,
  u.codigo as ubicacion
from productos p
cross join bodegas b
left join inventario_saldos s on s.producto_id = p.id and s.bodega_id = b.id
left join categorias c on c.id = p.categoria_id
left join unidades_medida um on um.id = p.unidad_medida_id
left join producto_ubicacion pu on pu.producto_id = p.id and pu.es_principal
left join ubicaciones u on u.id = pu.ubicacion_id
where p.activo and b.activa;

-- ---------------------------------------------------------
-- VISTA: resumen de ventas por día
-- ---------------------------------------------------------
drop view if exists v_ventas_resumen cascade;
create view v_ventas_resumen as
select
  v.fecha,
  v.tipo_venta,
  count(*) as num_ventas,
  sum(v.subtotal) as subtotal,
  sum(v.descuento) as descuento_total,
  sum(v.valor_impuesto) as impuesto,
  sum(v.total) as total
from ventas v
where v.estado in ('CONFIRMADA','PAGADA')
group by v.fecha, v.tipo_venta;

-- ---------------------------------------------------------
-- VISTA: productos más vendidos
-- ---------------------------------------------------------
drop view if exists v_productos_mas_vendidos cascade;
create view v_productos_mas_vendidos as
select
  p.id as producto_id,
  p.codigo,
  p.nombre as producto,
  c.nombre as categoria,
  sum(d.cantidad) as unidades_vendidas,
  sum(d.subtotal) as ingresos,
  count(distinct d.venta_id) as num_transacciones
from venta_detalle d
join ventas v on v.id = d.venta_id and v.estado in ('CONFIRMADA','PAGADA')
join productos p on p.id = d.producto_id
left join categorias c on c.id = p.categoria_id
group by p.id, p.codigo, p.nombre, c.nombre;
