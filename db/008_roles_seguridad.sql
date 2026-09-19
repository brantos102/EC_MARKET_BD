-- =========================================================
-- CENTRO DE CONTROL - MARKET
-- Migración 008: corrección crítica de RLS, roles y autorización
--
-- CORRIGE UN BUG QUE BLOQUEA TODA ESCRITURA DE INVENTARIO:
-- los triggers que mantienen inventario_saldos corrían con los
-- permisos del usuario que hace la operación, y como esa tabla tiene
-- RLS sin política de escritura, cualquier ajuste, ingreso o venta
-- fallaba con "new row violates row-level security policy".
--
-- La solución correcta no es abrir la tabla a escritura: es marcar
-- esas funciones como SECURITY DEFINER. Son lógica del sistema, no
-- entrada del usuario — deben correr con los permisos del dueño del
-- esquema y seguir siendo la única vía de modificar saldos.
--
-- Requiere: 007_realtime.sql
-- =========================================================

-- ---------------------------------------------------------
-- PARTE 1 — Corrección de RLS en los triggers del motor
-- ---------------------------------------------------------
alter function fn_procesar_movimiento_inventario() security definer;
alter function fn_consumir_lotes_fefo(uuid, uuid, numeric) security definer;
alter function fn_procesar_confirmacion_venta() security definer;
alter function fn_confirmar_ingreso() security definer;
alter function fn_recalcular_totales_venta() security definer;
alter function fn_recalcular_totales_ingreso() security definer;
alter function fn_calcular_linea_venta() security definer;
alter function fn_verificar_pago_venta() security definer;

-- search_path fijo: sin esto, una función SECURITY DEFINER puede ser
-- engañada para ejecutar código de otro esquema.
alter function fn_procesar_movimiento_inventario() set search_path = public;
alter function fn_consumir_lotes_fefo(uuid, uuid, numeric) set search_path = public;
alter function fn_procesar_confirmacion_venta() set search_path = public;
alter function fn_confirmar_ingreso() set search_path = public;
alter function fn_recalcular_totales_venta() set search_path = public;
alter function fn_recalcular_totales_ingreso() set search_path = public;
alter function fn_calcular_linea_venta() set search_path = public;
alter function fn_verificar_pago_venta() set search_path = public;

-- ---------------------------------------------------------
-- PARTE 2 — Datos de la empresa (para recibo y factura)
-- ---------------------------------------------------------
create table if not exists empresa (
  id boolean primary key default true check (id),   -- fila única
  razon_social text not null default 'MI EMPRESA',
  nombre_comercial text,
  ruc text check (ruc is null or ruc ~ '^[0-9]{13}$'),
  direccion_matriz text,
  direccion_establecimiento text,
  telefono text,
  email text,
  logo_url text,                       -- o data URI
  obligado_contabilidad boolean not null default false,
  contribuyente_especial text,
  establecimiento text not null default '001',
  punto_emision text not null default '001',
  ambiente text not null default 'PRUEBAS' check (ambiente in ('PRUEBAS','PRODUCCION')),
  pie_recibo text default '¡Gracias por su compra!',
  plantilla_recibo text,               -- HTML con marcadores {{...}}
  plantilla_correo text,
  color_primario text default '#2563eb',
  tipo_negocio text not null default 'MARKET'
    check (tipo_negocio in ('MARKET','FERRETERIA','TECNOLOGIA','OTRO')),
  updated_at timestamptz not null default now()
);

insert into empresa (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------
-- PARTE 3 — Perfiles y roles
-- ---------------------------------------------------------
create table if not exists perfiles_usuario (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null default 'VENDEDOR' check (rol in ('ADMIN','VENDEDOR','BODEGUERO')),
  activo boolean not null default true,
  bodega_id uuid references bodegas(id),
  created_at timestamptz not null default now(),
  creado_por uuid references auth.users(id)
);

-- Rol del usuario actual. STABLE y SECURITY DEFINER para que pueda
-- consultarse desde dentro de las propias políticas sin recursión.
create or replace function fn_rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select rol from perfiles_usuario where usuario_id = auth.uid() and activo),
    'SIN_PERFIL'
  );
$$;

