-- =========================================================
-- CENTRO DE CONTROL
-- Migración 017: ingresar la mercadería desde la factura del proveedor
--
-- EL PROBLEMA QUE NADIE VE VENIR
--
-- Leer el XML de la factura electrónica es la parte fácil y exacta: el
-- documento firmado trae cada línea con su cantidad, su precio y su
-- IVA. Lo difícil es lo otro: en esa factura dice
--
--     Q-10001203   BONICESSOTE FRESA X 10   1   1.74
--
-- y en el market ese producto se llama "Bonice fresa" con código
-- SNK-014, se vende por unidad y esa línea son DIEZ unidades, no una.
-- Nada en el XML dice eso. El proveedor factura con SU código, SU
-- descripción y SU presentación.
--
-- Emparejarlo a mano en cada factura sería más trabajo que digitar, así
-- que no se haría. La solución es que el sistema lo aprenda UNA vez por
-- producto: la primera factura de ese proveedor se empareja a mano, y
-- de ahí en adelante entra sola. Eso es proveedor_producto.
--
-- Requiere: 016_plano_editable.sql
-- =========================================================

-- ---------------------------------------------------------
-- PARTE 1 — La equivalencia entre el catálogo del proveedor y el nuestro
-- ---------------------------------------------------------
create table if not exists proveedor_producto (
  id               uuid primary key default gen_random_uuid(),
  proveedor_id     uuid not null references proveedores(id) on delete cascade,
  codigo_proveedor text not null,
  descripcion      text,
  producto_id      uuid not null references productos(id) on delete cascade,
  presentacion_id  uuid references presentaciones(id) on delete set null,
  factor           numeric(14,4) not null default 1,
  ultimo_costo     numeric(14,6),
  ultima_compra    date,
  veces_usado      integer not null default 0,
  created_at       timestamptz not null default now(),

  constraint proveedor_producto_unico unique (proveedor_id, codigo_proveedor),
  constraint proveedor_producto_factor check (factor > 0)
);

comment on table proveedor_producto is
  'Qué producto del market es cada código del proveedor, y cuántas unidades trae. Se aprende '
  'la primera vez y desde entonces la factura entra sola.';
comment on column proveedor_producto.factor is
  'Unidades de venta que representa UNA unidad facturada por el proveedor. Si factura la caja '
  'de 10, el factor es 10: la línea "cantidad 1" son 10 unidades al stock.';
comment on column proveedor_producto.veces_usado is
  'Cuántas facturas usaron esta equivalencia. Sirve para detectar la que se emparejó mal una '
  'vez y nunca más se usó.';

create index if not exists ix_prov_prod_producto on proveedor_producto (producto_id);

-- ---------------------------------------------------------
-- PARTE 2 — La factura importada deja rastro
-- ---------------------------------------------------------
alter table documentos_ingreso
  add column if not exists clave_acceso text,
  add column if not exists origen text not null default 'MANUAL';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documentos_ingreso_origen_valido') then
    alter table documentos_ingreso add constraint documentos_ingreso_origen_valido
      check (origen in ('MANUAL', 'XML_SRI', 'PDF', 'FOTO_OCR', 'ORDEN_COMPRA'));
  end if;
end $$;

comment on column documentos_ingreso.clave_acceso is
  'Los 49 dígitos de la factura electrónica. Es la identidad del documento ante el SRI y evita '
  'ingresar dos veces la misma factura.';
comment on column documentos_ingreso.origen is
  'Cómo entró: a mano, leyendo el XML del SRI, de un PDF o de una foto. Auditar un costo raro '
  'empieza por saber de dónde salió el dato.';

-- Una factura no se puede ingresar dos veces. Sin esto, un ingreso
-- repetido duplica el stock y arruina el costo promedio, y se descubre
-- meses después en un inventario físico.
create unique index if not exists ux_ingreso_clave_acceso
  on documentos_ingreso (clave_acceso) where clave_acceso is not null;

