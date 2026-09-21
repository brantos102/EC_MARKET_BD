-- =========================================================
-- CENTRO DE CONTROL
-- Migración 016: el plano se dibuja como es el local
--
-- QUÉ PROBLEMA RESUELVE
--
-- El plano 3D colocaba los muebles en fila, uno detrás de otro, porque
-- nadie le había dicho dónde están de verdad. Un plano que no se parece
-- al local no sirve para lo único que tiene que servir: que alguien que
-- no conoce la tienda encuentre el producto. Si el frigorífico está al
-- fondo a la derecha y el plano lo pone en la entrada, el plano estorba.
--
-- Esta migración agrega lo que faltaba para poder acomodarlo:
--
--   · CALLE. El código de ubicación ya decía mueble, columna y nivel
--     (ECM-A-01-1), pero no por qué pasillo se llega. En un local de
--     tres pasillos, "estantería A" no le dice nada a quien está
--     parado en la puerta. La calle es el dato que falta para dar una
--     dirección completa.
--
--   · MEDIDAS DEL LOCAL. Sin el ancho y el fondo de la sala, el plano
--     no sabe dónde está la pared y coloca todo pegado al origen.
--
--   · fn_mover_estructura, que guarda la posición comprobando que el
--     mueble no quede encima de otro ni fuera de la sala. Un plano con
--     dos estanterías superpuestas se ve bien en pantalla y es
--     imposible en la realidad.
--
-- Requiere: 015_presentaciones_codigos.sql
-- =========================================================

-- ---------------------------------------------------------
-- PARTE 1 — La sala
-- ---------------------------------------------------------
alter table sedes
  add column if not exists ancho_local_cm integer not null default 800,
  add column if not exists fondo_local_cm integer not null default 600;

comment on column sedes.ancho_local_cm is
  'Ancho de la sala de ventas en centímetros, medido de pared a pared. Es lo que permite '
  'dibujar el plano a escala en vez de amontonar los muebles junto al origen.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sedes_local_positivo') then
    alter table sedes add constraint sedes_local_positivo
      check (ancho_local_cm between 100 and 10000 and fondo_local_cm between 100 and 10000);
  end if;
end $$;

-- ---------------------------------------------------------
-- PARTE 2 — La calle
-- ---------------------------------------------------------
alter table estructuras
  add column if not exists calle text;

comment on column estructuras.calle is
  'Pasillo por el que se llega al mueble ("Calle 1", "Fondo", "Caja"). No entra en el código '
  'de ubicación —ese ya está impreso en las perchas— pero sí en la dirección que se le da a '
  'una persona: "Calle 2, estantería A, columna 3, nivel 1".';

-- ---------------------------------------------------------
-- PARTE 3 — Mover un mueble sin romper el plano
--
-- Dos muebles en el mismo lugar es un error que no se ve: el plano
-- queda bonito y el operador no encuentra nada. Se comprueba aquí, en
-- la base, porque el plano se puede editar desde la computadora y desde
-- el celular y la comprobación tiene que ser la misma.
--
-- El solape se calcula sobre el rectángulo del mueble SIN rotar cuando
-- la rotación es múltiplo de 90 —que es como se acomodan los muebles en
-- una tienda— intercambiando ancho y fondo en 90 y 270 grados. Para
-- ángulos raros se usa el círculo que envuelve al mueble, que es más
-- exigente: prefiere avisar de más que dejar pasar un solape.
-- ---------------------------------------------------------
create or replace function fn_caja_estructura(
  p_x integer, p_y integer, p_ancho integer, p_fondo integer, p_rot integer)
returns table (x1 numeric, y1 numeric, x2 numeric, y2 numeric)
language plpgsql immutable set search_path = public as $$
declare
  v_a numeric;
  v_f numeric;
  v_r integer := coalesce(p_rot, 0) % 360;
