-- =========================================================
-- CENTRO DE CONTROL
-- Migración 018: transformar un producto en otros (maquila, despiece)
--
-- EL CASO REAL
--
-- Entra un pollo entero de 5 lb que costó $8,50. Sale del cuarto frío
-- convertido en pechuga, piernas, alas y menudencia, cada una con su
-- precio por libra, y sobra medio kilo de hueso y recorte que no se
-- vende. Lo mismo pasa con el queso en bloque que se corta, el quintal
-- de arroz que se enfunda de a libra y el atado que se separa.
--
-- Hasta ahora esto no existía en el sistema, y en la práctica se hacía
-- con dos ajustes manuales: una salida del pollo y una entrada de las
-- presas "de la nada". Eso rompe tres cosas a la vez: el kardex deja de
-- explicar de dónde salió la mercadería, las presas entran con costo
-- cero o inventado, y la merma desaparece sin registro.
--
-- CÓMO SE REPARTE EL COSTO, Y POR QUÉ NO POR PESO
--
-- La tentación es repartir el costo del pollo entre las libras que
-- salieron. Pero entonces la libra de hueso costaría lo mismo que la de
-- pechuga, y eso es falso: haría parecer la pechuga mucho más rentable
-- de lo que es y el hueso una pérdida.
--
-- Lo correcto —y lo que pide la NIC 2 para productos conjuntos— es
-- repartir por VALOR DE VENTA RELATIVO: cada salida carga la parte del
-- costo que le corresponde según lo que vale. Si la pechuga representa
-- el 45 % del valor de lo que salió, absorbe el 45 % del costo.
--
-- LA MERMA no se reparte aparte: la absorben las salidas, que es lo
-- correcto —el hueso que se bota es parte de lo que costó la pechuga—
-- pero queda REGISTRADA en cantidad para poder medir el rendimiento del
-- despiece y detectar el día que alguien se esté llevando producto.
--
-- Requiere: 017_facturas_proveedor.sql
-- =========================================================

-- ---------------------------------------------------------
-- PARTE 1 — La receta, para no recalcular cada vez
-- ---------------------------------------------------------
create table if not exists recetas (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique,
  nombre         text not null,
  descripcion    text,
  producto_origen_id uuid not null references productos(id) on delete cascade,
  cantidad_origen    numeric(14,4) not null,
  merma_esperada_pct numeric(6,2) not null default 0,
  activa         boolean not null default true,
  created_at     timestamptz not null default now(),

  constraint recetas_cantidad_origen check (cantidad_origen > 0),
  constraint recetas_merma_valida check (merma_esperada_pct >= 0 and merma_esperada_pct < 100)
);

comment on table recetas is
  'Cómo se despieza o se maquila un producto: qué entra, qué sale y cuánto se pierde. Se '
  'escribe una vez y se reutiliza en cada transformación.';
comment on column recetas.cantidad_origen is
  'Cantidad del producto de origen que describe la receta. Un pollo, un quintal, un bloque. '
  'Las salidas se escalan en proporción cuando se transforma más de uno.';
comment on column recetas.merma_esperada_pct is
  'Pérdida normal del proceso, en por ciento. Sirve para comparar con la real y detectar '
  'un despiece que rinde menos de lo que debería.';

create table if not exists receta_salida (
  id          uuid primary key default gen_random_uuid(),
  receta_id   uuid not null references recetas(id) on delete cascade,
  producto_id uuid not null references productos(id) on delete cascade,
  cantidad    numeric(14,4) not null,
  orden       integer not null default 100,

  constraint receta_salida_cantidad check (cantidad > 0),
  constraint receta_salida_unica unique (receta_id, producto_id)
);

comment on table receta_salida is
  'Qué sale de la receta y en qué cantidad, para la cantidad de origen declarada.';

-- ---------------------------------------------------------
-- PARTE 2 — La transformación ejecutada
-- ---------------------------------------------------------
create table if not exists transformaciones (
  id            uuid primary key default gen_random_uuid(),
  numero        text unique,
  receta_id     uuid references recetas(id),
  bodega_id     uuid not null references bodegas(id),
  sede_id       uuid references sedes(id),
  fecha         date not null default current_date,
  estado        text not null default 'BORRADOR',
  costo_total   numeric(14,4) not null default 0,
  merma_cantidad numeric(14,4) not null default 0,
  merma_pct     numeric(6,2),
  observacion   text,
  usuario_id    uuid,
  confirmada_at timestamptz,
  created_at    timestamptz not null default now(),

  constraint transformaciones_estado check (estado in ('BORRADOR','CONFIRMADA','ANULADA'))
);

