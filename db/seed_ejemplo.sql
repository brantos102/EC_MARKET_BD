-- =========================================================
-- Datos de ejemplo para probar el módulo de inventario.
-- Ejecutar DESPUÉS de schema.sql. Opcional (solo para pruebas).
-- =========================================================

insert into categorias (nombre, descripcion) values
  ('Abarrotes', 'Productos secos y no perecibles'),
  ('Limpieza', 'Artículos de limpieza e higiene')
on conflict (nombre) do nothing;

insert into bodegas (nombre, ubicacion) values
  ('Bodega Principal', 'Alfaro, Pichincha')
on conflict (nombre) do nothing;

insert into productos (codigo, nombre, categoria_id, unidad_medida, stock_minimo)
select 'ARR-001', 'Arroz 1kg', c.id, 'UND', 20
from categorias c where c.nombre = 'Abarrotes'
on conflict (codigo) do nothing;

-- Movimientos de prueba (deja el rastro para verificar el Kardex):
-- 1) Entrada: 100 unidades a $0.80  -> saldo: 100 @ 0.80
-- 2) Entrada: 50 unidades a $0.90   -> saldo: 150 @ 0.8333...
-- 3) Salida: 30 unidades             -> saldo: 120 @ 0.8333... (costo no cambia)
insert into movimientos_inventario (producto_id, bodega_id, tipo, cantidad, costo_unitario, referencia)
select p.id, b.id, 'ENTRADA', 100, 0.80, 'FACT-001'
from productos p, bodegas b where p.codigo = 'ARR-001' and b.nombre = 'Bodega Principal';

insert into movimientos_inventario (producto_id, bodega_id, tipo, cantidad, costo_unitario, referencia)
select p.id, b.id, 'ENTRADA', 50, 0.90, 'FACT-002'
from productos p, bodegas b where p.codigo = 'ARR-001' and b.nombre = 'Bodega Principal';

insert into movimientos_inventario (producto_id, bodega_id, tipo, cantidad, referencia)
select p.id, b.id, 'SALIDA', 30, 'GUIA-001'
from productos p, bodegas b where p.codigo = 'ARR-001' and b.nombre = 'Bodega Principal';

-- Verificación rápida:
select * from v_stock_actual;
select tipo, cantidad, costo_unitario, saldo_cantidad, saldo_costo_promedio, saldo_valor_total
from movimientos_inventario order by created_at;