begin
  if v_r in (90, 270) then
    v_a := p_fondo; v_f := p_ancho;
  elsif v_r in (0, 180) then
    v_a := p_ancho; v_f := p_fondo;
  else
    -- Ángulo libre: se usa la diagonal, que envuelve al mueble en
    -- cualquier giro. Es conservador a propósito.
    v_a := sqrt(p_ancho ^ 2 + p_fondo ^ 2);
    v_f := v_a;
  end if;

  return query select
    p_x::numeric, p_y::numeric,
    p_x + v_a, p_y + v_f;
end $$;

create or replace function fn_mover_estructura(
  p_estructura_id uuid,
  p_x             integer,
  p_y             integer,
  p_rotacion      integer default null,
  p_calle         text default null,
  p_forzar        boolean default false
)
returns table (estado text, mensaje text)
language plpgsql security definer set search_path = public as $$
declare
  v_e        record;
  v_sede     record;
  v_rot      integer;
  v_caja     record;
  v_choque   record;
  v_nombres  text[] := '{}';
begin
  select * into v_e from estructuras where id = p_estructura_id;
  if v_e.id is null then
    return query select 'ERROR'::text, 'Ese mueble no existe.'::text;
    return;
  end if;

  select * into v_sede from sedes where id = v_e.sede_id;
  v_rot := coalesce(p_rotacion, v_e.rotacion_grados);

  if v_rot < 0 or v_rot > 359 then
    return query select 'ERROR'::text,
      format('La rotación tiene que estar entre 0 y 359 grados (llegó %s).', v_rot)::text;
    return;
  end if;
  if p_x < 0 or p_y < 0 then
    return query select 'ERROR'::text,
      'El mueble quedaría fuera de la sala: la esquina de la sala es el punto 0,0.'::text;
    return;
  end if;

  select * into v_caja
  from fn_caja_estructura(p_x, p_y, v_e.ancho_cm, v_e.fondo_cm, v_rot);

  if v_caja.x2 > v_sede.ancho_local_cm or v_caja.y2 > v_sede.fondo_local_cm then
    return query select 'FUERA'::text,
      format('El mueble se sale de la sala: llegaría hasta %s x %s cm y el local mide %s x %s. '
             'Si el local es más grande, corrija sus medidas en Administración → Sedes.',
             round(v_caja.x2), round(v_caja.y2),
             v_sede.ancho_local_cm, v_sede.fondo_local_cm)::text;
    return;
  end if;

  -- ¿Se monta encima de otro?
  for v_choque in
    select o.literal, o.nombre, c.*
    from estructuras o
    cross join lateral fn_caja_estructura(o.pos_x_cm, o.pos_y_cm, o.ancho_cm, o.fondo_cm,
                                          o.rotacion_grados) c
    where o.sede_id = v_e.sede_id
      and o.id <> v_e.id
      and o.activa
      and c.x1 < v_caja.x2 and c.x2 > v_caja.x1
      and c.y1 < v_caja.y2 and c.y2 > v_caja.y1
  loop
    v_nombres := v_nombres || format('%s (%s)', v_choque.literal, v_choque.nombre);
  end loop;

  if array_length(v_nombres, 1) > 0 and not p_forzar then
    return query select 'SOLAPE'::text,
      format('Ahí ya está %s. Dos muebles en el mismo lugar se ven bien en la pantalla y son '
             'imposibles en el local: nadie encontraría el producto. Mueva un poco más allá, '
             'o confirme si de verdad van juntos (un frigorífico empotrado en una góndola, '
             'por ejemplo).', array_to_string(v_nombres, ', '))::text;
    return;
  end if;

  update estructuras
     set pos_x_cm = p_x,
         pos_y_cm = p_y,
         rotacion_grados = v_rot,
         calle = coalesce(nullif(trim(p_calle), ''), calle)
   where id = p_estructura_id;

  if array_length(v_nombres, 1) > 0 then
    return query select 'GUARDADO_CON_SOLAPE'::text,
      format('Guardado, pero comparte lugar con %s.', array_to_string(v_nombres, ', '))::text;
    return;
  end if;

  return query select 'OK'::text,
    format('%s queda en x=%s, y=%s%s.', v_e.literal, p_x, p_y,
           case when v_rot <> 0 then format(', girado %s°', v_rot) else '' end)::text;