-- ---------------------------------------------------------
-- PARTE 3 — Recordar la equivalencia
-- ---------------------------------------------------------
create or replace function fn_vincular_producto_proveedor(
  p_proveedor_id     uuid,
  p_codigo_proveedor text,
  p_producto_id      uuid,
  p_factor           numeric default 1,
  p_descripcion      text default null,
  p_presentacion_id  uuid default null
)
returns table (estado text, mensaje text)
language plpgsql security definer set search_path = public as $$
declare
  v_codigo text := upper(trim(p_codigo_proveedor));
  v_nombre text;
  v_previo record;
begin
  select nombre into v_nombre from productos where id = p_producto_id;
  if v_nombre is null then
    return query select 'ERROR'::text, 'El producto no existe.'::text;
    return;
  end if;
  if coalesce(p_factor, 1) <= 0 then
    return query select 'ERROR'::text,
      'El factor tiene que ser mayor que cero: es cuántas unidades trae lo que factura el proveedor.'::text;
    return;
  end if;

  select pp.producto_id, p.nombre as producto, pp.factor
    into v_previo
  from proveedor_producto pp join productos p on p.id = pp.producto_id
  where pp.proveedor_id = p_proveedor_id and pp.codigo_proveedor = v_codigo;

  if found and v_previo.producto_id <> p_producto_id then
    -- Cambiar a qué producto apunta un código NO es un error: el
    -- proveedor reutiliza códigos. Pero se avisa, porque también puede
    -- ser un emparejamiento mal hecho que arrastraría el stock de dos
    -- productos distintos.
    update proveedor_producto
       set producto_id = p_producto_id,
           factor = coalesce(p_factor, 1),
           descripcion = coalesce(p_descripcion, descripcion),
           presentacion_id = p_presentacion_id
     where proveedor_id = p_proveedor_id and codigo_proveedor = v_codigo;

    return query select 'CAMBIADO'::text,
      format('El código %s apuntaba a "%s" y ahora apunta a "%s". Los ingresos anteriores no '
             'cambian: siguen donde se cargaron.', v_codigo, v_previo.producto, v_nombre)::text;
    return;
  end if;

  insert into proveedor_producto (proveedor_id, codigo_proveedor, descripcion,
                                  producto_id, presentacion_id, factor)
  values (p_proveedor_id, v_codigo, p_descripcion, p_producto_id, p_presentacion_id,
          coalesce(p_factor, 1))
  on conflict (proveedor_id, codigo_proveedor) do update
    set producto_id = excluded.producto_id,
        factor = excluded.factor,
        descripcion = coalesce(excluded.descripcion, proveedor_producto.descripcion),
        presentacion_id = excluded.presentacion_id;

  return query select 'OK'::text,
    format('%s = "%s"%s. La próxima factura de este proveedor lo reconocerá solo.',
           v_codigo, v_nombre,
           case when coalesce(p_factor, 1) <> 1
                then format(' (cada uno trae %s unidades)', p_factor) else '' end)::text;
end $$;

