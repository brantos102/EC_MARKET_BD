-- =========================================================
-- CENTRO DE CONTROL
-- Migración 015: presentaciones de compra y códigos de barras
--
-- DOS PROBLEMAS REALES DEL MOSTRADOR, Y CÓMO SE RESUELVEN AQUÍ
--
-- 1. SE COMPRA POR PAQUETE Y SE VENDE POR UNIDAD.
--    El proveedor factura "6 paquetes x 24 gaseosas" y el market vende
--    la gaseosa de una en una. Hasta ahora el ingreso pedía escribir
--    144 y calcular a mano el costo por unidad. Dos operaciones
--    mentales en la bodega, con el camión esperando, es una receta
--    para el error: se digita 6 en vez de 144 y el stock queda mal
--    para siempre.
--
--    LA REGLA QUE SE ADOPTA: el inventario se lleva SIEMPRE en la
--    unidad de venta (unidad, libra, litro). La presentación —caja,
--    paquete, quintal— es una forma de CONTAR al comprar y de vender
--    al por mayor, no una segunda bodega. El sistema multiplica por el
--    factor al recibir y divide el costo del bulto entre el factor.
--    Así el stock es uno solo y siempre es real; no hay que "abrir
--    paquetes" ni cuadrar dos saldos que se separan.
--
--    Para mirarlo como lo mira el bodeguero, la vista
--    v_stock_presentacion descompone ese saldo único: 244 unidades se
--    leen como "10 cajas + 4 unidades".
--
-- 2. EL PROVEEDOR CAMBIA EL CÓDIGO DE BARRAS.
--    El mismo producto llega hoy con un EAN y en tres meses con otro,
--    y en la percha conviven los dos. Guardar un solo código por
--    producto obliga a elegir cuál, y el otro deja de pasar por la
--    caja: o no se puede vender, o alguien lo carga como producto
--    nuevo y el inventario se parte en dos.
--
--    LA REGLA: un producto tiene TODOS sus códigos. producto_codigos
--    guarda cada uno, con su fecha y quién lo agregó. El código viejo
--    sigue vendiendo mientras exista mercadería con él; el nuevo se
--    registra al recibirlo, sin tocar el inventario ni el precio. Un
--    código nunca se borra: se desactiva.
--
-- Requiere: 014_impresion_termica.sql
-- =========================================================

-- ---------------------------------------------------------
-- PARTE 1 — Presentaciones
-- ---------------------------------------------------------
create table if not exists presentaciones (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references productos(id) on delete cascade,
  nombre          text not null,                    -- 'Caja x 24', 'Quintal'
  tipo            text not null default 'PAQUETE',
  factor          numeric(14,4) not null,           -- unidades base que contiene
  es_base         boolean not null default false,   -- la de factor 1
  para_compra     boolean not null default true,
  para_venta      boolean not null default false,   -- venta al por mayor
  precio_venta    numeric(14,4),                    -- precio del bulto completo
  costo_ultimo    numeric(14,6),
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),

  constraint presentaciones_factor_positivo check (factor > 0),
  constraint presentaciones_tipo_valido check (
    tipo in ('UNIDAD','PAQUETE','CAJA','DISPLAY','FARDO','SACO','QUINTAL',
             'DOCENA','BANDEJA','PLANCHA','GAVETA','BOTELLON','OTRO')),
  constraint presentaciones_nombre_unico unique (producto_id, nombre)
);

comment on table presentaciones is
  'Formas de contar un producto al comprarlo o venderlo al por mayor. El factor dice cuántas '
  'unidades de venta contiene. El inventario NO se lleva por presentación: se lleva en la '
  'unidad base y la presentación solo multiplica o divide.';
comment on column presentaciones.factor is
  'Unidades base que contiene. Una caja de 24 gaseosas tiene factor 24; un quintal de arroz '
  'vendido por libra tiene factor 100.';
comment on column presentaciones.para_venta is
  'Si el bulto completo se puede cobrar en caja (venta al por mayor). Descuenta factor '
  'unidades del mismo stock, no de un saldo aparte.';

