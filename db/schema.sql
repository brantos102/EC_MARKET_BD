-- =========================================================
-- CENTRO DE CONTROL - MARKET
-- Módulo: Inventario (Kardex por costeo Promedio Ponderado)
--
-- Método de valoración de inventario: PROMEDIO PONDERADO
-- (estándar bajo NIIF para inventarios homogéneos/fungibles).
-- El costo promedio se recalcula en cada ENTRADA; las SALIDAS
-- se valúan al costo promedio vigente y no lo modifican.
--
-- Cómo aplicar este archivo:
--   1) Supabase Dashboard > SQL Editor > pegar todo el contenido > Run
--   2) O vía CLI:  supabase db execute -f db/schema.sql  (requiere link al proyecto)
--
-- Es seguro volver a ejecutar este script (usa IF NOT EXISTS / OR REPLACE).
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------
create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  created_at timestamptz not null default now()
);

create table if not exists bodegas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  ubicacion text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists productos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  categoria_id uuid references categorias(id) on delete set null,
  unidad_medida text not null default 'UND',
  stock_minimo numeric(14,4) not null default 0 check (stock_minimo >= 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_productos_updated_at on productos;
create trigger trg_productos_updated_at
  before update on productos
  for each row execute function fn_set_updated_at();

-- ---------------------------------------------------------
-- Saldo actual (materializado) por producto + bodega
-- ---------------------------------------------------------
create table if not exists inventario_saldos (
  producto_id uuid not null references productos(id) on delete cascade,
  bodega_id uuid not null references bodegas(id) on delete cascade,
  stock numeric(14,4) not null default 0,
  costo_promedio numeric(14,6) not null default 0,
  actualizado_at timestamptz not null default now(),
  primary key (producto_id, bodega_id)
);

-- ---------------------------------------------------------
-- Kardex: ledger de movimientos (append-only, no editable)
-- ---------------------------------------------------------
create table if not exists movimientos_inventario (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id),
  bodega_id uuid not null references bodegas(id),
  tipo text not null check (tipo in ('ENTRADA','SALIDA','AJUSTE_POSITIVO','AJUSTE_NEGATIVO')),
  cantidad numeric(14,4) not null check (cantidad > 0),
  costo_unitario numeric(14,6),        -- obligatorio en ENTRADA; en salidas/ajustes se calcula
  costo_total numeric(14,4),           -- calculado por el trigger
  saldo_cantidad numeric(14,4),        -- snapshot de stock DESPUÉS del movimiento
  saldo_costo_promedio numeric(14,6),  -- snapshot de costo promedio DESPUÉS del movimiento
  saldo_valor_total numeric(14,4),     -- snapshot de valor total DESPUÉS del movimiento
  referencia text,                     -- N° factura / guía de remisión / documento
  observacion text,
  usuario_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_movimientos_producto_bodega
  on movimientos_inventario(producto_id, bodega_id, created_at);

-- ---------------------------------------------------------
-- Función de costeo: Promedio Ponderado
-- ---------------------------------------------------------
create or replace function fn_procesar_movimiento_inventario()
returns trigger
language plpgsql
as $$
declare
  v_saldo inventario_saldos%rowtype;
  v_nueva_cantidad numeric(14,4);
  v_nuevo_costo_promedio numeric(14,6);
begin
  select * into v_saldo from inventario_saldos
    where producto_id = new.producto_id and bodega_id = new.bodega_id
    for update;

  if not found then
    insert into inventario_saldos(producto_id, bodega_id, stock, costo_promedio)
    values (new.producto_id, new.bodega_id, 0, 0)
    returning * into v_saldo;
  end if;

  if new.tipo = 'ENTRADA' then
    if new.costo_unitario is null or new.costo_unitario <= 0 then
      raise exception 'costo_unitario es obligatorio y debe ser > 0 en una ENTRADA';
    end if;
    v_nueva_cantidad := v_saldo.stock + new.cantidad;
    v_nuevo_costo_promedio := ((v_saldo.stock * v_saldo.costo_promedio) + (new.cantidad * new.costo_unitario)) / v_nueva_cantidad;
    new.costo_total := new.cantidad * new.costo_unitario;

  elsif new.tipo = 'AJUSTE_POSITIVO' then
    v_nueva_cantidad := v_saldo.stock + new.cantidad;
    v_nuevo_costo_promedio := v_saldo.costo_promedio;
    new.costo_unitario := v_saldo.costo_promedio;
    new.costo_total := new.cantidad * v_saldo.costo_promedio;

  elsif new.tipo in ('SALIDA','AJUSTE_NEGATIVO') then
    if new.cantidad > v_saldo.stock then
      raise exception 'Stock insuficiente en esta bodega: disponible %, solicitado %', v_saldo.stock, new.cantidad;
    end if;
    v_nueva_cantidad := v_saldo.stock - new.cantidad;
    v_nuevo_costo_promedio := v_saldo.costo_promedio; -- las salidas no alteran el promedio
    new.costo_unitario := v_saldo.costo_promedio;
    new.costo_total := new.cantidad * v_saldo.costo_promedio;

  else
    raise exception 'Tipo de movimiento no soportado: %', new.tipo;
  end if;

  new.saldo_cantidad := v_nueva_cantidad;
  new.saldo_costo_promedio := v_nuevo_costo_promedio;
  new.saldo_valor_total := v_nueva_cantidad * v_nuevo_costo_promedio;

  update inventario_saldos
    set stock = v_nueva_cantidad,
        costo_promedio = v_nuevo_costo_promedio,
        actualizado_at = now()
    where producto_id = new.producto_id and bodega_id = new.bodega_id;

  return new;
end;
$$;

drop trigger if exists trg_procesar_movimiento_inventario on movimientos_inventario;
create trigger trg_procesar_movimiento_inventario
  before insert on movimientos_inventario
  for each row execute function fn_procesar_movimiento_inventario();

-- El kardex es un ledger de auditoría: no se edita ni se borra, solo se corrige
-- con un nuevo movimiento (AJUSTE_POSITIVO / AJUSTE_NEGATIVO).
create or replace function fn_bloquear_edicion_kardex()
returns trigger language plpgsql as $$
begin
  raise exception 'Los movimientos de inventario no se pueden modificar ni eliminar (ledger de auditoría). Use un AJUSTE.';
end;
$$;

drop trigger if exists trg_bloquear_update_kardex on movimientos_inventario;
create trigger trg_bloquear_update_kardex
  before update on movimientos_inventario
  for each row execute function fn_bloquear_edicion_kardex();

drop trigger if exists trg_bloquear_delete_kardex on movimientos_inventario;
create trigger trg_bloquear_delete_kardex
  before delete on movimientos_inventario
  for each row execute function fn_bloquear_edicion_kardex();

-- ---------------------------------------------------------
-- Vista de stock actual (para el dashboard)
-- ---------------------------------------------------------
create or replace view v_stock_actual as
select
  p.id as producto_id,
  p.codigo,
  p.nombre as producto,
  c.nombre as categoria,
  b.id as bodega_id,
  b.nombre as bodega,
  coalesce(s.stock, 0) as stock,
  coalesce(s.costo_promedio, 0) as costo_promedio,
  coalesce(s.stock, 0) * coalesce(s.costo_promedio, 0) as valor_total,
  p.stock_minimo,
  (coalesce(s.stock, 0) < p.stock_minimo) as bajo_minimo
from productos p
cross join bodegas b
left join inventario_saldos s on s.producto_id = p.id and s.bodega_id = b.id
left join categorias c on c.id = p.categoria_id
where p.activo = true and b.activa = true;

-- ---------------------------------------------------------
-- RLS: cualquier usuario autenticado (Supabase Auth) puede
-- leer y registrar movimientos. Ajustar según roles reales
-- del negocio (ver README.md, sección "Seguridad").
-- ---------------------------------------------------------
alter table categorias enable row level security;
alter table bodegas enable row level security;
alter table productos enable row level security;
alter table inventario_saldos enable row level security;
alter table movimientos_inventario enable row level security;

drop policy if exists "auth_read_categorias" on categorias;
create policy "auth_read_categorias" on categorias for select using (auth.role() = 'authenticated');
drop policy if exists "auth_write_categorias" on categorias;
create policy "auth_write_categorias" on categorias for insert with check (auth.role() = 'authenticated');
drop policy if exists "auth_update_categorias" on categorias;
create policy "auth_update_categorias" on categorias for update using (auth.role() = 'authenticated');

drop policy if exists "auth_read_bodegas" on bodegas;
create policy "auth_read_bodegas" on bodegas for select using (auth.role() = 'authenticated');
drop policy if exists "auth_write_bodegas" on bodegas;
create policy "auth_write_bodegas" on bodegas for insert with check (auth.role() = 'authenticated');
drop policy if exists "auth_update_bodegas" on bodegas;
create policy "auth_update_bodegas" on bodegas for update using (auth.role() = 'authenticated');

drop policy if exists "auth_read_productos" on productos;
create policy "auth_read_productos" on productos for select using (auth.role() = 'authenticated');
drop policy if exists "auth_write_productos" on productos;
create policy "auth_write_productos" on productos for insert with check (auth.role() = 'authenticated');
drop policy if exists "auth_update_productos" on productos;
create policy "auth_update_productos" on productos for update using (auth.role() = 'authenticated');

drop policy if exists "auth_read_saldos" on inventario_saldos;
create policy "auth_read_saldos" on inventario_saldos for select using (auth.role() = 'authenticated');

drop policy if exists "auth_read_movimientos" on movimientos_inventario;
create policy "auth_read_movimientos" on movimientos_inventario for select using (auth.role() = 'authenticated');
drop policy if exists "auth_insert_movimientos" on movimientos_inventario;
create policy "auth_insert_movimientos" on movimientos_inventario for insert with check (auth.role() = 'authenticated');
-- Nota: no hay política de UPDATE/DELETE para movimientos_inventario,
-- así que quedan bloqueados también a nivel de RLS (además del trigger).