comment on table transformaciones is
  'Un despiece o maquila realmente ejecutado. Al confirmarse escribe el kardex de las dos '
  'puntas: la salida de lo que entró y la entrada de lo que salió, con su costo repartido.';

create table if not exists transformacion_entrada (
  id                uuid primary key default gen_random_uuid(),
  transformacion_id uuid not null references transformaciones(id) on delete cascade,
  producto_id       uuid not null references productos(id),
  cantidad          numeric(14,4) not null,
  costo_unitario    numeric(14,6),
  costo_total       numeric(14,4),

  constraint transformacion_entrada_cantidad check (cantidad > 0)
);

create table if not exists transformacion_salida (
  id                uuid primary key default gen_random_uuid(),
  transformacion_id uuid not null references transformaciones(id) on delete cascade,
  producto_id       uuid not null references productos(id),
  cantidad          numeric(14,4) not null,
  valor_venta       numeric(14,4),
  participacion_pct numeric(7,4),
  costo_unitario    numeric(14,6),
  costo_total       numeric(14,4),

  constraint transformacion_salida_cantidad check (cantidad > 0)
);

comment on column transformacion_salida.participacion_pct is
  'Qué parte del valor total de lo producido representa esta salida. Es la proporción con la '
  'que absorbe el costo, según el método de valor de venta relativo (NIC 2).';

create index if not exists ix_transf_bodega on transformaciones (bodega_id, fecha);
create index if not exists ix_transf_entrada on transformacion_entrada (transformacion_id);
create index if not exists ix_transf_salida on transformacion_salida (transformacion_id);

