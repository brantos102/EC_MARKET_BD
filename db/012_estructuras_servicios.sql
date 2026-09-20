-- =========================================================
-- CENTRO DE CONTROL
-- Migración 012: estructuras físicas, ubicaciones estandarizadas,
--                servicios (recargas) y accesos externos
--
--   1. Estructuras — cada mueble del local (estantería, góndola,
--      frigorífico, nevera, mostrador) con sus medidas reales y su
--      posición en el piso. Es lo que permite dibujar el local en 3D
--      y, sobre todo, tener una nomenclatura de ubicación que no se
--      repita.
--   2. Ubicaciones — código estándar SEDE-LITERAL-COLUMNA-NIVEL:
--      ECM-A-01-1   → nivel 1, columna 1, estantería A de la matriz
--      ECM-FR1-01-1 → nivel 1, columna 1, primer frigorífico
--      Con crecimiento: más estructuras (nuevos literales), más
--      columnas o más niveles, sin tocar una línea de código.
--   3. Servicios — recargas y otros servicios que se venden en el
--      mostrador y no descuentan inventario, pero sí tienen que entrar
--      en el análisis mensual de cuánto se vendió.
--   4. Accesos externos — enlaces a sistemas de terceros (POSVirtual)
--      administrables desde la aplicación.
--
-- Requiere: 011_instalacion_deuna.sql
-- =========================================================

-- =========================================================
-- PARTE 1 — Código de nave por sede
--
-- El código SRI del establecimiento es numérico (001) y sirve para la
-- facturación. Para las ubicaciones físicas hace falta algo que el
-- bodeguero pueda leer en voz alta: ECM = El Cultivo Matriz.
-- =========================================================
alter table sedes add column if not exists codigo_nave text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sedes_codigo_nave_valido') then
    alter table sedes add constraint sedes_codigo_nave_valido
      check (codigo_nave is null or codigo_nave ~ '^[A-Z]{2,4}$');
  end if;
end $$;

-- A las sedes que ya existen se les arma un código con las iniciales
-- del nombre comercial. Si no sale nada razonable, queda "NAV".
update sedes s set codigo_nave = coalesce(
  nullif(upper(regexp_replace(
    (select string_agg(left(palabra, 1), '')
     from (select unnest(string_to_array(
             regexp_replace(coalesce(
               (select e.nombre_comercial from empresa e limit 1), s.nombre), '[^a-zA-Z ]', '', 'g'),
             ' ')) as palabra) p
     where length(palabra) > 2),
    '[^A-Z]', '', 'g')), ''),
  'NAV')
where codigo_nave is null;

-- Un código de tres letras es lo cómodo; si salieron más, se recorta.
update sedes set codigo_nave = left(codigo_nave, 3) where length(codigo_nave) > 3;

-- Y la matriz del proyecto actual se llama ECM, como pidió el negocio.
update sedes set codigo_nave = 'ECM'
where es_matriz
  and not exists (select 1 from sedes where codigo_nave = 'ECM')
  and exists (select 1 from empresa where nombre_comercial ilike '%cultivo%');

create unique index if not exists ix_sedes_codigo_nave on sedes (codigo_nave);

-- =========================================================
-- PARTE 2 — Estructuras físicas
--
-- Aquí vive la forma real del local: qué muebles hay, de qué tipo, de
-- qué tamaño y dónde están parados. Las medidas están en centímetros
-- porque es como se miden las perchas en la tienda, y la posición es la
-- esquina inferior izquierda vista desde arriba.
-- =========================================================
create table if not exists tipos_estructura (
  codigo text primary key,
  nombre text not null,
  descripcion text not null,
  prefijo_sugerido text not null,         -- A, FR, NV, MO
  temperatura text not null default 'AMBIENTE'
    check (temperatura in ('AMBIENTE','REFRIGERADO','CONGELADO')),
  ancho_cm int not null default 100,
  alto_cm int not null default 200,
  fondo_cm int not null default 50,
  columnas_defecto int not null default 4,
  niveles_defecto int not null default 4,
  doble_cara boolean not null default false,
  color_hex text not null default '#8a9a8d',
  orden int not null default 100
);

