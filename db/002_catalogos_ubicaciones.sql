-- =========================================================
-- CENTRO DE CONTROL - MARKET
-- Migración 002: catálogos comerciales, layout físico,
--                EAN-13, impuestos parametrizables y lotes.
--
-- Requiere: schema.sql (migración 001) ya aplicado.
-- Aplicar en: Supabase Dashboard > SQL Editor > Run
-- Es seguro volver a ejecutarlo.
-- =========================================================

-- ---------------------------------------------------------
-- UNIDADES DE MEDIDA
-- Incluye las unidades de uso real en el comercio ecuatoriano.
-- factor_base convierte a la unidad base de su tipo:
--   PESO    -> kilogramo
--   VOLUMEN -> litro
--   CONTEO  -> unidad
-- Nota: en Ecuador el quintal es de 100 libras (45,36 kg) y la
-- arroba de 25 libras (11,34 kg), no las métricas europeas.
-- ---------------------------------------------------------
create table if not exists unidades_medida (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  tipo text not null check (tipo in ('PESO','VOLUMEN','CONTEO','LONGITUD')),
  factor_base numeric(14,6) not null default 1,
  permite_fraccion boolean not null default false,
  activo boolean not null default true
);

insert into unidades_medida (codigo, nombre, tipo, factor_base, permite_fraccion) values
  ('UND',     'Unidad',            'CONTEO',  1,         false),
  ('DOCENA',  'Docena',            'CONTEO',  12,        false),
  ('SET',     'Set',               'CONTEO',  1,         false),
  ('FUNDA',   'Funda',             'CONTEO',  1,         false),
  ('ATADO',   'Atado',             'CONTEO',  1,         false),
  ('MALLA',   'Malla',             'CONTEO',  1,         false),
  ('GAVETA',  'Gaveta',            'CONTEO',  1,         false),
  ('KG',      'Kilogramo',         'PESO',    1,         true),
  ('G',       'Gramo',             'PESO',    0.001,     true),
  ('LB',      'Libra',             'PESO',    0.453592,  true),
  ('ARROBA',  'Arroba (25 lb)',    'PESO',    11.339800, true),
  ('QUINTAL', 'Quintal (100 lb)',  'PESO',    45.359200, true),
  ('LT',      'Litro',             'VOLUMEN', 1,         true),
  ('ML',      'Mililitro',         'VOLUMEN', 0.001,     true),
  ('GALON',   'Galón',             'VOLUMEN', 3.785412,  true)
on conflict (codigo) do nothing;

-- ---------------------------------------------------------
-- IMPUESTOS PARAMETRIZABLES
-- La tarifa de IVA en Ecuador cambió de 12% a 15% en 2024. Nunca
-- se debe hardcodear: se resuelve por fecha de la transacción.
-- ---------------------------------------------------------
create table if not exists tarifas_impuesto (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,              -- IVA_GENERAL, IVA_CERO
  nombre text not null,
  porcentaje numeric(6,4) not null check (porcentaje >= 0),
  vigencia_desde date not null,
  vigencia_hasta date,               -- null = vigente
  created_at timestamptz not null default now(),
  unique (codigo, vigencia_desde)
);

insert into tarifas_impuesto (codigo, nombre, porcentaje, vigencia_desde, vigencia_hasta) values
  ('IVA_GENERAL', 'IVA tarifa general', 12.0000, '2000-01-01', '2024-03-31'),
  ('IVA_GENERAL', 'IVA tarifa general', 15.0000, '2024-04-01', null),
  ('IVA_CERO',    'IVA tarifa 0%',       0.0000, '2000-01-01', null)
on conflict (codigo, vigencia_desde) do nothing;

create or replace function fn_tarifa_impuesto(p_codigo text, p_fecha date default current_date)
returns numeric
language sql
stable
as $$
  select porcentaje
  from tarifas_impuesto
  where codigo = p_codigo
    and vigencia_desde <= p_fecha
    and (vigencia_hasta is null or vigencia_hasta >= p_fecha)
  order by vigencia_desde desc
  limit 1;
$$;

