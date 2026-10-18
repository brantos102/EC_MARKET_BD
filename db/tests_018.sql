-- =========================================================
-- Pruebas de la migración 018: transformar un producto en otros
--
-- El caso es el pollo entero que sale en presas. Lo que se comprueba:
--   · que el kardex quede completo en las dos puntas (sale el pollo,
--     entran las presas) y que no haya forma de dejarlo a medias,
--   · que el costo se reparta por VALOR DE VENTA y no por peso —si se
--     repartiera por peso, la libra de hueso costaría lo mismo que la
--     de pechuga y el margen de todo el negocio saldría falso,
--   · que la suma de los costos repartidos sea exactamente el costo de
--     lo que entró: ni un centavo aparece ni desaparece,
--   · que la merma quede registrada,
--   · y que no se pueda transformar lo que no hay.
--
--   psql -f db/tests_018.sql
-- =========================================================
\set ON_ERROR_STOP on

do $$
declare
  v_ok       int := 0;
  v_bodega   uuid;
  v_pollo    uuid;
  v_pechuga  uuid;
  v_pierna   uuid;
  v_hueso    uuid;
  v_receta   uuid;
  v_tr       uuid;
  v_r        record;
  v_txt      text;
  v_n        numeric;
  v_und      uuid;
  v_lb       uuid;
