-- =========================================================
-- Pruebas de la migración 011: instalación y De Una
--
-- Se corren sobre una base recién migrada. Si el script termina
-- imprimiendo el resumen, todo pasó.
--   psql -f db/tests_011.sql
-- =========================================================
\set ON_ERROR_STOP on

do $$
declare
  v_ok int := 0;
  v_msg text;
  v_res jsonb;
  v_usuario uuid;
  v_tipo text;
begin
  -- -------------------------------------------------------
  -- 1. El catálogo de tipos de negocio está completo
  -- -------------------------------------------------------
  if (select count(*) from tipos_negocio where activo) < 5 then
    raise exception 'FALLA 1: faltan tipos de negocio en el catálogo';
  end if;
  if not exists (select 1 from tipos_negocio where codigo = 'FERRETERIA') then
    raise exception 'FALLA 1b: no está la ferretería';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 2. Todas las unidades que los tipos declaran existen
  --    (si no, instalar una ferretería dejaría productos sin medida)
  -- -------------------------------------------------------
  if exists (
    select 1 from tipos_negocio t, unnest(t.unidades) u
    where u not in (select codigo from unidades_medida)
  ) then
    raise exception 'FALLA 2: hay tipos que piden unidades inexistentes: %',
      (select string_agg(distinct u, ', ')
       from tipos_negocio t, unnest(t.unidades) u
       where u not in (select codigo from unidades_medida));
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 3. Una base con productos ya cargados se marca instalada
  --    (la 006 sembró el catálogo, así que aquí debe estar en true)
  -- -------------------------------------------------------
  if not (select completada from instalacion) then
    raise exception 'FALLA 3: una base con datos debería quedar marcada como instalada';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 4. El tipo de negocio no se puede cambiar tras instalar
  -- -------------------------------------------------------
  select tipo_negocio into v_tipo from empresa limit 1;
  begin
    update empresa set tipo_negocio = 'FERRETERIA' where id = true;
    raise exception 'FALLA 4: se permitió cambiar el tipo de negocio ya instalado';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA 4%' then raise; end if;
    if v_msg not like '%no se puede cambiar%' then
      raise exception 'FALLA 4b: el rechazo no explica el motivo: %', v_msg;
    end if;
  end;
  if (select tipo_negocio from empresa limit 1) <> v_tipo then
    raise exception 'FALLA 4c: el tipo cambió pese al bloqueo';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 5. Tampoco se puede desde la tabla instalacion
  -- -------------------------------------------------------
  begin
    update instalacion set tipo_negocio = 'FARMACIA' where id = true;
    raise exception 'FALLA 5: se permitió cambiar el tipo desde instalacion';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA 5%' then raise; end if;
  end;

  begin
    update instalacion set completada = false where id = true;
    raise exception 'FALLA 5b: se permitió revertir la instalación';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA 5b%' then raise; end if;
  end;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 6. Instalar dos veces se rechaza con un mensaje claro
  -- -------------------------------------------------------
  insert into auth.users (id, email) values (gen_random_uuid(), 'instalador@test.local')
  on conflict do nothing;
  select id into v_usuario from auth.users where email = 'instalador@test.local';
  perform set_config('request.jwt.claim.sub', v_usuario::text, true);

  begin
    perform fn_completar_instalacion('FERRETERIA', 'OTRA EMPRESA S.A.');
    raise exception 'FALLA 6: dejó instalar sobre una base ya instalada';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA 6%' then raise; end if;
    if v_msg not like '%ya fue instalado%' then
      raise exception 'FALLA 6b: el mensaje no explica que ya está instalado: %', v_msg;
    end if;
  end;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 7. fn_estado_instalacion responde sin sesión
  -- -------------------------------------------------------
  perform set_config('request.jwt.claim.sub', '', true);
  if not (select completada from fn_estado_instalacion()) then
    raise exception 'FALLA 7: fn_estado_instalacion no reporta la instalación';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 8. De Una arranca en modo QR estático y sin QR cargado
  -- -------------------------------------------------------
  if (select deuna_modo from empresa limit 1) <> 'QR_ESTATICO' then
    raise exception 'FALLA 8: el modo por defecto de De Una debería ser QR_ESTATICO';
  end if;
  if (select instrucciones from fn_config_deuna()) is null then
    raise exception 'FALLA 8b: faltan las instrucciones para el cliente';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 9. Un modo de De Una inventado se rechaza
  -- -------------------------------------------------------
  begin
    update empresa set deuna_modo = 'MAGIA' where id = true;
    raise exception 'FALLA 9: aceptó un modo de De Una inexistente';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA 9%' then raise; end if;
  end;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 10. Un cobro De Una se registra SIN código de transacción
  --     (es el caso real: el cliente escanea y transfiere)
  -- -------------------------------------------------------
  declare
    v_venta uuid;
  begin
    select id into v_venta from ventas where estado = 'CONFIRMADA' limit 1;
    if v_venta is not null then
      insert into pagos_venta (venta_id, forma_pago, monto, codigo_transaccion)
      values (v_venta, 'TRANSFERENCIA_DEUNA', 1.00, null);
      -- se limpia para no ensuciar los totales de otras pruebas
      delete from pagos_venta
      where venta_id = v_venta and forma_pago = 'TRANSFERENCIA_DEUNA' and monto = 1.00;
    end if;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    raise exception 'FALLA 10: un pago De Una sin código fue rechazado (%)', v_msg;
  end;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 11. La tabla de transacciones De Una está lista para el modo API
  -- -------------------------------------------------------
  if to_regclass('deuna_transacciones') is null then
    raise exception 'FALLA 11: falta deuna_transacciones';
  end if;
  begin
    insert into deuna_transacciones (referencia_interna, monto, estado)
    values ('PRUEBA-011', 10.50, 'INVENTADO');
    raise exception 'FALLA 11b: aceptó un estado de transacción inexistente';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA 11b%' then raise; end if;
  end;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 12. La clave del API no tiene dónde guardarse en la base
  --     (tiene que vivir como secreto de la función de borde)
  -- -------------------------------------------------------
  if exists (
    select 1 from information_schema.columns
    where table_name = 'empresa'
      and (column_name ilike '%api_key%' or column_name ilike '%secret%'
           or column_name ilike '%token%')
  ) then
    raise exception 'FALLA 12: hay una columna donde alguien guardaría la clave del API';
  end if;
  v_ok := v_ok + 1;

  raise notice '--------------------------------------------';
  raise notice 'Pruebas de la migración 011: % de 12 correctas', v_ok;
  raise notice '--------------------------------------------';

  if v_ok <> 12 then
    raise exception 'No pasaron todas las pruebas';
  end if;
