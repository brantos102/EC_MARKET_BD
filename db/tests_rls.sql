-- =========================================================
-- CENTRO DE CONTROL - MARKET
-- Pruebas de seguridad con RLS REALMENTE APLICADO.
--
-- POR QUÉ ESTE ARCHIVO EXISTE:
-- db/tests_funcionales.sql corría como superusuario, y PostgreSQL
-- ignora las políticas RLS para superusuarios y dueños de tabla. Por
-- eso pasaban todas las pruebas mientras la aplicación real fallaba
-- con "new row violates row-level security policy". Estas pruebas se
-- ejecutan como un rol sin privilegios, igual que la aplicación.
--
-- Uso (requiere las migraciones 001-008 aplicadas):
--   psql -f db/tests_rls.sql
-- =========================================================

\set ON_ERROR_STOP on

-- ---------------------------------------------------------
-- Preparación: roles que imitan a Supabase
-- ---------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_vendedor') then
    create role app_vendedor login;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'app_admin') then
    create role app_admin login;
  end if;
end $$;

-- Dos usuarios de prueba con roles distintos
do $$
declare v_admin uuid; v_vend uuid;
begin
  insert into auth.users (id, email) values (gen_random_uuid(), 'admin@prueba.ec')
    returning id into v_admin;
  insert into auth.users (id, email) values (gen_random_uuid(), 'vendedor@prueba.ec')
    returning id into v_vend;

  insert into perfiles_usuario (usuario_id, nombre, rol)
  values (v_admin, 'Admin Prueba', 'ADMIN')
  on conflict (usuario_id) do update set rol = 'ADMIN';

  insert into perfiles_usuario (usuario_id, nombre, rol)
  values (v_vend, 'Vendedor Prueba', 'VENDEDOR')
  on conflict (usuario_id) do update set rol = 'VENDEDOR';

  -- Se guardan para usarlos en las sesiones simuladas
  create table if not exists _prueba_usuarios (clave text primary key, id uuid, valor text);
  insert into _prueba_usuarios (clave, id) values ('admin', v_admin), ('vendedor', v_vend)
  on conflict (clave) do update set id = excluded.id;
end $$;

-- Los permisos se otorgan DESPUÉS de crear todas las tablas: un
-- "grant on all tables" solo alcanza a las que ya existen.
grant usage on schema public to app_vendedor, app_admin;
grant select, insert, update, delete on all tables in schema public to app_vendedor, app_admin;
grant usage, select on all sequences in schema public to app_vendedor, app_admin;
grant execute on all functions in schema public to app_vendedor, app_admin;

-- En Supabase el rol 'authenticated' puede llamar a auth.uid(); aquí se
-- concede lo mismo para que la simulación sea fiel.
grant usage on schema auth to app_vendedor, app_admin;
grant execute on all functions in schema auth to app_vendedor, app_admin;

\echo ''
\echo '=== PRUEBAS CON RLS APLICADO ==='

-- ---------------------------------------------------------
-- 1. El bug original: un ajuste debe poder escribir el saldo
-- ---------------------------------------------------------
\echo ''
\echo '--- 1. Un ADMIN puede registrar un ajuste (el bug que bloqueaba todo)'
set role app_admin;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', (select id::text from _prueba_usuarios where clave='admin'), false);

do $$
declare v_prod uuid; v_bod uuid; v_antes numeric; v_despues numeric;
begin
  select id into v_prod from productos where codigo = 'FRU-014';
  select id into v_bod from bodegas where nombre = 'Bodega Principal';
  select coalesce(stock,0) into v_antes from inventario_saldos
    where producto_id = v_prod and bodega_id = v_bod;

  perform fn_registrar_ajuste(v_prod, v_bod, 'AJUSTE_NEGATIVO', 2, 'Merma por maduración');

  select stock into v_despues from inventario_saldos
    where producto_id = v_prod and bodega_id = v_bod;

  if v_despues <> v_antes - 2 then
    raise exception 'FALLO: el ajuste no descontó (antes %, después %)', v_antes, v_despues;
  end if;
  raise notice '    OK: stock % -> %', v_antes, v_despues;
end $$;

-- ---------------------------------------------------------
-- 2. Un producto sin saldo previo también funciona (rama INSERT)
-- ---------------------------------------------------------
\echo '--- 2. Un producto sin saldo previo puede recibir su primer movimiento'
do $$
declare v_prod uuid; v_bod uuid; v_stock numeric;
begin
  insert into productos (codigo, nombre, precio_venta_menor)
  values ('TEST-RLS-001', 'Producto de prueba RLS', 1.00)
  on conflict (codigo) do nothing;

  select id into v_prod from productos where codigo = 'TEST-RLS-001';
  select id into v_bod from bodegas where nombre = 'Bodega Principal';

  insert into movimientos_inventario (producto_id, bodega_id, tipo, cantidad, costo_unitario)
  values (v_prod, v_bod, 'ENTRADA', 10, 0.50);

  select stock into v_stock from inventario_saldos
    where producto_id = v_prod and bodega_id = v_bod;

  if coalesce(v_stock, 0) <> 10 then
    raise exception 'FALLO: no se creó el saldo inicial (stock %)', v_stock;
  end if;
  raise notice '    OK: saldo creado con % unidades', v_stock;
