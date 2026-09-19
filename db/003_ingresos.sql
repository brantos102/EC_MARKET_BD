-- =========================================================
-- CENTRO DE CONTROL - MARKET
-- Migración 003: ingreso de mercadería
--
-- Trazabilidad: cada ingreso tiene un número interno propio
-- (ING-AAAA-NNNNN) y referencia obligatoria al documento externo
-- del proveedor (factura / nota de entrega / guía de remisión).
--
-- Requiere: 002_catalogos_ubicaciones.sql
-- =========================================================

-- ---------------------------------------------------------
-- Secuencias internas por tipo de documento y año
-- ---------------------------------------------------------
create table if not exists secuencias (
  tipo text not null,
  anio int not null,
  ultimo_numero int not null default 0,
  primary key (tipo, anio)
);

create or replace function fn_siguiente_secuencia(p_tipo text, p_prefijo text)
returns text
language plpgsql
as $$
declare
  v_anio int := extract(year from current_date)::int;
  v_num int;
begin
  insert into secuencias (tipo, anio, ultimo_numero)
  values (p_tipo, v_anio, 0)
  on conflict (tipo, anio) do nothing;

  update secuencias
    set ultimo_numero = ultimo_numero + 1
    where tipo = p_tipo and anio = v_anio
    returning ultimo_numero into v_num;

  return p_prefijo || '-' || v_anio::text || '-' || lpad(v_num::text, 5, '0');
end;
$$;

-- ---------------------------------------------------------
-- Cabecera del ingreso
-- ---------------------------------------------------------
create table if not exists documentos_ingreso (
  id uuid primary key default gen_random_uuid(),
  numero_interno text unique,                -- ING-2026-00001 (trazabilidad propia)
  proveedor_id uuid not null references proveedores(id),
  bodega_id uuid not null references bodegas(id),
  tipo_documento text not null default 'FACTURA'
    check (tipo_documento in ('FACTURA','NOTA_ENTREGA','GUIA_REMISION','AJUSTE_INICIAL','DEVOLUCION')),
  -- Formato SRI: establecimiento-punto de emisión-secuencial (001-001-000000123)
  numero_documento text not null,
  autorizacion_sri text,                     -- clave de acceso / n.º autorización
  fecha_emision date not null,
  fecha_recepcion date not null default current_date,
  subtotal numeric(14,4) not null default 0,
  valor_impuesto numeric(14,4) not null default 0,
  total numeric(14,4) not null default 0,
  estado text not null default 'BORRADOR'
    check (estado in ('BORRADOR','CONFIRMADO','ANULADO')),
  observacion text,
  usuario_id uuid references auth.users(id),
  confirmado_at timestamptz,
  created_at timestamptz not null default now(),
  unique (proveedor_id, tipo_documento, numero_documento)
);

create index if not exists idx_ingreso_estado on documentos_ingreso(estado, fecha_recepcion);

-- ---------------------------------------------------------
-- Detalle del ingreso
-- ---------------------------------------------------------
create table if not exists ingreso_detalle (
  id uuid primary key default gen_random_uuid(),
  documento_ingreso_id uuid not null references documentos_ingreso(id) on delete cascade,
  producto_id uuid not null references productos(id),
  cantidad numeric(14,4) not null check (cantidad > 0),
  costo_unitario numeric(14,6) not null check (costo_unitario > 0),
  subtotal numeric(14,4) generated always as (cantidad * costo_unitario) stored,
  codigo_lote text,
  fecha_caducidad date,
  created_at timestamptz not null default now()
);

create index if not exists idx_ingreso_detalle_doc on ingreso_detalle(documento_ingreso_id);

-- Ahora sí podemos enlazar el lote con su documento de origen
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lotes_documento_ingreso_fk') then
    alter table lotes
      add constraint lotes_documento_ingreso_fk
      foreign key (documento_ingreso_id) references documentos_ingreso(id) on delete set null;
  end if;
end $$;

-- ---------------------------------------------------------
-- Numeración automática al crear el ingreso
-- ---------------------------------------------------------
create or replace function fn_numerar_ingreso()
returns trigger language plpgsql as $$
begin
  if new.numero_interno is null then
    new.numero_interno := fn_siguiente_secuencia('INGRESO', 'ING');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_numerar_ingreso on documentos_ingreso;
create trigger trg_numerar_ingreso
  before insert on documentos_ingreso
  for each row execute function fn_numerar_ingreso();

-- ---------------------------------------------------------
-- Recalcular totales de la cabecera cuando cambia el detalle
-- ---------------------------------------------------------
create or replace function fn_recalcular_totales_ingreso()
returns trigger language plpgsql as $$
declare
  v_doc uuid := coalesce(new.documento_ingreso_id, old.documento_ingreso_id);
  v_fecha date;
  v_subtotal numeric(14,4);
  v_impuesto numeric(14,4);