create index if not exists ix_presentaciones_producto on presentaciones (producto_id) where activo;

-- Una sola presentación base por producto: es la que representa la
-- unidad de venta y no tiene sentido duplicarla.
create unique index if not exists ux_presentacion_base
  on presentaciones (producto_id) where es_base;

-- La base siempre vale 1: si alguien la crea con otro factor, todas las
-- conversiones del sistema quedarían corridas y en silencio.
create or replace function fn_validar_presentacion_base()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.es_base and new.factor <> 1 then
    raise exception
      'La presentación base de un producto representa la unidad de venta, así que su factor '
      'tiene que ser 1 (se recibió %). Si este bulto contiene varias unidades, no es la base.',
      new.factor;
  end if;
  return new;
end $$;

drop trigger if exists trg_presentacion_base on presentaciones;
create trigger trg_presentacion_base
  before insert or update on presentaciones
  for each row execute function fn_validar_presentacion_base();

-- ---------------------------------------------------------
-- PARTE 2 — Códigos de barras por producto
-- ---------------------------------------------------------
create table if not exists producto_codigos (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references productos(id) on delete cascade,
  codigo          text not null,
  tipo            text not null default 'EAN13',
  presentacion_id uuid references presentaciones(id) on delete set null,
  principal       boolean not null default false,
  origen          text not null default 'MANUAL',
  observacion     text,
  activo          boolean not null default true,
  usuario_id      uuid,
  created_at      timestamptz not null default now(),

  constraint producto_codigos_unico unique (codigo),
  constraint producto_codigos_tipo_valido check (
    tipo in ('EAN13','EAN8','UPC','INTERNO','PROVEEDOR','QR','OTRO')),
  constraint producto_codigos_origen_valido check (
    origen in ('MANUAL','RECEPCION','MIGRACION','PROVEEDOR','IMPORTACION'))
);

comment on table producto_codigos is
  'Todos los códigos de barras de un producto, no solo el último. El proveedor cambia el EAN '
  'y en la percha conviven los dos: si se guardara uno solo, el otro dejaría de pasar por caja.';
comment on column producto_codigos.presentacion_id is
  'Cuando el código es el de la caja y no el de la unidad. Al leerlo, la caja sabe que son '
  'factor unidades y no una.';
comment on column producto_codigos.activo is
  'Un código no se borra: se desactiva. Borrarlo dejaría sin explicación las ventas viejas '
  'que se hicieron con él.';

create index if not exists ix_producto_codigos_producto on producto_codigos (producto_id);
create index if not exists ix_producto_codigos_busqueda on producto_codigos (codigo) where activo;
create unique index if not exists ux_producto_codigo_principal
  on producto_codigos (producto_id) where principal;

-- El EAN-13 tiene dígito verificador; el EAN-8 y el UPC también. Se
-- comprueba al guardar, no al vender: un código mal tecleado que entra
-- hoy se descubre el día que un producto no pasa por la caja.
create or replace function fn_validar_codigo_producto()
returns trigger language plpgsql set search_path = public as $$
begin
  new.codigo := upper(trim(new.codigo));

  if new.codigo = '' then
    raise exception 'El código no puede estar vacío.';
  end if;

  if new.tipo = 'EAN13' then
    if new.codigo !~ '^[0-9]{13}$' then
      raise exception
        'Un EAN-13 son exactamente 13 dígitos; se recibió "%" (% caracteres). '
        'Si el código impreso es más corto puede ser un EAN-8 o un UPC: elija ese tipo.',
        new.codigo, length(new.codigo);
    end if;
    if not fn_validar_ean13(new.codigo) then
      raise exception
        'El código "%" no es un EAN-13 válido: el último dígito no cuadra con el resto. '
        'Suele ser un dígito mal leído; vuelva a escanearlo.', new.codigo;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_validar_codigo_producto on producto_codigos;