insert into tipos_estructura
  (codigo, nombre, descripcion, prefijo_sugerido, temperatura,
   ancho_cm, alto_cm, fondo_cm, columnas_defecto, niveles_defecto,
   doble_cara, color_hex, orden) values
  ('ESTANTERIA', 'Estantería mural',
   'Percha contra la pared, de una sola cara. La típica de abarrotes y enlatados.',
   'A', 'AMBIENTE', 120, 200, 45, 4, 5, false, '#d8dee0', 10),
  ('GONDOLA', 'Góndola central',
   'Isla de doble cara en medio del pasillo. Se accede por los dos lados.',
   'G', 'AMBIENTE', 150, 160, 80, 5, 4, true, '#e8ecef', 20),
  ('EXHIBIDOR_FRUTA', 'Exhibidor de frutas y verduras',
   'Mueble inclinado con bandejas. Producto a la vista, rotación alta.',
   'F', 'AMBIENTE', 180, 190, 70, 4, 4, false, '#2f3a33', 30),
  ('FRIGORIFICO', 'Frigorífico vertical',
   'Vitrina de puerta de vidrio para bebidas y lácteos. Se numera FR1, FR2…',
   'FR', 'REFRIGERADO', 80, 200, 65, 2, 5, false, '#bcd4e6', 40),
  ('NEVERA', 'Nevera horizontal / congelador',
   'Arcón de tapa superior para congelados. Se numera NV1, NV2…',
   'NV', 'CONGELADO', 150, 90, 70, 3, 2, false, '#a9c9e0', 50),
  ('MOSTRADOR', 'Mostrador / caja',
   'Donde se cobra. También exhibe impulso: dulces, pilas, recargas.',
   'MO', 'AMBIENTE', 180, 110, 60, 4, 2, false, '#c9a227', 60),
  ('PANADERIA', 'Vitrina de panadería',
   'Vitrina con bandejas para pan y bollería.',
   'PA', 'AMBIENTE', 120, 150, 60, 3, 3, false, '#e3c08d', 70),
  ('PALLET', 'Pallet / estiba en piso',
   'Bulto en el piso: quintales de arroz, sacos de azúcar, cajas de gaseosa.',
   'P', 'AMBIENTE', 120, 60, 100, 1, 1, false, '#9c7a4f', 80),
  ('BODEGA', 'Rack de bodega',
   'Estantería de trastienda, donde se guarda el respaldo del salón.',
   'B', 'AMBIENTE', 200, 250, 60, 6, 5, false, '#8fa3ad', 90)
on conflict (codigo) do update
  set nombre = excluded.nombre,
      descripcion = excluded.descripcion,
      prefijo_sugerido = excluded.prefijo_sugerido,
      temperatura = excluded.temperatura,
      ancho_cm = excluded.ancho_cm,
      alto_cm = excluded.alto_cm,
      fondo_cm = excluded.fondo_cm,
      columnas_defecto = excluded.columnas_defecto,
      niveles_defecto = excluded.niveles_defecto,
      doble_cara = excluded.doble_cara,
      color_hex = excluded.color_hex,
      orden = excluded.orden;

create table if not exists estructuras (
  id uuid primary key default gen_random_uuid(),
  sede_id uuid not null references sedes(id) on delete cascade,
  bodega_id uuid references bodegas(id),
  literal text not null,                  -- A, B, FR1, NV2, MO1
  nombre text not null,
  tipo text not null references tipos_estructura(codigo),
  columnas int not null default 4 check (columnas between 1 and 99),
  niveles int not null default 4 check (niveles between 1 and 9),

  -- Medidas reales, en centímetros
  ancho_cm int not null default 120 check (ancho_cm > 0),
  alto_cm int not null default 200 check (alto_cm > 0),
  fondo_cm int not null default 45 check (fondo_cm > 0),

  -- Posición en el piso, en centímetros desde la esquina de la sala,
  -- y giro en grados. Es lo que usa el dibujo en 3D.
  pos_x_cm int not null default 0,
  pos_y_cm int not null default 0,
  rotacion_grados int not null default 0 check (rotacion_grados between 0 and 359),

  temperatura text not null default 'AMBIENTE'
    check (temperatura in ('AMBIENTE','REFRIGERADO','CONGELADO')),
  color_hex text not null default '#d8dee0',
  activa boolean not null default true,
  orden int not null default 100,
  created_at timestamptz not null default now(),

  unique (sede_id, literal)
);

comment on table estructuras is
  'Los muebles del local. El literal es la parte del código de ubicación: ECM-[literal]-columna-nivel.';

-- Un literal tiene que poder leerse en voz alta y no chocar con el
-- separador del código.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'estructuras_literal_valido') then
    alter table estructuras add constraint estructuras_literal_valido
      check (literal ~ '^[A-Z]{1,3}[0-9]{0,2}$');
  end if;
end $$;

create index if not exists ix_estructuras_sede on estructuras (sede_id, orden);

-- =========================================================
-- PARTE 3 — Ubicaciones estandarizadas
-- =========================================================
alter table ubicaciones add column if not exists estructura_id uuid references estructuras(id) on delete cascade;
alter table ubicaciones add column if not exists columna int;
-- `nivel` y `codigo` ya existen desde la migración 002.
alter table ubicaciones alter column zona_id drop not null;

create index if not exists ix_ubicaciones_estructura on ubicaciones (estructura_id, columna, nivel);

/**
 * Código estándar de una posición.
 *
 * SEDE-LITERAL-COLUMNA-NIVEL, con la columna a dos dígitos para que
 * ordene bien alfabéticamente: ECM-A-01-1 va antes que ECM-A-10-1, cosa
 * que no pasaría con "1" y "10".
 */
create or replace function fn_codigo_ubicacion(p_nave text, p_literal text,
                                               p_columna int, p_nivel int)
returns text
language sql
immutable
as $$
  select upper(p_nave) || '-' || upper(p_literal) || '-' ||
         lpad(p_columna::text, 2, '0') || '-' || p_nivel::text;
$$;

/**
 * EL TRIGGER QUE HABÍA QUE CAMBIAR.
 *
 * La migración 002 dejó un trigger que reescribe `codigo` en cada
 * insert y update con el formato viejo (ZONA-PASILLO-ESTANTE-NIVEL).
 * Mientras siguiera ahí, cualquier intento de poner el código nuevo se
 * perdía en silencio: la fila se guardaba con el formato antiguo y
 * nadie se enteraba. Se reemplaza por uno que usa la estructura cuando
 * la hay, y que conserva el comportamiento anterior para las
 * ubicaciones viejas que todavía cuelguen de una zona.
 */