-- ---------------------------------------------------------
-- PARTE 4 — Traducir una factura completa
--
-- Recibe las líneas tal como vienen del XML y devuelve, para cada una,
-- a qué producto corresponde —si ya se sabe— y qué cantidad real
-- representa. Lo que no reconoce lo devuelve marcado, para que una
-- persona lo empareje una sola vez.
-- ---------------------------------------------------------
create or replace function fn_traducir_factura(
  p_proveedor_id uuid,
  p_lineas       jsonb
)
returns table (
  indice            int,
  codigo_proveedor  text,
  descripcion       text,
  cantidad_factura  numeric,
  precio_factura    numeric,
  producto_id       uuid,
  producto          text,
  unidad            text,
  factor            numeric,
  cantidad_real     numeric,
  costo_unitario    numeric,
  reconocido        boolean,
  sugerencia_id     uuid,
  sugerencia        text,
  motivo            text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_l     jsonb;
  v_i     int := 0;
  v_cod   text;
  v_aux   text;
  v_desc  text;
  v_cant  numeric;
  v_prec  numeric;
  v_map   record;
  v_sug   record;
begin
  for v_l in select * from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) loop
    v_i    := v_i + 1;
    v_cod  := upper(trim(coalesce(v_l ->> 'codigo', '')));
    v_aux  := upper(trim(coalesce(v_l ->> 'codigoAux', '')));
    v_desc := coalesce(v_l ->> 'descripcion', '');
    v_cant := coalesce((v_l ->> 'cantidad')::numeric, 0);
    v_prec := coalesce((v_l ->> 'precioUnitario')::numeric, 0);

    -- 1) ¿Ya se emparejó antes con este proveedor?
    select pp.producto_id, p.nombre, pp.factor,
           coalesce(um.codigo, p.unidad_medida) as unidad
      into v_map
    from proveedor_producto pp
    join productos p on p.id = pp.producto_id
    left join unidades_medida um on um.id = p.unidad_medida_id
    where pp.proveedor_id = p_proveedor_id and pp.codigo_proveedor = v_cod;

    if found then
      return query select
        v_i, v_cod, v_desc, v_cant, v_prec,
        v_map.producto_id, v_map.nombre, v_map.unidad, v_map.factor,
        v_cant * v_map.factor,
        case when v_map.factor > 0 then v_prec / v_map.factor else v_prec end,
        true, null::uuid, null::text,
        'Emparejado en una factura anterior'::text;
      continue;
    end if;

    -- 2) ¿El código auxiliar es un código de barras que ya conocemos?
    --    Es el atajo bueno: no hace falta emparejar nada.
    v_sug := null;
    if v_aux <> '' and v_aux <> '0' then
      select p.id, p.nombre, coalesce(um.codigo, p.unidad_medida) as unidad,
             coalesce(pr.factor, 1) as factor
        into v_sug
      from producto_codigos c
      join productos p on p.id = c.producto_id
      left join presentaciones pr on pr.id = c.presentacion_id and pr.activo
      left join unidades_medida um on um.id = p.unidad_medida_id
      where c.activo and c.codigo = v_aux;

      if found then
        return query select
          v_i, v_cod, v_desc, v_cant, v_prec,
          v_sug.id, v_sug.nombre, v_sug.unidad, v_sug.factor,
          v_cant * v_sug.factor,
          case when v_sug.factor > 0 then v_prec / v_sug.factor else v_prec end,
          true, v_sug.id, v_sug.nombre,
          'Reconocido por el código de barras que trae la factura'::text;
        continue;
      end if;
    end if;

    -- 3) Parecido por nombre, solo como SUGERENCIA. No se da por bueno:
    --    "ARROZ FLOR 2KG" y "ARROZ FLOR 5KG" se parecen mucho y son
    --    productos distintos con precios distintos.
    select p.id, p.nombre into v_sug
    from productos p
    where p.activo
      and (upper(p.nombre) like '%' || upper(split_part(v_desc, ' ', 1)) || '%'
           or upper(coalesce(p.marca, '')) like '%' || upper(split_part(v_desc, ' ', 1)) || '%')
      and length(split_part(v_desc, ' ', 1)) >= 4
    order by length(p.nombre)
    limit 1;

    return query select
      v_i, v_cod, v_desc, v_cant, v_prec,
      null::uuid, null::text, null::text, 1::numeric,
      v_cant, v_prec,
      false,
      case when v_sug.id is not null then v_sug.id else null end,
      case when v_sug.id is not null then v_sug.nombre else null end,
      case
        when v_sug.id is not null then 'Parecido por el nombre: confírmelo antes de aceptar'
        else 'Sin equivalencia: elija el producto o créelo'
      end::text;
  end loop;
end $$;

comment on function fn_traducir_factura(uuid, jsonb) is
  'Traduce las líneas del XML del proveedor al catálogo propio. Lo que ya se emparejó entra '
  'solo; lo demás se devuelve marcado para emparejarlo una vez.';

-- ---------------------------------------------------------
-- PARTE 5 — Seguridad
-- ---------------------------------------------------------
alter table proveedor_producto enable row level security;

drop policy if exists prov_prod_lectura on proveedor_producto;
create policy prov_prod_lectura on proveedor_producto
  for select using (auth.role() = 'authenticated');

drop policy if exists prov_prod_escritura on proveedor_producto;
create policy prov_prod_escritura on proveedor_producto
  using (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO'))
  with check (fn_rol_actual() in ('ADMIN','SUPERVISOR','BODEGUERO'));

grant select on proveedor_producto to authenticated;

notify pgrst, 'reload schema';

select 'Migración 017 aplicada: ingreso desde la factura del proveedor y equivalencias por proveedor.' as resultado;
