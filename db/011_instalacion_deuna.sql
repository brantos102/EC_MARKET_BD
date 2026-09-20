-- =========================================================
-- CENTRO DE CONTROL
-- Migración 011: asistente de instalación, tipo de negocio y De Una
--
--   1. Instalación — una base recién creada se configura una sola vez:
--      se elige el tipo de negocio, se cargan sus catálogos y queda
--      bloqueado. Cambiar de tipo exige una base nueva, a propósito.
--   2. De Una     — el cobro es una transferencia: el cliente escanea y
--      envía el monto pactado. No exige código. Queda preparado el modo
--      con API y token para cuando el banco lo habilite.
--
-- Requiere: 010_operacion_multisede.sql
-- =========================================================

-- =========================================================
-- PARTE 1 — Tipos de negocio
--
-- POR QUÉ NO SE PUEDE CAMBIAR DESPUÉS: el tipo decide las unidades de
-- medida, las categorías y la nomenclatura de las ubicaciones. Si un
-- minimarket que ya lleva seis meses de kardex se convirtiera en
-- ferretería, las libras y arrobas de su histórico dejarían de tener
-- sentido y los informes mezclarían dos realidades. Es la misma razón
-- por la que un sistema contable no deja cambiar el plan de cuentas con
-- movimientos cargados.
-- =========================================================
create table if not exists tipos_negocio (
  codigo text primary key,
  nombre text not null,
  descripcion text not null,
  icono text not null default 'caja',
  unidades text[] not null default '{}',     -- códigos de unidades_medida
  categorias text[] not null default '{}',
  zonas jsonb not null default '[]'::jsonb,  -- [{codigo, nombre, conservacion}]
  maneja_caducidad boolean not null default false,
  maneja_peso boolean not null default false,
  orden int not null default 100,
  activo boolean not null default true
);

comment on table tipos_negocio is
  'Plantillas de arranque. El tipo elegido en la instalación no se cambia después.';

insert into tipos_negocio
  (codigo, nombre, descripcion, icono, unidades, categorias, zonas,
   maneja_caducidad, maneja_peso, orden) values