create or replace function fn_es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select fn_rol_actual() = 'ADMIN';
$$;

-- El primer usuario que se registre queda como ADMIN; el resto,
-- VENDEDOR. Evita quedarse sin administrador en una base recién creada.
create or replace function fn_crear_perfil_automatico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_primero boolean;
begin
  select count(*) = 0 into v_primero from perfiles_usuario;
  insert into perfiles_usuario (usuario_id, nombre, rol)
  values (new.id, coalesce(new.email, 'usuario'), case when v_primero then 'ADMIN' else 'VENDEDOR' end)
  on conflict (usuario_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_perfil_automatico on auth.users;
create trigger trg_perfil_automatico
  after insert on auth.users
  for each row execute function fn_crear_perfil_automatico();

-- Perfiles para los usuarios que ya existan (el primero, ADMIN)
do $$
declare r record; v_primero boolean := true;
begin
  for r in select id, email from auth.users order by created_at loop
    insert into perfiles_usuario (usuario_id, nombre, rol)
    values (r.id, coalesce(r.email, 'usuario'), case when v_primero then 'ADMIN' else 'VENDEDOR' end)
    on conflict (usuario_id) do nothing;
    v_primero := false;
  end loop;
exception when undefined_column then
  -- auth.users sin columna created_at (entornos de prueba)
  for r in select id, email from auth.users loop
    insert into perfiles_usuario (usuario_id, nombre, rol)
    values (r.id, coalesce(r.email, 'usuario'), case when v_primero then 'ADMIN' else 'VENDEDOR' end)
    on conflict (usuario_id) do nothing;
    v_primero := false;
  end loop;
end $$;

-- ---------------------------------------------------------
-- PARTE 4 — Tokens de autorización
--
-- Un vendedor no puede anular una venta ni hacer un ajuste de
-- inventario por su cuenta. El administrador genera un token de un
-- solo uso, con vigencia corta y alcance limitado a una acción; el
-- vendedor lo digita y la operación queda registrada a nombre de
-- ambos. Así el admin no tiene que sentarse en la caja.
--
-- El token NUNCA se guarda en claro: se guarda su hash SHA-256.
-- ---------------------------------------------------------
create table if not exists tokens_autorizacion (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  accion text not null check (accion in ('AJUSTE_INVENTARIO','ANULAR_VENTA','CAMBIO_PRECIO','TRANSFERENCIA','CUALQUIERA')),
  descripcion text,
  emitido_por uuid not null references auth.users(id),
  usos_maximos int not null default 1 check (usos_maximos > 0),
  usos_realizados int not null default 0,
  vence_at timestamptz not null,
  anulado boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_tokens_hash on tokens_autorizacion(token_hash);

create table if not exists tokens_uso (
  id bigserial primary key,
  token_id uuid not null references tokens_autorizacion(id) on delete cascade,
  usado_por uuid references auth.users(id),
  accion text not null,
  detalle text,
  created_at timestamptz not null default now()
);

-- Genera un token legible (6 grupos de 4 no ambiguos) y devuelve el
-- valor en claro UNA sola vez. Solo un ADMIN puede emitirlo.
create or replace function fn_emitir_token(
  p_accion text,
  p_descripcion text default null,
  p_minutos int default 15,
  p_usos int default 1
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sin I,O,0,1
  v_token text := '';
  i int;
begin
  if not fn_es_admin() then
    raise exception 'Solo un administrador puede emitir tokens de autorización';
  end if;

  for i in 1..8 loop
    v_token := v_token || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    if i = 4 then v_token := v_token || '-'; end if;
  end loop;

  insert into tokens_autorizacion (token_hash, accion, descripcion, emitido_por, usos_maximos, vence_at)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_accion, p_descripcion, auth.uid(),
          p_usos, now() + make_interval(mins => p_minutos));

  return v_token;
end;
$$;

-- Valida y consume un token. Devuelve true si autoriza la acción.
create or replace function fn_consumir_token(p_token text, p_accion text, p_detalle text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token tokens_autorizacion%rowtype;
begin
  select * into v_token from tokens_autorizacion
  where token_hash = encode(digest(upper(trim(p_token)), 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'Token de autorización inválido';
  end if;
  if v_token.anulado then
    raise exception 'Ese token fue anulado por el administrador';
  end if;
  if v_token.vence_at < now() then
    raise exception 'El token expiró. Pida uno nuevo al administrador';
  end if;
  if v_token.usos_realizados >= v_token.usos_maximos then
    raise exception 'El token ya fue utilizado';
  end if;
  if v_token.accion <> 'CUALQUIERA' and v_token.accion <> p_accion then
    raise exception 'Ese token no autoriza la acción %', p_accion;
  end if;

  update tokens_autorizacion set usos_realizados = usos_realizados + 1 where id = v_token.id;
  insert into tokens_uso (token_id, usado_por, accion, detalle)
  values (v_token.id, auth.uid(), p_accion, p_detalle);

  return true;
end;
$$;

-- ---------------------------------------------------------
-- PARTE 5 — Operaciones sensibles vía función autorizada
--
-- Un vendedor no tiene permiso directo de INSERT sobre el kardex.
-- Pasa por aquí, y aquí se le exige token si no es administrador.
-- ---------------------------------------------------------
create or replace function fn_registrar_ajuste(
  p_producto_id uuid,
  p_bodega_id uuid,
  p_tipo text,
  p_cantidad numeric,
  p_motivo text,
  p_token text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_tipo not in ('AJUSTE_POSITIVO','AJUSTE_NEGATIVO') then
    raise exception 'Tipo de ajuste no válido: %', p_tipo;
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'El motivo del ajuste es obligatorio';
  end if;

  if not fn_es_admin() then
    perform fn_consumir_token(
      coalesce(p_token, ''), 'AJUSTE_INVENTARIO',
      format('%s de %s unidades. Motivo: %s', p_tipo, p_cantidad, p_motivo));
  end if;

  insert into movimientos_inventario (producto_id, bodega_id, tipo, cantidad, observacion, usuario_id)
  values (p_producto_id, p_bodega_id, p_tipo, p_cantidad, p_motivo, auth.uid())
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function fn_anular_venta(
  p_venta_id uuid,
  p_motivo text,
  p_token text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta ventas%rowtype;
  r record;
begin
  select * into v_venta from ventas where id = p_venta_id for update;
  if not found then
    raise exception 'Venta no encontrada';
  end if;
  if v_venta.estado = 'ANULADA' then
    raise exception 'La venta % ya está anulada', v_venta.numero_interno;
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'El motivo de la anulación es obligatorio';
  end if;

  if not fn_es_admin() then
    perform fn_consumir_token(
      coalesce(p_token, ''), 'ANULAR_VENTA',
      format('Anulación de %s. Motivo: %s', v_venta.numero_interno, p_motivo));
  end if;

  -- Si la venta ya descontó stock, se devuelve con movimientos de
  -- entrada: el kardex no se borra, se compensa.
  if v_venta.estado in ('CONFIRMADA','PAGADA') then
    for r in select d.*, p.maneja_lote from venta_detalle d
             join productos p on p.id = d.producto_id
             where d.venta_id = p_venta_id
    loop
      insert into movimientos_inventario (
        producto_id, bodega_id, tipo, cantidad, costo_unitario,
        referencia, observacion, usuario_id
      ) values (
        r.producto_id, v_venta.bodega_id, 'AJUSTE_POSITIVO', r.cantidad, null,
        v_venta.numero_interno || ' ANULADA', 'Devolución por anulación: ' || p_motivo, auth.uid()
      );

      -- Devolver a los lotes de los que salió
      if r.lotes_consumidos is not null then
        update lotes l
        set cantidad_disponible = l.cantidad_disponible + (x->>'cantidad')::numeric
        from jsonb_array_elements(r.lotes_consumidos) x
        where l.id = (x->>'lote_id')::uuid;
      end if;
    end loop;
  end if;

  update ventas
  set estado = 'ANULADA',
      observacion = coalesce(observacion || ' | ', '') || 'ANULADA: ' || p_motivo
  where id = p_venta_id;

  return true;
end;
$$;

-- ---------------------------------------------------------
-- PARTE 6 — Transferencia entre ubicaciones
-- ---------------------------------------------------------
create or replace function fn_transferir_ubicacion(
  p_producto_id uuid,
  p_ubicacion_destino uuid,
  p_token text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if fn_rol_actual() not in ('ADMIN','BODEGUERO') then
    perform fn_consumir_token(coalesce(p_token, ''), 'TRANSFERENCIA',
      format('Traslado de producto %s a ubicación %s', p_producto_id, p_ubicacion_destino));
  end if;

  update producto_ubicacion set es_principal = false
  where producto_id = p_producto_id and es_principal;

  insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
  values (p_producto_id, p_ubicacion_destino, true)
  on conflict (producto_id, ubicacion_id) do update set es_principal = true;

  return true;
end;
$$;

-- ---------------------------------------------------------
-- PARTE 7 — Políticas por rol
--
-- Regla general: el ADMIN puede todo. El VENDEDOR lee el catálogo y
-- registra ventas. El BODEGUERO además maneja ingresos y ubicaciones.
-- Las escrituras sensibles no se abren por política: pasan por las
-- funciones de arriba, que exigen token.
-- ---------------------------------------------------------

-- Saldos: nadie los escribe directamente; solo los mantiene el trigger
-- (que ahora es SECURITY DEFINER). Queda en solo lectura para todos.
drop policy if exists "auth_read_saldos" on inventario_saldos;
create policy "saldos_lectura" on inventario_saldos
  for select using (auth.role() = 'authenticated');

-- Catálogo: todos leen; solo admin escribe.
do $$
declare t text;
begin
  foreach t in array array['productos','categorias','bodegas','zonas','ubicaciones',
                           'unidades_medida','tarifas_impuesto','proveedores',
                           'promociones','promocion_alcance','empresa'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "auth_all_%s" on %I', t, t);
    execute format('drop policy if exists "auth_read_%s" on %I', t, t);
    execute format('drop policy if exists "auth_write_%s" on %I', t, t);
    execute format('drop policy if exists "auth_update_%s" on %I', t, t);
    execute format('drop policy if exists "%s_lectura" on %I', t, t);
    execute format('drop policy if exists "%s_admin" on %I', t, t);

    execute format(
      'create policy "%s_lectura" on %I for select using (auth.role() = ''authenticated'')', t, t);
    execute format(
      'create policy "%s_admin" on %I for all using (fn_es_admin()) with check (fn_es_admin())', t, t);
  end loop;
end $$;

-- Ubicación de productos: bodeguero y admin
drop policy if exists "auth_all_producto_ubicacion" on producto_ubicacion;
drop policy if exists "pu_lectura" on producto_ubicacion;
drop policy if exists "pu_escritura" on producto_ubicacion;
create policy "pu_lectura" on producto_ubicacion
  for select using (auth.role() = 'authenticated');
create policy "pu_escritura" on producto_ubicacion
  for all using (fn_rol_actual() in ('ADMIN','BODEGUERO'))
  with check (fn_rol_actual() in ('ADMIN','BODEGUERO'));

-- Lotes: lectura para todos, escritura para admin y bodeguero
drop policy if exists "auth_all_lotes" on lotes;
drop policy if exists "lotes_lectura" on lotes;
drop policy if exists "lotes_escritura" on lotes;
create policy "lotes_lectura" on lotes for select using (auth.role() = 'authenticated');
create policy "lotes_escritura" on lotes
  for all using (fn_rol_actual() in ('ADMIN','BODEGUERO'))
  with check (fn_rol_actual() in ('ADMIN','BODEGUERO'));

-- Ingresos: admin y bodeguero
do $$
declare t text;
begin
  foreach t in array array['documentos_ingreso','ingreso_detalle'] loop
    execute format('drop policy if exists "auth_all_%s" on %I', t, t);
    execute format('drop policy if exists "%s_lectura" on %I', t, t);
    execute format('drop policy if exists "%s_escritura" on %I', t, t);
    execute format('create policy "%s_lectura" on %I for select using (auth.role() = ''authenticated'')', t, t);
    execute format(
      'create policy "%s_escritura" on %I for all using (fn_rol_actual() in (''ADMIN'',''BODEGUERO''))
       with check (fn_rol_actual() in (''ADMIN'',''BODEGUERO''))', t, t);
  end loop;
end $$;

-- Clientes: cualquier usuario autenticado puede registrar un cliente
-- nuevo en caja (es parte de vender), pero solo admin los borra.
drop policy if exists "auth_all_clientes" on clientes;
drop policy if exists "clientes_lectura" on clientes;
drop policy if exists "clientes_alta" on clientes;
drop policy if exists "clientes_admin" on clientes;
create policy "clientes_lectura" on clientes for select using (auth.role() = 'authenticated');
create policy "clientes_alta" on clientes for insert with check (auth.role() = 'authenticated');
create policy "clientes_admin" on clientes for all using (fn_es_admin()) with check (fn_es_admin());

-- Ventas: el vendedor crea y confirma las suyas; el admin ve y toca todo.
do $$
declare t text;
begin
  foreach t in array array['ventas','venta_detalle','pagos_venta'] loop
    execute format('drop policy if exists "auth_all_%s" on %I', t, t);
  end loop;
end $$;

drop policy if exists "ventas_lectura" on ventas;
drop policy if exists "ventas_propias" on ventas;
create policy "ventas_lectura" on ventas for select using (auth.role() = 'authenticated');
create policy "ventas_propias" on ventas
  for all using (fn_es_admin() or usuario_id = auth.uid())
  with check (fn_es_admin() or usuario_id = auth.uid());

drop policy if exists "vd_lectura" on venta_detalle;
drop policy if exists "vd_escritura" on venta_detalle;
create policy "vd_lectura" on venta_detalle for select using (auth.role() = 'authenticated');
create policy "vd_escritura" on venta_detalle
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "pagos_lectura" on pagos_venta;
drop policy if exists "pagos_escritura" on pagos_venta;
create policy "pagos_lectura" on pagos_venta for select using (auth.role() = 'authenticated');
create policy "pagos_escritura" on pagos_venta
  for insert with check (auth.role() = 'authenticated');

-- Kardex: nadie inserta directo salvo el admin. Los vendedores llegan
-- por fn_registrar_ajuste, que exige token.
drop policy if exists "auth_insert_movimientos" on movimientos_inventario;
drop policy if exists "mov_admin_insert" on movimientos_inventario;
create policy "mov_admin_insert" on movimientos_inventario
  for insert with check (fn_es_admin());

-- Perfiles: cada quien ve el suyo; el admin ve y administra todos.
alter table perfiles_usuario enable row level security;
drop policy if exists "perfil_propio" on perfiles_usuario;
drop policy if exists "perfil_admin" on perfiles_usuario;
create policy "perfil_propio" on perfiles_usuario
  for select using (usuario_id = auth.uid() or fn_es_admin());
create policy "perfil_admin" on perfiles_usuario
  for all using (fn_es_admin()) with check (fn_es_admin());

-- Tokens: solo el admin los ve. El vendedor nunca los lista, solo los
-- digita, y la validación ocurre dentro de fn_consumir_token.
alter table tokens_autorizacion enable row level security;
alter table tokens_uso enable row level security;
drop policy if exists "tokens_admin" on tokens_autorizacion;
drop policy if exists "tokens_uso_admin" on tokens_uso;
create policy "tokens_admin" on tokens_autorizacion
  for all using (fn_es_admin()) with check (fn_es_admin());
create policy "tokens_uso_admin" on tokens_uso for select using (fn_es_admin());

-- ---------------------------------------------------------
-- PARTE 8 — Vista del perfil actual, para que la interfaz sepa
-- qué mostrar sin consultar tablas restringidas.
-- ---------------------------------------------------------
create or replace function fn_mi_perfil()
returns table (usuario_id uuid, nombre text, rol text, bodega_id uuid, tipo_negocio text)
language sql
stable
security definer
set search_path = public
as $$
  select p.usuario_id, p.nombre, p.rol, p.bodega_id,
         (select e.tipo_negocio from empresa e limit 1)
  from perfiles_usuario p
  where p.usuario_id = auth.uid() and p.activo;
$$;

select 'Migración 008 aplicada: RLS corregido, roles y tokens activos.' as resultado;
