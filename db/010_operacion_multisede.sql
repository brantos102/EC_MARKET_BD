-- =========================================================
-- CENTRO DE CONTROL - MINIMARKET EL CULTIVO
-- Migración 010: sedes, cantidades por unidad, catálogo de roles,
--                correo corporativo, órdenes de compra y De Una
--
-- Esta migración prepara el sistema para salir a producción con más
-- de un local y más de un usuario:
--
--   1. Sedes      — cada local numera sus comprobantes por separado y
--                   un vendedor solo ve el movimiento de su local.
--   2. Cantidades — lo que se vende por unidad ya no acepta decimales;
--                   lo que se pesa, sí, pero con un paso razonable.
--   3. Roles      — el catálogo de roles y el permiso de cada módulo
--                   viven en tablas, no en el código.
--   4. Correo     — configuración, plantillas HTML con etiquetas y una
--                   bandeja de salida con reintentos.
--   5. Compras    — sugerencia de reposición por stock bajo y orden de
--                   compra al proveedor.
--   6. De Una     — datos del QR de cobro del Banco Pichincha.
--
-- Requiere: 009_comprobantes_clientes.sql
-- =========================================================

-- =========================================================
-- PARTE 1 — Sedes (establecimientos)
--
-- El SRI numera los comprobantes como estab-ptoEmisión-secuencial.
-- Si dos locales del mismo RUC comparten el contador, se repiten
-- números y la contabilidad queda inservible. Por eso cada sede
-- guarda su propio código de establecimiento y su propio secuencial.
-- =========================================================
create table if not exists sedes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (codigo ~ '^[0-9]{3}$'),
  nombre text not null,
  direccion text,
  telefono text,
  punto_emision text not null default '001' check (punto_emision ~ '^[0-9]{3}$'),
  es_matriz boolean not null default false,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table sedes is
  'Locales del mismo contribuyente. El código es el establecimiento SRI (001, 002...).';

-- La sede matriz se crea a partir de lo que ya había en empresa.
insert into sedes (codigo, nombre, direccion, telefono, punto_emision, es_matriz)
select
  coalesce(e.establecimiento, '001'),
  coalesce(e.nombre_comercial, e.razon_social, 'Matriz'),
  coalesce(e.direccion_establecimiento, e.direccion_matriz),
  e.telefono,
  coalesce(e.punto_emision, '001'),
  true
from empresa e
where not exists (select 1 from sedes)
limit 1;

alter table bodegas            add column if not exists sede_id uuid references sedes(id);
alter table perfiles_usuario   add column if not exists sede_id uuid references sedes(id);
alter table ventas             add column if not exists sede_id uuid references sedes(id);
alter table documentos_ingreso add column if not exists sede_id uuid references sedes(id);

-- Todo lo que ya existía pertenece a la matriz.
--
-- Las ventas confirmadas y los ingresos confirmados son inmutables por
-- diseño: un trigger impide modificarlos. Aquí no se está alterando un
-- documento contable, solo se le pone la etiqueta de la sede que ya le
-- correspondía, así que se suspende ese trigger durante el relleno y se
-- vuelve a activar de inmediato.
update bodegas          set sede_id = (select id from sedes where es_matriz limit 1) where sede_id is null;
update perfiles_usuario set sede_id = (select id from sedes where es_matriz limit 1) where sede_id is null;

alter table ventas             disable trigger user;
alter table documentos_ingreso disable trigger user;

update ventas             set sede_id = (select id from sedes where es_matriz limit 1) where sede_id is null;
update documentos_ingreso set sede_id = (select id from sedes where es_matriz limit 1) where sede_id is null;

alter table ventas             enable trigger user;
alter table documentos_ingreso enable trigger user;

create index if not exists ix_ventas_sede on ventas(sede_id, fecha);
create index if not exists ix_ingresos_sede on documentos_ingreso(sede_id, fecha_recepcion);

-- Sede del usuario que está operando. Si no tiene una asignada cae en
-- la matriz, para que nunca se quede sin poder facturar.
create or replace function fn_mi_sede()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.sede_id from perfiles_usuario p where p.usuario_id = auth.uid() and p.activo),
    (select s.id from sedes s where s.es_matriz and s.activa limit 1),
    (select s.id from sedes s where s.activa order by s.codigo limit 1)
  );
$$;