create or replace function fn_generar_codigo_ubicacion()
returns trigger
language plpgsql
as $$
declare
  v_nave text;
  v_literal text;
  v_zona text;
begin
  if new.estructura_id is not null then
    select s.codigo_nave, e.literal into v_nave, v_literal
    from estructuras e
    join sedes s on s.id = e.sede_id
    where e.id = new.estructura_id;

    new.columna := coalesce(new.columna, new.estante);
    new.estante := coalesce(new.estante, new.columna);
    new.pasillo := coalesce(nullif(new.pasillo, ''), v_literal);
    new.codigo := fn_codigo_ubicacion(coalesce(v_nave, 'NAV'), v_literal,
                                      new.columna, new.nivel);
    return new;
  end if;

  select codigo into v_zona from zonas where id = new.zona_id;
  new.codigo := coalesce(v_zona, 'GEN') || '-' || upper(new.pasillo) || '-' ||
                lpad(new.estante::text, 2, '0') || '-' || new.nivel::text;
  return new;
end;
$$;

/**
 * Crea (o completa) las posiciones de una estructura.
 *
 * Es idempotente: se puede llamar después de agregar columnas o niveles
 * y solo crea lo que falta. Nunca borra: para quitar posiciones está
 * fn_redimensionar_estructura(), que primero comprueba que estén vacías.
 */