(
  'MARKET', 'Minimarket / Tienda de abarrotes',
  'Víveres, frutas y verduras, lácteos, snacks y bebidas. Vende por unidad y por peso, y controla fechas de caducidad.',
  'carrito',
  array['UND','LB','KG','G','ARROBA','QUINTAL','LT','ML','DOCENA','FUNDA','ATADO','MALLA','GAVETA'],
  array['Frutas','Verduras y hortalizas','Lácteos y huevos','Carnes y embutidos',
        'Abarrotes','Bebidas','Snacks y confitería','Panadería','Limpieza del hogar',
        'Cuidado personal','Mascotas'],
  '[{"codigo":"PER","nombre":"Perecibles","conservacion":"REFRIGERADO"},
    {"codigo":"SEC","nombre":"Secos y abarrotes","conservacion":"AMBIENTE"},
    {"codigo":"BEB","nombre":"Bebidas","conservacion":"AMBIENTE"},
    {"codigo":"CON","nombre":"Congelados","conservacion":"CONGELADO"},
    {"codigo":"LIM","nombre":"Limpieza","conservacion":"AMBIENTE"}]'::jsonb,
  true, true, 10
),
(
  'FERRETERIA', 'Ferretería',
  'Herramientas, materiales de construcción, pinturas y eléctricos. Vende por unidad, por metro y por peso; casi nada caduca.',
  'ajuste',
  array['UND','JUEGO','METRO','KG','LB','QUINTAL','GALON','LT','ROLLO','SACO','PAR','CAJA'],
  array['Herramienta manual','Herramienta eléctrica','Tornillería y fijación',
        'Plomería','Eléctricos e iluminación','Pinturas y solventes',
        'Materiales de construcción','Seguridad industrial','Cerrajería','Jardinería'],
  '[{"codigo":"HER","nombre":"Herramientas","conservacion":"AMBIENTE"},
    {"codigo":"CON","nombre":"Construcción","conservacion":"AMBIENTE"},
    {"codigo":"ELE","nombre":"Eléctricos","conservacion":"AMBIENTE"},
    {"codigo":"PIN","nombre":"Pinturas","conservacion":"AMBIENTE"},
    {"codigo":"PLO","nombre":"Plomería","conservacion":"AMBIENTE"}]'::jsonb,
  false, true, 20
),
(
  'FARMACIA', 'Farmacia / Botica',
  'Medicamentos y cuidado personal. El control de lote y caducidad no es opcional, es obligatorio.',
  'escudo',
  array['UND','CAJA','BLISTER','FRASCO','ML','MG','TUBO','SOBRE'],
  array['Analgésicos','Antibióticos','Cuidado personal','Vitaminas y suplementos',
        'Primeros auxilios','Higiene','Bebé','Dermocosmética'],
  '[{"codigo":"MED","nombre":"Medicamentos","conservacion":"AMBIENTE"},
    {"codigo":"REF","nombre":"Cadena de frío","conservacion":"REFRIGERADO"},
    {"codigo":"PER","nombre":"Perfumería","conservacion":"AMBIENTE"},
    {"codigo":"CTR","nombre":"Control especial","conservacion":"AMBIENTE"}]'::jsonb,
  true, false, 30
),
(
  'TECNOLOGIA', 'Tecnología y computación',
  'Equipos, partes y accesorios. Suele manejar número de serie y garantía, no caducidad.',
  'tablero',
  array['UND','CAJA','JUEGO','PAR','METRO'],
  array['Computadoras','Portátiles','Componentes','Periféricos','Redes',
        'Almacenamiento','Cables y adaptadores','Impresión','Audio y video','Celulares'],
  '[{"codigo":"EQU","nombre":"Equipos","conservacion":"AMBIENTE"},
    {"codigo":"PAR","nombre":"Partes","conservacion":"AMBIENTE"},
    {"codigo":"ACC","nombre":"Accesorios","conservacion":"AMBIENTE"},
    {"codigo":"VAL","nombre":"Alto valor","conservacion":"AMBIENTE"}]'::jsonb,
  false, false, 40
),
(
  'PAPELERIA', 'Papelería y bazar',
  'Útiles escolares, oficina y regalos. Vende por unidad, docena y resma.',
  'libro',
  array['UND','DOCENA','RESMA','CAJA','JUEGO','PAQUETE','METRO'],
  array['Útiles escolares','Oficina','Arte y manualidades','Libros y cuadernos',
        'Regalos y bazar','Impresión y copiado'],
  '[{"codigo":"ESC","nombre":"Escolar","conservacion":"AMBIENTE"},
    {"codigo":"OFI","nombre":"Oficina","conservacion":"AMBIENTE"},
    {"codigo":"BAZ","nombre":"Bazar","conservacion":"AMBIENTE"}]'::jsonb,
  false, false, 50
),
(
  'OTRO', 'Otro tipo de negocio',
  'Arranca con lo mínimo: unidad, caja y paquete, sin categorías precargadas. Usted define todo desde Catálogo.',
  'caja',
  array['UND','CAJA','PAQUETE','KG','LT','METRO'],
  array[]::text[],
  '[{"codigo":"GEN","nombre":"General","conservacion":"AMBIENTE"}]'::jsonb,
  false, false, 90
)
on conflict (codigo) do update
  set nombre = excluded.nombre,
      descripcion = excluded.descripcion,
      icono = excluded.icono,
      unidades = excluded.unidades,
      categorias = excluded.categorias,
      zonas = excluded.zonas,
      maneja_caducidad = excluded.maneja_caducidad,
      maneja_peso = excluded.maneja_peso,
      orden = excluded.orden;