create trigger trg_validar_codigo_producto
  before insert or update on producto_codigos
  for each row execute function fn_validar_codigo_producto();

-- ---------------------------------------------------------
-- PARTE 3 — Traer lo que ya existe
--
-- Cada producto activo estrena su presentación base y su código actual
-- pasa a ser el principal. Sin esto, el primer día después de la
-- migración ningún producto tendría códigos y la caja quedaría ciega.
-- ---------------------------------------------------------
insert into presentaciones (producto_id, nombre, tipo, factor, es_base, para_compra, para_venta)
select p.id,
       coalesce(u.nombre, 'Unidad'),
       'UNIDAD',
       1,
       true,
       true,
       false
from productos p
left join unidades_medida u on u.id = p.unidad_medida_id
where not exists (select 1 from presentaciones x where x.producto_id = p.id and x.es_base);

insert into producto_codigos (producto_id, codigo, tipo, principal, origen, observacion)
select p.id, p.ean13, 'EAN13', true, 'MIGRACION',
       'Código que el producto ya tenía antes de llevar historial de códigos'
from productos p
where p.ean13 is not null
  and not exists (select 1 from producto_codigos c where c.codigo = p.ean13);

-- ---------------------------------------------------------
-- PARTE 4 — Buscar un producto por cualquiera de sus códigos
--
-- Devuelve además cuántas unidades representa la lectura: si lo que se
-- escaneó es el código de la caja, una sola pasada son 24 unidades.
-- ---------------------------------------------------------
create or replace function fn_buscar_por_codigo(p_codigo text)
returns table (
  producto_id      uuid,
  codigo           text,
  nombre           text,
  unidades         numeric,
  presentacion_id  uuid,
  presentacion     text,
  precio_sugerido  numeric,
  codigo_principal boolean
)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.codigo,
    p.nombre,
    coalesce(pr.factor, 1)                             as unidades,
    pr.id,
    pr.nombre,
    case
      when pr.id is not null and pr.precio_venta is not null then pr.precio_venta
      when pr.id is not null then pr.factor * p.precio_venta_menor
      else p.precio_venta_menor
    end                                                as precio_sugerido,
    c.principal
  from producto_codigos c
  join productos p on p.id = c.producto_id
  left join presentaciones pr on pr.id = c.presentacion_id and pr.activo
  where c.activo
    and p.activo
    and c.codigo = upper(trim(p_codigo))
  limit 1;
$$;

comment on function fn_buscar_por_codigo(text) is
  'Resuelve cualquier código escaneado —el de la unidad o el de la caja— al producto y a '
  'cuántas unidades representa esa lectura.';