end $$;

comment on function fn_mover_estructura(uuid, integer, integer, integer, text, boolean) is
  'Guarda la posición de un mueble en el plano comprobando que no salga de la sala ni se monte '
  'sobre otro. Con p_forzar se puede guardar igual, para los casos reales en que sí van juntos.';

-- ---------------------------------------------------------
-- PARTE 4 — Vistas con la calle y con el local
-- ---------------------------------------------------------
drop view if exists v_estructuras_ocupacion cascade;
create view v_estructuras_ocupacion
with (security_invoker = true)
as
select
  e.id as estructura_id,
  e.sede_id,
  s.codigo_nave,
  s.ancho_local_cm,
  s.fondo_local_cm,
  e.literal,
  e.nombre,
  e.calle,
  e.tipo,
  te.nombre as tipo_nombre,
  e.columnas,
  e.niveles,
  e.ancho_cm,
  e.alto_cm,
  e.fondo_cm,
  e.pos_x_cm,
  e.pos_y_cm,
  e.rotacion_grados,
  e.temperatura,
  e.color_hex,
  te.doble_cara,
  e.activa,
  e.orden,
  count(distinct u.id) as posiciones,
  count(distinct u.id) filter (where pu.producto_id is not null) as posiciones_ocupadas,
  case
    when count(distinct u.id) = 0 then 0::numeric
    else round(100.0 * count(distinct u.id) filter (where pu.producto_id is not null)
               / count(distinct u.id), 1)
  end as ocupacion_pct,
  count(pu.producto_id) as productos_asignados
from estructuras e
join sedes s on s.id = e.sede_id
join tipos_estructura te on te.codigo = e.tipo
left join ubicaciones u on u.estructura_id = e.id
left join producto_ubicacion pu on pu.ubicacion_id = u.id
group by e.id, s.codigo_nave, s.ancho_local_cm, s.fondo_local_cm, te.nombre, te.doble_cara;

-- Las posiciones, ahora con la calle y con todo lo que hace falta para
-- contestar de pie frente a la percha: qué hay, cuánto queda, a cuánto
-- se vende y qué costó.
drop view if exists v_posiciones cascade;
create view v_posiciones
with (security_invoker = true)
as
select
  u.id as ubicacion_id,
  u.codigo,
  e.id as estructura_id,
  e.literal,
  e.nombre as estructura,
  e.calle,
  e.tipo,
  e.temperatura,
  e.sede_id,
  s.codigo_nave,
  u.columna,
  u.nivel,
  u.activa,
  p.id as producto_id,
  p.codigo as producto_codigo,
  p.nombre as producto,
  p.marca,
  c.nombre as categoria,
  coalesce(inv.stock, 0) as stock,
  coalesce(um.codigo, p.unidad_medida) as unidad,
  p.stock_minimo,
  p.precio_venta_menor,
  p.precio_venta_mayor,
  inv.costo_promedio,
  round(coalesce(inv.stock, 0) * coalesce(inv.costo_promedio, 0), 2) as valor_en_posicion,
  u.capacidad_maxima
from ubicaciones u
join estructuras e on e.id = u.estructura_id
join sedes s on s.id = e.sede_id
left join producto_ubicacion pu on pu.ubicacion_id = u.id
left join productos p on p.id = pu.producto_id
left join categorias c on c.id = p.categoria_id
left join unidades_medida um on um.id = p.unidad_medida_id
left join lateral (
  select i.stock, i.costo_promedio
  from inventario_saldos i
  where i.producto_id = p.id and i.bodega_id = coalesce(e.bodega_id, i.bodega_id)
  order by i.stock desc
  limit 1) inv on true;

comment on view v_posiciones is
  'Cada posición del local con lo que tiene encima: producto, stock, precio y valor. Es lo que '
  'se ve al tocar una posición en el plano.';

grant select on v_estructuras_ocupacion, v_posiciones to authenticated;

notify pgrst, 'reload schema';

select 'Migración 016 aplicada: plano editable, calles y detalle por posición.' as resultado;