end $$;

-- =========================================================
-- Instalación desde cero, en una base virgen
--
-- Se prueba aparte porque necesita una transacción que se revierte: no
-- se puede dejar la base de pruebas con los catálogos de una ferretería.
-- =========================================================
begin;

do $$
declare
  v_usuario uuid;
  v_res jsonb;
  v_msg text;
begin
  -- Se simula una base virgen: sin productos y sin instalar.
  -- Los documentos confirmados son inmutables por diseño, así que se
  -- suspenden sus triggers: aquí no se está alterando contabilidad, se
  -- está vaciando una base de pruebas dentro de una transacción que
  -- termina en ROLLBACK.
  alter table ingreso_detalle    disable trigger user;
  alter table documentos_ingreso disable trigger user;
  alter table venta_detalle      disable trigger user;
  alter table ventas             disable trigger user;
  alter table movimientos_inventario disable trigger user;
  -- El candado de la instalación también hay que suspenderlo: que haga
  -- falta hacerlo a mano es justamente la prueba de que funciona.
  alter table instalacion disable trigger user;
  alter table empresa     disable trigger user;

  delete from producto_ubicacion;
  delete from venta_detalle;
  delete from pagos_venta;
  delete from ventas;
  delete from ingreso_detalle;
  delete from documentos_ingreso;
  delete from movimientos_inventario;
  delete from inventario_saldos;
  delete from lotes;
  delete from productos;
  alter table ingreso_detalle    enable trigger user;
  alter table documentos_ingreso enable trigger user;
  alter table venta_detalle      enable trigger user;
  alter table ventas             enable trigger user;
  alter table movimientos_inventario enable trigger user;

  update instalacion set completada = false, tipo_negocio = null, instalada_at = null
  where id = true;

  alter table instalacion enable trigger user;
  alter table empresa     enable trigger user;

  insert into auth.users (id, email) values (gen_random_uuid(), 'nuevo@test.local')
  on conflict do nothing;
  select id into v_usuario from auth.users where email = 'nuevo@test.local';

  -- Sin sesión no se instala
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform fn_completar_instalacion('FERRETERIA', 'FERRETERIA EL PERNO');
    raise exception 'FALLA A: dejó instalar sin sesión iniciada';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA A%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', v_usuario::text, true);
  insert into perfiles_usuario (usuario_id, nombre, rol)
  values (v_usuario, 'Instalador', 'ADMIN')
  on conflict (usuario_id) do update set rol = 'ADMIN';

  -- Un tipo inexistente se rechaza
  begin
    perform fn_completar_instalacion('PANADERIA_ESPACIAL', 'X');
    raise exception 'FALLA B: aceptó un tipo de negocio inexistente';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA B%' then raise; end if;
  end;

  -- Un RUC inválido se rechaza
  begin
    perform fn_completar_instalacion('FERRETERIA', 'FERRETERIA EL PERNO', '1234567890123');
    raise exception 'FALLA C: aceptó un RUC inválido';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA C%' then raise; end if;
  end;

  -- Instalación buena
  v_res := fn_completar_instalacion(
    'FERRETERIA', 'FERRETERIA EL PERNO', '1728605070001',
    'El Perno', 'Av. Maldonado S12-45', '022345678', 'ventas@elperno.ec', 'Local Sur');

  if not (v_res ->> 'ok')::boolean then
    raise exception 'FALLA D: la instalación no reportó éxito';
  end if;
  if (v_res ->> 'tipo_negocio') <> 'FERRETERIA' then
    raise exception 'FALLA E: quedó instalado otro tipo';
  end if;
  if (v_res ->> 'categorias_creadas')::int < 5 then
    raise exception 'FALLA F: no se cargaron las categorías de la ferretería';
  end if;

  -- Las unidades del minimarket deben quedar desactivadas
  if (select activo from unidades_medida where codigo = 'ARROBA') then
    raise exception 'FALLA G: la arroba sigue activa en una ferretería';
  end if;
  if not (select activo from unidades_medida where codigo = 'METRO') then
    raise exception 'FALLA H: el metro debería estar activo en una ferretería';
  end if;

  -- Categorías y zonas propias del tipo
  if not exists (select 1 from categorias where nombre = 'Tornillería y fijación') then
    raise exception 'FALLA I: falta una categoría de ferretería';
  end if;
  if not exists (select 1 from zonas where codigo = 'PIN') then
    raise exception 'FALLA J: falta la zona de pinturas';
  end if;

  -- Los datos de la empresa quedaron escritos
  if (select razon_social from empresa limit 1) <> 'FERRETERIA EL PERNO' then
    raise exception 'FALLA K: no se guardó la razón social';
  end if;
  if (select nombre from sedes where es_matriz limit 1) <> 'Local Sur' then
    raise exception 'FALLA L: no se guardó el nombre de la sede';
  end if;

  -- Y ahora ya no se puede volver a instalar
  begin
    perform fn_completar_instalacion('MARKET', 'OTRA COSA');
    raise exception 'FALLA M: dejó reinstalar';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA M%' then raise; end if;
  end;

  raise notice 'Instalación desde cero: 13 de 13 correctas (A-M)';
end $$;

rollback;

select 'tests_011: OK' as resultado;