-- Unidades que necesitan los tipos nuevos y que el catálogo original
-- (pensado para un minimarket) no traía. Sin esto, instalar una
-- ferretería dejaría "METRO" o "ROLLO" fuera y los productos no tendrían
-- cómo medirse.
insert into unidades_medida (codigo, nombre, tipo, factor_base, permite_fraccion, activo) values
  ('METRO',   'Metro',            'LONGITUD', 1,      true,  true),
  ('CM',      'Centímetro',       'LONGITUD', 0.01,   true,  true),
  ('ROLLO',   'Rollo',            'CONTEO',   1,      false, true),
  ('SACO',    'Saco',             'CONTEO',   1,      false, true),
  ('PAR',     'Par',              'CONTEO',   2,      false, true),
  ('CAJA',    'Caja',             'CONTEO',   1,      false, true),
  ('JUEGO',   'Juego',            'CONTEO',   1,      false, true),
  ('PAQUETE', 'Paquete',          'CONTEO',   1,      false, true),
  ('RESMA',   'Resma (500 hojas)','CONTEO',   500,    false, true),
  ('BLISTER', 'Blíster',          'CONTEO',   1,      false, true),
  ('FRASCO',  'Frasco',           'CONTEO',   1,      false, true),
  ('TUBO',    'Tubo',             'CONTEO',   1,      false, true),
  ('SOBRE',   'Sobre',            'CONTEO',   1,      false, true),
  ('MG',      'Miligramo',        'PESO',     0.000001, true, true)
on conflict (codigo) do nothing;

-- El check antiguo de empresa.tipo_negocio solo admitía cuatro valores
-- escritos a mano. Se reemplaza por una clave foránea al catálogo, que
-- es lo que permite agregar tipos sin tocar el esquema.
do $$
declare
  v_con text;
begin
  select conname into v_con
  from pg_constraint
  where conrelid = 'empresa'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%tipo_negocio%';
  if v_con is not null then
    execute format('alter table empresa drop constraint %I', v_con);
  end if;
end $$;

-- Cualquier valor que no esté en el catálogo pasa a OTRO antes de
-- imponer la clave foránea, para que la migración no falle en una base
-- que ya tenía datos.
update empresa set tipo_negocio = 'OTRO'
where tipo_negocio is null
   or tipo_negocio not in (select codigo from tipos_negocio);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'empresa_tipo_negocio_fk') then
    alter table empresa
      add constraint empresa_tipo_negocio_fk
      foreign key (tipo_negocio) references tipos_negocio(codigo);
  end if;
end $$;

-- =========================================================
-- PARTE 2 — Estado de la instalación
-- =========================================================
create table if not exists instalacion (
  id boolean primary key default true check (id),
  completada boolean not null default false,
  tipo_negocio text references tipos_negocio(codigo),
  version_sistema text not null default '011',
  instalada_at timestamptz,
  instalada_por uuid references auth.users(id),
  notas text
);

insert into instalacion (id) values (true) on conflict (id) do nothing;

-- Una base que ya tiene productos cargados no es una instalación nueva:
-- se marca como completada para que el asistente no vuelva a aparecer.
update instalacion set
  completada = true,
  tipo_negocio = coalesce(tipo_negocio, (select tipo_negocio from empresa limit 1), 'OTRO'),
  instalada_at = coalesce(instalada_at, now()),
  notas = coalesce(notas, 'Marcada como instalada por la migración 011: la base ya tenía datos.')
where id = true
  and not completada
  and exists (select 1 from productos limit 1);

-- Una vez completada, el tipo de negocio no se cambia. Esto no es un
-- botón escondido en la interfaz: es un trigger, así que se cumple
-- aunque alguien edite la tabla desde un cliente SQL de escritorio.
create or replace function fn_bloquear_tipo_negocio()
returns trigger
language plpgsql
as $$
declare
  v_instalada boolean;
begin
  if new.tipo_negocio is distinct from old.tipo_negocio then
    select completada into v_instalada from instalacion limit 1;
    if coalesce(v_instalada, false) then
      raise exception
        'El tipo de negocio quedó fijado como % en la instalación y no se puede cambiar. '
        'Un cambio de tipo invalidaría las unidades y categorías del histórico ya '
        'registrado. Para otro tipo de negocio se instala una base nueva.',
        old.tipo_negocio;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_tipo_negocio on empresa;
create trigger trg_bloquear_tipo_negocio
  before update of tipo_negocio on empresa
  for each row execute function fn_bloquear_tipo_negocio();