-- ---------------------------------------------------------
-- VALIDACIÓN EAN-13 (ISO/IEC 15420 — simbología GS1)
-- Dígito verificador: posiciones impares peso 1, pares peso 3.
-- ---------------------------------------------------------
create or replace function fn_validar_ean13(p_codigo text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_suma int := 0;
  v_digito int;
  v_verificador int;
  i int;
begin
  if p_codigo is null or p_codigo = '' then
    return true;  -- el EAN es opcional (ej. productos a granel sin código)
  end if;
  if p_codigo !~ '^[0-9]{13}$' then
    return false;
  end if;
  for i in 1..12 loop
    v_digito := substring(p_codigo from i for 1)::int;
    if i % 2 = 0 then
      v_suma := v_suma + v_digito * 3;
    else
      v_suma := v_suma + v_digito;
    end if;
  end loop;
  v_verificador := (10 - (v_suma % 10)) % 10;
  return v_verificador = substring(p_codigo from 13 for 1)::int;
end;
$$;

-- ---------------------------------------------------------
-- PROVEEDORES Y CLIENTES
-- ---------------------------------------------------------
create table if not exists proveedores (
  id uuid primary key default gen_random_uuid(),
  ruc text not null unique check (ruc ~ '^[0-9]{13}$'),
  razon_social text not null,
  nombre_comercial text,
  direccion text,
  telefono text,
  email text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  tipo_identificacion text not null default 'CEDULA'
    check (tipo_identificacion in ('CEDULA','RUC','PASAPORTE','CONSUMIDOR_FINAL')),
  identificacion text not null unique,
  nombre text not null,
  email text,                        -- destino de la factura electrónica
  telefono text,
  direccion text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Consumidor final: identificación 9999999999999 según práctica SRI
insert into clientes (tipo_identificacion, identificacion, nombre)
values ('CONSUMIDOR_FINAL', '9999999999999', 'CONSUMIDOR FINAL')
on conflict (identificacion) do nothing;

-- ---------------------------------------------------------
-- LAYOUT FÍSICO DEL MARKET
-- Código jerárquico: ZONA-PASILLO-ESTANTE-NIVEL  (ej. PER-A-03-2)
-- ---------------------------------------------------------
create table if not exists zonas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,       -- PER, ABA, LIC, LIM, LAC, CON, BEB
  nombre text not null,
  tipo_conservacion text not null default 'AMBIENTE'
    check (tipo_conservacion in ('AMBIENTE','REFRIGERADO','CONGELADO')),
  orden int not null default 0,
  color_hex text default '#64748b',  -- para el mapa visual
  bodega_id uuid references bodegas(id) on delete cascade
);

create table if not exists ubicaciones (
  id uuid primary key default gen_random_uuid(),
  zona_id uuid not null references zonas(id) on delete cascade,
  pasillo text not null,             -- A, B, C...
  estante int not null check (estante > 0),
  nivel int not null check (nivel > 0),
  codigo text unique,                -- generado por trigger
  capacidad_maxima numeric(14,4),    -- opcional, en unidades del producto
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (zona_id, pasillo, estante, nivel)
);

create or replace function fn_generar_codigo_ubicacion()
returns trigger language plpgsql as $$
declare
  v_zona text;
begin
  select codigo into v_zona from zonas where id = new.zona_id;
  new.codigo := v_zona || '-' || upper(new.pasillo) || '-' ||
                lpad(new.estante::text, 2, '0') || '-' || new.nivel::text;
  return new;
end;
$$;

drop trigger if exists trg_codigo_ubicacion on ubicaciones;
create trigger trg_codigo_ubicacion
  before insert or update on ubicaciones
  for each row execute function fn_generar_codigo_ubicacion();

-- Dónde vive cada producto. Un producto puede tener varias ubicaciones
-- (una principal de percha + respaldo en bodega).
create table if not exists producto_ubicacion (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  ubicacion_id uuid not null references ubicaciones(id) on delete cascade,
  es_principal boolean not null default true,
  created_at timestamptz not null default now(),
  unique (producto_id, ubicacion_id)
);

create unique index if not exists idx_producto_ubicacion_principal
  on producto_ubicacion(producto_id) where es_principal;

-- ---------------------------------------------------------
-- EXTENSIÓN DE PRODUCTOS
-- ---------------------------------------------------------
alter table productos add column if not exists ean13 text;
alter table productos add column if not exists marca text;
alter table productos add column if not exists unidad_medida_id uuid references unidades_medida(id);
alter table productos add column if not exists precio_venta_menor numeric(14,4) not null default 0;
alter table productos add column if not exists precio_venta_mayor numeric(14,4) not null default 0;
alter table productos add column if not exists cantidad_minima_mayor numeric(14,4) not null default 12;
alter table productos add column if not exists codigo_impuesto text not null default 'IVA_CERO';
alter table productos add column if not exists maneja_lote boolean not null default false;
alter table productos add column if not exists dias_alerta_caducidad int not null default 30;
alter table productos add column if not exists permite_fraccion boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'productos_ean13_valido'
  ) then
    alter table productos
      add constraint productos_ean13_valido check (fn_validar_ean13(ean13));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'productos_ean13_unico'
  ) then
    alter table productos
      add constraint productos_ean13_unico unique (ean13);
  end if;
end $$;

create index if not exists idx_productos_ean13 on productos(ean13) where ean13 is not null;

-- Backfill de la unidad de medida desde la columna de texto original
update productos p
set unidad_medida_id = u.id
from unidades_medida u
where p.unidad_medida_id is null and u.codigo = p.unidad_medida;

-- ---------------------------------------------------------
-- LOTES — la caducidad pertenece al lote, no al producto
-- ---------------------------------------------------------
create table if not exists lotes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  bodega_id uuid not null references bodegas(id) on delete cascade,
  codigo_lote text not null,
  fecha_caducidad date,
  fecha_ingreso date not null default current_date,
  cantidad_inicial numeric(14,4) not null check (cantidad_inicial > 0),
  cantidad_disponible numeric(14,4) not null check (cantidad_disponible >= 0),
  costo_unitario numeric(14,6) not null default 0,
  documento_ingreso_id uuid,          -- FK añadida en la migración 003
  created_at timestamptz not null default now(),
  unique (producto_id, bodega_id, codigo_lote)
);

-- FEFO: primero el que caduca antes. Los lotes sin fecha van al final.
create index if not exists idx_lotes_fefo
  on lotes(producto_id, bodega_id, fecha_caducidad nulls last)
  where cantidad_disponible > 0;

-- ---------------------------------------------------------
-- RLS de las tablas nuevas
-- ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'unidades_medida','tarifas_impuesto','proveedores','clientes',
    'zonas','ubicaciones','producto_ubicacion','lotes'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "auth_all_%s" on %I', t, t);
    execute format(
      'create policy "auth_all_%s" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t, t);
  end loop;
end $$;