create or replace function fn_generar_ubicaciones(p_estructura_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  e estructuras%rowtype;
  v_nave text;
  v_creadas int := 0;
  c int;
  n int;
begin
  select * into e from estructuras where id = p_estructura_id;
  if not found then
    raise exception 'La estructura no existe';
  end if;

  select codigo_nave into v_nave from sedes where id = e.sede_id;

  for c in 1..e.columnas loop
    for n in 1..e.niveles loop
      insert into ubicaciones (estructura_id, columna, nivel, codigo, pasillo, estante, activa)
      values (p_estructura_id, c, n,
              fn_codigo_ubicacion(v_nave, e.literal, c, n),
              e.literal, c, true)
      on conflict (codigo) do nothing;

      if found then
        v_creadas := v_creadas + 1;
      end if;
    end loop;
  end loop;

  return v_creadas;
end;
$$;

/**
 * Alta de una estructura con todas sus posiciones.
 *
 * El literal se puede dejar en null y lo calcula solo: para una
 * estantería busca la siguiente letra libre (A, B, C…) y para un
 * frigorífico el siguiente número (FR1, FR2…). Así el usuario no tiene
 * que llevar la cuenta.
 */
create or replace function fn_crear_estructura(
  p_tipo text,
  p_nombre text,
  p_literal text default null,
  p_columnas int default null,
  p_niveles int default null,
  p_sede_id uuid default null,
  p_pos_x_cm int default 0,
  p_pos_y_cm int default 0,
  p_rotacion int default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t tipos_estructura%rowtype;
  v_sede uuid;
  v_literal text;
  v_id uuid;
  v_bodega uuid;
  i int;
begin
  if fn_rol_actual() not in ('ADMIN','SUPERVISOR','BODEGUERO') then
    raise exception 'Su rol no puede crear estructuras';
  end if;

  select * into t from tipos_estructura where codigo = p_tipo;
  if not found then
    raise exception 'El tipo de estructura "%" no existe', p_tipo;
  end if;

  v_sede := coalesce(p_sede_id, fn_mi_sede());
  select id into v_bodega from bodegas where sede_id = v_sede and activa order by created_at limit 1;

  -- ---- Literal automático ----
  v_literal := upper(coalesce(trim(p_literal), ''));

  if v_literal = '' then
    if t.prefijo_sugerido ~ '^[A-Z]$' and t.codigo in ('ESTANTERIA','GONDOLA','BODEGA','PALLET','EXHIBIDOR_FRUTA') then
      -- Estanterías: la siguiente letra libre del abecedario
      for i in 0..25 loop
        v_literal := chr(65 + i);
        exit when not exists (
          select 1 from estructuras where sede_id = v_sede and literal = v_literal);
        v_literal := '';
      end loop;
      if v_literal = '' then
        raise exception 'Se agotaron las letras A-Z en esta sede. Use un literal propio (por ejemplo AA).';
      end if;
    else
      -- Frigoríficos, neveras, mostradores: prefijo + siguiente número
      i := 1;
      loop
        v_literal := t.prefijo_sugerido || i::text;
        exit when not exists (
          select 1 from estructuras where sede_id = v_sede and literal = v_literal);
        i := i + 1;
        if i > 99 then
          raise exception 'Demasiadas estructuras de tipo % en esta sede', p_tipo;
        end if;
      end loop;
    end if;
  end if;

  if exists (select 1 from estructuras where sede_id = v_sede and literal = v_literal) then
    raise exception 'Ya existe una estructura con el literal % en esta sede', v_literal;
  end if;

  insert into estructuras (
    sede_id, bodega_id, literal, nombre, tipo,
    columnas, niveles, ancho_cm, alto_cm, fondo_cm,
    pos_x_cm, pos_y_cm, rotacion_grados, temperatura, color_hex,
    orden)
  values (
    v_sede, v_bodega, v_literal, p_nombre, p_tipo,
    coalesce(p_columnas, t.columnas_defecto),
    coalesce(p_niveles, t.niveles_defecto),
    t.ancho_cm, t.alto_cm, t.fondo_cm,
    p_pos_x_cm, p_pos_y_cm, p_rotacion, t.temperatura, t.color_hex,
    coalesce((select max(orden) + 10 from estructuras where sede_id = v_sede), 10))
  returning id into v_id;

  perform fn_generar_ubicaciones(v_id);
  return v_id;
end;
$$;

/**
 * Cambia el número de columnas o niveles de una estructura.
 *
 * Crecer es trivial. Encoger no: antes de quitar una posición hay que
 * comprobar que no tenga producto asignado. Devolver un error con la
 * lista de posiciones ocupadas es mucho más útil que borrar en silencio
 * y que alguien descubra tres semanas después que perdió la ubicación
 * de veinte productos.
 */
create or replace function fn_redimensionar_estructura(
  p_estructura_id uuid,
  p_columnas int,
  p_niveles int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  e estructuras%rowtype;
  v_ocupadas text[];
  v_eliminadas int := 0;
  v_creadas int := 0;
begin
  if fn_rol_actual() not in ('ADMIN','SUPERVISOR','BODEGUERO') then
    raise exception 'Su rol no puede redimensionar estructuras';
  end if;

  select * into e from estructuras where id = p_estructura_id;
  if not found then
    raise exception 'La estructura no existe';
  end if;
  if p_columnas < 1 or p_columnas > 99 then
    raise exception 'Las columnas deben estar entre 1 y 99';
  end if;
  if p_niveles < 1 or p_niveles > 9 then
    raise exception 'Los niveles deben estar entre 1 y 9';
  end if;

  -- ¿Alguna de las posiciones que desaparecerían tiene producto?
  select array_agg(u.codigo order by u.codigo) into v_ocupadas
  from ubicaciones u
  where u.estructura_id = p_estructura_id
    and (u.columna > p_columnas or u.nivel > p_niveles)
    and exists (select 1 from producto_ubicacion pu where pu.ubicacion_id = u.id);

  if v_ocupadas is not null then
    raise exception
      'No se puede encoger: % posiciones todavía tienen producto (%). '
      'Mueva primero esos productos a otra ubicación.',
      array_length(v_ocupadas, 1),
      array_to_string(v_ocupadas[1:8], ', ') ||
        case when array_length(v_ocupadas, 1) > 8 then '…' else '' end;
  end if;

  delete from ubicaciones u
  where u.estructura_id = p_estructura_id
    and (u.columna > p_columnas or u.nivel > p_niveles);
  get diagnostics v_eliminadas = row_count;

  update estructuras set columnas = p_columnas, niveles = p_niveles
  where id = p_estructura_id;

  v_creadas := fn_generar_ubicaciones(p_estructura_id);

  return jsonb_build_object(
    'ok', true,
    'posiciones_creadas', v_creadas,
    'posiciones_eliminadas', v_eliminadas,
    'total', p_columnas * p_niveles);
end;
$$;

-- =========================================================
-- PARTE 4 — Migrar las ubicaciones que ya existían
--
-- Las zonas de la migración 002 pasan a ser estructuras, conservando el
-- id de cada ubicación para no perder qué producto está dónde. Lo único
-- que cambia es el texto del código.
-- =========================================================
do $$
declare
  z record;
  v_sede uuid;
  v_nave text;
  v_bodega uuid;
  v_id uuid;
  v_cols int;
  v_niv int;
  v_x int := 0;
  v_tipo text;
  v_literal text;
  v_indice int := 0;
begin
  -- Si ya hay estructuras, esta migración ya corrió.
  if exists (select 1 from estructuras limit 1) then
    return;
  end if;

  select id, codigo_nave into v_sede, v_nave from sedes where es_matriz limit 1;
  if v_sede is null then
    select id, codigo_nave into v_sede, v_nave from sedes order by codigo limit 1;
  end if;
  if v_sede is null then
    return;   -- base sin sedes: nada que migrar
  end if;

  select id into v_bodega from bodegas where activa order by created_at limit 1;

  -- UNA ESTRUCTURA POR PASILLO, no por zona.
  --
  -- En el modelo viejo una zona ("Perecibles") podía tener varios
  -- pasillos (A, B), y cada pasillo era en realidad un mueble distinto.
  -- Agruparlos en una sola estructura hacía que dos posiciones
  -- diferentes reclamaran el mismo código y la migración se caía. Cada
  -- pasillo pasa a ser su propio mueble, que además es lo que se ve al
  -- entrar a la tienda.
  for z in
    select zo.id as zona_id, zo.codigo as zona_codigo, zo.nombre as zona_nombre,
           zo.tipo_conservacion, zo.orden, u.pasillo,
           max(u.estante) as max_col, max(u.nivel) as max_niv
    from zonas zo
    join ubicaciones u on u.zona_id = zo.id
    group by zo.id, zo.codigo, zo.nombre, zo.tipo_conservacion, zo.orden, u.pasillo
    order by zo.orden, zo.codigo, u.pasillo
  loop
    v_cols := coalesce(z.max_col, 4);
    v_niv  := coalesce(z.max_niv, 4);

    v_tipo := case z.tipo_conservacion
                when 'REFRIGERADO' then 'FRIGORIFICO'
                when 'CONGELADO' then 'NEVERA'
                else 'ESTANTERIA' end;

    -- Literal correlativo A, B, C… sobre toda la sede. Se conserva la
    -- letra del pasillo si está libre, porque el personal ya la conoce.
    v_literal := upper(z.pasillo);
    if v_literal !~ '^[A-Z]{1,3}[0-9]{0,2}$'
       or exists (select 1 from estructuras where sede_id = v_sede and literal = v_literal) then
      v_literal := null;
      while v_literal is null and v_indice < 26 loop
        if not exists (select 1 from estructuras
                       where sede_id = v_sede and literal = chr(65 + v_indice)) then
          v_literal := chr(65 + v_indice);
        end if;
        v_indice := v_indice + 1;
      end loop;
      if v_literal is null then
        v_literal := 'Z' || v_indice::text;
        v_indice := v_indice + 1;
      end if;
    end if;

    insert into estructuras (
      sede_id, bodega_id, literal, nombre, tipo, columnas, niveles,
      ancho_cm, alto_cm, fondo_cm, pos_x_cm, pos_y_cm,
      temperatura, color_hex, orden)
    select v_sede, v_bodega, v_literal,
           z.zona_nombre || ' · pasillo ' || upper(z.pasillo),
           v_tipo, v_cols, v_niv,
           t.ancho_cm, t.alto_cm, t.fondo_cm,
           v_x, 0,
           z.tipo_conservacion, t.color_hex, z.orden
    from tipos_estructura t where t.codigo = v_tipo
    returning id into v_id;

    -- El código lo recalcula el trigger al ver la estructura.
    update ubicaciones u set
      estructura_id = v_id,
      columna = u.estante
    where u.zona_id = z.zona_id and u.pasillo = z.pasillo;

    v_x := v_x + 200;   -- 2 m entre muebles; después se acomodan en el mapa
  end loop;
end $$;


-- =========================================================
-- PARTE 4b — Muebles que el modelo viejo no sabía representar
--
-- Las zonas de la migración 002 solo distinguían por temperatura. El
-- local real tiene además un exhibidor de frutas, un frigorífico de
-- bebidas, un congelador y el mostrador de caja. Se crean aquí, con el
-- literal que pidió el negocio (FR1, NV1, MO1) y acomodados en el piso
-- como están en la tienda: perchas contra las paredes, góndola al
-- centro, frigoríficos al fondo y la caja junto a la entrada.
-- =========================================================
do $$
declare
  v_sede uuid;
  v_bodega uuid;
  v_id uuid;
  v_x int;
  e record;
begin
  select id into v_sede from sedes where es_matriz limit 1;
  if v_sede is null then
    select id into v_sede from sedes order by codigo limit 1;
  end if;
  if v_sede is null then
    return;
  end if;

  select id into v_bodega from bodegas where activa order by created_at limit 1;

  -- Solo en una base que ya tenía el layout viejo: si alguien instala
  -- de cero, los muebles los crea desde la pantalla de estructuras.
  if not exists (select 1 from estructuras where sede_id = v_sede) then
    return;
  end if;
  if exists (select 1 from estructuras where sede_id = v_sede and tipo = 'MOSTRADOR') then
    return;   -- ya se corrió
  end if;

  -- Exhibidor de frutas, frigorífico, congelador y mostrador
  insert into estructuras (sede_id, bodega_id, literal, nombre, tipo,
                           columnas, niveles, ancho_cm, alto_cm, fondo_cm,
                           pos_x_cm, pos_y_cm, rotacion_grados,
                           temperatura, color_hex, orden)
  select v_sede, v_bodega, d.literal, d.nombre, d.tipo,
         d.columnas, d.niveles, t.ancho_cm, t.alto_cm, t.fondo_cm,
         d.x, d.y, d.rot, t.temperatura, t.color_hex, d.orden
  from (values
    ('F1',  'Exhibidor de frutas y verduras', 'EXHIBIDOR_FRUTA', 3, 4,   20, 120,   0, 200),
    ('FR1', 'Frigorífico de bebidas',         'FRIGORIFICO',     2, 5,  520,  40,   0, 210),
    ('FR2', 'Frigorífico de lácteos',         'FRIGORIFICO',     2, 5,  610,  40,   0, 220),
    ('NV1', 'Congelador horizontal',          'NEVERA',          3, 2,  520, 260,   0, 230),
    ('MO1', 'Mostrador de caja',              'MOSTRADOR',       4, 2,  640, 420,   0, 240),
    ('PA1', 'Vitrina de panadería',           'PANADERIA',       3, 3,  380, 420,   0, 250)
  ) as d(literal, nombre, tipo, columnas, niveles, x, y, rot, orden)
  join tipos_estructura t on t.codigo = d.tipo
  where not exists (
    select 1 from estructuras x where x.sede_id = v_sede and x.literal = d.literal);

  for e in select id from estructuras where sede_id = v_sede and literal in ('F1','FR1','FR2','NV1','MO1','PA1') loop
    perform fn_generar_ubicaciones(e.id);
  end loop;

  -- Se acomodan las perchas heredadas contra las paredes, en vez de la
  -- fila recta que dejó la migración anterior.
  v_x := 20;
  for e in
    select id from estructuras
    where sede_id = v_sede and tipo in ('ESTANTERIA','GONDOLA')
    order by orden, literal
  loop
    update estructuras set
      pos_x_cm = case when v_x < 460 then v_x else 20 + (v_x - 460) end,
      pos_y_cm = case when v_x < 460 then 40 else 300 end,
      rotacion_grados = 0
    where id = e.id;
    v_x := v_x + 140;
  end loop;
end $$;

-- =========================================================
-- PARTE 5 — Vista para el dibujo en 3D y para el buscador
-- =========================================================
drop view if exists v_estructuras_ocupacion cascade;
create view v_estructuras_ocupacion as
select
  e.id as estructura_id,
  e.sede_id,
  s.codigo_nave,
  e.literal,
  e.nombre,
  e.tipo,
  te.nombre as tipo_nombre,
  e.columnas,
  e.niveles,
  e.ancho_cm, e.alto_cm, e.fondo_cm,
  e.pos_x_cm, e.pos_y_cm, e.rotacion_grados,
  e.temperatura,
  e.color_hex,
  te.doble_cara,
  e.activa,
  e.orden,
  -- distinct porque una posición puede tener varios productos: sin él,
  -- el join multiplicaba las filas y la ocupación daba más del 100 %.
  count(distinct u.id) as posiciones,
  count(distinct u.id) filter (where pu.producto_id is not null) as posiciones_ocupadas,
  case when count(distinct u.id) = 0 then 0
       else round(100.0 * count(distinct u.id) filter (where pu.producto_id is not null)
                  / count(distinct u.id), 1)
  end as ocupacion_pct,
  count(pu.producto_id) as productos_asignados
from estructuras e
join sedes s on s.id = e.sede_id
join tipos_estructura te on te.codigo = e.tipo
left join ubicaciones u on u.estructura_id = e.id
left join producto_ubicacion pu on pu.ubicacion_id = u.id
group by e.id, s.codigo_nave, te.nombre, te.doble_cara;

drop view if exists v_posiciones cascade;
create view v_posiciones as
select
  u.id as ubicacion_id,
  u.codigo,
  e.id as estructura_id,
  e.literal,
  e.nombre as estructura,
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
  coalesce(um.codigo, 'UND') as unidad
from ubicaciones u
join estructuras e on e.id = u.estructura_id
join sedes s on s.id = e.sede_id
left join producto_ubicacion pu on pu.ubicacion_id = u.id
left join productos p on p.id = pu.producto_id
left join categorias c on c.id = p.categoria_id
left join unidades_medida um on um.id = p.unidad_medida_id
left join inventario_saldos inv
       on inv.producto_id = p.id and inv.bodega_id = e.bodega_id;

comment on view v_posiciones is
  'Una fila por posición física, con el producto que ocupa esa posición si lo hay.';

-- =========================================================
-- PARTE 6 — Servicios: recargas y otros cobros sin inventario
--
-- Una recarga de saldo no descuenta stock ni tiene costo promedio, así
-- que meterla en `ventas` obligaría a inventar un producto fantasma y a
-- desactivar media docena de triggers. Vive en su propia tabla, y el
-- análisis mensual las suma junto con las ventas de mercadería.
-- =========================================================
create table if not exists servicios_catalogo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  tipo text not null default 'RECARGA'
    check (tipo in ('RECARGA','PAGO_SERVICIO','GIRO','OTRO')),
  proveedor text,
  -- La comisión puede ser un porcentaje del monto o un valor fijo.
  comision_tipo text not null default 'PORCENTAJE'
    check (comision_tipo in ('PORCENTAJE','FIJA','NINGUNA')),
  comision_valor numeric(10,4) not null default 0 check (comision_valor >= 0),
  monto_minimo numeric(12,2) not null default 1 check (monto_minimo > 0),
  monto_maximo numeric(12,2),
  requiere_referencia boolean not null default true,
  etiqueta_referencia text not null default 'Número de teléfono',
  icono text not null default 'punto',
  color_hex text not null default '#17803A',
  activo boolean not null default true,
  orden int not null default 100
);

insert into servicios_catalogo
  (codigo, nombre, tipo, proveedor, comision_tipo, comision_valor,
   monto_minimo, monto_maximo, etiqueta_referencia, icono, color_hex, orden) values
  ('REC_CLARO',    'Recarga Claro',     'RECARGA', 'Claro',     'PORCENTAJE', 5, 1, 100, 'Número de celular', 'senal', '#d52b1e', 10),
  ('REC_MOVISTAR', 'Recarga Movistar',  'RECARGA', 'Movistar',  'PORCENTAJE', 5, 1, 100, 'Número de celular', 'senal', '#019df4', 20),
  ('REC_CNT',      'Recarga CNT',       'RECARGA', 'CNT',       'PORCENTAJE', 5, 1, 100, 'Número de celular', 'senal', '#f68b1f', 30),
  ('REC_TUENTI',   'Recarga Tuenti',    'RECARGA', 'Tuenti',    'PORCENTAJE', 5, 1, 100, 'Número de celular', 'senal', '#0099ff', 40),
  ('PAGO_LUZ',     'Pago de luz',       'PAGO_SERVICIO', 'Empresa Eléctrica', 'FIJA', 0.25, 1, null, 'Número de suministro', 'rayo', '#f5c518', 50),
  ('PAGO_AGUA',    'Pago de agua',      'PAGO_SERVICIO', 'EPMAPS', 'FIJA', 0.25, 1, null, 'Número de cuenta', 'gota', '#2b8fd6', 60)
on conflict (codigo) do nothing;

create table if not exists ventas_servicio (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  servicio_id uuid not null references servicios_catalogo(id),
  sede_id uuid references sedes(id),
  cliente_id uuid references clientes(id),
  fecha date not null default current_date,
  monto numeric(12,2) not null check (monto > 0),
  comision numeric(12,4) not null default 0 check (comision >= 0),
  referencia text,                          -- teléfono, suministro, etc.
  codigo_operadora text,                    -- lo que devuelve el sistema externo
  forma_pago text not null default 'EFECTIVO'
    check (forma_pago in ('EFECTIVO','TARJETA_CREDITO','TARJETA_DEBITO',
                          'TRANSFERENCIA_DEUNA','TRANSFERENCIA_OTRO')),
  estado text not null default 'COMPLETADA'
    check (estado in ('COMPLETADA','ANULADA')),
  observacion text,
  usuario_id uuid references auth.users(id),
  cajero_nombre text,
  created_at timestamptz not null default now(),
  anulada_at timestamptz,
  anulada_por uuid references auth.users(id)
);

create index if not exists ix_ventas_servicio_fecha on ventas_servicio (fecha, sede_id);
create index if not exists ix_ventas_servicio_serv on ventas_servicio (servicio_id, fecha);

comment on table ventas_servicio is
  'Recargas y pagos de servicios. No tocan inventario, pero sí entran en el análisis mensual.';

/**
 * Registra una recarga o un pago de servicio.
 *
 * La comisión la calcula la base, no el navegador: si dependiera de lo
 * que mande la pantalla, cada caja podría reportar una comisión distinta
 * y el análisis mensual no serviría para nada.
 */
create or replace function fn_registrar_servicio(
  p_servicio_codigo text,
  p_monto numeric,
  p_referencia text default null,
  p_forma_pago text default 'EFECTIVO',
  p_codigo_operadora text default null,
  p_cliente_id uuid default null,
  p_observacion text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s servicios_catalogo%rowtype;
  v_numero text;
  v_comision numeric(12,4);
  v_id uuid;
  v_nombre text;
begin
  if auth.uid() is null then
    raise exception 'Inicie sesión para registrar un servicio';
  end if;

  select * into s from servicios_catalogo where codigo = p_servicio_codigo and activo;
  if not found then
    raise exception 'El servicio "%" no existe o está inactivo', p_servicio_codigo;
  end if;

  if p_monto < s.monto_minimo then
    raise exception 'El monto mínimo de % es $%', s.nombre, s.monto_minimo;
  end if;
  if s.monto_maximo is not null and p_monto > s.monto_maximo then
    raise exception 'El monto máximo de % es $%', s.nombre, s.monto_maximo;
  end if;
  if s.requiere_referencia and coalesce(trim(p_referencia), '') = '' then
    raise exception '% necesita %', s.nombre, lower(s.etiqueta_referencia);
  end if;

  v_comision := case s.comision_tipo
                  when 'PORCENTAJE' then round(p_monto * s.comision_valor / 100.0, 4)
                  when 'FIJA' then s.comision_valor
                  else 0
                end;

  v_numero := fn_siguiente_secuencia('VENTA_SERVICIO', 'SRV');
  select nombre into v_nombre from perfiles_usuario where usuario_id = auth.uid();

  insert into ventas_servicio (
    numero, servicio_id, sede_id, cliente_id, monto, comision,
    referencia, codigo_operadora, forma_pago, observacion,
    usuario_id, cajero_nombre)
  values (
    v_numero, s.id, fn_mi_sede(), p_cliente_id, p_monto, v_comision,
    nullif(trim(p_referencia), ''), nullif(trim(p_codigo_operadora), ''),
    p_forma_pago, p_observacion, auth.uid(), v_nombre)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true, 'id', v_id, 'numero', v_numero,
    'servicio', s.nombre, 'monto', p_monto, 'comision', v_comision);
end;
$$;

create or replace function fn_anular_servicio(p_id uuid, p_motivo text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if fn_rol_actual() not in ('ADMIN','SUPERVISOR') then
    raise exception 'Solo un administrador o supervisor puede anular un servicio registrado';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'La anulación necesita un motivo';
  end if;

  update ventas_servicio set
    estado = 'ANULADA',
    anulada_at = now(),
    anulada_por = auth.uid(),
    observacion = coalesce(observacion || ' | ', '') || 'ANULADA: ' || trim(p_motivo)
  where id = p_id and estado = 'COMPLETADA';

  if not found then
    raise exception 'El servicio no existe o ya estaba anulado';
  end if;
  return true;
end;
$$;

-- Resumen mensual: mercadería y servicios en el mismo cuadro, que es
-- como el dueño quiere ver cuánto vendió el negocio.
drop view if exists v_resumen_mensual cascade;
create view v_resumen_mensual as
with mercaderia as (
  select date_trunc('month', v.fecha)::date as mes,
         v.sede_id,
         count(*) as transacciones,
         sum(v.total) as monto,
         0::numeric as comision
  from ventas v
  where v.estado = 'CONFIRMADA'
  group by 1, 2
),
servicios as (
  select date_trunc('month', vs.fecha)::date as mes,
         vs.sede_id,
         count(*) as transacciones,
         sum(vs.monto) as monto,
         sum(vs.comision) as comision
  from ventas_servicio vs
  where vs.estado = 'COMPLETADA'
  group by 1, 2
)
select mes, sede_id, 'MERCADERIA' as origen, transacciones, monto, comision from mercaderia
union all
select mes, sede_id, 'SERVICIOS' as origen, transacciones, monto, comision from servicios;

drop view if exists v_servicios_detalle cascade;
create view v_servicios_detalle as
select
  vs.id,
  vs.numero,
  vs.fecha,
  vs.created_at,
  sc.codigo as servicio_codigo,
  sc.nombre as servicio,
  sc.tipo,
  sc.proveedor,
  vs.monto,
  vs.comision,
  vs.referencia,
  vs.codigo_operadora,
  vs.forma_pago,
  vs.estado,
  vs.cajero_nombre,
  vs.observacion,
  s.nombre as sede,
  s.codigo_nave
from ventas_servicio vs
join servicios_catalogo sc on sc.id = vs.servicio_id
left join sedes s on s.id = vs.sede_id;

-- =========================================================
-- PARTE 7 — Accesos a sistemas externos
--
-- POSVirtual es de un tercero: no tenemos su API ni sus credenciales, y
-- su servidor no permite que otra página lo incruste. Lo honesto es
-- abrirlo en su propia ventana y quedarnos con el registro de lo que se
-- vendió, que es lo que el negocio necesita para su análisis.
-- =========================================================
create table if not exists accesos_externos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  url text not null,
  icono text not null default 'enlace',
  color_hex text not null default '#0f766e',
  registrar_servicio text references servicios_catalogo(codigo),
  instrucciones text,
  activo boolean not null default true,
  orden int not null default 100
);

insert into accesos_externos (codigo, nombre, descripcion, url, icono, color_hex, instrucciones, orden)
values (
  'POSVIRTUAL',
  'POSVirtual — Recargas',
  'Sistema de Ponle Más para recargar saldo a Claro, Movistar, CNT y Tuenti.',
  'https://posvirtual.ponlemas.com:86/login',
  'senal',
  '#1f7a8c',
  'Se abre en una ventana aparte porque es un sistema de otra empresa. '
  'Haga la recarga ahí y después registre el monto en el sistema, para que '
  'entre en el cierre de caja y en el análisis del mes.',
  10)
on conflict (codigo) do update
  set nombre = excluded.nombre,
      descripcion = excluded.descripcion,
      url = excluded.url,
      instrucciones = excluded.instrucciones;

-- =========================================================
-- PARTE 8 — Módulo nuevo en el menú
-- =========================================================
insert into modulos_sistema (codigo, nombre, grupo, icono, descripcion, orden) values
  ('servicios', 'Recargas y servicios', 'Operación', 'senal',
   'Recargas de saldo, pagos de servicios y acceso a POSVirtual', 25)
on conflict (codigo) do update
  set nombre = excluded.nombre, grupo = excluded.grupo,
      icono = excluded.icono, descripcion = excluded.descripcion,
      orden = excluded.orden;

insert into permisos_rol (rol, modulo, puede_ver, puede_editar, requiere_token)
select r.codigo, 'servicios',
       true,                                   -- todos pueden ver
       r.codigo in ('ADMIN','SUPERVISOR','BODEGUERO','VENDEDOR'),
       false
from roles_catalogo r
on conflict (rol, modulo) do nothing;

-- =========================================================
-- PARTE 9 — Seguridad
-- =========================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'tipos_estructura','estructuras','servicios_catalogo',
    'ventas_servicio','accesos_externos'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Catálogos: leen todos los autenticados, escribe quien abastece.
do $$
declare
  t text;
begin
  foreach t in array array['tipos_estructura','servicios_catalogo','accesos_externos'] loop
    execute format('drop policy if exists "%s_lectura" on %I', t, t);
    execute format('drop policy if exists "%s_admin" on %I', t, t);
    execute format(
      'create policy "%s_lectura" on %I for select using (auth.role() = ''authenticated'')', t, t);
    execute format(
      'create policy "%s_admin" on %I for all using (fn_es_admin()) with check (fn_es_admin())', t, t);
  end loop;
end $$;

drop policy if exists "estructuras_lectura" on estructuras;
create policy "estructuras_lectura" on estructuras
  for select using (auth.role() = 'authenticated');

drop policy if exists "estructuras_escritura" on estructuras;
create policy "estructuras_escritura" on estructuras
  for all using (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO'))
  with check (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO'));

-- Servicios: los ve cualquiera autenticado, los registra la función
-- (SECURITY DEFINER) y solo admin/supervisor los puede tocar a mano.
drop policy if exists "servicios_lectura" on ventas_servicio;
create policy "servicios_lectura" on ventas_servicio
  for select using (auth.role() = 'authenticated');

drop policy if exists "servicios_admin" on ventas_servicio;
create policy "servicios_admin" on ventas_servicio
  for all using (fn_rol_actual() in ('ADMIN','SUPERVISOR'))
  with check (fn_rol_actual() in ('ADMIN','SUPERVISOR'));

notify pgrst, 'reload schema';

select 'Migración 012 aplicada: estructuras, ubicaciones estandarizadas, servicios y accesos externos.' as resultado;