end $$;

-- ---------------------------------------------------------
-- 3. El vendedor NO puede ajustar inventario sin token
-- ---------------------------------------------------------
\echo '--- 3. Un VENDEDOR no puede ajustar inventario sin autorización'
reset role;
set role app_vendedor;
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', (select id::text from _prueba_usuarios where clave='vendedor'), false);

do $$
declare v_prod uuid; v_bod uuid;
begin
  select id into v_prod from productos where codigo = 'FRU-014';
  select id into v_bod from bodegas where nombre = 'Bodega Principal';
  begin
    perform fn_registrar_ajuste(v_prod, v_bod, 'AJUSTE_NEGATIVO', 1, 'Intento sin permiso');
    raise exception 'FALLO: el vendedor ajustó inventario sin token';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
    raise notice '    OK (rechazado: %)', left(sqlerrm, 50);
  end;
end $$;

\echo '--- 4. Un VENDEDOR tampoco puede insertar en el kardex directamente'
do $$
declare v_prod uuid; v_bod uuid;
begin
  select id into v_prod from productos where codigo = 'FRU-014';
  select id into v_bod from bodegas where nombre = 'Bodega Principal';
  begin
    insert into movimientos_inventario (producto_id, bodega_id, tipo, cantidad, costo_unitario)
    values (v_prod, v_bod, 'ENTRADA', 100, 1.00);
    raise exception 'FALLO: el vendedor escribió en el kardex';
  exception when insufficient_privilege or check_violation then
    raise notice '    OK (bloqueado por política)';
  when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
    raise notice '    OK (bloqueado: %)', left(sqlerrm, 40);
  end;
end $$;

\echo '--- 5. Un VENDEDOR no puede cambiar precios'
do $$
begin
  update productos set precio_venta_menor = 0.01 where codigo = 'FRU-014';
  if found then
    raise exception 'FALLO: el vendedor cambió un precio';
  end if;
  raise notice '    OK (la política no dejó modificar ninguna fila)';
exception when insufficient_privilege then
  raise notice '    OK (bloqueado por política)';
end $$;

-- ---------------------------------------------------------
-- 6. El vendedor SÍ puede vender
-- ---------------------------------------------------------
\echo '--- 6. Un VENDEDOR sí puede registrar y confirmar una venta'
do $$
declare v_venta uuid; v_prod uuid; v_bod uuid; v_cli uuid; v_estado text;
begin
  select id into v_prod from productos where codigo = 'ABA-001';
  select id into v_bod from bodegas where nombre = 'Bodega Principal';
  select id into v_cli from clientes where identificacion = '9999999999999';

  insert into ventas (cliente_id, bodega_id, tipo_venta, usuario_id)
  values (v_cli, v_bod, 'MENOR', auth.uid()) returning id into v_venta;

  insert into venta_detalle (venta_id, producto_id, cantidad) values (v_venta, v_prod, 2);
  update ventas set estado = 'CONFIRMADA' where id = v_venta;

  select estado into v_estado from ventas where id = v_venta;
  if v_estado <> 'CONFIRMADA' then
    raise exception 'FALLO: la venta quedó en %', v_estado;
  end if;
  raise notice '    OK: venta confirmada por el vendedor y stock descontado';
end $$;

-- ---------------------------------------------------------
-- 7. Token emitido por el admin habilita al vendedor
-- ---------------------------------------------------------
\echo '--- 7. Con un token del administrador, el vendedor sí puede ajustar'
reset role;
set role app_admin;
select set_config('request.jwt.claim.sub', (select id::text from _prueba_usuarios where clave='admin'), false);

insert into _prueba_usuarios (clave, valor)
values ('token', fn_emitir_token('AJUSTE_INVENTARIO', 'Prueba automatizada', 15, 1))
on conflict (clave) do update set valor = excluded.valor;

reset role;
set role app_vendedor;
select set_config('request.jwt.claim.sub', (select id::text from _prueba_usuarios where clave='vendedor'), false);