-- ---------------------------------------------------------
-- PARTE 3 — Preparar una transformación desde la receta
--
-- Escala las salidas a la cantidad que de verdad se va a procesar y
-- calcula cuánto costará. No toca el inventario: es la propuesta que
-- una persona revisa antes de confirmar, porque el despiece real
-- nunca sale exactamente como la receta.
-- ---------------------------------------------------------
create or replace function fn_preparar_transformacion(
  p_receta_id uuid,
  p_bodega_id uuid,
  p_cantidad  numeric
)
returns table (
  producto_id    uuid,
  producto       text,
  unidad         text,
  cantidad       numeric,
  precio_venta   numeric,
  valor_venta    numeric,
  es_origen      boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_r     record;
  v_veces numeric;
begin
  select * into v_r from recetas where id = p_receta_id and activa;
  if v_r.id is null then
    raise exception 'La receta no existe o está desactivada.';
  end if;
  if coalesce(p_cantidad, 0) <= 0 then
    raise exception 'La cantidad a transformar tiene que ser mayor que cero.';
  end if;

  v_veces := p_cantidad / v_r.cantidad_origen;

  -- Lo que entra
  return query
  select p.id, p.nombre, coalesce(u.codigo, p.unidad_medida),
         p_cantidad, p.precio_venta_menor, null::numeric, true
  from productos p
  left join unidades_medida u on u.id = p.unidad_medida_id
  where p.id = v_r.producto_origen_id;

  -- Lo que sale, escalado
  return query
  select p.id, p.nombre, coalesce(u.codigo, p.unidad_medida),
         round(rs.cantidad * v_veces, 4),
         p.precio_venta_menor,
         round(rs.cantidad * v_veces * p.precio_venta_menor, 4),
         false
  from receta_salida rs
  join productos p on p.id = rs.producto_id
  left join unidades_medida u on u.id = p.unidad_medida_id
  where rs.receta_id = p_receta_id
  order by 1;
end $$;

-- ---------------------------------------------------------
-- PARTE 4 — Ejecutar la transformación
--
-- Esta función es la que toca el inventario, y lo hace todo dentro de
-- una transacción: o entra completa o no entra nada. Una transformación
-- a medias —el pollo descontado y las presas sin ingresar— sería peor
-- que no tenerla.
-- ---------------------------------------------------------
create or replace function fn_ejecutar_transformacion(
  p_bodega_id   uuid,
  p_entradas    jsonb,     -- [{producto_id, cantidad}]
  p_salidas     jsonb,     -- [{producto_id, cantidad}]
  p_receta_id   uuid default null,
  p_observacion text default null
)
returns table (estado text, mensaje text, transformacion_id uuid, costo_total numeric)
language plpgsql security definer set search_path = public as $$
declare
  v_id         uuid;
  v_numero     text;
  v_item       jsonb;
  v_prod       record;
  v_saldo      record;
  v_cant       numeric;
  v_costo_ent  numeric := 0;
  v_valor_sal  numeric := 0;
  v_cant_ent   numeric := 0;
  v_cant_sal   numeric := 0;
  v_merma      numeric;
  v_sal        record;
  v_costo_u    numeric;
begin
  if fn_rol_actual() not in ('ADMIN','SUPERVISOR','BODEGUERO') then
    raise exception 'Su rol no puede transformar productos.';
  end if;
  if jsonb_array_length(coalesce(p_entradas, '[]'::jsonb)) = 0 then
    raise exception 'No hay nada que transformar: falta el producto de origen.';
  end if;
  if jsonb_array_length(coalesce(p_salidas, '[]'::jsonb)) = 0 then
    raise exception 'No hay nada producido: falta al menos un producto de salida.';
  end if;

  v_numero := fn_siguiente_secuencia('TRANSFORMACION', 'TR');

  insert into transformaciones (numero, receta_id, bodega_id, sede_id, observacion, usuario_id)
  values (v_numero, p_receta_id, p_bodega_id, fn_mi_sede(), p_observacion, auth.uid())
  returning id into v_id;

  -- ----- Entradas: se comprueba stock ANTES de tocar nada -----
  for v_item in select * from jsonb_array_elements(p_entradas) loop
    v_cant := (v_item ->> 'cantidad')::numeric;

    select p.id, p.nombre, p.permite_fraccion, p.unidad_medida
      into v_prod
    from productos p where p.id = (v_item ->> 'producto_id')::uuid;

    if v_prod.id is null then
      raise exception 'Un producto de origen no existe.';
    end if;
    if not v_prod.permite_fraccion and v_cant <> round(v_cant) then
      raise exception '"%" se maneja por % entera: no se puede transformar %.',
        v_prod.nombre, lower(coalesce(v_prod.unidad_medida, 'unidad')), v_cant;
    end if;

    select stock, costo_promedio into v_saldo
    from inventario_saldos
    where producto_id = v_prod.id and bodega_id = p_bodega_id;

    if coalesce(v_saldo.stock, 0) < v_cant then
      raise exception
        'No hay suficiente "%" para transformar: se necesitan % y quedan %.',
        v_prod.nombre, v_cant, coalesce(v_saldo.stock, 0);
    end if;

    insert into transformacion_entrada (transformacion_id, producto_id, cantidad,
                                        costo_unitario, costo_total)
    values (v_id, v_prod.id, v_cant, coalesce(v_saldo.costo_promedio, 0),
            round(v_cant * coalesce(v_saldo.costo_promedio, 0), 4));

    v_costo_ent := v_costo_ent + v_cant * coalesce(v_saldo.costo_promedio, 0);
    v_cant_ent  := v_cant_ent + v_cant;
  end loop;

  -- ----- Salidas: primero el valor de venta de cada una -----
  for v_item in select * from jsonb_array_elements(p_salidas) loop
    v_cant := (v_item ->> 'cantidad')::numeric;

    select p.id, p.nombre, p.permite_fraccion, p.unidad_medida, p.precio_venta_menor
      into v_prod
    from productos p where p.id = (v_item ->> 'producto_id')::uuid;

    if v_prod.id is null then
      raise exception 'Un producto de salida no existe.';
    end if;
    if not v_prod.permite_fraccion and v_cant <> round(v_cant) then
      raise exception '"%" se maneja por % entera: no puede salir %.',
        v_prod.nombre, lower(coalesce(v_prod.unidad_medida, 'unidad')), v_cant;
    end if;

    insert into transformacion_salida (transformacion_id, producto_id, cantidad, valor_venta)
    values (v_id, v_prod.id, v_cant,
            round(v_cant * coalesce(v_prod.precio_venta_menor, 0), 4));

    v_valor_sal := v_valor_sal + v_cant * coalesce(v_prod.precio_venta_menor, 0);
    v_cant_sal  := v_cant_sal + v_cant;
  end loop;

  -- ----- Reparto del costo por valor de venta relativo -----
  --
  -- Si ninguna salida tiene precio todavía (producto recién creado), no
  -- hay forma de repartir por valor y se reparte por cantidad. Se avisa
  -- en el mensaje, porque el reparto por cantidad distorsiona el margen
  -- cuando las salidas valen cosas muy distintas.
  if v_valor_sal > 0 then
    update transformacion_salida s
       set participacion_pct = round(100 * s.valor_venta / v_valor_sal, 4),
           costo_total = round(v_costo_ent * s.valor_venta / v_valor_sal, 4),
           costo_unitario = round((v_costo_ent * s.valor_venta / v_valor_sal) / s.cantidad, 6)
     where s.transformacion_id = v_id;
  else
    update transformacion_salida s
       set participacion_pct = round(100 * s.cantidad / nullif(v_cant_sal, 0), 4),
           costo_total = round(v_costo_ent * s.cantidad / nullif(v_cant_sal, 0), 4),
           costo_unitario = round(v_costo_ent / nullif(v_cant_sal, 0), 6)
     where s.transformacion_id = v_id;
  end if;

  -- ----- Merma -----
  -- Solo tiene sentido comparar cantidades cuando entra y sale la misma
  -- unidad (libras a libras). Un pollo entero que sale en libras no se
  -- puede restar, así que ahí la merma queda en nulo en vez de mentir.
  v_merma := null;
  if exists (
    select 1
    from transformacion_entrada e
    join productos pe on pe.id = e.producto_id
    where e.transformacion_id = v_id
      and exists (
        select 1 from transformacion_salida s
        join productos ps on ps.id = s.producto_id
        where s.transformacion_id = v_id
          and ps.unidad_medida is not distinct from pe.unidad_medida)
  ) then
    v_merma := v_cant_ent - v_cant_sal;
  end if;

  -- ----- Kardex -----
  -- Se alias la tabla a propósito: "transformacion_id" es también el
  -- nombre de una columna de salida de esta función, y sin calificar
  -- PostgreSQL no sabe a cuál se refiere.
  for v_sal in select e.* from transformacion_entrada e where e.transformacion_id = v_id loop
    insert into movimientos_inventario (producto_id, bodega_id, tipo, cantidad,
                                        costo_unitario, referencia, observacion, usuario_id)
    values (v_sal.producto_id, p_bodega_id, 'SALIDA', v_sal.cantidad,
            v_sal.costo_unitario, v_numero,
            'Transformación: producto de origen', auth.uid());
  end loop;

  for v_sal in select s.* from transformacion_salida s where s.transformacion_id = v_id loop
    v_costo_u := coalesce(v_sal.costo_unitario, 0);
    insert into movimientos_inventario (producto_id, bodega_id, tipo, cantidad,
                                        costo_unitario, referencia, observacion, usuario_id)
    values (v_sal.producto_id, p_bodega_id, 'ENTRADA', v_sal.cantidad,
            v_costo_u, v_numero,
            format('Transformación: absorbe %s%% del costo', v_sal.participacion_pct),
            auth.uid());
  end loop;

  update transformaciones
     set estado = 'CONFIRMADA',
         costo_total = round(v_costo_ent, 4),
         merma_cantidad = coalesce(v_merma, 0),
         merma_pct = case when v_merma is not null and v_cant_ent > 0
                          then round(100 * v_merma / v_cant_ent, 2) end,
         confirmada_at = now()
   where id = v_id;

  return query select
    'OK'::text,
    format('%s: %s en costo repartido entre %s producto(s)%s.%s',
           v_numero, round(v_costo_ent, 2),
           jsonb_array_length(p_salidas),
           case when v_merma is not null
                then format(', con %s de merma (%s%%)', round(v_merma, 3),
                            round(100 * v_merma / nullif(v_cant_ent, 0), 1))
                else '' end,
           case when v_valor_sal <= 0
                then ' Ojo: las salidas no tienen precio de venta, así que el costo se '
                     'repartió por cantidad. Póngales precio y el reparto será correcto.'
                else '' end)::text,
    v_id,
    round(v_costo_ent, 4);
end $$;

comment on function fn_ejecutar_transformacion(uuid, jsonb, jsonb, uuid, text) is
  'Despieza o maquila: descuenta lo que entra, ingresa lo que sale y reparte el costo por '
  'valor de venta relativo (NIC 2). Todo o nada: no deja transformaciones a medias.';

-- ---------------------------------------------------------
-- PARTE 5 — Vistas
-- ---------------------------------------------------------
drop view if exists v_transformaciones cascade;
create view v_transformaciones
with (security_invoker = true)
as
select
  t.id,
  t.numero,
  t.fecha,
  t.estado,
  t.costo_total,
  t.merma_cantidad,
  t.merma_pct,
  r.nombre as receta,
  r.merma_esperada_pct,
  b.nombre as bodega,
  t.observacion,
  t.confirmada_at,
  (select string_agg(format('%s %s', round(e.cantidad, 3), p.nombre), ' + ')
     from transformacion_entrada e join productos p on p.id = e.producto_id
    where e.transformacion_id = t.id) as entro,
  (select string_agg(format('%s %s', round(s.cantidad, 3), p.nombre), ' + ')
     from transformacion_salida s join productos p on p.id = s.producto_id
    where s.transformacion_id = t.id) as salio,
  case
    when t.merma_pct is null then null
    when r.merma_esperada_pct is null then null
    when t.merma_pct > r.merma_esperada_pct + 2 then 'RINDIÓ MENOS'
    when t.merma_pct < r.merma_esperada_pct - 2 then 'RINDIÓ MÁS'
    else 'NORMAL'
  end as rendimiento
from transformaciones t
left join recetas r on r.id = t.receta_id
left join bodegas b on b.id = t.bodega_id;

comment on view v_transformaciones is
  'Historial de despieces con lo que entró, lo que salió y si rindió lo esperado. La columna '
  'rendimiento es la que delata un despiece que viene perdiendo más de la cuenta.';

-- ---------------------------------------------------------
-- PARTE 6 — Seguridad
-- ---------------------------------------------------------
alter table recetas               enable row level security;
alter table receta_salida         enable row level security;
alter table transformaciones      enable row level security;
alter table transformacion_entrada enable row level security;
alter table transformacion_salida  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['recetas','receta_salida','transformaciones',
                           'transformacion_entrada','transformacion_salida']
  loop
    execute format('drop policy if exists %I_lectura on %I', t, t);
    execute format(
      'create policy %I_lectura on %I for select using (auth.role() = ''authenticated'')', t, t);

    execute format('drop policy if exists %I_escritura on %I', t, t);
    execute format(
      'create policy %I_escritura on %I using (fn_rol_actual() in (''ADMIN'',''SUPERVISOR'',''BODEGUERO'')) '
      'with check (fn_rol_actual() in (''ADMIN'',''SUPERVISOR'',''BODEGUERO''))', t, t);
  end loop;
end $$;

grant select on recetas, receta_salida, transformaciones,
                transformacion_entrada, transformacion_salida, v_transformaciones
  to authenticated;

-- El módulo, para que aparezca en el menú de quien corresponda
insert into modulos_sistema (codigo, nombre, descripcion, grupo, icono, orden)
values ('transformaciones', 'Transformar productos',
        'Despiece y maquila: convertir un producto en otros repartiendo el costo',
        'Bodega', 'ajuste', 75)
on conflict (codigo) do update set nombre = excluded.nombre, descripcion = excluded.descripcion;

insert into permisos_rol (rol, modulo, puede_ver, puede_editar)
select r.codigo, 'transformaciones',
       r.codigo in ('ADMIN','SUPERVISOR','BODEGUERO'),
       r.codigo in ('ADMIN','SUPERVISOR','BODEGUERO')
from roles_catalogo r
on conflict (rol, modulo) do nothing;

notify pgrst, 'reload schema';

select 'Migración 018 aplicada: transformación de productos con reparto de costo por valor de venta.' as resultado;
