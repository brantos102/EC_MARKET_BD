-- =========================================================
-- CENTRO DE CONTROL - MARKET
-- Migración 004: promociones de temporada, ventas (mayor/menor),
--                consumo FEFO de lotes y formas de pago.
--
-- Requiere: 003_ingresos.sql
-- =========================================================

-- ---------------------------------------------------------
-- PROMOCIONES / MAQUILA POR TEMPORADA
--
-- Tipos soportados:
--   N_POR_DOLAR  cantidad=3, valor=1.00  -> "3 por $1"
--   N_POR_M      cantidad=2, valor=1     -> "2x1" (paga 1 de cada 2)
--   PORCENTAJE   valor=20                -> 20% de descuento
--   PRECIO_FIJO  valor=0.75              -> precio especial por unidad
-- ---------------------------------------------------------
create table if not exists promociones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  temporada text,                     -- Navidad, Carnaval, Finados, Día de la Madre...
  tipo text not null check (tipo in ('N_POR_DOLAR','N_POR_M','PORCENTAJE','PRECIO_FIJO')),
  cantidad numeric(14,4),             -- N (para N_POR_DOLAR y N_POR_M)
  valor numeric(14,4) not null,       -- dólares, unidades pagadas o porcentaje según tipo
  vigencia_desde date not null,
  vigencia_hasta date not null,
  aplica_tipo_venta text not null default 'AMBAS'
    check (aplica_tipo_venta in ('MENOR','MAYOR','AMBAS')),
  prioridad int not null default 0,   -- ante empate, gana la prioridad más alta
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  check (vigencia_hasta >= vigencia_desde)
);

create table if not exists promocion_alcance (
  id uuid primary key default gen_random_uuid(),
  promocion_id uuid not null references promociones(id) on delete cascade,
  producto_id uuid references productos(id) on delete cascade,
  categoria_id uuid references categorias(id) on delete cascade,
  check (num_nonnulls(producto_id, categoria_id) = 1)
);

create index if not exists idx_promo_alcance_producto on promocion_alcance(producto_id);
create index if not exists idx_promo_alcance_categoria on promocion_alcance(categoria_id);

-- ---------------------------------------------------------
-- Cálculo de precio de una línea de venta.
-- Resuelve precio mayor/menor y aplica la mejor promoción vigente.
-- Espejo en JS: web/js/lib/pricing.js
-- ---------------------------------------------------------
create or replace function fn_calcular_precio_linea(
  p_producto_id uuid,
  p_tipo_venta text,
  p_cantidad numeric,
  p_fecha date default current_date
)
returns table (
  precio_base numeric,
  total_sin_promo numeric,
  total_con_promo numeric,
  descuento numeric,
  promocion_id uuid,
  promocion_nombre text
)
language plpgsql
stable
as $$
declare
  v_prod record;
  v_precio numeric(14,4);
  v_promo record;
  v_total_normal numeric(14,4);
  v_total numeric(14,4);
  v_grupos int;
  v_resto numeric(14,4);