begin
  select id into v_bodega from bodegas limit 1;
  select id into v_und from unidades_medida where codigo = 'UND';
  select id into v_lb  from unidades_medida where codigo = 'LB';

  -- La función comprueba el rol del usuario, y con razón: transformar
  -- mueve inventario y reparte costos. Aquí se monta un ADMIN de prueba
  -- para poder ejercitarla; sin esto la prueba no probaría el camino
  -- real, probaría el rechazo.
  -- El usuario se reutiliza si ya existe: borrarlo rompería las claves
  -- foráneas del kardex de una corrida anterior, y el kardex no se
  -- borra ni siquiera en pruebas.
  if not exists (select 1 from auth.users where email = 'transf@prueba.ec') then
    insert into auth.users (id, email) values (gen_random_uuid(), 'transf@prueba.ec');
  end if;

  insert into perfiles_usuario (usuario_id, nombre, rol)
  select id, 'Admin de transformaciones', 'ADMIN' from auth.users where email = 'transf@prueba.ec'
  on conflict (usuario_id) do update set rol = 'ADMIN', nombre = excluded.nombre;

  perform set_config('request.jwt.claim.sub',
                     (select id::text from auth.users where email = 'transf@prueba.ec'), true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  if fn_rol_actual() <> 'ADMIN' then
    raise exception 'Preparación: el usuario de prueba quedó como "%" y no como ADMIN',
      fn_rol_actual();
  end if;

  -- ---------------------------------------------------------
  -- Productos: el pollo entero (por unidad) y las presas (por libra)
  -- ---------------------------------------------------------
  insert into productos (codigo, nombre, unidad_medida, unidad_medida_id,
                         precio_venta_menor, codigo_impuesto, permite_fraccion)
  values ('PRU-TR-POLLO', 'Pollo entero', 'UND', v_und, 9.50, 'IVA_CERO', false)
  on conflict (codigo) do update set precio_venta_menor = excluded.precio_venta_menor
  returning id into v_pollo;

  insert into productos (codigo, nombre, unidad_medida, unidad_medida_id,
                         precio_venta_menor, codigo_impuesto, permite_fraccion)
  values ('PRU-TR-PECHUGA', 'Pechuga de pollo', 'LB', v_lb, 3.20, 'IVA_CERO', true)
  on conflict (codigo) do update set precio_venta_menor = excluded.precio_venta_menor
  returning id into v_pechuga;

  insert into productos (codigo, nombre, unidad_medida, unidad_medida_id,
                         precio_venta_menor, codigo_impuesto, permite_fraccion)
  values ('PRU-TR-PIERNA', 'Pierna y muslo', 'LB', v_lb, 2.10, 'IVA_CERO', true)
  on conflict (codigo) do update set precio_venta_menor = excluded.precio_venta_menor
  returning id into v_pierna;

  insert into productos (codigo, nombre, unidad_medida, unidad_medida_id,
                         precio_venta_menor, codigo_impuesto, permite_fraccion)
  values ('PRU-TR-HUESO', 'Hueso para caldo', 'LB', v_lb, 0.40, 'IVA_CERO', true)
  on conflict (codigo) do update set precio_venta_menor = excluded.precio_venta_menor
  returning id into v_hueso;

  -- 10 pollos a $6,00 de costo. El kardex es inmutable, así que para
  -- dejar la prueba en un punto conocido hay que soltar el candado un
  -- momento; en producción esto no se hace nunca.
  execute 'alter table movimientos_inventario disable trigger user';
  delete from movimientos_inventario where producto_id in (v_pollo, v_pechuga, v_pierna, v_hueso);
  execute 'alter table movimientos_inventario enable trigger user';
  delete from inventario_saldos where producto_id in (v_pollo, v_pechuga, v_pierna, v_hueso);

  insert into movimientos_inventario (producto_id, bodega_id, tipo, cantidad, costo_unitario)
  values (v_pollo, v_bodega, 'ENTRADA', 10, 6.00);

  select stock, costo_promedio into v_r
  from inventario_saldos where producto_id = v_pollo and bodega_id = v_bodega;
  if v_r.stock <> 10 or v_r.costo_promedio <> 6 then
    raise exception 'Preparación: el pollo debería quedar en 10 a $6, quedó % a %',
      v_r.stock, v_r.costo_promedio;
  end if;
  v_ok := v_ok + 1;

  -- ---------------------------------------------------------
  -- 2. La receta
  -- ---------------------------------------------------------
  delete from recetas where codigo = 'PRU-DESPIECE';
  insert into recetas (codigo, nombre, producto_origen_id, cantidad_origen, merma_esperada_pct)
  values ('PRU-DESPIECE', 'Despiece de pollo', v_pollo, 1, 8)
  returning id into v_receta;

  insert into receta_salida (receta_id, producto_id, cantidad) values
    (v_receta, v_pechuga, 1.5),
    (v_receta, v_pierna, 2.0),
    (v_receta, v_hueso, 1.1);
  v_ok := v_ok + 1;

  -- 3. Preparar escala la receta a lo que de verdad se va a procesar
  select count(*) into v_n from fn_preparar_transformacion(v_receta, v_bodega, 2);
  if v_n <> 4 then   -- 1 origen + 3 salidas
    raise exception 'FALLA 3: la preparación devolvió % filas, se esperaban 4', v_n;
  end if;

  select cantidad into v_n
  from fn_preparar_transformacion(v_receta, v_bodega, 2)
  where producto_id = v_pechuga;
  if v_n <> 3.0 then
    raise exception 'FALLA 3b: 2 pollos deberían dar 3 lb de pechuga, dio %', v_n;
  end if;
  v_ok := v_ok + 1;

  -- ---------------------------------------------------------
  -- 4. Ejecutar: 2 pollos ($12 de costo) -> 3 lb pechuga, 4 lb pierna,
  --    2 lb hueso. Entraron 2 unidades y salieron 9 lb.
  -- ---------------------------------------------------------
  select estado, transformacion_id, costo_total into v_r
  from fn_ejecutar_transformacion(
    v_bodega,
    jsonb_build_array(jsonb_build_object('producto_id', v_pollo, 'cantidad', 2)),
    jsonb_build_array(
      jsonb_build_object('producto_id', v_pechuga, 'cantidad', 3),
      jsonb_build_object('producto_id', v_pierna,  'cantidad', 4),
      jsonb_build_object('producto_id', v_hueso,   'cantidad', 2)),
    v_receta, 'Despiece de prueba');

  if v_r.estado <> 'OK' then
    raise exception 'FALLA 4: la transformación no se ejecutó (%)', v_r.estado;
  end if;
  v_tr := v_r.transformacion_id;

  if v_r.costo_total <> 12 then
    raise exception 'FALLA 4b: el costo de 2 pollos a $6 debería ser $12, es %', v_r.costo_total;
  end if;
  v_ok := v_ok + 1;

  -- 5. El pollo salió del stock
  select stock into v_n from inventario_saldos
   where producto_id = v_pollo and bodega_id = v_bodega;
  if v_n <> 8 then
    raise exception 'FALLA 5: deberían quedar 8 pollos, quedan %', v_n;
  end if;
  v_ok := v_ok + 1;

  -- 6. Las presas entraron al stock
  select stock into v_n from inventario_saldos
   where producto_id = v_pechuga and bodega_id = v_bodega;
  if v_n <> 3 then
    raise exception 'FALLA 6: deberían entrar 3 lb de pechuga, entraron %', v_n;
  end if;
  v_ok := v_ok + 1;

  -- ---------------------------------------------------------
  -- 7. EL REPARTO DEL COSTO. Valor de venta de lo producido:
  --      pechuga 3 x 3,20 =  9,60  (55,81 %)
  --      pierna  4 x 2,10 =  8,40  (48,84 %)  -- ojo, suman 17,20
  --      hueso   2 x 0,40 =  0,80
  --    total 18,80. La pechuga absorbe 9,60/18,80 = 51,06 % de $12.
  -- ---------------------------------------------------------
  select participacion_pct, costo_total, costo_unitario into v_r
  from transformacion_salida
  where transformacion_id = v_tr and producto_id = v_pechuga;

  if round(v_r.participacion_pct, 2) <> 51.06 then
    raise exception 'FALLA 7: la pechuga debería absorber 51,06 %% del costo, absorbe %',
      v_r.participacion_pct;
  end if;
  if round(v_r.costo_total, 2) <> 6.13 then
    raise exception 'FALLA 7b: a la pechuga le tocan $6,13 de los $12, le tocaron %',
      v_r.costo_total;
  end if;
  v_ok := v_ok + 1;

  -- 8. LO IMPORTANTE: el hueso NO cuesta lo mismo por libra que la
  --    pechuga. Repartir por peso es el error que haría parecer la
  --    pechuga mucho más rentable de lo que es.
  select costo_unitario into v_n
  from transformacion_salida where transformacion_id = v_tr and producto_id = v_hueso;

  select costo_unitario into v_r
  from transformacion_salida where transformacion_id = v_tr and producto_id = v_pechuga;

  if v_n >= v_r.costo_unitario then
    raise exception
      'FALLA 8: la libra de hueso (%) cuesta igual o más que la de pechuga (%). '
      'El costo se está repartiendo por peso y no por valor.', v_n, v_r.costo_unitario;
  end if;
  -- Si se repartiera por peso, las tres saldrían a 12/9 = 1,3333
  if round(v_n, 4) = 1.3333 then
    raise exception 'FALLA 8b: el costo se repartió por cantidad, no por valor de venta';
  end if;
  v_ok := v_ok + 1;

  -- 9. Ni un centavo aparece ni desaparece: los costos repartidos suman
  --    exactamente el costo de lo que entró.
  select sum(costo_total) into v_n from transformacion_salida where transformacion_id = v_tr;
  if abs(v_n - 12) > 0.01 then
    raise exception
      'FALLA 9: los costos repartidos suman % y el costo de origen era 12. '
      'El inventario ganaría o perdería valor de la nada.', v_n;
  end if;
  v_ok := v_ok + 1;

  -- 10. El kardex quedó completo en las dos puntas
  select count(*) into v_n from movimientos_inventario
   where referencia = (select numero from transformaciones where id = v_tr);
  if v_n <> 4 then   -- 1 salida + 3 entradas
    raise exception 'FALLA 10: el kardex tiene % movimientos, deberían ser 4', v_n;
  end if;
  v_ok := v_ok + 1;

  -- 11. Y cada movimiento dice de qué transformación viene: un costo
  --     raro se puede rastrear hasta el despiece que lo produjo.
  select count(*) into v_n from movimientos_inventario
   where referencia = (select numero from transformaciones where id = v_tr)
     and observacion like 'Transformación%';
  if v_n <> 4 then
    raise exception 'FALLA 11: % movimientos sin explicación de origen', 4 - v_n;
  end if;
  v_ok := v_ok + 1;

  -- 12. La merma: entraron 2 unidades y salieron 9 libras. No son la
  --     misma unidad, así que restar sería mentir: la merma queda nula.
  select merma_pct into v_n from transformaciones where id = v_tr;
  if v_n is not null then
    raise exception
      'FALLA 12: inventó una merma de %%% restando unidades a libras. '
      'Dos unidades menos nueve libras no es un número que signifique algo.', v_n;
  end if;
  v_ok := v_ok + 1;

  -- 13. Cuando SÍ es la misma unidad, la merma se calcula y se guarda.
  --     10 lb de pechuga que se limpian y quedan en 9,2 lb: 8 % de merma.
  insert into movimientos_inventario (producto_id, bodega_id, tipo, cantidad, costo_unitario)
  values (v_pechuga, v_bodega, 'ENTRADA', 10, 2.00);

  select estado, transformacion_id into v_r
  from fn_ejecutar_transformacion(
    v_bodega,
    jsonb_build_array(jsonb_build_object('producto_id', v_pechuga, 'cantidad', 10)),
    jsonb_build_array(jsonb_build_object('producto_id', v_pierna, 'cantidad', 9.2)),
    null, 'Limpieza');

  select merma_cantidad, merma_pct into v_r from transformaciones where id = v_r.transformacion_id;
  if round(v_r.merma_cantidad, 2) <> 0.80 then
    raise exception 'FALLA 13: la merma debería ser 0,8 lb y es %', v_r.merma_cantidad;
  end if;
  if round(v_r.merma_pct, 1) <> 8.0 then
    raise exception 'FALLA 13b: la merma debería ser 8 %% y es %', v_r.merma_pct;
  end if;
  v_ok := v_ok + 1;

  -- 14. No se puede transformar lo que no hay
  begin
    perform fn_ejecutar_transformacion(
      v_bodega,
      jsonb_build_array(jsonb_build_object('producto_id', v_pollo, 'cantidad', 999)),
      jsonb_build_array(jsonb_build_object('producto_id', v_pechuga, 'cantidad', 1)));
    raise exception 'FALLA 14: dejó transformar 999 pollos habiendo 8';
  exception
    when others then
      if sqlerrm like 'FALLA 14%' then raise; end if;
      if sqlerrm not like '%No hay suficiente%' then
        raise exception 'FALLA 14b: el mensaje no explica el problema: %', sqlerrm;
      end if;
      v_ok := v_ok + 1;
  end;

  -- 15. Un producto por unidad no puede salir en fracciones
  begin
    perform fn_ejecutar_transformacion(
      v_bodega,
      jsonb_build_array(jsonb_build_object('producto_id', v_pollo, 'cantidad', 1.5)),
      jsonb_build_array(jsonb_build_object('producto_id', v_pechuga, 'cantidad', 1)));
    raise exception 'FALLA 15: aceptó transformar 1,5 pollos';
  exception
    when others then
      if sqlerrm like 'FALLA 15%' then raise; end if;
      v_ok := v_ok + 1;
  end;

  -- 16. Sin salidas no hay transformación: sería una salida de stock
  --     disfrazada, y para eso está el ajuste manual.
  begin
    perform fn_ejecutar_transformacion(
      v_bodega,
      jsonb_build_array(jsonb_build_object('producto_id', v_pollo, 'cantidad', 1)),
      '[]'::jsonb);
    raise exception 'FALLA 16: dejó transformar sin producir nada';
  exception
    when others then
      if sqlerrm like 'FALLA 16%' then raise; end if;
      v_ok := v_ok + 1;
  end;

  -- 17. La vista cuenta la historia de un vistazo
  select entro, salio, rendimiento into v_r from v_transformaciones where id = v_tr;
  if v_r.entro not like '%Pollo entero%' or v_r.salio not like '%Pechuga%' then
    raise exception 'FALLA 17: la vista no dice qué entró y qué salió (% / %)',
      v_r.entro, v_r.salio;
  end if;
  v_ok := v_ok + 1;

  raise notice 'tests_018: % de 17 comprobaciones correctas', v_ok;
  if v_ok <> 17 then
    raise exception 'tests_018: faltaron comprobaciones (% de 17)', v_ok;
  end if;
end $$;

-- ---------------------------------------------------------
-- 18. La pantalla del historial tiene que ver la transformación.
--
-- La prueba 17 leyó la vista como superusuario, y eso no prueba nada:
-- el superusuario se salta el RLS. Si a `transformaciones` le faltara
-- la política de lectura, la pantalla de Historial saldría en blanco
-- para el cajero y aquí seguiría pasando.
--
-- Esta comprobación vive aquí y no en tests_013 porque tests_013 corre
-- sobre una base recién sembrada, donde todavía no se ha transformado
-- nada: una vista vacía por falta de datos no se distingue de una vacía
-- por falta de política. Aquí sí hay datos, así que la distinción es
-- real. Por eso v_transformaciones está en la lista de vistas que
-- tests_013 admite vacías: la cobertura no se pierde, se mueve.
--
-- El cambio de rol va dentro de una transacción a propósito: fuera de
-- ella PostgreSQL avisa y NO cambia el rol, y la prueba correría como
-- superusuario pasando siempre sin probar nada.
-- ---------------------------------------------------------
do $$
declare v_id uuid;
begin
  -- Se reutiliza si ya existe: borrarlo rompería las claves foráneas
  -- del kardex de una corrida anterior.
  if not exists (select 1 from auth.users where email = 'vistas-transf@prueba.ec') then
    insert into auth.users (id, email) values (gen_random_uuid(), 'vistas-transf@prueba.ec');
  end if;
  select id into v_id from auth.users where email = 'vistas-transf@prueba.ec';
  insert into perfiles_usuario (usuario_id, nombre, rol)
  values (v_id, 'Cajero de transformaciones', 'VENDEDOR')
  on conflict (usuario_id) do update set rol = 'VENDEDOR', nombre = excluded.nombre;
end $$;

begin;

set local role app_vistas;
select set_config('request.jwt.claim.sub',
                  (select usuario_id::text from perfiles_usuario
                    where nombre = 'Cajero de transformaciones'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_filas int;
  v_r     record;
begin
  select count(*) into v_filas from v_transformaciones;
  if v_filas = 0 then
    raise exception 'FALLA 18: el historial de transformaciones sale en blanco para un '
      'usuario normal. Falta política de lectura en transformaciones, '
      'transformacion_entrada o transformacion_salida.';
  end if;

  -- Y que lo que ve sea útil, no una fila con todo en blanco.
  select entro, salio, costo_total into v_r from v_transformaciones
   where observacion = 'Despiece de prueba' limit 1;
  if v_r.entro is null or v_r.salio is null or coalesce(v_r.costo_total, 0) = 0 then
    raise exception 'FALLA 18: el cajero ve la fila pero sin detalle (% / % / %). '
      'Las políticas de las tablas de detalle no lo dejan leer.',
      v_r.entro, v_r.salio, v_r.costo_total;
  end if;

  raise notice 'tests_018: comprobación 18 correcta (% filas visibles con RLS)', v_filas;
end $$;

rollback;

-- Limpieza
delete from transformacion_salida where transformacion_id in
  (select id from transformaciones where observacion in ('Despiece de prueba', 'Limpieza'));
delete from transformacion_entrada where transformacion_id in
  (select id from transformaciones where observacion in ('Despiece de prueba', 'Limpieza'));
delete from transformaciones where observacion in ('Despiece de prueba', 'Limpieza');
delete from receta_salida where receta_id in (select id from recetas where codigo = 'PRU-DESPIECE');
delete from recetas where codigo = 'PRU-DESPIECE';
-- El kardex es inmutable a propósito (es un libro de auditoría), así
-- que para limpiar lo que dejó la prueba hay que desactivar el candado
-- un momento. En producción nadie hace esto: por eso está el ajuste.
alter table movimientos_inventario disable trigger user;
delete from movimientos_inventario where producto_id in
  (select id from productos where codigo like 'PRU-TR-%');
alter table movimientos_inventario enable trigger user;
delete from inventario_saldos where producto_id in
  (select id from productos where codigo like 'PRU-TR-%');
delete from presentaciones where producto_id in
  (select id from productos where codigo like 'PRU-TR-%');
delete from productos where codigo like 'PRU-TR-%';
delete from perfiles_usuario where nombre = 'Admin de transformaciones';
-- El usuario de prueba se deja: el kardex lo referencia y borrarlo
-- dejaría movimientos sin responsable, que es justo lo que un libro de
-- auditoría no puede permitir.

select 'tests_018: OK' as resultado;
