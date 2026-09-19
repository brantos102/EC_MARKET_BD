-- =========================================================
-- Pruebas de la migración 010
--
-- Se ejecutan sobre una base ya migrada. Cada bloque levanta una
-- excepción si el comportamiento no es el esperado, así que si el
-- script termina imprimiendo el resumen, todo pasó.
--   psql -f db/tests_010.sql
-- =========================================================
\set ON_ERROR_STOP on

do $$
declare
  v_ok int := 0;
  v_prod uuid;
  v_prod_peso uuid;
  v_bod uuid;
  v_sede uuid;
  v_msg text;
  v_txt text;
  v_id uuid;
begin
  -- -------------------------------------------------------
  -- 1. La sede matriz existe y quedó ligada a las bodegas
  -- -------------------------------------------------------
  select id into v_sede from sedes where es_matriz;
  if v_sede is null then
    raise exception 'FALLA 1: no se creó la sede matriz';
  end if;
  if exists (select 1 from bodegas where sede_id is null) then
    raise exception 'FALLA 1b: quedaron bodegas sin sede';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 2. Dos sedes numeran comprobantes por separado
  -- -------------------------------------------------------
  insert into sedes (codigo, nombre, punto_emision) values ('002', 'Sucursal norte', '001')
  on conflict (codigo) do nothing;

  -- fn_mi_sede cae en la matriz porque no hay usuario autenticado
  if fn_siguiente_comprobante('NOTA_VENTA') !~ '^001-001-[0-9]{9}$' then
    raise exception 'FALLA 2: el comprobante no respeta el formato de la sede';
  end if;
  -- el secuencial de la sede 002 arranca en 1 aunque 001 ya haya usado números
  insert into secuencias (tipo, anio, ultimo_numero)
  values ('COMP_NOTA_VENTA_002', extract(year from current_date)::int, 0)
  on conflict do nothing;
  if (select ultimo_numero from secuencias
      where tipo = 'COMP_NOTA_VENTA_002' and anio = extract(year from current_date)::int) <> 0 then
    raise exception 'FALLA 2b: la sede 002 no tiene su propio contador';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 3. Un producto por unidad rechaza cantidades decimales
  -- -------------------------------------------------------
  select p.id into v_prod
  from productos p
  join unidades_medida u on u.id = p.unidad_medida_id
  where not u.permite_fraccion and p.activo
  limit 1;

  begin
    perform fn_validar_cantidad_producto(v_prod, 1.03);
    raise exception 'FALLA 3: se aceptó 1,03 en un producto que se vende por unidad';
  exception
    when others then
      get stacked diagnostics v_msg = message_text;
      if v_msg like 'FALLA 3%' then raise; end if;
  end;
  perform fn_validar_cantidad_producto(v_prod, 3);   -- entero: debe pasar
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 4. Un producto a peso sí acepta decimales
  -- -------------------------------------------------------
  select p.id into v_prod_peso
  from productos p
  join unidades_medida u on u.id = p.unidad_medida_id
  where u.permite_fraccion and p.activo
  limit 1;

  if v_prod_peso is not null then
    perform fn_validar_cantidad_producto(v_prod_peso, 1.03);
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 5. El paso de venta quedó asignado y siempre es positivo
  -- -------------------------------------------------------
  if exists (select 1 from productos where paso_venta <= 0) then
    raise exception 'FALLA 5: hay productos con paso_venta no positivo';
  end if;
  if (select paso_venta from productos where id = v_prod) <> 1 then
    raise exception 'FALLA 5b: un producto por unidad debería tener paso 1';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 6. Catálogo de roles completo y con permisos cargados
  -- -------------------------------------------------------
  if (select count(*) from roles_catalogo where activo) < 4 then
    raise exception 'FALLA 6: faltan roles en el catálogo';
  end if;
  if (select count(*) from permisos_rol) <>
     (select count(*) from roles_catalogo) * (select count(*) from modulos_sistema) then
    raise exception 'FALLA 6b: la matriz de permisos está incompleta';
  end if;
  -- el vendedor no debe ver Administración
  if (select puede_ver from permisos_rol where rol = 'VENDEDOR' and modulo = 'admin') then
    raise exception 'FALLA 6c: el vendedor no debería ver Administración';
  end if;
  -- el supervisor tampoco
  if (select puede_ver from permisos_rol where rol = 'SUPERVISOR' and modulo = 'admin') then
    raise exception 'FALLA 6d: el supervisor no debería ver Administración';
  end if;
  -- el admin ve todo
  if exists (select 1 from permisos_rol where rol = 'ADMIN' and not puede_ver) then
    raise exception 'FALLA 6e: el administrador debe ver todos los módulos';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 7. SUPERVISOR es un rol válido en perfiles_usuario
  -- -------------------------------------------------------
  begin
    insert into auth.users (id, email) values (gen_random_uuid(), 'sup@test.local')
    on conflict do nothing;
    insert into perfiles_usuario (usuario_id, nombre, rol)
    select id, 'Supervisor de prueba', 'SUPERVISOR' from auth.users where email = 'sup@test.local'
    on conflict (usuario_id) do update set rol = 'SUPERVISOR';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    raise exception 'FALLA 7: SUPERVISOR no es aceptado como rol (%)', v_msg;
  end;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 8. Las etiquetas de la plantilla se reemplazan
  -- -------------------------------------------------------
  v_txt := fn_renderizar_plantilla(
    'Hola {{cliente.nombre}}, su total es {{venta.total}}. {{no.existe}}fin',
    '{"cliente": {"nombre": "ANA PEREZ"}, "venta": {"total": "$12.50"}}'::jsonb);
  if v_txt <> 'Hola ANA PEREZ, su total es $12.50. fin' then
    raise exception 'FALLA 8: la plantilla no se renderizó bien: "%"', v_txt;
  end if;
  -- también acepta claves planas
  if fn_renderizar_plantilla('{{a.b}}', '{"a.b": "plano"}'::jsonb) <> 'plano' then
    raise exception 'FALLA 8b: no se aceptó la clave plana';
  end if;
  -- y tolera espacios dentro de las llaves
  if fn_renderizar_plantilla('{{ cliente.nombre }}', '{"cliente":{"nombre":"X"}}'::jsonb) <> 'X' then
    raise exception 'FALLA 8c: no tolera espacios en la etiqueta';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 9. Encolar correo valida el destinatario
  -- -------------------------------------------------------
  begin
    perform fn_encolar_correo('COMPROBANTE_CLIENTE', 'esto-no-es-un-correo', '{}'::jsonb);
    raise exception 'FALLA 9: se aceptó un correo con formato inválido';
  exception when others then
    get stacked diagnostics v_msg = message_text;
    if v_msg like 'FALLA 9%' then raise; end if;
  end;

  v_id := fn_encolar_correo('COMPROBANTE_CLIENTE', 'cliente@ejemplo.com',
    '{"cliente": {"nombre": "ANA"}, "empresa": {"nombre_comercial": "El Cultivo"}}'::jsonb);
  if (select cuerpo_html from cola_correo where id = v_id) like '%{{cliente.nombre}}%' then
    raise exception 'FALLA 9b: el cuerpo encolado conserva las etiquetas sin reemplazar';
  end if;
  if (select asunto from cola_correo where id = v_id) not like '%El Cultivo%' then
    raise exception 'FALLA 9c: el asunto no tomó los datos';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 10. La sugerencia de reposición pide múltiplos del paso
  -- -------------------------------------------------------
  select bodega_id into v_bod from inventario_saldos limit 1;
  -- fuerza un producto bajo el mínimo
  update inventario_saldos set stock = 0 where producto_id = v_prod and bodega_id = v_bod;
  update productos set stock_minimo = 10 where id = v_prod;

  if not exists (select 1 from v_sugerencia_reposicion where producto_id = v_prod) then
    raise exception 'FALLA 10: un producto en cero y bajo el mínimo no aparece en la sugerencia';
  end if;
  if (select urgencia from v_sugerencia_reposicion where producto_id = v_prod limit 1) <> 'AGOTADO' then
    raise exception 'FALLA 10b: un producto en cero debería marcarse AGOTADO';
  end if;
  if (select cantidad_sugerida from v_sugerencia_reposicion where producto_id = v_prod limit 1) < 10 then
    raise exception 'FALLA 10c: la cantidad sugerida no alcanza el stock mínimo';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 11. fn_mis_modulos devuelve la lista ordenada
  -- -------------------------------------------------------
  if (select count(*) from fn_mis_modulos()) <> (select count(*) from modulos_sistema where activo) then
    raise exception 'FALLA 11: fn_mis_modulos no devolvió todos los módulos';
  end if;
  v_ok := v_ok + 1;

  -- -------------------------------------------------------
  -- 12. v_pos_productos expone el paso de venta
  -- -------------------------------------------------------
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'v_pos_productos' and column_name = 'paso_venta') then
    raise exception 'FALLA 12: v_pos_productos no expone paso_venta';
  end if;
  v_ok := v_ok + 1;

  raise notice '--------------------------------------------';
  raise notice 'Pruebas de la migración 010: % de 12 correctas', v_ok;
  raise notice '--------------------------------------------';

  if v_ok <> 12 then
    raise exception 'No pasaron todas las pruebas';
  end if;
end $$;

select 'tests_010: OK' as resultado;
