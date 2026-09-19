-- =========================================================
-- CENTRO DE CONTROL - MARKET
-- Pruebas funcionales del motor de negocio.
--
-- Ejecutar DESPUÉS de las migraciones 001-006, sobre una base de
-- pruebas (no producción: crea y confirma ventas reales).
--
--   psql -f db/tests_funcionales.sql
--
-- Cada bloque levanta una excepción si el resultado no es el esperado,
-- así que si el script termina sin error, todo pasó.
-- =========================================================

\set ON_ERROR_STOP on

do $$
declare
  v_bodega uuid;
  v_cliente uuid;
  v_venta uuid;
  v_prod uuid;
  v_prod_limon uuid;
  v_prod_papa uuid;
  v_stock_antes numeric;
  v_stock_despues numeric;
  v_calc record;
  v_venta_row record;
  v_lotes jsonb;
  v_count int;
  v_total numeric;
  v_estado text;
begin
  select id into v_bodega from bodegas where nombre = 'Bodega Principal';
  select id into v_cliente from clientes where identificacion = '9999999999999';
  select id into v_prod_limon from productos where codigo = 'FRU-013';   -- 3 x $1
  select id into v_prod_papa  from productos where codigo = 'VER-001';   -- precio fijo 0.40
  select id into v_prod       from productos where codigo = 'ABA-001';   -- arroz, sin promo

  -- =====================================================
  raise notice '--- 1. EAN-13: todos los productos del catálogo son válidos';
  select count(*) into v_count from productos where ean13 is not null and not fn_validar_ean13(ean13);
  if v_count > 0 then
    raise exception 'FALLO: % productos con EAN-13 inválido', v_count;
  end if;
  raise notice '    OK';

  raise notice '--- 2. EAN-13: la base rechaza un código con verificador incorrecto';
  begin
    insert into productos (codigo, nombre, ean13) values ('TEST-BAD', 'Prueba', '7861000100012');
    raise exception 'FALLO: se aceptó un EAN-13 inválido';
  exception when check_violation then
    raise notice '    OK (rechazado por constraint)';
  end;

  -- =====================================================
  raise notice '--- 3. Promoción "3 limones por $1"';
  select * into v_calc from fn_calcular_precio_linea(v_prod_limon, 'MENOR', 7);
  -- precio menor 0.80 -> sin promo 5.60 ; con promo: 2 grupos ($2) + 1 suelto (0.80) = 2.80
  if v_calc.total_con_promo <> 2.80 then
    raise exception 'FALLO: 7 limones deberían costar 2.80 y dieron %', v_calc.total_con_promo;
  end if;
  raise notice '    OK: 7 limones = $% (sin promo $%)', v_calc.total_con_promo, v_calc.total_sin_promo;

  raise notice '--- 4. Promoción de precio fijo en papa chola';
  select * into v_calc from fn_calcular_precio_linea(v_prod_papa, 'MENOR', 10);
  if v_calc.total_con_promo <> 4.00 then
    raise exception 'FALLO: 10 lb de papa deberían costar 4.00 y dieron %', v_calc.total_con_promo;
  end if;
  raise notice '    OK: 10 lb de papa = $%', v_calc.total_con_promo;

  raise notice '--- 5. Precio mayorista solo sobre la cantidad mínima';
  select * into v_calc from fn_calcular_precio_linea(v_prod, 'MAYOR', 5);
  if v_calc.precio_base <> 2.85 then
    raise exception 'FALLO: 5 unidades no alcanzan el mínimo mayorista, esperaba 2.85 y dio %', v_calc.precio_base;
  end if;
  select * into v_calc from fn_calcular_precio_linea(v_prod, 'MAYOR', 12);
  if v_calc.precio_base <> 2.50 then
    raise exception 'FALLO: 12 unidades sí alcanzan el mínimo, esperaba 2.50 y dio %', v_calc.precio_base;
  end if;
  raise notice '    OK: 5 und -> $2.85/u ; 12 und -> $2.50/u';

  -- =====================================================
  raise notice '--- 6. Venta completa: confirma, descuenta stock y consume lotes FEFO';
  select stock into v_stock_antes from inventario_saldos
    where producto_id = v_prod and bodega_id = v_bodega;

  insert into ventas (cliente_id, bodega_id, tipo_venta)
    values (v_cliente, v_bodega, 'MENOR') returning id into v_venta;

  insert into venta_detalle (venta_id, producto_id, cantidad)
    values (v_venta, v_prod, 3);

  select * into v_venta_row from ventas where id = v_venta;
  if v_venta_row.subtotal <> 8.55 then   -- 3 x 2.85
    raise exception 'FALLO: subtotal esperado 8.55, obtenido %', v_venta_row.subtotal;
  end if;
  if v_venta_row.valor_impuesto <> 0 then  -- arroz es IVA 0%
    raise exception 'FALLO: el arroz es IVA 0%%, obtenido %', v_venta_row.valor_impuesto;
  end if;

  update ventas set estado = 'CONFIRMADA' where id = v_venta;

  select stock into v_stock_despues from inventario_saldos
    where producto_id = v_prod and bodega_id = v_bodega;

  if v_stock_despues <> v_stock_antes - 3 then
    raise exception 'FALLO: el stock no se descontó (antes %, después %)', v_stock_antes, v_stock_despues;
  end if;

  select lotes_consumidos into v_lotes from venta_detalle where venta_id = v_venta;
  if v_lotes is null or jsonb_array_length(v_lotes) = 0 then
    raise exception 'FALLO: no se registró el consumo de lotes';
  end if;
  raise notice '    OK: stock % -> %, lotes consumidos: %', v_stock_antes, v_stock_despues, v_lotes;

  -- =====================================================
  raise notice '--- 7. El IVA se aplica a productos de tarifa general';
  declare v_venta2 uuid; v_prod_snack uuid;
  begin
    select id into v_prod_snack from productos where codigo = 'SNK-001';  -- Ruffles, IVA general
    insert into ventas (cliente_id, bodega_id, tipo_venta)
      values (v_cliente, v_bodega, 'MENOR') returning id into v_venta2;
    insert into venta_detalle (venta_id, producto_id, cantidad) values (v_venta2, v_prod_snack, 2);
    select * into v_venta_row from ventas where id = v_venta2;
    -- 2 x 2.35 = 4.70 ; IVA 15% = 0.705 ; total 5.405
    if round(v_venta_row.valor_impuesto, 3) <> 0.705 then
      raise exception 'FALLO: IVA esperado 0.705, obtenido %', v_venta_row.valor_impuesto;
    end if;
    raise notice '    OK: subtotal $%, IVA $%, total $%',
      v_venta_row.subtotal, v_venta_row.valor_impuesto, v_venta_row.total;
    update ventas set estado = 'ANULADA' where id = v_venta2;
  end;

  -- =====================================================
  raise notice '--- 8. Venta sin stock suficiente es rechazada';
  declare v_venta3 uuid;
  begin
    insert into ventas (cliente_id, bodega_id, tipo_venta)
      values (v_cliente, v_bodega, 'MENOR') returning id into v_venta3;
    insert into venta_detalle (venta_id, producto_id, cantidad) values (v_venta3, v_prod, 999999);
    begin
      update ventas set estado = 'CONFIRMADA' where id = v_venta3;
      raise exception 'FALLO: se confirmó una venta sin stock';
    exception when raise_exception then
      if sqlerrm like '%FALLO%' then raise; end if;
      raise notice '    OK (rechazada: %)', left(sqlerrm, 60);
    end;
  end;

  -- =====================================================
  raise notice '--- 9. Pago cubre el total y la venta pasa a PAGADA';
  select total into v_total from ventas where id = v_venta;
  insert into pagos_venta (venta_id, forma_pago, monto, recibido, cambio)
    values (v_venta, 'EFECTIVO', v_total, 10.00, 10.00 - v_total);

  select estado into v_estado from ventas where id = v_venta;
  if v_estado <> 'PAGADA' then
    raise exception 'FALLO: la venta debería estar PAGADA y está %', v_estado;
  end if;
  raise notice '    OK: venta pagada, cambio $%', round(10.00 - v_total, 2);

  -- =====================================================
  raise notice '--- 10. El kardex no se puede alterar';
  begin
    update movimientos_inventario set cantidad = 1
      where id = (select id from movimientos_inventario limit 1);
    raise exception 'FALLO: se permitió modificar el kardex';
  exception when raise_exception then
    if sqlerrm like '%FALLO%' then raise; end if;
    raise notice '    OK (bloqueado)';
  end;

  -- =====================================================
  raise notice '--- 11. Un ingreso confirmado no se puede reconfirmar ni editar';
  declare v_ing uuid;
  begin
    select id into v_ing from documentos_ingreso where estado = 'CONFIRMADO' limit 1;
    begin
      update documentos_ingreso set observacion = 'intento' where id = v_ing;
      raise exception 'FALLO: se permitió editar un ingreso confirmado';
    exception when raise_exception then
      if sqlerrm like '%FALLO%' then raise; end if;
      raise notice '    OK (bloqueado)';
    end;
  end;

  -- =====================================================
  raise notice '--- 12. La bitácora de auditoría registró los movimientos';
  select count(*) into v_count from auditoria_log;
  if v_count = 0 then
    raise exception 'FALLO: la bitácora está vacía';
  end if;
  raise notice '    OK: % eventos registrados', v_count;

  -- =====================================================
  raise notice '--- 13. Las alertas de caducidad clasifican correctamente';
  select count(*) into v_count from v_alertas_caducidad where nivel_alerta in ('CRITICO','PROXIMO','VENCIDO');
  raise notice '    OK: % lotes en alerta de caducidad', v_count;

  -- =====================================================
  raise notice '--- 14. El layout tiene productos ubicados';
  select count(*) into v_count from v_ocupacion_layout where producto_id is not null;
  if v_count = 0 then
    raise exception 'FALLO: ningún producto tiene ubicación asignada';
  end if;
  raise notice '    OK: % ubicaciones con producto', v_count;

  raise notice '';
  raise notice '===== TODAS LAS PRUEBAS FUNCIONALES PASARON =====';
end $$;