begin
  select p.*, c.id as cat_id into v_prod
  from productos p
  left join categorias c on c.id = p.categoria_id
  where p.id = p_producto_id;

  if not found then
    raise exception 'Producto no encontrado';
  end if;

  -- Precio mayorista solo si alcanza la cantidad mínima
  if p_tipo_venta = 'MAYOR'
     and v_prod.precio_venta_mayor > 0
     and p_cantidad >= v_prod.cantidad_minima_mayor then
    v_precio := v_prod.precio_venta_mayor;
  else
    v_precio := v_prod.precio_venta_menor;
  end if;

  v_total_normal := p_cantidad * v_precio;
  v_total := v_total_normal;

  select pr.* into v_promo
  from promociones pr
  join promocion_alcance pa on pa.promocion_id = pr.id
  where pr.activa
    and p_fecha between pr.vigencia_desde and pr.vigencia_hasta
    and (pr.aplica_tipo_venta = 'AMBAS' or pr.aplica_tipo_venta = p_tipo_venta)
    and (pa.producto_id = p_producto_id or pa.categoria_id = v_prod.cat_id)
  order by pr.prioridad desc, pa.producto_id nulls last
  limit 1;

  if found then
    if v_promo.tipo = 'N_POR_DOLAR' and v_promo.cantidad > 0 then
      v_grupos := floor(p_cantidad / v_promo.cantidad);
      v_resto  := p_cantidad - (v_grupos * v_promo.cantidad);
      v_total  := (v_grupos * v_promo.valor) + (v_resto * v_precio);

    elsif v_promo.tipo = 'N_POR_M' and v_promo.cantidad > 0 then
      v_grupos := floor(p_cantidad / v_promo.cantidad);
      v_resto  := p_cantidad - (v_grupos * v_promo.cantidad);
      v_total  := ((v_grupos * v_promo.valor) + v_resto) * v_precio;

    elsif v_promo.tipo = 'PORCENTAJE' then
      v_total := v_total_normal * (1 - (v_promo.valor / 100));

    elsif v_promo.tipo = 'PRECIO_FIJO' then
      v_total := p_cantidad * v_promo.valor;
    end if;

    -- Una promoción nunca debe encarecer el producto
    if v_total > v_total_normal then
      v_total := v_total_normal;
    end if;
  end if;

  return query select
    v_precio,
    round(v_total_normal, 4),
    round(v_total, 4),
    round(v_total_normal - v_total, 4),
    case when v_total < v_total_normal then v_promo.id else null end,
    case when v_total < v_total_normal then v_promo.nombre else null end;
end;
$$;

-- ---------------------------------------------------------
-- VENTAS
-- ---------------------------------------------------------
create table if not exists ventas (
  id uuid primary key default gen_random_uuid(),
  numero_interno text unique,                 -- VTA-2026-00001
  cliente_id uuid not null references clientes(id),
  bodega_id uuid not null references bodegas(id),
  tipo_venta text not null default 'MENOR' check (tipo_venta in ('MENOR','MAYOR')),
  fecha date not null default current_date,
  subtotal numeric(14,4) not null default 0,
  descuento numeric(14,4) not null default 0,
  valor_impuesto numeric(14,4) not null default 0,
  total numeric(14,4) not null default 0,
  estado text not null default 'BORRADOR'
    check (estado in ('BORRADOR','CONFIRMADA','PAGADA','ANULADA')),
  observacion text,
  usuario_id uuid references auth.users(id),
  confirmada_at timestamptz,
  pagada_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_ventas_estado on ventas(estado, fecha);

create table if not exists venta_detalle (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id) on delete cascade,
  producto_id uuid not null references productos(id),
  cantidad numeric(14,4) not null check (cantidad > 0),
  precio_unitario numeric(14,4) not null,
  descuento numeric(14,4) not null default 0,
  promocion_id uuid references promociones(id),
  subtotal numeric(14,4) not null,            -- ya neto de promoción
  valor_impuesto numeric(14,4) not null default 0,
  lotes_consumidos jsonb,                     -- trazabilidad FEFO
  created_at timestamptz not null default now()
);

create index if not exists idx_venta_detalle_venta on venta_detalle(venta_id);

