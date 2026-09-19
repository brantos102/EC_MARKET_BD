-- =========================================================
-- CENTRO DE CONTROL - MINIMARKET EL CULTIVO
-- Migración 009: comprobantes, clientes y proveedores
--
-- Añade lo necesario para emitir nota de venta o factura con el
-- formato que se usa en Ecuador, identificar al cliente por cédula
-- y administrar proveedores desde la aplicación.
--
-- Requiere: 008_roles_seguridad.sql
-- =========================================================

-- ---------------------------------------------------------
-- PARTE 1 — Datos reales del establecimiento
-- ---------------------------------------------------------
update empresa set
  razon_social = 'MINIMARKET EL CULTIVO',
  nombre_comercial = 'Minimarket El Cultivo',
  ruc = '1728605070001',
  pie_recibo = 'Frescura y calidad en cada compra',
  color_primario = '#17803A',
  tipo_negocio = 'MARKET',
  updated_at = now()
where id = true
  and (razon_social is null or razon_social in ('MI EMPRESA', 'MINIMARKET EL CULTIVO'));

-- ---------------------------------------------------------
-- PARTE 2 — Validación de cédula y RUC ecuatorianos
--
-- Cédula: 10 dígitos. Los dos primeros son la provincia (01-24, o 30
-- para quien se cedula en el exterior) y el tercero es menor a 6 para
-- persona natural. El último dígito es verificador por módulo 10 con
-- coeficientes 2,1,2,1,2,1,2,1,2.
-- RUC de persona natural: la cédula + '001'.
-- ---------------------------------------------------------
create or replace function fn_validar_cedula(p_cedula text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_provincia int;
  v_tercero int;
  v_suma int := 0;
  v_digito int;
  v_producto int;
  v_verificador int;
  i int;
begin
  if p_cedula is null or p_cedula !~ '^[0-9]{10}$' then
    return false;
  end if;

  v_provincia := substring(p_cedula from 1 for 2)::int;
  if v_provincia < 1 or (v_provincia > 24 and v_provincia <> 30) then
    return false;
  end if;

  v_tercero := substring(p_cedula from 3 for 1)::int;
  if v_tercero > 5 then
    return false;   -- 6 y 9 corresponden a RUC público o de sociedad
  end if;

  for i in 1..9 loop
    v_digito := substring(p_cedula from i for 1)::int;
    if i % 2 = 1 then
      v_producto := v_digito * 2;
      if v_producto > 9 then
        v_producto := v_producto - 9;
      end if;
    else
      v_producto := v_digito;
    end if;
    v_suma := v_suma + v_producto;
  end loop;

  v_verificador := (10 - (v_suma % 10)) % 10;
  return v_verificador = substring(p_cedula from 10 for 1)::int;
end;
$$;

create or replace function fn_validar_identificacion(p_tipo text, p_numero text)
returns boolean
language plpgsql
immutable
as $$
begin
  if p_tipo = 'CONSUMIDOR_FINAL' then
    return p_numero = '9999999999999';
  elsif p_tipo = 'CEDULA' then
    return fn_validar_cedula(p_numero);
  elsif p_tipo = 'RUC' then
    -- 13 dígitos terminados en 001; si es de persona natural, los 10
    -- primeros deben ser una cédula válida.
    if p_numero !~ '^[0-9]{13}$' then return false; end if;
    if substring(p_numero from 11 for 3) <> '001' then return false; end if;
    if substring(p_numero from 3 for 1)::int < 6 then
      return fn_validar_cedula(substring(p_numero from 1 for 10));
    end if;
    return true;   -- sociedades (9) y sector público (6) usan otro dígito verificador
  elsif p_tipo = 'PASAPORTE' then
    return length(coalesce(p_numero, '')) between 5 and 20;
  end if;
  return false;
end;
$$;

-- ---------------------------------------------------------
-- PARTE 3 — Comprobantes: nota de venta o factura
-- ---------------------------------------------------------
alter table ventas add column if not exists tipo_comprobante text not null default 'NOTA_VENTA'
  check (tipo_comprobante in ('NOTA_VENTA','FACTURA'));
alter table ventas add column if not exists numero_comprobante text;
alter table ventas add column if not exists cajero_nombre text;

-- Numeración estab-ptoEmision-secuencial (001-001-000000123)
create or replace function fn_siguiente_comprobante(p_tipo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp empresa%rowtype;
  v_anio int := extract(year from current_date)::int;
  v_num int;
  v_clave text := 'COMP_' || p_tipo;
begin
  select * into v_emp from empresa limit 1;

  insert into secuencias (tipo, anio, ultimo_numero) values (v_clave, v_anio, 0)
  on conflict (tipo, anio) do nothing;

  update secuencias set ultimo_numero = ultimo_numero + 1
  where tipo = v_clave and anio = v_anio
  returning ultimo_numero into v_num;

  return coalesce(v_emp.establecimiento, '001') || '-' ||
         coalesce(v_emp.punto_emision, '001') || '-' ||
         lpad(v_num::text, 9, '0');
end;
$$;

-- Se asigna el número al confirmar la venta, no antes: una venta en
-- borrador que se abandona no debe consumir un secuencial.
create or replace function fn_numerar_comprobante()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.numero_comprobante is null then
    new.numero_comprobante := fn_siguiente_comprobante(new.tipo_comprobante);
  end if;
  if new.cajero_nombre is null then
    select nombre into new.cajero_nombre from perfiles_usuario where usuario_id = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_numerar_comprobante on ventas;
create trigger trg_numerar_comprobante
  before update of estado on ventas
  for each row
  when (new.estado = 'CONFIRMADA' and old.estado is distinct from 'CONFIRMADA')
  execute function fn_numerar_comprobante();

-- Una factura exige cliente identificado; una nota de venta no.
create or replace function fn_validar_comprobante()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente clientes%rowtype;
begin
  if new.estado = 'CONFIRMADA' and old.estado is distinct from 'CONFIRMADA'
     and new.tipo_comprobante = 'FACTURA' then
    select * into v_cliente from clientes where id = new.cliente_id;
    if v_cliente.tipo_identificacion = 'CONSUMIDOR_FINAL' then
      raise exception 'Una FACTURA necesita un cliente identificado con cédula o RUC. Para consumidor final emita NOTA DE VENTA.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_comprobante on ventas;
create trigger trg_validar_comprobante
  before update of estado on ventas
  for each row execute function fn_validar_comprobante();

-- ---------------------------------------------------------
-- PARTE 4 — Buscar o registrar cliente por identificación
--
-- El cajero digita la cédula. Si existe, devuelve los datos; si no,
-- registra al cliente con lo que le dicten y lo devuelve. Todo en una
-- sola llamada para no frenar la fila de la caja.
-- ---------------------------------------------------------
create or replace function fn_buscar_cliente(p_identificacion text)
returns table (id uuid, tipo_identificacion text, identificacion text,
               nombre text, email text, telefono text, direccion text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.tipo_identificacion, c.identificacion, c.nombre,
         c.email, c.telefono, c.direccion
  from clientes c
  where c.identificacion = trim(p_identificacion) and c.activo;
$$;

create or replace function fn_registrar_cliente(
  p_identificacion text,
  p_nombre text,
  p_tipo text default null,
  p_email text default null,
  p_telefono text default null,
  p_direccion text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_tipo text;
  v_num text := trim(p_identificacion);
begin
  select id into v_id from clientes where identificacion = v_num;
  if found then
    return v_id;
  end if;

  v_tipo := coalesce(p_tipo, case when length(v_num) = 13 then 'RUC'
                                  when length(v_num) = 10 then 'CEDULA'
                                  else 'PASAPORTE' end);

  if not fn_validar_identificacion(v_tipo, v_num) then
    raise exception 'La identificación % no es válida para el tipo %', v_num, v_tipo;
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'El nombre del cliente es obligatorio';
  end if;

  insert into clientes (tipo_identificacion, identificacion, nombre, email, telefono, direccion)
  values (v_tipo, v_num, upper(trim(p_nombre)), p_email, p_telefono, p_direccion)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------
-- PARTE 5 — Proveedores administrables desde la aplicación
-- ---------------------------------------------------------
create or replace function fn_registrar_proveedor(
  p_ruc text,
  p_razon_social text,
  p_nombre_comercial text default null,
  p_direccion text default null,
  p_telefono text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if fn_rol_actual() not in ('ADMIN','BODEGUERO') then
    raise exception 'Solo un administrador o bodeguero puede registrar proveedores';
  end if;
  if not fn_validar_identificacion('RUC', trim(p_ruc)) then
    raise exception 'El RUC % no es válido', p_ruc;
  end if;

  insert into proveedores (ruc, razon_social, nombre_comercial, direccion, telefono, email)
  values (trim(p_ruc), upper(trim(p_razon_social)), p_nombre_comercial, p_direccion, p_telefono, p_email)
  on conflict (ruc) do update
    set razon_social = excluded.razon_social,
        nombre_comercial = excluded.nombre_comercial,
        direccion = excluded.direccion,
        telefono = excluded.telefono,
        email = excluded.email
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------
-- PARTE 6 — Vista con todo lo que necesita el comprobante impreso
-- ---------------------------------------------------------
drop view if exists v_comprobante cascade;
create view v_comprobante as
select
  v.id as venta_id,
  v.numero_interno,
  v.numero_comprobante,
  v.tipo_comprobante,
  v.fecha,
  v.created_at,
  v.confirmada_at,
  v.cajero_nombre,
  v.subtotal,
  v.descuento,
  v.valor_impuesto,
  v.total,
  v.estado,
  v.tipo_venta,
  c.tipo_identificacion,
  c.identificacion as cliente_identificacion,
  c.nombre as cliente_nombre,
  c.direccion as cliente_direccion,
  c.telefono as cliente_telefono,
  c.email as cliente_email,
  e.razon_social,
  e.nombre_comercial,
  e.ruc,
  e.direccion_matriz,
  e.direccion_establecimiento,
  e.telefono as empresa_telefono,
  e.email as empresa_email,
  e.obligado_contabilidad,
  e.contribuyente_especial,
  e.ambiente,
  e.pie_recibo,
  e.logo_url
from ventas v
join clientes c on c.id = v.cliente_id
cross join (select * from empresa limit 1) e;

select 'Migración 009 aplicada: comprobantes, clientes y proveedores.' as resultado;