begin
  select fecha_emision into v_fecha from documentos_ingreso where id = v_doc;

  select
    coalesce(sum(d.cantidad * d.costo_unitario), 0),
    coalesce(sum(d.cantidad * d.costo_unitario *
      coalesce(fn_tarifa_impuesto(p.codigo_impuesto, v_fecha), 0) / 100), 0)
  into v_subtotal, v_impuesto
  from ingreso_detalle d
  join productos p on p.id = d.producto_id
  where d.documento_ingreso_id = v_doc;

  update documentos_ingreso
    set subtotal = v_subtotal,
        valor_impuesto = v_impuesto,
        total = v_subtotal + v_impuesto
    where id = v_doc;

  return null;
end;
$$;

drop trigger if exists trg_totales_ingreso on ingreso_detalle;
create trigger trg_totales_ingreso
  after insert or update or delete on ingreso_detalle
  for each row execute function fn_recalcular_totales_ingreso();

-- ---------------------------------------------------------
-- CONFIRMACIÓN DEL INGRESO
-- Al pasar de BORRADOR a CONFIRMADO:
--   1. crea/actualiza el lote de cada línea
--   2. registra la ENTRADA en el kardex (que recalcula el costo promedio)
-- Un ingreso confirmado ya no se edita ni se elimina.
-- ---------------------------------------------------------
create or replace function fn_confirmar_ingreso()
returns trigger language plpgsql as $$
declare
  r record;
  v_lote text;
begin
  if old.estado = 'CONFIRMADO' then
    raise exception 'El ingreso % ya fue confirmado y no puede modificarse', old.numero_interno;
  end if;

  if new.estado <> 'CONFIRMADO' or old.estado = new.estado then
    return new;
  end if;

  if not exists (select 1 from ingreso_detalle where documento_ingreso_id = new.id) then
    raise exception 'No se puede confirmar un ingreso sin detalle';
  end if;

  for r in
    select d.*, p.maneja_lote
    from ingreso_detalle d
    join productos p on p.id = d.producto_id
    where d.documento_ingreso_id = new.id
  loop
    if r.maneja_lote then
      v_lote := coalesce(nullif(r.codigo_lote, ''), new.numero_interno);

      insert into lotes (
        producto_id, bodega_id, codigo_lote, fecha_caducidad, fecha_ingreso,
        cantidad_inicial, cantidad_disponible, costo_unitario, documento_ingreso_id
      ) values (
        r.producto_id, new.bodega_id, v_lote, r.fecha_caducidad, new.fecha_recepcion,
        r.cantidad, r.cantidad, r.costo_unitario, new.id
      )
      on conflict (producto_id, bodega_id, codigo_lote) do update
        set cantidad_inicial    = lotes.cantidad_inicial + excluded.cantidad_inicial,
            cantidad_disponible = lotes.cantidad_disponible + excluded.cantidad_disponible,
            costo_unitario      = excluded.costo_unitario;
    end if;

    insert into movimientos_inventario (
      producto_id, bodega_id, tipo, cantidad, costo_unitario,
      referencia, observacion, usuario_id
    ) values (
      r.producto_id, new.bodega_id, 'ENTRADA', r.cantidad, r.costo_unitario,
      new.numero_interno || ' / ' || new.numero_documento,
      'Ingreso de mercadería', new.usuario_id
    );
  end loop;

  new.confirmado_at := now();
  return new;
end;
$$;

drop trigger if exists trg_confirmar_ingreso on documentos_ingreso;
create trigger trg_confirmar_ingreso
  before update on documentos_ingreso
  for each row execute function fn_confirmar_ingreso();

-- Bloquear edición del detalle una vez confirmado el documento
create or replace function fn_bloquear_detalle_confirmado()
returns trigger language plpgsql as $$
declare
  v_estado text;
  v_doc uuid := coalesce(new.documento_ingreso_id, old.documento_ingreso_id);
begin
  select estado into v_estado from documentos_ingreso where id = v_doc;
  if v_estado = 'CONFIRMADO' then
    raise exception 'No se puede modificar el detalle de un ingreso ya confirmado';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_bloquear_detalle_ingreso on ingreso_detalle;
create trigger trg_bloquear_detalle_ingreso
  before insert or update or delete on ingreso_detalle
  for each row execute function fn_bloquear_detalle_confirmado();

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['secuencias','documentos_ingreso','ingreso_detalle'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "auth_all_%s" on %I', t, t);
    execute format(
      'create policy "auth_all_%s" on %I for all using (auth.role() = ''authenticated'') with check (auth.role() = ''authenticated'')',
      t, t);
  end loop;
end $$;