-- Lo mismo para la propia tabla instalacion.
create or replace function fn_bloquear_instalacion()
returns trigger
language plpgsql
as $$
begin
  if old.completada and (new.tipo_negocio is distinct from old.tipo_negocio) then
    raise exception 'La instalación ya está completada: el tipo de negocio no se cambia.';
  end if;
  if old.completada and not new.completada then
    raise exception 'Una instalación completada no se puede revertir desde la aplicación.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_instalacion on instalacion;
create trigger trg_bloquear_instalacion
  before update on instalacion
  for each row execute function fn_bloquear_instalacion();

-- Lo que consulta el asistente antes de pedir sesión: si ya está
-- instalado, no muestra nada. Es deliberadamente escueto — no revela
-- nombre de empresa ni RUC a quien no ha iniciado sesión.
create or replace function fn_estado_instalacion()
returns table (completada boolean, tipo_negocio text, hay_usuarios boolean)
language sql
stable
security definer
set search_path = public
as $$
  select i.completada,
         i.tipo_negocio,
         exists (select 1 from perfiles_usuario limit 1)
  from instalacion i
  limit 1;
$$;

-- El asistente consulta esto antes de que exista una sesión, así que la
-- función se abre al rol anónimo. Los roles anon/authenticated los crea
-- Supabase; el condicional es para que la migración también corra en un
-- PostgreSQL limpio (por ejemplo el de las pruebas).
do $$
declare
  r text;
begin
  foreach r in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('grant execute on function fn_estado_instalacion() to %I', r);
    end if;
  end loop;
end $$;