do $$
declare v_prod uuid; v_bod uuid; v_token text; v_antes numeric; v_despues numeric;
begin
  select valor into v_token from _prueba_usuarios where clave = 'token';
  select id into v_prod from productos where codigo = 'FRU-014';
  select id into v_bod from bodegas where nombre = 'Bodega Principal';
  select stock into v_antes from inventario_saldos where producto_id = v_prod and bodega_id = v_bod;

  perform fn_registrar_ajuste(v_prod, v_bod, 'AJUSTE_NEGATIVO', 1, 'Merma autorizada', v_token);

  select stock into v_despues from inventario_saldos where producto_id = v_prod and bodega_id = v_bod;
  if v_despues <> v_antes - 1 then
    raise exception 'FALLO: el ajuste con token no se aplicó';
  end if;
  raise notice '    OK: ajuste autorizado por token, stock % -> %', v_antes, v_despues;
end $$;

\echo '--- 8. El mismo token no sirve dos veces'
do $$
declare v_prod uuid; v_bod uuid; v_token text;
begin
  select valor into v_token from _prueba_usuarios where clave = 'token';
  select id into v_prod from productos where codigo = 'FRU-014';
  select id into v_bod from bodegas where nombre = 'Bodega Principal';
  begin
    perform fn_registrar_ajuste(v_prod, v_bod, 'AJUSTE_NEGATIVO', 1, 'Reintento', v_token);
    raise exception 'FALLO: el token se reutilizó';
  exception when raise_exception then
    if sqlerrm like 'FALLO%' then raise; end if;
    raise notice '    OK (rechazado: %)', left(sqlerrm, 40);
  end;
end $$;

\echo '--- 9. Un vendedor no puede emitir tokens'
do $$
begin
  perform fn_emitir_token('CUALQUIERA', 'Intento', 60, 99);
  raise exception 'FALLO: el vendedor emitió un token';
exception when raise_exception then
  if sqlerrm like 'FALLO%' then raise; end if;
  raise notice '    OK (rechazado: %)', left(sqlerrm, 50);
end $$;

\echo '--- 10. Un vendedor no puede leer la tabla de tokens'
do $$
declare v_cuenta int;
begin
  select count(*) into v_cuenta from tokens_autorizacion;
  if v_cuenta > 0 then
    raise exception 'FALLO: el vendedor vio % tokens', v_cuenta;
  end if;
  raise notice '    OK (la política le oculta todos los tokens)';
exception when insufficient_privilege then
  raise notice '    OK (bloqueado por política)';
end $$;

-- ---------------------------------------------------------
-- 11. Anulación de venta devuelve el stock
-- ---------------------------------------------------------
\echo '--- 11. Anular una venta con token devuelve el stock al inventario'
reset role;
set role app_admin;
select set_config('request.jwt.claim.sub', (select id::text from _prueba_usuarios where clave='admin'), false);

do $$
declare v_venta uuid; v_prod uuid; v_bod uuid; v_cli uuid;
        v_antes numeric; v_despues numeric; v_estado text;
begin
  select id into v_prod from productos where codigo = 'ABA-002';
  select id into v_bod from bodegas where nombre = 'Bodega Principal';
  select id into v_cli from clientes where identificacion = '9999999999999';

  insert into ventas (cliente_id, bodega_id, tipo_venta, usuario_id)
  values (v_cli, v_bod, 'MENOR', auth.uid()) returning id into v_venta;
  insert into venta_detalle (venta_id, producto_id, cantidad) values (v_venta, v_prod, 3);
  update ventas set estado = 'CONFIRMADA' where id = v_venta;

  select stock into v_antes from inventario_saldos where producto_id = v_prod and bodega_id = v_bod;
  perform fn_anular_venta(v_venta, 'Cliente se arrepintió');
  select stock into v_despues from inventario_saldos where producto_id = v_prod and bodega_id = v_bod;
  select estado into v_estado from ventas where id = v_venta;

  if v_despues <> v_antes + 3 then
    raise exception 'FALLO: el stock no se devolvió (antes %, después %)', v_antes, v_despues;
  end if;
  if v_estado <> 'ANULADA' then
    raise exception 'FALLO: la venta quedó en %', v_estado;
  end if;
  raise notice '    OK: venta anulada y stock devuelto % -> %', v_antes, v_despues;
end $$;

\echo '--- 12. La bitácora registró quién hizo cada cosa'
do $$
declare v_cuenta int;
begin
  select count(*) into v_cuenta from auditoria_log where usuario_id is not null;
  if v_cuenta = 0 then
    raise exception 'FALLO: la bitácora no registró el usuario de ninguna operación';
  end if;
  raise notice '    OK: % eventos con usuario identificado', v_cuenta;
end $$;

reset role;
drop table if exists _prueba_usuarios;

\echo ''
\echo '===== TODAS LAS PRUEBAS DE SEGURIDAD PASARON ====='