create table if not exists pagos_venta (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references ventas(id) on delete cascade,
  forma_pago text not null check (forma_pago in
    ('EFECTIVO','TARJETA_CREDITO','TARJETA_DEBITO','TRANSFERENCIA_DEUNA','TRANSFERENCIA_OTRO')),
  monto numeric(14,4) not null check (monto > 0),
  recibido numeric(14,4),                     -- efectivo entregado por el cliente
  cambio numeric(14,4),
  codigo_transaccion text,                    -- comprobante De Una / voucher / n.º transferencia
  banco text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pagos_venta on pagos_venta(venta_id);

-- ---------------------------------------------------------
-- Numeración de la venta
-- ---------------------------------------------------------
create or replace function fn_numerar_venta()
returns trigger language plpgsql as $$
begin
  if new.numero_interno is null then
    new.numero_interno := fn_siguiente_secuencia('VENTA', 'VTA');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_numerar_venta on ventas;
create trigger trg_numerar_venta
  before insert on ventas
  for each row execute function fn_numerar_venta();

-- ---------------------------------------------------------
-- Precio y totales automáticos de cada línea
-- ---------------------------------------------------------
create or replace function fn_calcular_linea_venta()
returns trigger language plpgsql as $$
declare
  v_venta record;
  v_calc record;
  v_tarifa numeric;
  v_codigo_impuesto text;
begin
  select * into v_venta from ventas where id = new.venta_id;

  if v_venta.estado <> 'BORRADOR' then
    raise exception 'No se puede modificar el detalle de una venta en estado %', v_venta.estado;
  end if;

  select * into v_calc
  from fn_calcular_precio_linea(new.producto_id, v_venta.tipo_venta, new.cantidad, v_venta.fecha);

  new.precio_unitario := v_calc.precio_base;
  new.descuento       := v_calc.descuento;
  new.promocion_id    := v_calc.promocion_id;
  new.subtotal        := v_calc.total_con_promo;

  select codigo_impuesto into v_codigo_impuesto from productos where id = new.producto_id;
  v_tarifa := coalesce(fn_tarifa_impuesto(v_codigo_impuesto, v_venta.fecha), 0);
  new.valor_impuesto := round(new.subtotal * v_tarifa / 100, 4);

  return new;
end;
$$;

-- Solo se recalcula cuando cambian los datos que ingresa el cajero.
-- Así, escribir lotes_consumidos durante la confirmación no dispara
-- el recálculo (que rechazaría la venta por no estar en BORRADOR).
drop trigger if exists trg_calcular_linea_venta on venta_detalle;
create trigger trg_calcular_linea_venta
  before insert or update of cantidad, producto_id on venta_detalle
  for each row execute function fn_calcular_linea_venta();

create or replace function fn_recalcular_totales_venta()
returns trigger language plpgsql as $$
declare
  v_venta uuid := coalesce(new.venta_id, old.venta_id);
begin
  update ventas v
  set subtotal       = coalesce(t.subtotal, 0),
      descuento      = coalesce(t.descuento, 0),
      valor_impuesto = coalesce(t.impuesto, 0),
      total          = coalesce(t.subtotal, 0) + coalesce(t.impuesto, 0)
  from (
    select sum(subtotal) as subtotal,
           sum(descuento) as descuento,
           sum(valor_impuesto) as impuesto
    from venta_detalle where venta_id = v_venta
  ) t
  where v.id = v_venta;
  return null;
end;
$$;

drop trigger if exists trg_totales_venta on venta_detalle;
create trigger trg_totales_venta
  after insert or delete on venta_detalle
  for each row execute function fn_recalcular_totales_venta();

drop trigger if exists trg_totales_venta_upd on venta_detalle;
create trigger trg_totales_venta_upd
  after update of cantidad, producto_id on venta_detalle
  for each row execute function fn_recalcular_totales_venta();

-- ---------------------------------------------------------
-- FEFO: consumo de lotes (primero el que caduca antes)
-- ---------------------------------------------------------
create or replace function fn_consumir_lotes_fefo(
  p_producto_id uuid, p_bodega_id uuid, p_cantidad numeric
)
returns jsonb
language plpgsql
as $$
declare
  v_restante numeric(14,4) := p_cantidad;
  v_tomar numeric(14,4);
  v_detalle jsonb := '[]'::jsonb;
  r record;
begin
  for r in
    select id, codigo_lote, fecha_caducidad, cantidad_disponible
    from lotes
    where producto_id = p_producto_id
      and bodega_id = p_bodega_id
      and cantidad_disponible > 0
    order by fecha_caducidad nulls last, fecha_ingreso
    for update
  loop
    exit when v_restante <= 0;

    v_tomar := least(v_restante, r.cantidad_disponible);

    update lotes
      set cantidad_disponible = cantidad_disponible - v_tomar
      where id = r.id;

    v_detalle := v_detalle || jsonb_build_object(
      'lote_id', r.id,
      'codigo_lote', r.codigo_lote,
      'fecha_caducidad', r.fecha_caducidad,
      'cantidad', v_tomar
    );

    v_restante := v_restante - v_tomar;
  end loop;

  if v_restante > 0 then
    raise exception 'Lotes insuficientes: faltan % unidades por asignar', v_restante;
  end if;

  return v_detalle;
end;
$$;

-- ---------------------------------------------------------
-- CONFIRMACIÓN DE LA VENTA
--
-- Se separa en dos triggers a propósito:
--   BEFORE  valida la transición y sella la marca de tiempo sobre la
--           propia fila (lo único que un BEFORE puede hacer sin riesgo).
--   AFTER   ejecuta los efectos sobre otras tablas (lotes, kardex).
-- Hacerlo todo en el BEFORE provoca el error de PostgreSQL
-- "tuple to be updated was already modified by an operation triggered
-- by the current command", porque los triggers del detalle reescriben
-- la misma fila de ventas que el BEFORE está modificando.
-- ---------------------------------------------------------
-- Limpieza del trigger monolítico de versiones anteriores
drop trigger if exists trg_confirmar_venta on ventas;
drop function if exists fn_confirmar_venta();

create or replace function fn_validar_confirmacion_venta()
returns trigger language plpgsql as $$
begin
  if old.estado = 'ANULADA' and new.estado <> 'ANULADA' then
    raise exception 'La venta % está anulada y no puede reabrirse', old.numero_interno;
  end if;

  if new.estado = 'CONFIRMADA' and old.estado <> 'CONFIRMADA' then
    if not exists (select 1 from venta_detalle where venta_id = new.id) then
      raise exception 'No se puede confirmar una venta sin productos';
    end if;
    new.confirmada_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_confirmacion_venta on ventas;
create trigger trg_validar_confirmacion_venta
  before update on ventas
  for each row execute function fn_validar_confirmacion_venta();

create or replace function fn_procesar_confirmacion_venta()
returns trigger language plpgsql as $$
declare
  r record;
  v_lotes jsonb;
  v_stock numeric(14,4);
begin
  for r in
    select d.*, p.nombre as producto_nombre, p.maneja_lote
    from venta_detalle d
    join productos p on p.id = d.producto_id
    where d.venta_id = new.id
  loop
    -- Validación explícita de stock, con mensaje entendible para el cajero
    select coalesce(stock, 0) into v_stock
    from inventario_saldos
    where producto_id = r.producto_id and bodega_id = new.bodega_id;

    if coalesce(v_stock, 0) < r.cantidad then
      raise exception 'Stock insuficiente de "%": disponible %, solicitado %',
        r.producto_nombre, coalesce(v_stock, 0), r.cantidad;
    end if;

    if r.maneja_lote then
      v_lotes := fn_consumir_lotes_fefo(r.producto_id, new.bodega_id, r.cantidad);
      update venta_detalle set lotes_consumidos = v_lotes where id = r.id;
    end if;

    insert into movimientos_inventario (
      producto_id, bodega_id, tipo, cantidad,
      referencia, observacion, usuario_id
    ) values (
      r.producto_id, new.bodega_id, 'SALIDA', r.cantidad,
      new.numero_interno, 'Venta ' || new.tipo_venta, new.usuario_id
    );
  end loop;

  return null;
end;
$$;

drop trigger if exists trg_procesar_confirmacion_venta on ventas;
create trigger trg_procesar_confirmacion_venta
  after update of estado on ventas
  for each row
  when (new.estado = 'CONFIRMADA' and old.estado is distinct from 'CONFIRMADA')
  execute function fn_procesar_confirmacion_venta();

-- ---------------------------------------------------------
-- La venta pasa a PAGADA cuando los pagos cubren el total
-- ---------------------------------------------------------
create or replace function fn_verificar_pago_venta()
returns trigger language plpgsql as $$
declare
  v_venta record;
  v_pagado numeric(14,4);
begin
  select * into v_venta from ventas where id = new.venta_id;

  if v_venta.estado = 'BORRADOR' then
    raise exception 'Confirme la venta antes de registrar pagos';
  end if;

  select coalesce(sum(monto), 0) into v_pagado from pagos_venta where venta_id = new.venta_id;

  if v_pagado >= v_venta.total then
    update ventas set estado = 'PAGADA', pagada_at = now()
    where id = new.venta_id and estado <> 'PAGADA';
  end if;

  return null;
end;
$$;

drop trigger if exists trg_verificar_pago on pagos_venta;
create trigger trg_verificar_pago
  after insert on pagos_venta
  for each row execute function fn_verificar_pago_venta();

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'promociones','promocion_alcance','ventas','venta_detalle','pagos_venta'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "auth_all_%s" on %I', t, t);
    execute format(
      'create policy "auth_all_%s" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t, t);
  end loop;
end $$;
