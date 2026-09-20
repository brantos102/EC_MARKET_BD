-- =========================================================
-- Pruebas de la migración 012: estructuras, ubicaciones y servicios
--   psql -f db/tests_012.sql
-- =========================================================
\set ON_ERROR_STOP on

do $$
declare
  v_ok int := 0;
  v_msg text;
  v_id uuid;
  v_id2 uuid;
  v_usuario uuid;
  v_res jsonb;
  v_ubi uuid;
  v_prod uuid;
  v_codigo text;
  v_n int;
begin
  -- -------------------------------------------------------
  -- 1. La sede tiene código de nave
  -- -------------------------------------------------------
  if (select codigo_nave from sedes where es_matriz) is null then
    raise exception 'FALLA 1: la sede matriz no tiene código de nave';
  end if;
  if (select codigo_nave from sedes where es_matriz) !~ '^[A-Z]{2,4}$' then
    raise exception 'FALLA 1b: el código de nave no tiene el formato esperado';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 2. Todas las ubicaciones usan el formato estándar
  --    NAVE-LITERAL-COLUMNA-NIVEL
  -- -------------------------------------------------------
  select count(*) into v_n
  from ubicaciones
  where codigo !~ '^[A-Z]{2,4}-[A-Z]{1,3}[0-9]{0,2}-[0-9]{2}-[0-9]$';
  if v_n > 0 then
    raise exception 'FALLA 2: % ubicaciones no siguen el formato (ej: %)',
      v_n, (select codigo from ubicaciones
            where codigo !~ '^[A-Z]{2,4}-[A-Z]{1,3}[0-9]{0,2}-[0-9]{2}-[0-9]$' limit 1);
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 3. La columna va a dos dígitos, para que ordene bien
  --    (ECM-A-02-1 tiene que ir antes que ECM-A-10-1)
  -- -------------------------------------------------------
  if fn_codigo_ubicacion('ECM', 'A', 2, 1) <> 'ECM-A-02-1' then
    raise exception 'FALLA 3: la columna no se rellena a dos dígitos';
  end if;
  if fn_codigo_ubicacion('ECM', 'FR1', 1, 1) <> 'ECM-FR1-01-1' then
    raise exception 'FALLA 3b: el frigorífico no arma bien su código';
  end if;
  if not ('ECM-A-02-1' < 'ECM-A-10-1') then
    raise exception 'FALLA 3c: el orden alfabético no coincide con el numérico';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 4. Ninguna ubicación quedó huérfana y ningún producto perdió
  --    su posición durante la migración
  -- -------------------------------------------------------
  if exists (select 1 from ubicaciones where estructura_id is null) then
    raise exception 'FALLA 4: quedaron ubicaciones sin estructura';
  end if;
  if exists (
    select 1 from producto_ubicacion pu
    left join ubicaciones u on u.id = pu.ubicacion_id
    where u.id is null
  ) then
    raise exception 'FALLA 4b: hay productos apuntando a una ubicación que ya no existe';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 5. Existen los muebles que el local real tiene
  -- -------------------------------------------------------
  if not exists (select 1 from estructuras where literal = 'FR1' and tipo = 'FRIGORIFICO') then
    raise exception 'FALLA 5: no se creó el frigorífico FR1';
  end if;
  if not exists (select 1 from estructuras where tipo = 'NEVERA') then
    raise exception 'FALLA 5b: no se creó el congelador';
  end if;
  if not exists (select 1 from estructuras where tipo = 'MOSTRADOR') then
    raise exception 'FALLA 5c: no se creó el mostrador';
  end if;
  if not exists (select 1 from ubicaciones where codigo = 'ECM-FR1-01-1') then
    raise exception 'FALLA 5d: falta la posición ECM-FR1-01-1 que pidió el negocio';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 6. La ocupación nunca pasa del 100 %
  --    (el bug del abanico del join daba 275 %)
  -- -------------------------------------------------------
  if exists (select 1 from v_estructuras_ocupacion where ocupacion_pct > 100) then
    raise exception 'FALLA 6: hay estructuras con más de 100 %% de ocupación';
  end if;
  if exists (select 1 from v_estructuras_ocupacion where posiciones <> columnas * niveles) then
    raise exception 'FALLA 6b: las posiciones no cuadran con columnas x niveles';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 7. Crear una estructura asigna literal solo y genera posiciones
  -- -------------------------------------------------------
  insert into auth.users (id, email) values (gen_random_uuid(), 'bodeguero012@test.local')
  on conflict do nothing;
  select id into v_usuario from auth.users where email = 'bodeguero012@test.local';
  insert into perfiles_usuario (usuario_id, nombre, rol)
  values (v_usuario, 'Bodeguero de prueba', 'ADMIN')
  on conflict (usuario_id) do update set rol = 'ADMIN';
  perform set_config('request.jwt.claim.sub', v_usuario::text, true);

  v_id := fn_crear_estructura('FRIGORIFICO', 'Frigorífico nuevo de prueba');
  if (select literal from estructuras where id = v_id) <> 'FR3' then
    raise exception 'FALLA 7: el literal automático debió ser FR3, fue %',
      (select literal from estructuras where id = v_id);
  end if;
  if (select count(*) from ubicaciones where estructura_id = v_id) = 0 then
    raise exception 'FALLA 7b: no se generaron las posiciones';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 8. Una estantería toma la siguiente letra libre
  -- -------------------------------------------------------
  v_id2 := fn_crear_estructura('ESTANTERIA', 'Percha nueva de prueba');
  if (select literal from estructuras where id = v_id2) !~ '^[A-Z]$' then
    raise exception 'FALLA 8: la estantería no tomó una letra';
  end if;
  if (select literal from estructuras where id = v_id2) in
     (select literal from estructuras where id <> v_id2) then
    raise exception 'FALLA 8b: el literal se repitió';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 9. Crecer: más columnas y más niveles crean las posiciones nuevas
  -- -------------------------------------------------------
  v_n := (select count(*) from ubicaciones where estructura_id = v_id2);
  v_res := fn_redimensionar_estructura(v_id2, 8, 6);
  if (select count(*) from ubicaciones where estructura_id = v_id2) <> 48 then
    raise exception 'FALLA 9: al crecer a 8x6 debería haber 48 posiciones, hay %',
      (select count(*) from ubicaciones where estructura_id = v_id2);
  end if;
  if (v_res ->> 'posiciones_creadas')::int <> 48 - v_n then
    raise exception 'FALLA 9b: el conteo de posiciones creadas no cuadra';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 10. Encoger una estructura vacía sí se permite
  -- -------------------------------------------------------
  v_res := fn_redimensionar_estructura(v_id2, 2, 2);
  if (select count(*) from ubicaciones where estructura_id = v_id2) <> 4 then
    raise exception 'FALLA 10: al encoger a 2x2 deberían quedar 4 posiciones';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 11. Encoger sobre posiciones OCUPADAS se rechaza, y el mensaje
  --     dice cuáles son. Perder en silencio la ubicación de un
  --     producto es el peor error posible aquí.
  -- -------------------------------------------------------
  perform fn_redimensionar_estructura(v_id2, 4, 4);
  select id into v_ubi from ubicaciones
  where estructura_id = v_id2 and columna = 4 and nivel = 4;
  -- Un producto puede estar en varias posiciones pero solo una es la
  -- principal, así que esta segunda ubicación se marca como secundaria.
  select id into v_prod from productos limit 1;
  insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
  values (v_prod, v_ubi, false)
  on conflict (producto_id, ubicacion_id) do nothing;

  begin
    perform fn_redimensionar_estructura(v_id2, 2, 2);
    raise exception 'FALLA 11: dejó borrar una posición con producto';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA 11%' then raise; end if;
    if v_msg not like '%todavía tienen producto%' then
      raise exception 'FALLA 11b: el rechazo no explica el motivo: %', v_msg;
    end if;
    if v_msg not like '%-04-4%' then
      raise exception 'FALLA 11c: el mensaje no dice qué posición está ocupada: %', v_msg;
    end if;
  end;

  if (select count(*) from ubicaciones where estructura_id = v_id2) <> 16 then
    raise exception 'FALLA 11d: la estructura se modificó pese al rechazo';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 12. Un literal repetido se rechaza
  -- -------------------------------------------------------
  begin
    perform fn_crear_estructura('ESTANTERIA', 'Repetida', 'A');
    raise exception 'FALLA 12: aceptó un literal ya usado';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA 12%' then raise; end if;
  end;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 13. Servicios: la comisión la calcula la base
  -- -------------------------------------------------------
  v_res := fn_registrar_servicio('REC_CLARO', 10.00, '0999123456');
  if not (v_res ->> 'ok')::boolean then
    raise exception 'FALLA 13: no se registró la recarga';
  end if;
  -- 5 % de 10 = 0,50
  if (v_res ->> 'comision')::numeric <> 0.50 then
    raise exception 'FALLA 13b: la comisión debió ser 0.50 y fue %', v_res ->> 'comision';
  end if;
  if (v_res ->> 'numero') !~ '^SRV-' then
    raise exception 'FALLA 13c: el número de servicio no lleva su prefijo';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 14. Los límites y la referencia del servicio se respetan
  -- -------------------------------------------------------
  begin
    perform fn_registrar_servicio('REC_CLARO', 500.00, '0999123456');
    raise exception 'FALLA 14: aceptó un monto sobre el máximo';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA 14%' then raise; end if;
  end;

  begin
    perform fn_registrar_servicio('REC_CLARO', 5.00, null);
    raise exception 'FALLA 14b: aceptó una recarga sin número de celular';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA 14b%' then raise; end if;
  end;

  begin
    perform fn_registrar_servicio('NO_EXISTE', 5.00, '0999123456');
    raise exception 'FALLA 14c: aceptó un servicio inexistente';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA 14c%' then raise; end if;
  end;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 15. Una comisión fija no se calcula como porcentaje
  -- -------------------------------------------------------
  v_res := fn_registrar_servicio('PAGO_LUZ', 40.00, '12345678');
  if (v_res ->> 'comision')::numeric <> 0.25 then
    raise exception 'FALLA 15: la comisión fija debió ser 0.25 y fue %', v_res ->> 'comision';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 16. El resumen mensual suma mercadería y servicios por separado
  -- -------------------------------------------------------
  if not exists (select 1 from v_resumen_mensual where origen = 'SERVICIOS') then
    raise exception 'FALLA 16: los servicios no aparecen en el resumen mensual';
  end if;
  -- La mercadería se comprueba por consistencia y no por presencia: una
  -- base recién sembrada todavía no tiene ventas confirmadas, y exigir
  -- que las haya haría fallar la prueba por un motivo que no es el suyo.
  if (select count(*) from v_resumen_mensual where origen = 'MERCADERIA')
     <> (select count(*) from (
           select distinct date_trunc('month', fecha), sede_id
           from ventas where estado = 'CONFIRMADA') x) then
    raise exception 'FALLA 16b: el resumen no cuadra con las ventas confirmadas';
  end if;
  if (select sum(comision) from v_resumen_mensual where origen = 'SERVICIOS') <= 0 then
    raise exception 'FALLA 16c: la comisión no se está acumulando';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 17. Anular un servicio exige motivo y lo deja registrado
  -- -------------------------------------------------------
  begin
    perform fn_anular_servicio(
      (select id from ventas_servicio order by created_at desc limit 1), '');
    raise exception 'FALLA 17: dejó anular sin motivo';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA 17%' then raise; end if;
  end;

  perform fn_anular_servicio(
    (select id from ventas_servicio order by created_at desc limit 1), 'Prueba automatizada');

  if not exists (select 1 from ventas_servicio
                 where estado = 'ANULADA' and observacion like '%Prueba automatizada%') then
    raise exception 'FALLA 17b: la anulación no quedó registrada con su motivo';
  end if;
  -- Y una anulada ya no cuenta en el resumen
  if exists (
    select 1 from ventas_servicio vs
    where vs.estado = 'ANULADA'
      and vs.monto > 0
      and (select sum(monto) from v_resumen_mensual where origen = 'SERVICIOS')
          >= (select sum(monto) from ventas_servicio)
  ) then
    raise exception 'FALLA 17c: el resumen está contando servicios anulados';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 18. El acceso externo a POSVirtual quedó registrado
  -- -------------------------------------------------------
  if not exists (select 1 from accesos_externos where codigo = 'POSVIRTUAL' and activo) then
    raise exception 'FALLA 18: falta el acceso a POSVirtual';
  end if;
  if (select url from accesos_externos where codigo = 'POSVIRTUAL') not like 'https://%' then
    raise exception 'FALLA 18b: el acceso externo debe ser por https';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 19. El módulo de servicios está en el menú, con permisos
  -- -------------------------------------------------------
  if not exists (select 1 from modulos_sistema where codigo = 'servicios' and activo) then
    raise exception 'FALLA 19: falta el módulo de servicios en el menú';
  end if;
  if not (select puede_ver from permisos_rol where rol = 'VENDEDOR' and modulo = 'servicios') then
    raise exception 'FALLA 19b: el cajero debería poder ver las recargas';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 20. v_posiciones muestra cada posición con su producto
  -- -------------------------------------------------------
  if (select count(*) from v_posiciones) < (select count(*) from ubicaciones) then
    raise exception 'FALLA 20: v_posiciones no cubre todas las ubicaciones';
  end if;
  if not exists (select 1 from v_posiciones where producto_id is not null) then
    raise exception 'FALLA 20b: v_posiciones no está trayendo los productos';
  end if;
  v_ok := v_ok + 1;

  raise notice '--------------------------------------------';
  raise notice 'Pruebas de la migración 012: % de 20 correctas', v_ok;
  raise notice '--------------------------------------------';

  if v_ok <> 20 then
    raise exception 'No pasaron todas las pruebas';
  end if;
end $$;

select 'tests_012: OK' as resultado;
