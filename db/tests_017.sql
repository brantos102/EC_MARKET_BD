-- =========================================================
-- Pruebas de la migración 017: la factura del proveedor
--
-- Lo que se comprueba es la parte que decide si esto sirve o estorba:
--   · que la primera vez haya que emparejar y la segunda ya no,
--   · que el factor del proveedor convierta bien (1 caja de 10 = 10),
--   · que el código de barras de la factura reconozca solo el producto,
--   · que un parecido por nombre se ofrezca como SUGERENCIA y nunca se
--     dé por bueno,
--   · y que la misma factura no se pueda ingresar dos veces.
--
--   psql -f db/tests_017.sql
-- =========================================================
\set ON_ERROR_STOP on

do $$
declare
  v_ok      int := 0;
  v_prov    uuid;
  v_bodega  uuid;
  v_p1      uuid;
  v_p2      uuid;
  v_r       record;
  v_txt     text;
  v_lineas  jsonb;
  v_n       int;
begin
  select id into v_bodega from bodegas limit 1;

  insert into proveedores (ruc, razon_social, nombre_comercial, activo)
  values ('1793223186001', '3B DISTRIBUCION S.A.S', '3B', true)
  on conflict (ruc) do update set razon_social = excluded.razon_social
  returning id into v_prov;

  insert into productos (codigo, nombre, unidad_medida, unidad_medida_id,
                         precio_venta_menor, precio_venta_mayor, codigo_impuesto, permite_fraccion)
  values ('PRU-FAC-1', 'Bonice fresa', 'UND',
          (select id from unidades_medida where codigo = 'UND'),
          0.35, 0.30, 'IVA_GENERAL', false)
  on conflict (codigo) do update set nombre = excluded.nombre
  returning id into v_p1;

  insert into productos (codigo, nombre, unidad_medida, unidad_medida_id,
                         precio_venta_menor, precio_venta_mayor, codigo_impuesto, permite_fraccion)
  values ('PRU-FAC-2', 'Tratamiento argán 70 ml', 'UND',
          (select id from unidades_medida where codigo = 'UND'),
          1.20, 1.00, 'IVA_GENERAL', false)
  on conflict (codigo) do update set nombre = excluded.nombre
  returning id into v_p2;

  insert into presentaciones (producto_id, nombre, tipo, factor, es_base)
  values (v_p1, 'Unidad', 'UNIDAD', 1, true)
  on conflict (producto_id, nombre) do nothing;
  insert into presentaciones (producto_id, nombre, tipo, factor, es_base)
  values (v_p2, 'Unidad', 'UNIDAD', 1, true)
  on conflict (producto_id, nombre) do nothing;

  delete from proveedor_producto where proveedor_id = v_prov;
  delete from producto_codigos where producto_id in (v_p1, v_p2);

  -- Las tres líneas de la factura real de 3B
  v_lineas := jsonb_build_array(
    jsonb_build_object('codigo', 'Q-10001203', 'codigoAux', '7799000999003',
                       'descripcion', 'BONICESSOTE FRESA X 10',
                       'cantidad', 1, 'precioUnitario', 1.74),
    jsonb_build_object('codigo', 'Q-10001204', 'codigoAux', '0',
                       'descripcion', 'BONICESSOTE MANGO X10',
                       'cantidad', 1, 'precioUnitario', 1.74),
    jsonb_build_object('codigo', '20740052', 'codigoAux', '0',
                       'descripcion', 'NB TRATAMIENTO ARGAN 15 DISPLAYS X 12 70ml',
                       'cantidad', 1, 'precioUnitario', 4.50));

  -- 1. La primera vez no reconoce nada: hay que emparejar
  select count(*) filter (where reconocido) into v_n
  from fn_traducir_factura(v_prov, v_lineas);
  if v_n <> 0 then
    raise exception 'FALLA 1: reconoció % líneas sin haber emparejado nada', v_n;
  end if;
  v_ok := v_ok + 1;

  -- 2. Devuelve las tres líneas con su código y descripción del proveedor
  select count(*) into v_n from fn_traducir_factura(v_prov, v_lineas);
  if v_n <> 3 then
    raise exception 'FALLA 2: devolvió % líneas de 3', v_n;
  end if;
  v_ok := v_ok + 1;

  -- 3. Emparejar: el proveedor factura la CAJA DE 10, el market vende
  --    por unidad. El factor es lo que hace que entren 10 y no 1.
  select estado into v_txt
  from fn_vincular_producto_proveedor(v_prov, 'Q-10001203', v_p1, 10,
                                      'BONICESSOTE FRESA X 10');
  if v_txt <> 'OK' then
    raise exception 'FALLA 3: no guardó la equivalencia (%)', v_txt;
  end if;
  v_ok := v_ok + 1;

  -- 4. Ahora esa línea entra sola, con la cantidad y el costo reales
  select * into v_r from fn_traducir_factura(v_prov, v_lineas) where indice = 1;
  if not v_r.reconocido then
    raise exception 'FALLA 4: no reconoció la línea ya emparejada';
  end if;
  if v_r.cantidad_real <> 10 then
    raise exception
      'FALLA 4b: 1 caja de 10 tiene que entrar como 10 unidades, entró como %',
      v_r.cantidad_real;
  end if;
  -- $1,74 la caja / 10 = $0,174 la unidad. Si esto sale mal, sale mal
  -- el costo promedio y con él el precio de venta de todo el negocio.
  if round(v_r.costo_unitario, 4) <> 0.1740 then
    raise exception 'FALLA 4c: el costo por unidad debería ser 0,174 y es %', v_r.costo_unitario;
  end if;
  v_ok := v_ok + 1;

  -- 5. Lo demás sigue sin reconocerse: no inventa equivalencias
  select count(*) filter (where reconocido) into v_n
  from fn_traducir_factura(v_prov, v_lineas);
  if v_n <> 1 then
    raise exception 'FALLA 5: reconoció % líneas cuando solo una está emparejada', v_n;
  end if;
  v_ok := v_ok + 1;

  -- 6. El código de barras que trae la factura reconoce el producto sin
  --    emparejar nada: es el atajo bueno.
  perform fn_registrar_codigo_producto(v_p2, '7799000999010', 'EAN13');
  select * into v_r
  from fn_traducir_factura(
    v_prov,
    jsonb_build_array(jsonb_build_object(
      'codigo', 'NUEVO-999', 'codigoAux', '7799000999010',
      'descripcion', 'ALGO QUE NO SE PARECE A NADA',
      'cantidad', 2, 'precioUnitario', 3.00)))
  where indice = 1;

  if not v_r.reconocido or v_r.producto_id <> v_p2 then
    raise exception 'FALLA 6: no reconoció el producto por su código de barras';
  end if;
  if v_r.motivo not like '%código de barras%' then
    raise exception 'FALLA 6b: no dice por qué lo reconoció (%)', v_r.motivo;
  end if;
  v_ok := v_ok + 1;

  -- 7. Un parecido por nombre se ofrece, pero NO se da por bueno.
  --    "ARROZ FLOR 2KG" y "ARROZ FLOR 5KG" se parecen mucho y son
  --    productos distintos con precios distintos.
  select * into v_r
  from fn_traducir_factura(
    v_prov,
    jsonb_build_array(jsonb_build_object(
      'codigo', 'OTRO-1', 'codigoAux', '0',
      'descripcion', 'BONICE SABOR LIMON',
      'cantidad', 1, 'precioUnitario', 0.20)))
  where indice = 1;

  if v_r.reconocido then
    raise exception
      'FALLA 7: dio por bueno un parecido por nombre. Así se carga mercadería al '
      'producto equivocado y el inventario queda mal sin que nadie lo note.';
  end if;
  if v_r.sugerencia_id is null then
    raise exception 'FALLA 7b: ni siquiera sugirió el producto parecido';
  end if;
  if v_r.motivo not like '%confírmelo%' then
    raise exception 'FALLA 7c: la sugerencia no avisa de que hay que confirmarla (%)', v_r.motivo;
  end if;
  v_ok := v_ok + 1;

  -- 8. Cambiar a qué producto apunta un código avisa, pero se permite:
  --    el proveedor reutiliza códigos.
  select estado into v_txt
  from fn_vincular_producto_proveedor(v_prov, 'Q-10001203', v_p2, 1);
  if v_txt <> 'CAMBIADO' then
    raise exception 'FALLA 8: no avisó del cambio de equivalencia (%)', v_txt;
  end if;
  v_ok := v_ok + 1;

  -- 9. Un factor cero o negativo no se acepta: dividiría entre cero al
  --    calcular el costo unitario.
  select estado into v_txt
  from fn_vincular_producto_proveedor(v_prov, 'X-1', v_p1, 0);
  if v_txt <> 'ERROR' then
    raise exception 'FALLA 9: aceptó un factor cero';
  end if;
  v_ok := v_ok + 1;

  -- 10. La misma factura no se puede ingresar dos veces. Un ingreso
  --     repetido duplica el stock y arruina el costo promedio, y se
  --     descubre meses después en un inventario físico.
  delete from documentos_ingreso
   where clave_acceso = '0909202601179322318600120010030000247786316875011';

  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento,
                                  fecha_emision, clave_acceso, origen)
  values (v_prov, v_bodega, 'FACTURA', '001-003-000024778', current_date,
          '0909202601179322318600120010030000247786316875011', 'XML_SRI');

  begin
    insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento,
                                    fecha_emision, clave_acceso, origen)
    values (v_prov, v_bodega, 'FACTURA', '001-003-000024779', current_date,
            '0909202601179322318600120010030000247786316875011', 'XML_SRI');
    raise exception 'FALLA 10: dejó ingresar dos veces la misma factura electrónica';
  exception
    when others then
      if sqlerrm like 'FALLA 10%' then raise; end if;
      v_ok := v_ok + 1;
  end;

  -- 11. El origen queda registrado: auditar un costo raro empieza por
  --     saber de dónde salió el dato.
  select origen into v_txt from documentos_ingreso
   where clave_acceso = '0909202601179322318600120010030000247786316875011';
  if v_txt <> 'XML_SRI' then
    raise exception 'FALLA 11: no guardó de dónde vino el documento (%)', v_txt;
  end if;
  v_ok := v_ok + 1;

  -- 12. Un origen inventado se rechaza
  begin
    update documentos_ingreso set origen = 'ADIVINADO'
     where clave_acceso = '0909202601179322318600120010030000247786316875011';
    raise exception 'FALLA 12: aceptó un origen que no existe';
  exception
    when others then
      if sqlerrm like 'FALLA 12%' then raise; end if;
      v_ok := v_ok + 1;
  end;

  raise notice 'tests_017: % de 12 comprobaciones correctas', v_ok;
  if v_ok <> 12 then
    raise exception 'tests_017: faltaron comprobaciones (% de 12)', v_ok;
  end if;
end $$;

-- Limpieza
delete from documentos_ingreso
 where clave_acceso = '0909202601179322318600120010030000247786316875011';
delete from proveedor_producto where producto_id in
  (select id from productos where codigo like 'PRU-FAC-%');
delete from producto_codigos where producto_id in
  (select id from productos where codigo like 'PRU-FAC-%');
delete from presentaciones where producto_id in
  (select id from productos where codigo like 'PRU-FAC-%');
delete from productos where codigo like 'PRU-FAC-%';

select 'tests_017: OK' as resultado;