-- Al crear una venta o un ingreso se sella la sede del operador. No se
-- confía en lo que mande el navegador: lo decide la base.
create or replace function fn_sellar_sede()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.sede_id is null then
    new.sede_id := coalesce(
      (select b.sede_id from bodegas b where b.id = new.bodega_id),
      fn_mi_sede()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sellar_sede_venta on ventas;
create trigger trg_sellar_sede_venta
  before insert on ventas
  for each row execute function fn_sellar_sede();

drop trigger if exists trg_sellar_sede_ingreso on documentos_ingreso;
create trigger trg_sellar_sede_ingreso
  before insert on documentos_ingreso
  for each row execute function fn_sellar_sede();

-- Numeración por sede: el secuencial se guarda con la clave
-- COMP_<tipo>_<código de sede>, así 001 y 002 nunca chocan.
create or replace function fn_siguiente_comprobante(p_tipo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sede sedes%rowtype;
  v_anio int := extract(year from current_date)::int;
  v_num int;
  v_clave text;
begin
  select * into v_sede from sedes where id = fn_mi_sede();
  if not found then
    select * into v_sede from sedes where activa order by codigo limit 1;
  end if;

  v_clave := 'COMP_' || p_tipo || '_' || coalesce(v_sede.codigo, '001');

  insert into secuencias (tipo, anio, ultimo_numero) values (v_clave, v_anio, 0)
  on conflict (tipo, anio) do nothing;

  update secuencias set ultimo_numero = ultimo_numero + 1
  where tipo = v_clave and anio = v_anio
  returning ultimo_numero into v_num;

  return coalesce(v_sede.codigo, '001') || '-' ||
         coalesce(v_sede.punto_emision, '001') || '-' ||
         lpad(v_num::text, 9, '0');
end;
$$;

-- =========================================================
-- PARTE 2 — Cantidades por unidad
--
-- Un guineo, una funda de arroz o un foco se venden de uno en uno. Que
-- la caja pueda quedar en 1,03 unidades es un error de captura que
-- termina en un inventario que no cuadra. Lo que se pesa sí admite
-- decimales, pero con un paso útil (media libra), no de centésimas.
-- =========================================================
alter table productos add column if not exists paso_venta numeric(12,3) not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'productos_paso_venta_positivo') then
    alter table productos add constraint productos_paso_venta_positivo check (paso_venta > 0);
  end if;
end $$;

-- Paso sugerido según cómo se despacha el producto.
update productos p set paso_venta = case
    when not coalesce(u.permite_fraccion, false) then 1
    when u.codigo in ('LB')                      then 0.5
    when u.codigo in ('KG','LT')                 then 0.25
    when u.codigo in ('G','ML')                  then 50
    else 1
  end
from unidades_medida u
where u.id = p.unidad_medida_id;

-- Rechaza una cantidad fraccionaria en un producto que no se fracciona.
-- Esto vive en la base a propósito: si mañana alguien carga ventas por
-- un script o desde otra pantalla, la regla se sigue cumpliendo.
create or replace function fn_validar_cantidad_producto(p_producto_id uuid, p_cantidad numeric)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fracciona boolean;
  v_nombre text;
  v_unidad text;
begin
  select coalesce(u.permite_fraccion, false), p.nombre, coalesce(u.nombre, 'unidad')
    into v_fracciona, v_nombre, v_unidad
  from productos p
  left join unidades_medida u on u.id = p.unidad_medida_id
  where p.id = p_producto_id;

  if not found then
    return;
  end if;

  if not v_fracciona and p_cantidad <> trunc(p_cantidad) then
    raise exception
      '"%" se despacha por % entera: % no es una cantidad válida. Use un número entero.',
      v_nombre, lower(v_unidad), trim(to_char(p_cantidad, '9999999D999'));
  end if;
end;
$$;

create or replace function fn_trg_validar_cantidad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform fn_validar_cantidad_producto(new.producto_id, new.cantidad);
  return new;
end;
$$;

drop trigger if exists trg_cantidad_venta on venta_detalle;
create trigger trg_cantidad_venta
  before insert or update of cantidad on venta_detalle
  for each row execute function fn_trg_validar_cantidad();

drop trigger if exists trg_cantidad_ingreso on ingreso_detalle;
create trigger trg_cantidad_ingreso
  before insert or update of cantidad on ingreso_detalle
  for each row execute function fn_trg_validar_cantidad();

-- =========================================================
-- PARTE 3 — Catálogo de roles y permisos
--
-- Antes el menú se armaba con una lista dentro del JavaScript. Para
-- cambiar quién ve qué había que tocar el código. Ahora está en tablas
-- que el administrador edita desde la pantalla de Administración.
-- =========================================================
create table if not exists roles_catalogo (
  codigo text primary key,
  nombre text not null,
  descripcion text not null,
  nivel int not null default 10,        -- menor número = más autoridad
  es_sistema boolean not null default false,
  activo boolean not null default true
);

insert into roles_catalogo (codigo, nombre, descripcion, nivel, es_sistema) values
  ('ADMIN', 'Administrador',
   'Dueño o gerente. Configura la empresa, da de alta usuarios, cambia precios y emite tokens. Es el único que puede modificar la configuración del sistema.',
   1, true),
  ('SUPERVISOR', 'Supervisor de tienda',
   'Jefe de turno. Hace todo lo operativo —incluido ajustar inventario y anular ventas— pero no administra usuarios ni cambia los datos de la empresa.',
   2, true),
  ('BODEGUERO', 'Bodeguero',
   'Recibe mercadería, ubica productos en las perchas, controla caducidades y mueve stock entre ubicaciones. Puede vender si le toca cubrir caja.',
   3, true),
  ('VENDEDOR', 'Cajero / Vendedor',
   'Atiende la caja: escanea, cobra, emite nota de venta o factura y consulta stock y ubicaciones. Para ajustar inventario o anular una venta necesita un token del administrador.',
   4, true)
on conflict (codigo) do update
  set nombre = excluded.nombre,
      descripcion = excluded.descripcion,
      nivel = excluded.nivel;

-- Se amplía el check de perfiles_usuario para admitir SUPERVISOR.
do $$
declare
  v_con text;
begin
  select conname into v_con
  from pg_constraint
  where conrelid = 'perfiles_usuario'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%rol%BODEGUERO%';
  if v_con is not null then
    execute format('alter table perfiles_usuario drop constraint %I', v_con);
  end if;
end $$;

alter table perfiles_usuario
  add constraint perfiles_usuario_rol_valido
  check (rol in ('ADMIN','SUPERVISOR','BODEGUERO','VENDEDOR'));

-- Módulos de la aplicación, con el grupo e ícono que usa el menú.
create table if not exists modulos_sistema (
  codigo text primary key,
  nombre text not null,
  grupo text not null,
  icono text not null default 'punto',
  descripcion text,
  orden int not null default 100,
  activo boolean not null default true
);

insert into modulos_sistema (codigo, nombre, grupo, icono, descripcion, orden) values
  ('dashboard',   'Dashboard',              'Operación',     'tablero',    'Resumen del día: ventas, stock bajo y caducidades', 10),
  ('pos',         'Punto de venta',         'Operación',     'carrito',    'Caja: escanear, cobrar e imprimir el comprobante', 20),
  ('ingresos',    'Ingreso de mercadería',  'Operación',     'entrada',    'Recepción de compras y actualización del costo', 30),
  ('layout',      'Mapa del market',        'Bodega',        'mapa',       'Dónde está físicamente cada producto', 40),
  ('caducidades', 'Caducidades',            'Bodega',        'reloj',      'Lotes por vencer y ya vencidos', 50),
  ('kardex',      'Kardex',                 'Bodega',        'libro',      'Historial de cada movimiento de inventario', 60),
  ('movimientos', 'Ajuste manual',          'Bodega',        'ajuste',     'Corrección de stock con motivo y respaldo', 70),
  ('productos',   'Productos',              'Catálogo',      'caja',       'Alta y edición de productos, precios y unidades', 80),
  ('promociones', 'Promociones',            'Catálogo',      'etiqueta',   'Ofertas de temporada: 3 por $1, porcentajes', 90),
  ('bodegas',     'Bodegas',                'Catálogo',      'almacen',    'Bodegas y locales donde hay existencias', 100),
  ('compras',     'Compras a proveedores',  'Catálogo',      'camion',     'Sugerencia de reposición y órdenes de compra', 105),
  ('reportes',    'Reportes',               'Control',       'grafico',    'Ventas, rotación y valorización del inventario', 110),
  ('auditoria',   'Auditoría',              'Control',       'escudo',     'Bitácora de quién hizo qué y cuándo', 120),
  ('admin',       'Administración',         'Control',       'engranaje',  'Empresa, sedes, usuarios, roles, correo y plantillas', 130)
on conflict (codigo) do update
  set nombre = excluded.nombre,
      grupo = excluded.grupo,
      icono = excluded.icono,
      descripcion = excluded.descripcion,
      orden = excluded.orden;

create table if not exists permisos_rol (
  rol text not null references roles_catalogo(codigo) on delete cascade,
  modulo text not null references modulos_sistema(codigo) on delete cascade,
  puede_ver boolean not null default false,
  puede_editar boolean not null default false,
  requiere_token boolean not null default false,
  primary key (rol, modulo)
);

-- Matriz inicial. El administrador la puede cambiar después sin tocar
-- una línea de código.
insert into permisos_rol (rol, modulo, puede_ver, puede_editar, requiere_token)
select r.codigo, m.codigo,
  case
    when r.codigo = 'ADMIN' then true
    when r.codigo = 'SUPERVISOR' then m.codigo <> 'admin'
    when r.codigo = 'BODEGUERO' then m.codigo in
      ('dashboard','pos','ingresos','layout','caducidades','kardex','movimientos',
       'productos','bodegas','compras','reportes')
    else m.codigo in ('dashboard','pos','layout','caducidades','promociones','kardex')
  end,
  case
    when r.codigo = 'ADMIN' then true
    when r.codigo = 'SUPERVISOR' then m.codigo not in ('admin','productos','promociones')
    when r.codigo = 'BODEGUERO' then m.codigo in
      ('pos','ingresos','layout','caducidades','compras')
    else m.codigo in ('pos')
  end,
  case
    when r.codigo in ('BODEGUERO','VENDEDOR') and m.codigo = 'movimientos' then true
    else false
  end
from roles_catalogo r
cross join modulos_sistema m
on conflict (rol, modulo) do nothing;

-- Lo que la interfaz consulta una sola vez al iniciar sesión para
-- armar el menú. Devuelve el módulo, su grupo, su ícono y qué puede
-- hacer el usuario en él.
create or replace function fn_mis_modulos()
returns table (codigo text, nombre text, grupo text, icono text,
               descripcion text, orden int, puede_ver boolean,
               puede_editar boolean, requiere_token boolean)
language sql
stable
security definer
set search_path = public
as $$
  select m.codigo, m.nombre, m.grupo, m.icono, m.descripcion, m.orden,
         coalesce(pr.puede_ver, false),
         coalesce(pr.puede_editar, false),
         coalesce(pr.requiere_token, false)
  from modulos_sistema m
  left join permisos_rol pr
    on pr.modulo = m.codigo and pr.rol = fn_rol_actual()
  where m.activo
  order by m.orden;
$$;

-- Perfil ampliado: rol, sede y nombre legible del rol.
create or replace function fn_mi_perfil_completo()
returns table (usuario_id uuid, nombre text, rol text, rol_nombre text,
               rol_descripcion text, sede_id uuid, sede_nombre text,
               sede_codigo text, activo boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.usuario_id, p.nombre, p.rol,
         coalesce(rc.nombre, p.rol),
         coalesce(rc.descripcion, ''),
         coalesce(p.sede_id, fn_mi_sede()),
         coalesce(s.nombre, (select nombre from sedes where es_matriz limit 1)),
         coalesce(s.codigo, (select codigo from sedes where es_matriz limit 1)),
         p.activo
  from perfiles_usuario p
  left join roles_catalogo rc on rc.codigo = p.rol
  left join sedes s on s.id = p.sede_id
  where p.usuario_id = auth.uid();
$$;

-- =========================================================
-- PARTE 4 — Correo corporativo, plantillas y bandeja de salida
--
-- El sistema no habla SMTP por sí mismo: deja el correo listo en
-- cola_correo y una función de borde (Edge Function) lo envía. Así la
-- clave del proveedor de correo nunca viaja al navegador.
-- =========================================================
create table if not exists correo_config (
  id boolean primary key default true check (id),
  proveedor text not null default 'RESEND' check (proveedor in ('RESEND','SMTP','NINGUNO')),
  remitente_email text,
  remitente_nombre text,
  responder_a text,
  copia_oculta text,
  firma_html text,
  activo boolean not null default false,
  notas text,
  updated_at timestamptz not null default now()
);

insert into correo_config (id) values (true) on conflict (id) do nothing;

update correo_config set
  remitente_nombre = coalesce(remitente_nombre, 'Minimarket El Cultivo'),
  notas = coalesce(notas,
    'Configure el dominio verificado en el proveedor antes de activar. La clave del API se guarda como secreto de la Edge Function, nunca en esta tabla.')
where id = true;

create table if not exists plantillas_correo (
  codigo text primary key,
  nombre text not null,
  descripcion text,
  asunto text not null,
  cuerpo_html text not null,
  activa boolean not null default true,
  es_sistema boolean not null default false,
  actualizada_at timestamptz not null default now(),
  actualizada_por uuid references auth.users(id)
);

comment on table plantillas_correo is
  'Cuerpo HTML con etiquetas {{grupo.campo}} que se reemplazan al enviar.';

insert into plantillas_correo (codigo, nombre, descripcion, asunto, cuerpo_html, es_sistema) values
(
  'COMPROBANTE_CLIENTE',
  'Comprobante al cliente',
  'Se envía al cliente cuando deja su correo en la venta.',
  '{{empresa.nombre_comercial}} — comprobante {{venta.numero_comprobante}}',
  '<div style="font-family:Arial,Helvetica,sans-serif;color:#1d2b1f;max-width:600px">
  <div style="background:#013D10;color:#fff;padding:20px;border-radius:8px 8px 0 0">
    <h2 style="margin:0;font-size:18px">{{empresa.nombre_comercial}}</h2>
    <p style="margin:4px 0 0;font-size:13px;opacity:.85">{{empresa.pie_recibo}}</p>
  </div>
  <div style="border:1px solid #d8e6d9;border-top:0;padding:20px;border-radius:0 0 8px 8px">
    <p>Estimado/a <b>{{cliente.nombre}}</b>:</p>
    <p>Adjuntamos el detalle de su compra del {{venta.fecha}}.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr><td style="padding:6px 0">Comprobante</td><td align="right"><b>{{venta.numero_comprobante}}</b></td></tr>
      <tr><td style="padding:6px 0">Subtotal</td><td align="right">{{venta.subtotal}}</td></tr>
      <tr><td style="padding:6px 0">Descuentos</td><td align="right">-{{venta.descuento}}</td></tr>
      <tr><td style="padding:6px 0">IVA</td><td align="right">{{venta.iva}}</td></tr>
      <tr><td style="padding:10px 0;border-top:2px solid #013D10"><b>TOTAL</b></td>
          <td align="right" style="padding:10px 0;border-top:2px solid #013D10"><b>{{venta.total}}</b></td></tr>
    </table>
    {{venta.detalle_html}}
    <p style="font-size:12px;color:#5a6b5c">{{empresa.razon_social}} · RUC {{empresa.ruc}} · {{empresa.direccion_establecimiento}}</p>
  </div>
</div>',
  true
),
(
  'ORDEN_COMPRA_PROVEEDOR',
  'Orden de compra al proveedor',
  'Solicitud de abastecimiento que se genera cuando hay productos bajo el mínimo.',
  'Orden de compra {{orden.numero}} — {{empresa.nombre_comercial}}',
  '<div style="font-family:Arial,Helvetica,sans-serif;color:#1d2b1f;max-width:640px">
  <div style="background:#013D10;color:#fff;padding:20px;border-radius:8px 8px 0 0">
    <h2 style="margin:0;font-size:18px">Orden de compra {{orden.numero}}</h2>
    <p style="margin:4px 0 0;font-size:13px;opacity:.85">{{empresa.razon_social}} · RUC {{empresa.ruc}}</p>
  </div>
  <div style="border:1px solid #d8e6d9;border-top:0;padding:20px;border-radius:0 0 8px 8px">
    <p>Señores <b>{{proveedor.razon_social}}</b>:</p>
    <p>Solicitamos el abastecimiento de los siguientes productos. La cantidad pedida
       considera la rotación de las últimas semanas y el stock mínimo de cada ítem.</p>
    {{orden.detalle_html}}
    <p><b>Entregar en:</b> {{sede.nombre}} — {{sede.direccion}}<br />
       <b>Fecha requerida:</b> {{orden.fecha_requerida}}</p>
    <p style="font-size:12px;color:#5a6b5c">Contacto: {{empresa.telefono}} · {{empresa.email}}</p>
  </div>
</div>',
  true
),
(
  'ALERTA_STOCK_BAJO',
  'Aviso interno de stock bajo',
  'Resumen que se envía al administrador con los productos bajo el mínimo.',
  'Stock bajo en {{sede.nombre}} — {{alerta.cantidad_productos}} productos',
  '<div style="font-family:Arial,Helvetica,sans-serif;color:#1d2b1f;max-width:640px">
  <h2 style="color:#013D10;font-size:17px">Productos que necesitan reposición</h2>
  <p>Al {{alerta.fecha}} hay <b>{{alerta.cantidad_productos}}</b> productos por debajo del
     stock mínimo en {{sede.nombre}}.</p>
  {{alerta.detalle_html}}
  <p style="font-size:12px;color:#5a6b5c">Generado automáticamente por el sistema de inventario.</p>
</div>',
  true
)
on conflict (codigo) do nothing;

create table if not exists cola_correo (
  id uuid primary key default gen_random_uuid(),
  plantilla text references plantillas_correo(codigo),
  destinatario text not null,
  destinatario_nombre text,
  asunto text not null,
  cuerpo_html text not null,
  referencia_tipo text,                 -- VENTA, ORDEN_COMPRA, ALERTA
  referencia_id uuid,
  estado text not null default 'PENDIENTE'
    check (estado in ('PENDIENTE','ENVIADO','ERROR','CANCELADO')),
  intentos int not null default 0,
  ultimo_error text,
  enviado_at timestamptz,
  created_at timestamptz not null default now(),
  creado_por uuid references auth.users(id)
);

create index if not exists ix_cola_correo_pendiente
  on cola_correo (estado, created_at) where estado = 'PENDIENTE';

-- Reemplaza {{clave}} por el valor correspondiente. Acepta un JSON
-- plano ({"cliente.nombre": "..."}) o anidado ({"cliente": {"nombre": ...}}).
create or replace function fn_renderizar_plantilla(p_texto text, p_datos jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_salida text := coalesce(p_texto, '');
  v_clave text;
  v_valor text;
  v_grupo text;
  v_campo text;
begin
  for v_clave in
    select distinct (regexp_matches(v_salida, '\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}', 'g'))[1]
  loop
    v_valor := null;

    -- Clave plana
    if p_datos ? v_clave then
      v_valor := p_datos ->> v_clave;
    elsif position('.' in v_clave) > 0 then
      v_grupo := split_part(v_clave, '.', 1);
      v_campo := split_part(v_clave, '.', 2);
      if p_datos ? v_grupo and jsonb_typeof(p_datos -> v_grupo) = 'object' then
        v_valor := (p_datos -> v_grupo) ->> v_campo;
      end if;
    end if;

    v_salida := regexp_replace(
      v_salida,
      '\{\{\s*' || replace(v_clave, '.', '\.') || '\s*\}\}',
      coalesce(v_valor, ''),
      'g'
    );
  end loop;

  return v_salida;
end;
$$;

-- Toma la plantilla, la rellena y la deja lista para enviar.
create or replace function fn_encolar_correo(
  p_plantilla text,
  p_destinatario text,
  p_datos jsonb,
  p_destinatario_nombre text default null,
  p_referencia_tipo text default null,
  p_referencia_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pl plantillas_correo%rowtype;
  v_cfg correo_config%rowtype;
  v_id uuid;
  v_cuerpo text;
begin
  if coalesce(trim(p_destinatario), '') = '' then
    raise exception 'Falta el correo del destinatario';
  end if;
  if p_destinatario !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-zA-Z]{2,}$' then
    raise exception 'El correo "%" no tiene un formato válido', p_destinatario;
  end if;

  select * into v_pl from plantillas_correo where codigo = p_plantilla and activa;
  if not found then
    raise exception 'No existe una plantilla activa con código %', p_plantilla;
  end if;

  select * into v_cfg from correo_config limit 1;
  v_cuerpo := fn_renderizar_plantilla(v_pl.cuerpo_html, p_datos);
  if coalesce(v_cfg.firma_html, '') <> '' then
    v_cuerpo := v_cuerpo || v_cfg.firma_html;
  end if;

  insert into cola_correo (plantilla, destinatario, destinatario_nombre, asunto,
                           cuerpo_html, referencia_tipo, referencia_id, creado_por)
  values (p_plantilla, lower(trim(p_destinatario)), p_destinatario_nombre,
          fn_renderizar_plantilla(v_pl.asunto, p_datos),
          v_cuerpo, p_referencia_tipo, p_referencia_id, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

-- Datos de una venta listos para la plantilla, con el detalle ya
-- formateado como tabla HTML.
create or replace function fn_datos_correo_venta(p_venta_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
  v_detalle text;
begin
  select string_agg(
    format('<tr><td style="padding:4px 0">%s</td><td align="center">%s</td><td align="right">$%s</td></tr>',
           p.nombre,
           trim(to_char(d.cantidad, 'FM9999999.999')),
           trim(to_char(d.subtotal, 'FM999999990.00'))),
    '' order by p.nombre)
  into v_detalle
  from venta_detalle d
  join productos p on p.id = d.producto_id
  where d.venta_id = p_venta_id;

  select jsonb_build_object(
    'venta', jsonb_build_object(
      'numero_comprobante', coalesce(c.numero_comprobante, c.numero_interno),
      'tipo', case when c.tipo_comprobante = 'FACTURA' then 'Factura' else 'Nota de venta' end,
      'fecha', to_char(c.fecha, 'DD/MM/YYYY'),
      'subtotal', '$' || trim(to_char(c.subtotal, 'FM999999990.00')),
      'descuento', '$' || trim(to_char(c.descuento, 'FM999999990.00')),
      'iva', '$' || trim(to_char(c.valor_impuesto, 'FM999999990.00')),
      'total', '$' || trim(to_char(c.total, 'FM999999990.00')),
      'cajero', coalesce(c.cajero_nombre, ''),
      'detalle_html', coalesce(
        '<table style="width:100%;border-collapse:collapse;font-size:13px">' ||
        '<tr style="border-bottom:1px solid #d8e6d9"><th align="left">Producto</th>' ||
        '<th align="center">Cant.</th><th align="right">Valor</th></tr>' ||
        v_detalle || '</table>', '')
    ),
    'cliente', jsonb_build_object(
      'nombre', coalesce(c.cliente_nombre, 'CONSUMIDOR FINAL'),
      'identificacion', coalesce(c.cliente_identificacion, ''),
      'email', coalesce(c.cliente_email, ''),
      'direccion', coalesce(c.cliente_direccion, '')
    ),
    'empresa', jsonb_build_object(
      'razon_social', coalesce(c.razon_social, ''),
      'nombre_comercial', coalesce(c.nombre_comercial, c.razon_social, ''),
      'ruc', coalesce(c.ruc, ''),
      'direccion_establecimiento', coalesce(c.direccion_establecimiento, ''),
      'telefono', coalesce(c.empresa_telefono, ''),
      'email', coalesce(c.empresa_email, ''),
      'pie_recibo', coalesce(c.pie_recibo, '')
    )
  ) into v
  from v_comprobante c
  where c.venta_id = p_venta_id;

  return coalesce(v, '{}'::jsonb);
end;
$$;

-- =========================================================
-- PARTE 5 — Reposición y órdenes de compra
-- =========================================================
drop view if exists v_sugerencia_reposicion cascade;
create view v_sugerencia_reposicion as
with rotacion as (
  select d.producto_id,
         sum(d.cantidad) as vendido_30d,
         sum(d.cantidad) / 30.0 as promedio_diario
  from venta_detalle d
  join ventas v on v.id = d.venta_id
  where v.estado = 'CONFIRMADA'
    and v.fecha >= current_date - 30
  group by d.producto_id
),
ultimo_proveedor as (
  select distinct on (det.producto_id)
         det.producto_id, di.proveedor_id, det.costo_unitario
  from ingreso_detalle det
  join documentos_ingreso di on di.id = det.documento_ingreso_id
  where di.estado = 'CONFIRMADO'
  order by det.producto_id, di.fecha_recepcion desc
)
select
  p.id as producto_id,
  p.codigo,
  p.nombre,
  p.stock_minimo,
  s.bodega_id,
  b.sede_id,
  coalesce(s.stock, 0) as stock,
  coalesce(r.vendido_30d, 0) as vendido_30d,
  round(coalesce(r.promedio_diario, 0), 3) as promedio_diario,
  -- Se pide lo que falta para el mínimo más dos semanas de rotación,
  -- redondeado hacia arriba a un múltiplo del paso de venta.
  greatest(
    ceil(
      (greatest(p.stock_minimo - coalesce(s.stock, 0), 0)
       + coalesce(r.promedio_diario, 0) * 14) / p.paso_venta
    ) * p.paso_venta,
    p.paso_venta
  ) as cantidad_sugerida,
  up.proveedor_id,
  pr.razon_social as proveedor,
  pr.email as proveedor_email,
  up.costo_unitario as ultimo_costo,
  case
    when coalesce(s.stock, 0) <= 0 then 'AGOTADO'
    when coalesce(s.stock, 0) < p.stock_minimo * 0.5 then 'CRITICO'
    else 'BAJO'
  end as urgencia
from productos p
join inventario_saldos s on s.producto_id = p.id
join bodegas b on b.id = s.bodega_id
left join rotacion r on r.producto_id = p.id
left join ultimo_proveedor up on up.producto_id = p.id
left join proveedores pr on pr.id = up.proveedor_id
where p.activo
  and coalesce(s.stock, 0) < p.stock_minimo;

comment on view v_sugerencia_reposicion is
  'Productos bajo el mínimo con la cantidad a pedir según rotación de 30 días.';

create table if not exists ordenes_compra (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  proveedor_id uuid not null references proveedores(id),
  sede_id uuid references sedes(id),
  fecha date not null default current_date,
  fecha_requerida date,
  estado text not null default 'BORRADOR'
    check (estado in ('BORRADOR','ENVIADA','RECIBIDA','ANULADA')),
  observaciones text,
  total_estimado numeric(14,4) not null default 0,
  correo_id uuid references cola_correo(id),
  created_at timestamptz not null default now(),
  creado_por uuid references auth.users(id)
);

create table if not exists orden_compra_detalle (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references ordenes_compra(id) on delete cascade,
  producto_id uuid not null references productos(id),
  cantidad numeric(14,4) not null check (cantidad > 0),
  costo_estimado numeric(14,4) not null default 0,
  unique (orden_id, producto_id)
);

create or replace function fn_recalcular_total_orden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_orden uuid := coalesce(new.orden_id, old.orden_id);
begin
  update ordenes_compra o
  set total_estimado = coalesce(
    (select sum(d.cantidad * d.costo_estimado) from orden_compra_detalle d where d.orden_id = v_orden), 0)
  where o.id = v_orden;
  return null;
end;
$$;

drop trigger if exists trg_total_orden on orden_compra_detalle;
create trigger trg_total_orden
  after insert or update or delete on orden_compra_detalle
  for each row execute function fn_recalcular_total_orden();

-- Crea la orden con los productos indicados. p_items es un arreglo
-- [{"producto_id": "...", "cantidad": 10, "costo": 0.85}, ...]
create or replace function fn_crear_orden_compra(
  p_proveedor_id uuid,
  p_items jsonb,
  p_fecha_requerida date default null,
  p_observaciones text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_numero text;
  v_item jsonb;
begin
  if fn_rol_actual() not in ('ADMIN','SUPERVISOR','BODEGUERO') then
    raise exception 'Su rol no puede generar órdenes de compra';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'La orden de compra no tiene productos';
  end if;

  v_numero := fn_siguiente_secuencia('ORDEN_COMPRA', 'OC');

  insert into ordenes_compra (numero, proveedor_id, sede_id, fecha_requerida,
                              observaciones, creado_por)
  values (v_numero, p_proveedor_id, fn_mi_sede(),
          coalesce(p_fecha_requerida, current_date + 3), p_observaciones, auth.uid())
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into orden_compra_detalle (orden_id, producto_id, cantidad, costo_estimado)
    values (v_id,
            (v_item ->> 'producto_id')::uuid,
            (v_item ->> 'cantidad')::numeric,
            coalesce((v_item ->> 'costo')::numeric, 0))
    on conflict (orden_id, producto_id) do update
      set cantidad = excluded.cantidad,
          costo_estimado = excluded.costo_estimado;
  end loop;

  return v_id;
end;
$$;

-- Deja la orden lista en la bandeja de salida con la plantilla del
-- proveedor ya rellenada.
create or replace function fn_enviar_orden_compra(p_orden_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_o ordenes_compra%rowtype;
  v_p proveedores%rowtype;
  v_s sedes%rowtype;
  v_e empresa%rowtype;
  v_detalle text;
  v_datos jsonb;
  v_correo uuid;
begin
  select * into v_o from ordenes_compra where id = p_orden_id;
  if not found then
    raise exception 'La orden de compra no existe';
  end if;
  select * into v_p from proveedores where id = v_o.proveedor_id;
  if coalesce(trim(v_p.email), '') = '' then
    raise exception 'El proveedor % no tiene correo registrado. Agréguelo en Administración → Proveedores.', v_p.razon_social;
  end if;

  select * into v_s from sedes where id = coalesce(v_o.sede_id, fn_mi_sede());
  select * into v_e from empresa limit 1;

  select '<table style="width:100%;border-collapse:collapse;font-size:13px;margin:14px 0">'
         || '<tr style="background:#eef6ef"><th align="left" style="padding:6px">Código</th>'
         || '<th align="left" style="padding:6px">Producto</th>'
         || '<th align="center" style="padding:6px">Cantidad</th>'
         || '<th align="left" style="padding:6px">Unidad</th></tr>'
         || string_agg(
              format('<tr><td style="padding:6px;border-top:1px solid #e3ede4">%s</td>'
                  || '<td style="padding:6px;border-top:1px solid #e3ede4">%s</td>'
                  || '<td align="center" style="padding:6px;border-top:1px solid #e3ede4">%s</td>'
                  || '<td style="padding:6px;border-top:1px solid #e3ede4">%s</td></tr>',
                     pr.codigo, pr.nombre,
                     trim(to_char(d.cantidad, 'FM9999999.999')),
                     coalesce(u.nombre, 'Unidad')),
              '' order by pr.nombre)
         || '</table>'
  into v_detalle
  from orden_compra_detalle d
  join productos pr on pr.id = d.producto_id
  left join unidades_medida u on u.id = pr.unidad_medida_id
  where d.orden_id = p_orden_id;

  v_datos := jsonb_build_object(
    'orden', jsonb_build_object(
      'numero', v_o.numero,
      'fecha', to_char(v_o.fecha, 'DD/MM/YYYY'),
      'fecha_requerida', to_char(coalesce(v_o.fecha_requerida, v_o.fecha + 3), 'DD/MM/YYYY'),
      'observaciones', coalesce(v_o.observaciones, ''),
      'detalle_html', coalesce(v_detalle, '')),
    'proveedor', jsonb_build_object(
      'razon_social', v_p.razon_social,
      'ruc', v_p.ruc,
      'email', v_p.email),
    'sede', jsonb_build_object(
      'nombre', coalesce(v_s.nombre, ''),
      'direccion', coalesce(v_s.direccion, '')),
    'empresa', jsonb_build_object(
      'razon_social', coalesce(v_e.razon_social, ''),
      'nombre_comercial', coalesce(v_e.nombre_comercial, v_e.razon_social, ''),
      'ruc', coalesce(v_e.ruc, ''),
      'telefono', coalesce(v_e.telefono, ''),
      'email', coalesce(v_e.email, '')));

  v_correo := fn_encolar_correo(
    'ORDEN_COMPRA_PROVEEDOR', v_p.email, v_datos,
    v_p.razon_social, 'ORDEN_COMPRA', p_orden_id);

  update ordenes_compra
  set estado = 'ENVIADA', correo_id = v_correo
  where id = p_orden_id;

  return v_correo;
end;
$$;

-- =========================================================
-- PARTE 6 — De Una! (cobro con QR del Banco Pichincha)
--
-- El QR estático del comercio se descarga de la banca en línea y se
-- carga aquí. La caja lo muestra a pantalla completa para que el
-- cliente lo escanee; el cajero anota el código de la transacción.
-- La integración por API exige un contrato comercial con Deuna y se
-- documenta en PUBLICACION.md.
-- =========================================================
alter table empresa add column if not exists deuna_qr_url text;
alter table empresa add column if not exists deuna_titular text;
alter table empresa add column if not exists deuna_telefono text;
alter table empresa add column if not exists deuna_activo boolean not null default false;

-- =========================================================
-- PARTE 7 — Seguridad de las tablas nuevas
-- =========================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'sedes','roles_catalogo','modulos_sistema','permisos_rol',
    'plantillas_correo','correo_config','cola_correo',
    'ordenes_compra','orden_compra_detalle'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Catálogos: todos los autenticados leen, solo el admin escribe.
do $$
declare
  t text;
begin
  foreach t in array array['sedes','roles_catalogo','modulos_sistema','permisos_rol',
                           'plantillas_correo','correo_config'] loop
    execute format('drop policy if exists "%s_lectura" on %I', t, t);
    execute format('drop policy if exists "%s_admin" on %I', t, t);
    execute format(
      'create policy "%s_lectura" on %I for select using (auth.role() = ''authenticated'')', t, t);
    execute format(
      'create policy "%s_admin" on %I for all using (fn_es_admin()) with check (fn_es_admin())', t, t);
  end loop;
end $$;

-- Correo: lo ve el administrador; lo encolan las funciones, que son
-- SECURITY DEFINER y por tanto no pasan por estas políticas.
drop policy if exists "correo_admin" on cola_correo;
create policy "correo_admin" on cola_correo
  for all using (fn_rol_actual() in ('ADMIN','SUPERVISOR'))
  with check (fn_rol_actual() in ('ADMIN','SUPERVISOR'));

-- Órdenes de compra: las ve y crea quien abastece.
drop policy if exists "oc_lectura" on ordenes_compra;
drop policy if exists "oc_escritura" on ordenes_compra;
create policy "oc_lectura" on ordenes_compra
  for select using (auth.role() = 'authenticated');
create policy "oc_escritura" on ordenes_compra
  for all using (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO'))
  with check (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO'));

drop policy if exists "ocd_lectura" on orden_compra_detalle;
drop policy if exists "ocd_escritura" on orden_compra_detalle;
create policy "ocd_lectura" on orden_compra_detalle
  for select using (auth.role() = 'authenticated');
create policy "ocd_escritura" on orden_compra_detalle
  for all using (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO'))
  with check (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO'));

-- SUPERVISOR hereda los permisos de escritura que ya tenían ADMIN y
-- BODEGUERO en las tablas de operación creadas en 008.
do $$
declare
  t text;
begin
  foreach t in array array['productos','categorias','bodegas','proveedores',
                           'ubicaciones','zonas','unidades_medida'] loop
    if to_regclass(t) is not null then
      execute format('drop policy if exists "%s_escritura" on %I', t, t);
      execute format(
        'create policy "%s_escritura" on %I for all
           using (fn_rol_actual() in (''ADMIN'',''SUPERVISOR'',''BODEGUERO''))
           with check (fn_rol_actual() in (''ADMIN'',''SUPERVISOR'',''BODEGUERO''))', t, t);
    end if;
  end loop;
end $$;

-- =========================================================
-- PARTE 8 — Vista del punto de venta con el paso de cantidad
-- =========================================================
drop view if exists v_pos_productos cascade;
create view v_pos_productos as
select
  p.id as producto_id,
  p.codigo,
  p.ean13,
  p.nombre,
  p.marca,
  p.categoria_id,
  p.precio_venta_menor,
  p.precio_venta_mayor,
  p.cantidad_minima_mayor,
  p.codigo_impuesto,
  coalesce(ti.porcentaje, 0) as tarifa_impuesto,
  coalesce(u.codigo, 'UND') as unidad,
  coalesce(u.nombre, 'Unidad') as unidad_nombre,
  coalesce(u.permite_fraccion, false) as permite_fraccion,
  coalesce(p.paso_venta, 1) as paso_venta,
  p.stock_minimo,
  s.bodega_id,
  coalesce(s.stock, 0) as stock,
  (
    select string_agg(ub.codigo, ', ' order by ub.codigo)
    from producto_ubicacion pu
    join ubicaciones ub on ub.id = pu.ubicacion_id
    where pu.producto_id = p.id
  ) as ubicacion
from productos p
join inventario_saldos s on s.producto_id = p.id
left join unidades_medida u on u.id = p.unidad_medida_id
left join lateral (
  select t.porcentaje
  from tarifas_impuesto t
  where t.codigo = p.codigo_impuesto
    and t.vigencia_desde <= current_date
    and (t.vigencia_hasta is null or t.vigencia_hasta >= current_date)
  order by t.vigencia_desde desc
  limit 1
) ti on true
where p.activo;

notify pgrst, 'reload schema';

select 'Migración 010 aplicada: sedes, cantidades por unidad, roles, correo, compras y De Una.' as resultado;
