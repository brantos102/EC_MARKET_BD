-- =========================================================
-- Pruebas de la migración 015: presentaciones y códigos
--
-- Lo que se comprueba es lo que decide si el inventario es real:
--   · que recibir 6 cajas de 24 deje 144 unidades y no 6,
--   · que el costo del bulto se reparta entre las unidades,
--   · que la diferencia entre lo facturado y lo recibido quede escrita
--     y que al stock entre lo FÍSICO,
--   · que un código nuevo no pise al viejo ni robe el de otro producto,
--   · que un EAN-13 con el dígito verificador mal se rechace,
--   · y que la lectura por presentación cuadre con el saldo único.
--
--   psql -f db/tests_015.sql
-- =========================================================
\set ON_ERROR_STOP on

do $$
declare
  v_ok        int := 0;
  v_prod      uuid;
  v_prod2     uuid;
  v_bodega    uuid;
  v_prov      uuid;
  v_caja      uuid;
  v_doc       uuid;
  v_det       uuid;
  v_r         record;
  v_n         numeric;
  v_txt       text;
  v_cat       uuid;
begin
  -- ---------------------------------------------------------
  -- Preparación
  -- ---------------------------------------------------------
  select id into v_bodega from bodegas limit 1;
  select id into v_prov   from proveedores limit 1;
  select id into v_cat    from categorias limit 1;

  insert into productos (codigo, nombre, unidad_medida, unidad_medida_id, categoria_id,
                         precio_venta_menor, precio_venta_mayor, codigo_impuesto, permite_fraccion)
  values ('PRU-PRES-1', 'Gaseosa de prueba 350 ml', 'UND',
          (select id from unidades_medida where codigo = 'UND'), v_cat,
          0.50, 0.40, 'IVA_GENERAL', false)
  on conflict (codigo) do update set nombre = excluded.nombre
  returning id into v_prod;

  insert into productos (codigo, nombre, unidad_medida, unidad_medida_id,
                         precio_venta_menor, precio_venta_mayor, codigo_impuesto, permite_fraccion)
  values ('PRU-PRES-2', 'Otro producto de prueba', 'UND',
          (select id from unidades_medida where codigo = 'UND'),
          1.00, 0.90, 'IVA_CERO', false)
  on conflict (codigo) do update set nombre = excluded.nombre
  returning id into v_prod2;

  -- 1. La migración le dio presentación base a todo producto
  if not exists (select 1 from presentaciones where producto_id = v_prod and es_base) then
    -- El producto se creó después de la migración: se crea su base,
    -- que es lo que hará la pantalla de productos.
    insert into presentaciones (producto_id, nombre, tipo, factor, es_base)
    values (v_prod, 'Unidad', 'UNIDAD', 1, true);
  end if;
  v_ok := v_ok + 1;

  -- 2. La base no puede tener un factor distinto de 1
  begin
    insert into presentaciones (producto_id, nombre, tipo, factor, es_base)
    values (v_prod, 'Base mala', 'CAJA', 24, true);
    raise exception 'FALLA 2: aceptó una presentación base con factor 24';
  exception
    when others then
      if sqlerrm like 'FALLA 2%' then raise; end if;
      v_ok := v_ok + 1;
  end;

  -- 3. Se crea la caja de 24
  insert into presentaciones (producto_id, nombre, tipo, factor, para_compra, para_venta, precio_venta)
  values (v_prod, 'Caja x 24', 'CAJA', 24, true, true, 9.00)
  on conflict (producto_id, nombre) do update set factor = excluded.factor
  returning id into v_caja;
  v_ok := v_ok + 1;

  -- ---------------------------------------------------------
  -- Códigos de barras
  -- ---------------------------------------------------------
  -- 4. Un EAN-13 con dígito verificador mal se rechaza
  begin
    insert into producto_codigos (producto_id, codigo, tipo)
    values (v_prod, '7799000999004', 'EAN13');   -- el válido termina en 3
    raise exception 'FALLA 4: aceptó un EAN-13 con dígito verificador incorrecto';
  exception
    when others then
      if sqlerrm like 'FALLA 4%' then raise; end if;
      v_ok := v_ok + 1;
  end;

  -- 5. Un EAN-13 de 12 dígitos se rechaza con un mensaje entendible
  begin
    insert into producto_codigos (producto_id, codigo, tipo)
    values (v_prod, '779900099900', 'EAN13');
    raise exception 'FALLA 5: aceptó un código de 12 dígitos como EAN-13';
  exception
    when others then
      if sqlerrm like 'FALLA 5%' then raise; end if;
      if sqlerrm not like '%13 dígitos%' then
        raise exception 'FALLA 5b: el mensaje no explica el problema: %', sqlerrm;
      end if;
      v_ok := v_ok + 1;
  end;

  -- 6. El código de la unidad
  select estado into v_txt
  from fn_registrar_codigo_producto(v_prod, '7799000999003', 'EAN13');
  if v_txt <> 'AGREGADO' then
    raise exception 'FALLA 6: no registró el código de la unidad (%)', v_txt;
  end if;
  v_ok := v_ok + 1;

  -- 7. El código de la CAJA es otro código, y vale 24 unidades
  select estado into v_txt
  from fn_registrar_codigo_producto(v_prod, '7799000999010', 'EAN13', v_caja);
  if v_txt <> 'AGREGADO' then
    raise exception 'FALLA 7: no registró el código de la caja (%)', v_txt;
  end if;

  select unidades, presentacion into v_n, v_txt
  from fn_buscar_por_codigo('7799000999010');
  if v_n <> 24 then
    raise exception 'FALLA 7b: leer el código de la caja debería dar 24 unidades, dio %', v_n;
  end if;
  v_ok := v_ok + 1;

  -- 8. El código de la unidad sigue valiendo 1
  select unidades into v_n from fn_buscar_por_codigo('7799000999003');
  if v_n <> 1 then
    raise exception 'FALLA 8: el código de la unidad debería valer 1, dio %', v_n;
  end if;
  v_ok := v_ok + 1;

  -- 9. EL CASO DE BRYAN: el proveedor cambia el código.
  --    El nuevo se agrega y el VIEJO SIGUE FUNCIONANDO. Si el viejo
  --    dejara de vender, la mercadería que ya está en percha se
  --    quedaría trabada en la caja.
  select estado into v_txt
  from fn_registrar_codigo_producto(v_prod, '7799000999027', 'EAN13', null,
                                    'El proveedor cambió el código en septiembre');
  if v_txt <> 'AGREGADO' then
    raise exception 'FALLA 9: no aceptó el código nuevo (%)', v_txt;
  end if;
  if (select producto_id from fn_buscar_por_codigo('7799000999003')) is null then
    raise exception 'FALLA 9b: el código viejo dejó de vender al llegar el nuevo';
  end if;
  if (select producto_id from fn_buscar_por_codigo('7799000999027')) <> v_prod then
    raise exception 'FALLA 9c: el código nuevo no resuelve al producto';
  end if;
  v_ok := v_ok + 1;

  -- 10. Un código que ya es de otro producto NO se roba
  select estado into v_txt
  from fn_registrar_codigo_producto(v_prod2, '7799000999003', 'EAN13');
  if v_txt <> 'CONFLICTO' then
    raise exception
      'FALLA 10: dejó asignar a otro producto un código que ya estaba en uso (%). '
      'Eso haría que la caja cobre un producto y descuente otro.', v_txt;
  end if;
  v_ok := v_ok + 1;

  -- 11. Repetir el mismo código en el mismo producto no duplica
  select estado into v_txt
  from fn_registrar_codigo_producto(v_prod, '7799000999003', 'EAN13');
  if v_txt <> 'YA_EXISTE' then
    raise exception 'FALLA 11: debería avisar que ya lo tenía (%)', v_txt;
  end if;
  v_ok := v_ok + 1;

  -- ---------------------------------------------------------
  -- Recepción por bultos
  -- ---------------------------------------------------------
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento,
                                  numero_documento, fecha_emision)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000099001', current_date)
  on conflict (proveedor_id, tipo_documento, numero_documento) do update
    set fecha_emision = excluded.fecha_emision
  returning id into v_doc;

  delete from ingreso_detalle where documento_ingreso_id = v_doc;

  -- 12. 6 cajas de 24 son 144 unidades, no 6
  select estado, detalle_id into v_txt, v_det
  from fn_agregar_linea_ingreso(v_doc, v_prod, 6, 9.00, v_caja);
  if v_txt <> 'OK' then
    raise exception 'FALLA 12: no aceptó la línea por bultos (%)', v_txt;
  end if;

  select cantidad, costo_unitario, bultos into v_r
  from ingreso_detalle where id = v_det;
  if v_r.cantidad <> 144 then
    raise exception 'FALLA 12b: 6 cajas x 24 deberían ser 144 unidades, guardó %', v_r.cantidad;
  end if;
  v_ok := v_ok + 1;

  -- 13. El costo del bulto se reparte: $9,00 / 24 = $0,375 por unidad
  if round(v_r.costo_unitario, 4) <> 0.3750 then
    raise exception 'FALLA 13: el costo unitario debería ser 0,375 y es %', v_r.costo_unitario;
  end if;
  v_ok := v_ok + 1;

  -- 14. FALTANTE: la factura dice 6 cajas, llegaron 5.
  --     Al stock tiene que entrar lo FÍSICO.
  delete from ingreso_detalle where documento_ingreso_id = v_doc;
  select estado, detalle_id into v_txt, v_det
  from fn_agregar_linea_ingreso(v_doc, v_prod, 5, 9.00, v_caja, 6);
  if v_txt <> 'DIFERENCIA' then
    raise exception 'FALLA 14: no avisó de la diferencia entre factura y físico (%)', v_txt;
  end if;

  select cantidad, cantidad_documento into v_r from ingreso_detalle where id = v_det;
  if v_r.cantidad <> 120 then
    raise exception 'FALLA 14b: al stock deben entrar las 120 que llegaron, no %', v_r.cantidad;
  end if;
  if v_r.cantidad_documento <> 144 then
    raise exception 'FALLA 14c: no guardó lo que decía la factura (%)', v_r.cantidad_documento;
  end if;
  v_ok := v_ok + 1;

  -- 15. El cotejo se puede leer de un vistazo
  select resultado, diferencia into v_r
  from v_recepcion_vs_orden where documento_id = v_doc and producto_id = v_prod;
  if v_r.resultado <> 'FALTANTE' then
    raise exception 'FALLA 15: el cotejo debería decir FALTANTE y dice %', v_r.resultado;
  end if;
  if v_r.diferencia <> -24 then
    raise exception 'FALLA 15b: la diferencia debería ser -24 unidades, es %', v_r.diferencia;
  end if;
  v_ok := v_ok + 1;

  -- 16. Escanear el producto físico marca la línea como verificada
  delete from ingreso_detalle where documento_ingreso_id = v_doc;
  select estado, detalle_id into v_txt, v_det
  from fn_agregar_linea_ingreso(v_doc, v_prod, 2, 9.00, v_caja, 2, '7799000999003');
  if v_txt <> 'OK' then
    raise exception 'FALLA 16: rechazó una línea con código correcto (%)', v_txt;
  end if;
  if not (select codigo_verificado from ingreso_detalle where id = v_det) then
    raise exception 'FALLA 16b: no marcó la línea como verificada con el escáner';
  end if;
  v_ok := v_ok + 1;

  -- 17. Un código que no es de ese producto detiene la recepción
  select estado into v_txt
  from fn_agregar_linea_ingreso(v_doc, v_prod2, 1, 1.00, null, 1, '7799000999003');
  if v_txt <> 'CODIGO_DESCONOCIDO' then
    raise exception
      'FALLA 17: dejó recibir un producto escaneando el código de otro (%). '
      'Así se cargan cajas al producto equivocado.', v_txt;
  end if;
  v_ok := v_ok + 1;

  -- 18. Un factor que produce fracciones en algo por unidad se rechaza
  insert into presentaciones (producto_id, nombre, tipo, factor, para_compra)
  values (v_prod, 'Media caja', 'CAJA', 12.5, true)
  on conflict (producto_id, nombre) do update set factor = 12.5;

  select estado into v_txt
  from fn_agregar_linea_ingreso(v_doc, v_prod, 1, 5.00,
        (select id from presentaciones where producto_id = v_prod and nombre = 'Media caja'));
  if v_txt <> 'ERROR' then
    raise exception 'FALLA 18: aceptó 12,5 unidades en un producto que va por unidad entera';
  end if;
  v_ok := v_ok + 1;

  -- ---------------------------------------------------------
  -- Lectura del stock y precios
  -- ---------------------------------------------------------
  -- 19. 244 unidades se leen como 10 cajas + 4 sueltas
  insert into inventario_saldos (producto_id, bodega_id, stock, costo_promedio)
  values (v_prod, v_bodega, 244, 0.375)
  on conflict (producto_id, bodega_id) do update set stock = 244;

  select bultos_completos, unidades_sueltas, lectura into v_r
  from v_stock_presentacion
  where producto_id = v_prod and bodega_id = v_bodega and presentacion_id = v_caja;

  if v_r.bultos_completos <> 10 or v_r.unidades_sueltas <> 4 then
    raise exception 'FALLA 19: 244 unidades deberían ser 10 cajas + 4, y da % y %',
      v_r.bultos_completos, v_r.unidades_sueltas;
  end if;
  if v_r.lectura not like '10 x Caja x 24 + 4%' then
    raise exception 'FALLA 19b: la lectura no se entiende: %', v_r.lectura;
  end if;
  v_ok := v_ok + 1;

  -- 20. El saldo sigue siendo UNO solo: la presentación no lo duplica
  select count(distinct stock_unidades) into v_n
  from v_stock_presentacion where producto_id = v_prod and bodega_id = v_bodega;
  if v_n <> 1 then
    raise exception
      'FALLA 20: el stock se ve distinto según la presentación (% valores). '
      'La presentación es una forma de contar, no un segundo inventario.', v_n;
  end if;
  v_ok := v_ok + 1;

  -- 21. La sugerencia de precios cubre el costo y redondea hacia arriba
  select precio_menor, precio_mayor, utilidad_menor into v_r
  from fn_sugerir_precios(0.375, v_cat);
  if v_r.precio_menor <= 0.375 or v_r.precio_mayor <= 0.375 then
    raise exception 'FALLA 21: el precio sugerido no cubre el costo (% y %)',
      v_r.precio_menor, v_r.precio_mayor;
  end if;
  if v_r.precio_menor < v_r.precio_mayor then
    raise exception
      'FALLA 21b: el precio al público (%) salió menor que el de mayorista (%)',
      v_r.precio_menor, v_r.precio_mayor;
  end if;
  -- 0,375 x 1,25 = 0,46875 -> 0,47 (hacia arriba; hacia abajo se come el margen)
  if v_r.precio_menor <> 0.47 then
    raise exception 'FALLA 21c: se esperaba 0,47 al 25 %% y dio %', v_r.precio_menor;
  end if;
  v_ok := v_ok + 1;

  -- 22. La caja recibe todos los códigos del producto en una sola consulta
  select jsonb_array_length(codigos) into v_n
  from v_pos_productos where producto_id = v_prod and bodega_id = v_bodega;
  if coalesce(v_n, 0) < 3 then
    raise exception
      'FALLA 22: la caja solo ve % códigos de este producto; tiene 3 activos y todos '
      'tienen que pasar por el escáner.', coalesce(v_n, 0);
  end if;
  v_ok := v_ok + 1;

  raise notice 'tests_015: % de 22 comprobaciones correctas', v_ok;
  if v_ok <> 22 then
    raise exception 'tests_015: faltaron comprobaciones (% de 22)', v_ok;
  end if;
end $$;

-- Limpieza: las pruebas no dejan basura en la base
delete from ingreso_detalle where documento_ingreso_id in (
  select id from documentos_ingreso where numero_documento = '001-001-000099001');
delete from documentos_ingreso where numero_documento = '001-001-000099001';
delete from inventario_saldos where producto_id in
  (select id from productos where codigo like 'PRU-PRES-%');
delete from producto_codigos where producto_id in
  (select id from productos where codigo like 'PRU-PRES-%');
delete from presentaciones where producto_id in
  (select id from productos where codigo like 'PRU-PRES-%');
delete from productos where codigo like 'PRU-PRES-%';

select 'tests_015: OK' as resultado;