-- =========================================================
-- PARTE 3 — Completar la instalación
--
-- Carga los catálogos del tipo elegido y deja el sistema listo. Solo
-- corre una vez y solo la puede ejecutar un usuario autenticado que sea
-- ADMIN o el primero de la base (cuando todavía no hay perfiles nadie
-- puede ser admin, así que el primero que entra instala).
-- =========================================================
create or replace function fn_completar_instalacion(
  p_tipo_negocio text,
  p_razon_social text,
  p_ruc text default null,
  p_nombre_comercial text default null,
  p_direccion text default null,
  p_telefono text default null,
  p_email text default null,
  p_sede_nombre text default 'Matriz',
  p_cargar_catalogos boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo tipos_negocio%rowtype;
  v_inst instalacion%rowtype;
  v_hay_perfiles boolean;
  v_unidades int := 0;
  v_categorias int := 0;
  v_zonas int := 0;
  v_bodega uuid;
  v_sede uuid;
  v_zona jsonb;
  v_categoria text;
  v_faltantes text[];
begin
  if auth.uid() is null then
    raise exception 'Inicie sesión antes de instalar el sistema';
  end if;

  select * into v_inst from instalacion limit 1;
  if v_inst.completada then
    raise exception
      'El sistema ya fue instalado como % el %. Para otro tipo de negocio se '
      'necesita una base de datos nueva.',
      v_inst.tipo_negocio, to_char(v_inst.instalada_at, 'DD/MM/YYYY');
  end if;

  select exists (select 1 from perfiles_usuario limit 1) into v_hay_perfiles;
  if v_hay_perfiles and fn_rol_actual() <> 'ADMIN' then
    raise exception 'Solo un administrador puede completar la instalación';
  end if;

  select * into v_tipo from tipos_negocio where codigo = p_tipo_negocio and activo;
  if not found then
    raise exception 'El tipo de negocio "%" no existe en el catálogo', p_tipo_negocio;
  end if;

  if coalesce(trim(p_razon_social), '') = '' then
    raise exception 'La razón social es obligatoria';
  end if;
  if p_ruc is not null and not fn_validar_identificacion('RUC', trim(p_ruc)) then
    raise exception 'El RUC % no es válido', p_ruc;
  end if;

  -- ---- Datos de la empresa ----
  -- El tipo se escribe aquí, antes de marcar la instalación como
  -- completada; después el trigger ya no lo dejaría.
  update empresa set
    razon_social = upper(trim(p_razon_social)),
    nombre_comercial = coalesce(p_nombre_comercial, trim(p_razon_social)),
    ruc = coalesce(trim(p_ruc), ruc),
    direccion_matriz = coalesce(p_direccion, direccion_matriz),
    direccion_establecimiento = coalesce(p_direccion, direccion_establecimiento),
    telefono = coalesce(p_telefono, telefono),
    email = coalesce(p_email, email),
    tipo_negocio = p_tipo_negocio,
    updated_at = now()
  where id = true;

  -- ---- Sede matriz ----
  select id into v_sede from sedes where es_matriz limit 1;
  if v_sede is null then
    insert into sedes (codigo, nombre, direccion, telefono, punto_emision, es_matriz)
    values ('001', coalesce(p_sede_nombre, 'Matriz'), p_direccion, p_telefono, '001', true)
    returning id into v_sede;
  else
    update sedes set nombre = coalesce(p_sede_nombre, nombre),
                     direccion = coalesce(p_direccion, direccion)
    where id = v_sede;
  end if;

  if p_cargar_catalogos then
    -- ---- Unidades ----
    -- Se activan las del tipo y se desactivan las demás. Desactivar y no
    -- borrar: una unidad borrada rompería productos históricos si la base
    -- se reinstalara sobre datos existentes.
    select array_agg(u) into v_faltantes
    from unnest(v_tipo.unidades) u
    where u not in (select codigo from unidades_medida);

    if v_faltantes is not null then
      raise exception 'Faltan unidades en el catálogo: %. Aplique la migración 011 completa.',
        array_to_string(v_faltantes, ', ');
    end if;

    update unidades_medida set activo = (codigo = any(v_tipo.unidades));
    select count(*) into v_unidades from unidades_medida where activo;

    -- ---- Categorías ----
    foreach v_categoria in array v_tipo.categorias loop
      insert into categorias (nombre) values (v_categoria)
      on conflict (nombre) do nothing;
      v_categorias := v_categorias + 1;
    end loop;

    -- ---- Bodega y zonas ----
    select id into v_bodega from bodegas where activa order by created_at limit 1;
    if v_bodega is null then
      insert into bodegas (codigo, nombre, activa)
      values ('PRIN', 'Bodega principal', true)
      returning id into v_bodega;
    end if;
    update bodegas set sede_id = v_sede where sede_id is null;

    for v_zona in select * from jsonb_array_elements(v_tipo.zonas) loop
      insert into zonas (codigo, nombre, tipo_conservacion, bodega_id, orden)
      values (v_zona ->> 'codigo', v_zona ->> 'nombre',
              coalesce(v_zona ->> 'conservacion', 'AMBIENTE'), v_bodega, v_zonas * 10)
      on conflict (codigo) do nothing;
      v_zonas := v_zonas + 1;
    end loop;
  end if;

  -- ---- Cerrar la instalación ----
  update instalacion set
    completada = true,
    tipo_negocio = p_tipo_negocio,
    instalada_at = now(),
    instalada_por = auth.uid(),
    version_sistema = '011'
  where id = true;

  -- Quien instala queda como administrador: si no, nadie podría entrar
  -- después a la pantalla de Administración.
  update perfiles_usuario set rol = 'ADMIN', sede_id = coalesce(sede_id, v_sede)
  where usuario_id = auth.uid();

  return jsonb_build_object(
    'ok', true,
    'tipo_negocio', p_tipo_negocio,
    'unidades_activas', v_unidades,
    'categorias_creadas', v_categorias,
    'zonas_creadas', v_zonas,
    'sede_id', v_sede
  );
end;
$$;

-- =========================================================
-- PARTE 4 — De Una!
--
-- CÓMO SE COBRA DE VERDAD: el cliente escanea el QR del comercio, digita
-- el monto que se le dijo de viva voz y envía la transferencia. No hay
-- token, no hay código que el sistema pueda validar, y exigir uno solo
-- conseguía frenar la caja. Por eso el código de transacción pasa a ser
-- opcional: se anota si el cajero quiere dejar rastro, y nada más.
--
-- El modo con API queda declarado para el día que el negocio firme con
-- el banco. Ahí el QR sí lleva el monto y un webhook confirma el pago.
-- =========================================================
alter table empresa add column if not exists deuna_qr_mime text;
alter table empresa add column if not exists deuna_qr_nombre text;
alter table empresa add column if not exists deuna_instrucciones text;
alter table empresa add column if not exists deuna_modo text not null default 'QR_ESTATICO';
alter table empresa add column if not exists deuna_comercio_id text;
alter table empresa add column if not exists deuna_api_base text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'empresa_deuna_modo_valido') then
    alter table empresa add constraint empresa_deuna_modo_valido
      check (deuna_modo in ('QR_ESTATICO', 'API_TOKEN'));
  end if;