-- ---------------------------------------------------------
-- PARTE 5 — Registrar un código nuevo sin tocar nada más
--
-- Este es el caso del proveedor que cambió el EAN. Registrar el código
-- NO cambia precios, ni stock, ni el producto: solo agrega una forma
-- más de reconocerlo. Por eso es seguro hacerlo en la bodega, con el
-- camión descargando.
-- ---------------------------------------------------------
create or replace function fn_registrar_codigo_producto(
  p_producto_id     uuid,
  p_codigo          text,
  p_tipo            text default 'EAN13',
  p_presentacion_id uuid default null,
  p_observacion     text default null
)
returns table (estado text, mensaje text, codigo_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_codigo text := upper(trim(p_codigo));
  v_dueno  record;
  v_id     uuid;
  v_nombre text;
begin
  select nombre into v_nombre from productos where id = p_producto_id;
  if v_nombre is null then
    return query select 'ERROR'::text, 'El producto no existe.'::text, null::uuid;
    return;
  end if;

  -- ¿Ya lo tiene alguien?
  select c.producto_id, c.activo, p.nombre as producto
    into v_dueno
  from producto_codigos c join productos p on p.id = c.producto_id
  where c.codigo = v_codigo;

  if found and v_dueno.producto_id <> p_producto_id then
    -- Esto es exactamente lo que no se debe dejar pasar: el mismo
    -- código apuntando a dos productos haría que la caja cobre uno y
    -- descuente el otro.
    return query select
      'CONFLICTO'::text,
      format('El código %s ya pertenece a "%s". Un código no puede identificar a dos '
             'productos: si la mercadería vieja de "%s" se agotó, desactive ese código '
             'antes de asignarlo aquí.', v_codigo, v_dueno.producto, v_dueno.producto)::text,
      null::uuid;
    return;
  end if;

  if found then
    if v_dueno.activo then
      return query select 'YA_EXISTE'::text,
        format('"%s" ya tenía registrado el código %s.', v_nombre, v_codigo)::text, null::uuid;
      return;
    end if;
    update producto_codigos
       set activo = true, observacion = coalesce(p_observacion, observacion)
     where codigo = v_codigo
     returning id into v_id;
    return query select 'REACTIVADO'::text,
      format('El código %s vuelve a estar activo para "%s".', v_codigo, v_nombre)::text, v_id;
    return;
  end if;

  insert into producto_codigos (producto_id, codigo, tipo, presentacion_id,
                                principal, origen, observacion, usuario_id)
  values (p_producto_id, v_codigo, p_tipo, p_presentacion_id,
          false, 'RECEPCION', p_observacion, auth.uid())
  returning id into v_id;

  return query select 'AGREGADO'::text,
    format('Código %s agregado a "%s". El código anterior sigue funcionando: la mercadería '
           'que ya está en percha se seguirá vendiendo sin problema.', v_codigo, v_nombre)::text,
    v_id;
end $$;

comment on function fn_registrar_codigo_producto(uuid, text, text, uuid, text) is
  'Agrega un código de barras a un producto sin tocar stock ni precios. Rechaza el código '
  'que ya pertenece a otro producto, que es el error que haría cobrar uno y descontar otro.';

-- ---------------------------------------------------------
-- PARTE 6 — La recepción: documento contra físico
--
-- Lo que dice la factura y lo que baja del camión no siempre coinciden.
-- Hasta ahora el ingreso guardaba un solo número, así que la diferencia
-- se perdía: si llegaban 22 de 24, el sistema decía 24 y el faltante
-- aparecía semanas después como un descuadre sin explicación.
--
-- A partir de aquí se guardan los dos, y el que entra al stock es el
-- FÍSICO. La diferencia queda escrita, que es lo que se le reclama al
-- proveedor.
-- ---------------------------------------------------------
alter table ingreso_detalle
  add column if not exists presentacion_id     uuid references presentaciones(id),
  add column if not exists bultos              numeric(14,4),
  add column if not exists cantidad_documento  numeric(14,4),
  add column if not exists costo_bulto         numeric(14,6),
  add column if not exists codigo_escaneado    text,
  add column if not exists codigo_verificado   boolean not null default false,
  add column if not exists observacion         text;

comment on column ingreso_detalle.cantidad is
  'Lo que REALMENTE se recibió, en unidades de venta. Es lo que entra al stock.';
comment on column ingreso_detalle.cantidad_documento is
  'Lo que dice la factura del proveedor, en unidades de venta. Si difiere de cantidad, hay '
  'un faltante o un sobrante que reclamar.';
comment on column ingreso_detalle.bultos is
  'Cuántos bultos de la presentación se recibieron (6 cajas). cantidad = bultos x factor.';
comment on column ingreso_detalle.codigo_verificado is
  'Si alguien pasó el escáner por el producto físico al recibirlo. Es la única forma de '
  'saber que el código impreso coincide con el que tiene el sistema.';

alter table documentos_ingreso
  add column if not exists orden_compra_id uuid references ordenes_compra(id);

comment on column documentos_ingreso.orden_compra_id is
  'La orden que originó esta compra, cuando la hubo. Permite cotejar lo pedido con lo '
  'facturado y con lo recibido.';

create index if not exists ix_ingresos_orden on documentos_ingreso (orden_compra_id)
  where orden_compra_id is not null;

-- ---------------------------------------------------------
-- PARTE 7 — Agregar una línea contando bultos
--
-- El bodeguero escribe "6 cajas a $18,00 la caja". La función calcula
-- las 144 unidades y el costo de $0,125 por unidad. Nadie multiplica ni
-- divide a mano con el camión esperando.
-- ---------------------------------------------------------
create or replace function fn_agregar_linea_ingreso(
  p_documento_id      uuid,
  p_producto_id       uuid,
  p_bultos            numeric,
  p_costo_bulto       numeric,
  p_presentacion_id   uuid default null,
  p_bultos_documento  numeric default null,
  p_codigo_escaneado  text default null,
  p_codigo_lote       text default null,
  p_fecha_caducidad   date default null,
  p_observacion       text default null
)
returns table (estado text, mensaje text, detalle_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_factor    numeric := 1;
  v_pres      record;
  v_cantidad  numeric;
  v_costo_u   numeric;
  v_cant_doc  numeric;
  v_verificado boolean := false;
  v_producto  record;
  v_id        uuid;
begin
  select p.id, p.nombre, p.permite_fraccion, p.unidad_medida
    into v_producto
  from productos p where p.id = p_producto_id;

  if v_producto.id is null then
    return query select 'ERROR'::text, 'El producto no existe.'::text, null::uuid;
    return;
  end if;

  if p_presentacion_id is not null then
    select * into v_pres from presentaciones where id = p_presentacion_id;
    if v_pres.id is null then
      return query select 'ERROR'::text, 'La presentación no existe.'::text, null::uuid;
      return;
    end if;
    if v_pres.producto_id <> p_producto_id then
      return query select 'ERROR'::text,
        'Esa presentación pertenece a otro producto.'::text, null::uuid;
      return;
    end if;
    v_factor := v_pres.factor;
  end if;

  v_cantidad := p_bultos * v_factor;
  v_cant_doc := coalesce(p_bultos_documento, p_bultos) * v_factor;
  v_costo_u  := p_costo_bulto / v_factor;

  if v_cantidad <= 0 then
    return query select 'ERROR'::text,
      'La cantidad recibida tiene que ser mayor que cero.'::text, null::uuid;
    return;
  end if;

  -- Un producto por unidad no puede terminar con 12,5 unidades por un
  -- factor mal puesto. Se avisa antes de que lo rechace el trigger de
  -- la tabla, con un mensaje que se entiende.
  if not v_producto.permite_fraccion and v_cantidad <> round(v_cantidad) then
    return query select 'ERROR'::text,
      format('"%s" se maneja por %s entera y la cuenta da %s. Revise los bultos o el factor '
             'de la presentación.', v_producto.nombre,
             lower(coalesce(v_producto.unidad_medida, 'unidad')), v_cantidad)::text,
      null::uuid;
    return;
  end if;

  -- Si escanearon el producto físico, se comprueba que el código
  -- corresponda a ESTE producto y no a otro parecido.
  if p_codigo_escaneado is not null and trim(p_codigo_escaneado) <> '' then
    select true into v_verificado
    from producto_codigos c
    where c.activo and c.codigo = upper(trim(p_codigo_escaneado))
      and c.producto_id = p_producto_id;

    if not coalesce(v_verificado, false) then
      return query select 'CODIGO_DESCONOCIDO'::text,
        format('El código %s no está registrado en "%s". Si el proveedor cambió el código, '
               'regístrelo antes de recibir: así el producto seguirá pasando por caja.',
               upper(trim(p_codigo_escaneado)), v_producto.nombre)::text,
        null::uuid;
      return;
    end if;
  end if;

  insert into ingreso_detalle (
    documento_ingreso_id, producto_id, cantidad, costo_unitario,
    presentacion_id, bultos, cantidad_documento, costo_bulto,
    codigo_escaneado, codigo_verificado, codigo_lote, fecha_caducidad, observacion)
  values (
    p_documento_id, p_producto_id, v_cantidad, v_costo_u,
    p_presentacion_id, p_bultos, v_cant_doc, p_costo_bulto,
    nullif(trim(p_codigo_escaneado), ''), coalesce(v_verificado, false),
    p_codigo_lote, p_fecha_caducidad, p_observacion)
  returning id into v_id;

  if v_cantidad <> v_cant_doc then
    return query select 'DIFERENCIA'::text,
      format('Anotado: la factura dice %s y se recibieron %s. La diferencia queda registrada '
             'para reclamar al proveedor; al stock entran las %s que llegaron.',
             v_cant_doc, v_cantidad, v_cantidad)::text, v_id;
    return;
  end if;

  return query select 'OK'::text,
    format('%s %s x %s = %s unidades a $%s cada una.',
           p_bultos, coalesce(v_pres.nombre, 'unidad'), v_factor, v_cantidad,
           round(v_costo_u, 4))::text, v_id;
end $$;

-- ---------------------------------------------------------
-- PARTE 8 — Precios: costo, público y mayorista
--
-- El precio no se adivina: se calcula sobre el costo real y el margen
-- que el negocio decide. Se guardan los márgenes objetivo para que el
-- sistema PROPONGA, y una persona decida.
-- ---------------------------------------------------------
alter table empresa
  add column if not exists margen_menor numeric(6,2) not null default 25,
  add column if not exists margen_mayor numeric(6,2) not null default 12;

comment on column empresa.margen_menor is
  'Margen objetivo sobre el costo para la venta al público, en por ciento. Solo propone: el '
  'precio final lo decide una persona.';
comment on column empresa.margen_mayor is
  'Margen objetivo para la venta al por mayor. Menor que el de menudeo, porque el volumen '
  'compensa.';

alter table categorias
  add column if not exists margen_menor numeric(6,2),
  add column if not exists margen_mayor numeric(6,2);

comment on column categorias.margen_menor is
  'Margen propio de la categoría, cuando difiere del general. Las gaseosas se venden con '
  'menos margen que los abarrotes y forzar un solo número para todo saca precios fuera de '
  'mercado. Nulo = se usa el de la empresa.';

create or replace function fn_sugerir_precios(
  p_costo_unitario numeric,
  p_categoria_id   uuid default null,
  p_factor_mayor   numeric default null
)
returns table (
  costo_unitario   numeric,
  margen_menor     numeric,
  precio_menor     numeric,
  margen_mayor     numeric,
  precio_mayor     numeric,
  utilidad_menor   numeric,
  utilidad_mayor   numeric,
  nota             text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_mm numeric;
  v_my numeric;
  v_pm numeric;
  v_py numeric;
begin
  select coalesce(c.margen_menor, e.margen_menor),
         coalesce(c.margen_mayor, e.margen_mayor)
    into v_mm, v_my
  from (select * from empresa limit 1) e
  left join categorias c on c.id = p_categoria_id;

  v_mm := coalesce(v_mm, 25);
  v_my := coalesce(v_my, 12);

  -- Precio = costo x (1 + margen). Se redondea al centavo hacia arriba:
  -- un precio de 0,8749 se cobra 0,88, nunca 0,87, porque redondear
  -- hacia abajo en cada venta se come el margen sin que nadie lo note.
  v_pm := ceil(p_costo_unitario * (1 + v_mm / 100) * 100) / 100;
  v_py := ceil(p_costo_unitario * (1 + v_my / 100) * 100) / 100;

  return query select
    round(p_costo_unitario, 4),
    v_mm,
    v_pm,
    v_my,
    v_py,
    round(v_pm - p_costo_unitario, 4),
    round(v_py - p_costo_unitario, 4),
    case
      when v_py <= p_costo_unitario then
        'El precio al por mayor no cubre el costo. Revise el margen o el costo de compra.'
      when p_factor_mayor is not null then
        format('Sugerencia: $%s la unidad al público y $%s al por mayor. El bulto de %s '
               'saldría en $%s.', v_pm, v_py, p_factor_mayor,
               round(v_py * p_factor_mayor, 2))
      else
        format('Sugerencia: $%s la unidad al público y $%s al por mayor, sobre un costo de $%s.',
               v_pm, v_py, round(p_costo_unitario, 4))
    end;
end $$;

comment on function fn_sugerir_precios(numeric, uuid, numeric) is
  'Propone precio al público y al por mayor a partir del costo real y el margen objetivo de '
  'la categoría (o de la empresa). Propone: no cambia nada.';

-- ---------------------------------------------------------
-- PARTE 9 — Vistas
-- ---------------------------------------------------------

-- El stock único, leído como lo lee el bodeguero.
drop view if exists v_stock_presentacion cascade;
create view v_stock_presentacion
with (security_invoker = true)
as
select
  s.producto_id,
  p.codigo,
  p.nombre                                   as producto,
  s.bodega_id,
  b.nombre                                   as bodega,
  coalesce(u.codigo, 'UND')                  as unidad,
  s.stock                                    as stock_unidades,
  pr.id                                      as presentacion_id,
  pr.nombre                                  as presentacion,
  pr.factor,
  floor(s.stock / pr.factor)                 as bultos_completos,
  s.stock - floor(s.stock / pr.factor) * pr.factor as unidades_sueltas,
  case
    when pr.factor <= 1 then
      format('%s %s', trim(to_char(s.stock, 'FM999999990.###')), coalesce(u.codigo, 'UND'))
    when s.stock < pr.factor then
      format('%s %s sueltas', trim(to_char(s.stock, 'FM999999990.###')), coalesce(u.codigo, 'UND'))
    when s.stock - floor(s.stock / pr.factor) * pr.factor = 0 then
      format('%s x %s', floor(s.stock / pr.factor), pr.nombre)
    else
      format('%s x %s + %s %s',
             floor(s.stock / pr.factor), pr.nombre,
             trim(to_char(s.stock - floor(s.stock / pr.factor) * pr.factor, 'FM999999990.###')),
             coalesce(u.codigo, 'UND'))
  end                                        as lectura,
  pr.para_venta                              as se_vende_asi,
  pr.precio_venta                            as precio_bulto
from inventario_saldos s
join productos p on p.id = s.producto_id
left join bodegas b on b.id = s.bodega_id
left join unidades_medida u on u.id = p.unidad_medida_id
join presentaciones pr on pr.producto_id = p.id and pr.activo
where p.activo;

comment on view v_stock_presentacion is
  'El mismo saldo, contado en cada presentación: 244 unidades se leen como "10 x Caja x 24 '
  '+ 4 UND". No es un segundo inventario, es otra forma de mirar el único que hay.';

-- Códigos vigentes de cada producto, para que la caja los tenga todos.
drop view if exists v_producto_codigos cascade;
create view v_producto_codigos
with (security_invoker = true)
as
select
  c.producto_id,
  p.codigo                      as producto_codigo,
  p.nombre                      as producto,
  c.codigo,
  c.tipo,
  c.principal,
  c.origen,
  c.activo,
  c.created_at,
  pr.id                         as presentacion_id,
  pr.nombre                     as presentacion,
  coalesce(pr.factor, 1)        as unidades_por_lectura
from producto_codigos c
join productos p on p.id = c.producto_id
left join presentaciones pr on pr.id = c.presentacion_id;

-- Lo pedido contra lo recibido. Es lo que contesta "¿me mandaron todo?".
drop view if exists v_recepcion_vs_orden cascade;
create view v_recepcion_vs_orden
with (security_invoker = true)
as
select
  d.id                          as documento_id,
  d.numero_interno,
  d.numero_documento,
  d.estado,
  d.fecha_recepcion,
  o.id                          as orden_id,
  o.numero                      as orden_numero,
  pr.razon_social               as proveedor,
  p.id                          as producto_id,
  p.codigo                      as producto_codigo,
  p.nombre                      as producto,
  ocd.cantidad                  as pedido,
  det.cantidad_documento        as facturado,
  det.cantidad                  as recibido,
  coalesce(det.cantidad, 0) - coalesce(det.cantidad_documento, det.cantidad, 0) as diferencia,
  det.codigo_verificado,
  det.costo_unitario,
  case
    when det.cantidad is null then 'NO_LLEGO'
    when det.cantidad_documento is null then 'SIN_COTEJO'
    when det.cantidad < det.cantidad_documento then 'FALTANTE'
    when det.cantidad > det.cantidad_documento then 'SOBRANTE'
    else 'CONFORME'
  end                           as resultado
from documentos_ingreso d
join proveedores pr on pr.id = d.proveedor_id
left join ordenes_compra o on o.id = d.orden_compra_id
left join ingreso_detalle det on det.documento_ingreso_id = d.id
left join orden_compra_detalle ocd
       on ocd.orden_id = o.id and ocd.producto_id = det.producto_id
left join productos p on p.id = det.producto_id;

comment on view v_recepcion_vs_orden is
  'Pedido, facturado y recibido en la misma fila. La columna resultado dice si hubo faltante, '
  'sobrante o si nadie cotejó.';

-- La caja necesita TODOS los códigos de cada producto en una sola
-- consulta: si tuviera que preguntar por cada lectura, el escaneo
-- dependería de la red y el cajero lo notaría.
drop view if exists v_pos_productos cascade;
create view v_pos_productos
with (security_invoker = true)
as
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
  (select string_agg(ub.codigo, ', ' order by ub.codigo)
     from producto_ubicacion pu
     join ubicaciones ub on ub.id = pu.ubicacion_id
    where pu.producto_id = p.id) as ubicacion,
  -- Todos los códigos vigentes, y cuántas unidades vale cada lectura.
  coalesce((
    select jsonb_agg(jsonb_build_object(
             'codigo', c.codigo,
             'unidades', coalesce(pres.factor, 1),
             'presentacion', pres.nombre,
             'precio', pres.precio_venta)
           order by c.principal desc, c.created_at)
    from producto_codigos c
    left join presentaciones pres on pres.id = c.presentacion_id and pres.activo
    where c.producto_id = p.id and c.activo
  ), '[]'::jsonb) as codigos
from productos p
join inventario_saldos s on s.producto_id = p.id
left join unidades_medida u on u.id = p.unidad_medida_id
left join lateral (
  select t.porcentaje from tarifas_impuesto t
  where t.codigo = p.codigo_impuesto
    and t.vigencia_desde <= current_date
    and (t.vigencia_hasta is null or t.vigencia_hasta >= current_date)
  order by t.vigencia_desde desc limit 1) ti on true
where p.activo;

-- ---------------------------------------------------------
-- PARTE 10 — Seguridad
-- ---------------------------------------------------------
alter table presentaciones    enable row level security;
alter table producto_codigos  enable row level security;

drop policy if exists presentaciones_lectura on presentaciones;
create policy presentaciones_lectura on presentaciones
  for select using (auth.role() = 'authenticated');

drop policy if exists presentaciones_escritura on presentaciones;
create policy presentaciones_escritura on presentaciones
  using (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO'))
  with check (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO'));

drop policy if exists codigos_lectura on producto_codigos;
create policy codigos_lectura on producto_codigos
  for select using (auth.role() = 'authenticated');

-- El bodeguero tiene que poder registrar el código nuevo con el camión
-- descargando: si hubiera que llamar al administrador, la mercadería
-- entraría sin código y no pasaría por caja.
drop policy if exists codigos_escritura on producto_codigos;
create policy codigos_escritura on producto_codigos
  using (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO'))
  with check (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO'));

grant select on presentaciones, producto_codigos to authenticated;
grant select on v_stock_presentacion, v_producto_codigos,
                v_recepcion_vs_orden, v_pos_productos to authenticated;

notify pgrst, 'reload schema';

select 'Migración 015 aplicada: presentaciones, códigos por producto, cotejo de recepción y sugerencia de precios.' as resultado;