end $$;

comment on column empresa.deuna_modo is
  'QR_ESTATICO: el cliente digita el monto. API_TOKEN: requiere contrato con Deuna; el QR lleva el monto y un webhook confirma el pago.';
comment on column empresa.deuna_api_base is
  'URL del ambiente de Deuna. La clave de API NUNCA va aquí: vive como secreto de la función de borde.';

update empresa set
  deuna_instrucciones = coalesce(deuna_instrucciones,
    'Escanee el código con la app De Una y envíe el valor indicado en pantalla.')
where id = true;

-- Cuando el negocio pase al modo API hará falta registrar lo que
-- devuelve el banco. La tabla se crea ya para no volver a migrar en
-- producción con ventas en curso.
create table if not exists deuna_transacciones (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid references ventas(id) on delete set null,
  referencia_interna text not null unique,
  referencia_banco text,
  monto numeric(14,4) not null check (monto > 0),
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','PAGADA','EXPIRADA','ANULADA','DEVUELTA')),
  qr_payload text,
  respuesta jsonb,
  creada_at timestamptz not null default now(),
  confirmada_at timestamptz,
  creada_por uuid references auth.users(id)
);

create index if not exists ix_deuna_estado on deuna_transacciones (estado, creada_at);

comment on table deuna_transacciones is
  'Solo se usa en modo API_TOKEN. Con QR estático el cobro se registra en pagos_venta.';

-- Configuración pública de De Una para la caja: lo que el navegador
-- necesita para pintar el QR, sin nada sensible.
create or replace function fn_config_deuna()
returns table (activo boolean, modo text, qr_url text, qr_mime text,
               titular text, telefono text, instrucciones text)
language sql
stable
security definer
set search_path = public
as $$
  select e.deuna_activo, e.deuna_modo, e.deuna_qr_url, e.deuna_qr_mime,
         e.deuna_titular, e.deuna_telefono, e.deuna_instrucciones
  from empresa e
  limit 1;
$$;

-- =========================================================
-- PARTE 5 — Seguridad de las tablas nuevas
-- =========================================================
alter table tipos_negocio enable row level security;
alter table instalacion enable row level security;
alter table deuna_transacciones enable row level security;

drop policy if exists "tipos_negocio_lectura" on tipos_negocio;
create policy "tipos_negocio_lectura" on tipos_negocio
  for select using (true);          -- el asistente los lee antes de haber sesión

drop policy if exists "tipos_negocio_admin" on tipos_negocio;
create policy "tipos_negocio_admin" on tipos_negocio
  for all using (fn_es_admin()) with check (fn_es_admin());

drop policy if exists "instalacion_lectura" on instalacion;
create policy "instalacion_lectura" on instalacion
  for select using (auth.role() = 'authenticated');

-- Nadie escribe instalacion directamente: se pasa por
-- fn_completar_instalacion(), que valida y es SECURITY DEFINER.
drop policy if exists "instalacion_admin" on instalacion;
create policy "instalacion_admin" on instalacion
  for update using (fn_es_admin()) with check (fn_es_admin());

drop policy if exists "deuna_lectura" on deuna_transacciones;
create policy "deuna_lectura" on deuna_transacciones
  for select using (auth.role() = 'authenticated');

drop policy if exists "deuna_escritura" on deuna_transacciones;
create policy "deuna_escritura" on deuna_transacciones
  for all using (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO','VENDEDOR'))
  with check (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO','VENDEDOR'));

notify pgrst, 'reload schema';

select 'Migración 011 aplicada: instalación por tipo de negocio y cobro De Una.' as resultado;
