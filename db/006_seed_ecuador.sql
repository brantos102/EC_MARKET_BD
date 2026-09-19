-- =========================================================
-- CENTRO DE CONTROL - MARKET
-- Migración 006: catálogo de ejemplo para un market en Quito.
--
-- ARCHIVO GENERADO por db/generar_seed.mjs — no editar a mano.
-- Los EAN-13 llevan prefijo 786 (Ecuador, GS1) y dígito verificador
-- calculado según ISO/IEC 15420.
--
-- La clasificación de IVA (0% para productos de primera necesidad vs
-- tarifa general) sigue el criterio del Art. 55 de la LRTI, pero debe
-- ser validada por el contador antes de facturar en producción.
--
-- Requiere: 005_auditoria_vistas.sql
-- =========================================================

-- Bodega principal (creada en seed_ejemplo.sql o aquí si no existe)
insert into bodegas (nombre, ubicacion) values ('Bodega Principal', 'Quito, Pichincha')
on conflict (nombre) do nothing;


-- ---------- Zonas ----------
insert into zonas (codigo, nombre, tipo_conservacion, orden, color_hex, bodega_id)
select 'PER', 'Perecibles - Frutas y Verduras', 'AMBIENTE', 1, '#22c55e', b.id
from bodegas b where b.nombre = 'Bodega Principal'
on conflict (codigo) do nothing;
insert into zonas (codigo, nombre, tipo_conservacion, orden, color_hex, bodega_id)
select 'CAR', 'Carnes y Embutidos', 'REFRIGERADO', 2, '#ef4444', b.id
from bodegas b where b.nombre = 'Bodega Principal'
on conflict (codigo) do nothing;
insert into zonas (codigo, nombre, tipo_conservacion, orden, color_hex, bodega_id)
select 'LAC', 'Lácteos y Huevos', 'REFRIGERADO', 3, '#60a5fa', b.id
from bodegas b where b.nombre = 'Bodega Principal'
on conflict (codigo) do nothing;
insert into zonas (codigo, nombre, tipo_conservacion, orden, color_hex, bodega_id)
select 'ABA', 'Abarrotes y Granos', 'AMBIENTE', 4, '#f59e0b', b.id
from bodegas b where b.nombre = 'Bodega Principal'
on conflict (codigo) do nothing;
insert into zonas (codigo, nombre, tipo_conservacion, orden, color_hex, bodega_id)
select 'BEB', 'Bebidas', 'AMBIENTE', 5, '#06b6d4', b.id
from bodegas b where b.nombre = 'Bodega Principal'
on conflict (codigo) do nothing;
insert into zonas (codigo, nombre, tipo_conservacion, orden, color_hex, bodega_id)
select 'LIC', 'Licores', 'AMBIENTE', 6, '#a855f7', b.id
from bodegas b where b.nombre = 'Bodega Principal'
on conflict (codigo) do nothing;
insert into zonas (codigo, nombre, tipo_conservacion, orden, color_hex, bodega_id)
select 'SNK', 'Snacks y Confitería', 'AMBIENTE', 7, '#ec4899', b.id
from bodegas b where b.nombre = 'Bodega Principal'
on conflict (codigo) do nothing;
insert into zonas (codigo, nombre, tipo_conservacion, orden, color_hex, bodega_id)
select 'LIM', 'Limpieza y Hogar', 'AMBIENTE', 8, '#64748b', b.id
from bodegas b where b.nombre = 'Bodega Principal'
on conflict (codigo) do nothing;

-- ---------- Ubicaciones (layout físico) ----------
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'A', 1, 1, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'A', 1, 2, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'A', 1, 3, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'A', 2, 1, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'A', 2, 2, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'A', 2, 3, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'A', 3, 1, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'A', 3, 2, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'A', 3, 3, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'A', 4, 1, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'A', 4, 2, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'A', 4, 3, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'B', 1, 1, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'B', 1, 2, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'B', 1, 3, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'B', 2, 1, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'B', 2, 2, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'B', 2, 3, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'B', 3, 1, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'B', 3, 2, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'B', 3, 3, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'B', 4, 1, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'B', 4, 2, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'B', 4, 3, 200 from zonas z where z.codigo = 'PER'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'C', 1, 1, 200 from zonas z where z.codigo = 'CAR'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'C', 1, 2, 200 from zonas z where z.codigo = 'CAR'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'C', 2, 1, 200 from zonas z where z.codigo = 'CAR'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'C', 2, 2, 200 from zonas z where z.codigo = 'CAR'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'C', 3, 1, 200 from zonas z where z.codigo = 'CAR'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'C', 3, 2, 200 from zonas z where z.codigo = 'CAR'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'D', 1, 1, 200 from zonas z where z.codigo = 'LAC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'D', 1, 2, 200 from zonas z where z.codigo = 'LAC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'D', 1, 3, 200 from zonas z where z.codigo = 'LAC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'D', 2, 1, 200 from zonas z where z.codigo = 'LAC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'D', 2, 2, 200 from zonas z where z.codigo = 'LAC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'D', 2, 3, 200 from zonas z where z.codigo = 'LAC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'D', 3, 1, 200 from zonas z where z.codigo = 'LAC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'D', 3, 2, 200 from zonas z where z.codigo = 'LAC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'D', 3, 3, 200 from zonas z where z.codigo = 'LAC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 1, 1, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 1, 2, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 1, 3, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 1, 4, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 2, 1, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 2, 2, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 2, 3, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 2, 4, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 3, 1, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 3, 2, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 3, 3, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 3, 4, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 4, 1, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 4, 2, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 4, 3, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 4, 4, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 5, 1, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 5, 2, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 5, 3, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'E', 5, 4, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 1, 1, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 1, 2, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 1, 3, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 1, 4, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 2, 1, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 2, 2, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 2, 3, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 2, 4, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 3, 1, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 3, 2, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 3, 3, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 3, 4, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 4, 1, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 4, 2, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 4, 3, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 4, 4, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 5, 1, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 5, 2, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 5, 3, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'F', 5, 4, 200 from zonas z where z.codigo = 'ABA'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'G', 1, 1, 200 from zonas z where z.codigo = 'BEB'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'G', 1, 2, 200 from zonas z where z.codigo = 'BEB'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'G', 1, 3, 200 from zonas z where z.codigo = 'BEB'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'G', 2, 1, 200 from zonas z where z.codigo = 'BEB'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'G', 2, 2, 200 from zonas z where z.codigo = 'BEB'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'G', 2, 3, 200 from zonas z where z.codigo = 'BEB'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'G', 3, 1, 200 from zonas z where z.codigo = 'BEB'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'G', 3, 2, 200 from zonas z where z.codigo = 'BEB'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'G', 3, 3, 200 from zonas z where z.codigo = 'BEB'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'G', 4, 1, 200 from zonas z where z.codigo = 'BEB'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'G', 4, 2, 200 from zonas z where z.codigo = 'BEB'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'G', 4, 3, 200 from zonas z where z.codigo = 'BEB'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'H', 1, 1, 200 from zonas z where z.codigo = 'LIC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'H', 1, 2, 200 from zonas z where z.codigo = 'LIC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'H', 1, 3, 200 from zonas z where z.codigo = 'LIC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'H', 2, 1, 200 from zonas z where z.codigo = 'LIC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'H', 2, 2, 200 from zonas z where z.codigo = 'LIC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'H', 2, 3, 200 from zonas z where z.codigo = 'LIC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'H', 3, 1, 200 from zonas z where z.codigo = 'LIC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'H', 3, 2, 200 from zonas z where z.codigo = 'LIC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'H', 3, 3, 200 from zonas z where z.codigo = 'LIC'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 1, 1, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 1, 2, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 1, 3, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 1, 4, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 2, 1, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 2, 2, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 2, 3, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 2, 4, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 3, 1, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 3, 2, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 3, 3, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 3, 4, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 4, 1, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 4, 2, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 4, 3, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'I', 4, 4, 200 from zonas z where z.codigo = 'SNK'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'J', 1, 1, 200 from zonas z where z.codigo = 'LIM'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'J', 1, 2, 200 from zonas z where z.codigo = 'LIM'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'J', 1, 3, 200 from zonas z where z.codigo = 'LIM'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'J', 2, 1, 200 from zonas z where z.codigo = 'LIM'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'J', 2, 2, 200 from zonas z where z.codigo = 'LIM'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'J', 2, 3, 200 from zonas z where z.codigo = 'LIM'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'J', 3, 1, 200 from zonas z where z.codigo = 'LIM'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'J', 3, 2, 200 from zonas z where z.codigo = 'LIM'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'J', 3, 3, 200 from zonas z where z.codigo = 'LIM'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'J', 4, 1, 200 from zonas z where z.codigo = 'LIM'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'J', 4, 2, 200 from zonas z where z.codigo = 'LIM'
on conflict (zona_id, pasillo, estante, nivel) do nothing;
insert into ubicaciones (zona_id, pasillo, estante, nivel, capacidad_maxima)
select z.id, 'J', 4, 3, 200 from zonas z where z.codigo = 'LIM'
on conflict (zona_id, pasillo, estante, nivel) do nothing;

-- ---------- Categorías ----------
insert into categorias (nombre, descripcion) values ('Frutas', 'Fruta fresca nacional e importada') on conflict (nombre) do nothing;
insert into categorias (nombre, descripcion) values ('Verduras y Hortalizas', 'Producto agrícola en estado natural') on conflict (nombre) do nothing;
insert into categorias (nombre, descripcion) values ('Carnes', 'Res, cerdo, pollo y pescado') on conflict (nombre) do nothing;
insert into categorias (nombre, descripcion) values ('Embutidos', 'Productos cárnicos procesados') on conflict (nombre) do nothing;
insert into categorias (nombre, descripcion) values ('Lácteos y Huevos', 'Leche, queso, yogurt y huevos') on conflict (nombre) do nothing;
insert into categorias (nombre, descripcion) values ('Granos y Cereales', 'Granos secos, arroz y harinas') on conflict (nombre) do nothing;
insert into categorias (nombre, descripcion) values ('Abarrotes', 'Despensa básica no perecible') on conflict (nombre) do nothing;
insert into categorias (nombre, descripcion) values ('Bebidas', 'Gaseosas, aguas y jugos') on conflict (nombre) do nothing;
insert into categorias (nombre, descripcion) values ('Licores', 'Cervezas, destilados y vinos') on conflict (nombre) do nothing;
insert into categorias (nombre, descripcion) values ('Snacks y Confitería', 'Pasabocas, galletas y dulces') on conflict (nombre) do nothing;
insert into categorias (nombre, descripcion) values ('Limpieza', 'Aseo del hogar') on conflict (nombre) do nothing;
insert into categorias (nombre, descripcion) values ('Cuidado Personal', 'Higiene personal') on conflict (nombre) do nothing;

-- ---------- Proveedores ----------
insert into proveedores (ruc, razon_social, nombre_comercial) values ('1790016919001', 'CORPORACION FAVORITA C.A.', 'Supermaxi Mayorista') on conflict (ruc) do nothing;
insert into proveedores (ruc, razon_social, nombre_comercial) values ('1791251237001', 'DISTRIBUIDORA JUAN ELJURI CIA LTDA', 'Eljuri Distribución') on conflict (ruc) do nothing;
insert into proveedores (ruc, razon_social, nombre_comercial) values ('1790368718001', 'PRONACA C.A.', 'Pronaca') on conflict (ruc) do nothing;
insert into proveedores (ruc, razon_social, nombre_comercial) values ('0190123456001', 'MERCADO MAYORISTA DE QUITO S.A.', 'Mayorista Quito') on conflict (ruc) do nothing;
insert into proveedores (ruc, razon_social, nombre_comercial) values ('1792345678001', 'DISTRIBUIDORA ANDINA DE ALIMENTOS', 'Andina Alimentos') on conflict (ruc) do nothing;

-- ---------- Productos ----------
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-001', 'Guineo de seda', null, '7861000100014', c.id, 'LB', u.id,
  0.35, 0.28, 25, 'IVA_CERO', true, 5, 30, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-002', 'Manzana Royal Gala', null, '7861001100020', c.id, 'LB', u.id,
  0.9, 0.75, 25, 'IVA_CERO', true, 10, 20, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-003', 'Naranja Valencia', null, '7861002100036', c.id, 'UND', u.id,
  0.15, 0.1, 50, 'IVA_CERO', true, 10, 100, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-004', 'Naranjilla', null, '7861003100042', c.id, 'LB', u.id,
  1.25, 1, 20, 'IVA_CERO', true, 5, 15, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-005', 'Tomate de árbol', null, '7861004100058', c.id, 'LB', u.id,
  0.9, 0.7, 20, 'IVA_CERO', true, 7, 20, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-006', 'Babaco', null, '7861000100069', c.id, 'UND', u.id,
  2.5, 2, 10, 'IVA_CERO', true, 7, 10, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-007', 'Granadilla', null, '7861001100075', c.id, 'UND', u.id,
  0.4, 0.3, 30, 'IVA_CERO', true, 7, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-008', 'Mora de Castilla', null, '7861002100081', c.id, 'LB', u.id,
  1.75, 1.4, 15, 'IVA_CERO', true, 3, 12, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-009', 'Uvilla', null, '7861003100097', c.id, 'LB', u.id,
  1.5, 1.2, 15, 'IVA_CERO', true, 5, 12, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-010', 'Papaya Hawaiana', null, '7861004100102', c.id, 'UND', u.id,
  2, 1.6, 10, 'IVA_CERO', true, 5, 10, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-011', 'Piña', null, '7861000100113', c.id, 'UND', u.id,
  1.5, 1.2, 12, 'IVA_CERO', true, 7, 15, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-012', 'Maracuyá', null, '7861001100129', c.id, 'LB', u.id,
  1, 0.8, 20, 'IVA_CERO', true, 7, 15, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-013', 'Limón sutil', null, '7861002100135', c.id, 'LB', u.id,
  0.8, 0.6, 25, 'IVA_CERO', true, 10, 25, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'FRU-014', 'Aguacate Fuerte', null, '7861003100141', c.id, 'UND', u.id,
  0.75, 0.6, 24, 'IVA_CERO', true, 5, 30, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Frutas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-001', 'Papa Chola', null, '7861004100157', c.id, 'LB', u.id,
  0.45, 0.35, 50, 'IVA_CERO', true, 15, 100, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-002', 'Papa Súper Chola', null, '7861000100168', c.id, 'LB', u.id,
  0.5, 0.4, 50, 'IVA_CERO', true, 15, 80, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-003', 'Cebolla Paiteña', null, '7861001100174', c.id, 'LB', u.id,
  0.6, 0.45, 30, 'IVA_CERO', true, 15, 50, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-004', 'Cebolla Blanca', null, '7861002100180', c.id, 'ATADO', u.id,
  0.75, 0.6, 20, 'IVA_CERO', true, 5, 25, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'ATADO'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-005', 'Tomate Riñón', null, '7861003100196', c.id, 'LB', u.id,
  0.7, 0.55, 30, 'IVA_CERO', true, 5, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-006', 'Zanahoria Amarilla', null, '7861004100201', c.id, 'LB', u.id,
  0.5, 0.4, 30, 'IVA_CERO', true, 12, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-007', 'Brócoli', null, '7861000100212', c.id, 'UND', u.id,
  0.9, 0.7, 20, 'IVA_CERO', true, 5, 20, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-008', 'Col', null, '7861001100228', c.id, 'UND', u.id,
  0.8, 0.65, 20, 'IVA_CERO', true, 8, 20, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-009', 'Lechuga Criolla', null, '7861002100234', c.id, 'UND', u.id,
  0.6, 0.45, 24, 'IVA_CERO', true, 4, 25, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-010', 'Choclo', null, '7861003100240', c.id, 'UND', u.id,
  0.5, 0.4, 30, 'IVA_CERO', true, 5, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-011', 'Fréjol Tierno', null, '7861004100256', c.id, 'LB', u.id,
  1.2, 0.95, 20, 'IVA_CERO', true, 5, 15, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-012', 'Arveja Tierna', null, '7861000100267', c.id, 'LB', u.id,
  1.3, 1.05, 20, 'IVA_CERO', true, 5, 15, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-013', 'Haba Tierna', null, '7861001100273', c.id, 'LB', u.id,
  1, 0.8, 20, 'IVA_CERO', true, 5, 15, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-014', 'Yuca', null, '7861002100289', c.id, 'LB', u.id,
  0.45, 0.35, 30, 'IVA_CERO', true, 10, 30, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-015', 'Zapallo', null, '7861003100295', c.id, 'LB', u.id,
  0.6, 0.45, 25, 'IVA_CERO', true, 15, 20, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-016', 'Pimiento Verde', null, '7861004100300', c.id, 'LB', u.id,
  0.9, 0.7, 20, 'IVA_CERO', true, 7, 18, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-017', 'Ají', null, '7861000100311', c.id, 'LB', u.id,
  1.5, 1.2, 10, 'IVA_CERO', true, 7, 8, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-018', 'Culantro', null, '7861001100327', c.id, 'ATADO', u.id,
  0.3, 0.2, 30, 'IVA_CERO', true, 3, 30, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'ATADO'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'VER-019', 'Perejil', null, '7861002100333', c.id, 'ATADO', u.id,
  0.3, 0.2, 30, 'IVA_CERO', true, 3, 30, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Verduras y Hortalizas' and u.codigo = 'ATADO'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'CAR-001', 'Carne Molida de Res', null, '7861003100349', c.id, 'LB', u.id,
  2.75, 2.4, 20, 'IVA_CERO', true, 3, 25, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Carnes' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'CAR-002', 'Lomo Fino de Res', null, '7861004100355', c.id, 'LB', u.id,
  4.5, 4, 15, 'IVA_CERO', true, 3, 15, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Carnes' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'CAR-003', 'Costilla de Res', null, '7861000100366', c.id, 'LB', u.id,
  2.5, 2.15, 20, 'IVA_CERO', true, 3, 20, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Carnes' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'CAR-004', 'Pechuga de Pollo', 'Mr. Pollo', '7861001100372', c.id, 'LB', u.id,
  2.25, 1.95, 25, 'IVA_CERO', true, 3, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Carnes' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'CAR-005', 'Pollo Entero', 'Mr. Pollo', '7861002100388', c.id, 'LB', u.id,
  1.85, 1.6, 25, 'IVA_CERO', true, 3, 35, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Carnes' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'CAR-006', 'Presa de Pollo', 'Mr. Pollo', '7861003100394', c.id, 'LB', u.id,
  1.95, 1.7, 25, 'IVA_CERO', true, 3, 30, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Carnes' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'CAR-007', 'Chuleta de Cerdo', null, '7861004100409', c.id, 'LB', u.id,
  2.6, 2.25, 20, 'IVA_CERO', true, 3, 20, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Carnes' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'CAR-008', 'Costilla de Cerdo', null, '7861000100410', c.id, 'LB', u.id,
  2.4, 2.1, 20, 'IVA_CERO', true, 3, 18, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Carnes' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'CAR-009', 'Tilapia Entera', null, '7861001100426', c.id, 'LB', u.id,
  2.8, 2.4, 15, 'IVA_CERO', true, 2, 15, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Carnes' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'CAR-010', 'Corvina en Filete', null, '7861002100432', c.id, 'LB', u.id,
  4.25, 3.8, 12, 'IVA_CERO', true, 2, 10, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Carnes' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'EMB-001', 'Salchicha Vienesa 500g', 'Juris', '7861003100448', c.id, 'UND', u.id,
  2.5, 2.2, 12, 'IVA_GENERAL', true, 10, 20, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Embutidos' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'EMB-002', 'Mortadela Especial', 'Plumrose', '7861004100454', c.id, 'LB', u.id,
  2.25, 1.95, 15, 'IVA_GENERAL', true, 7, 15, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Embutidos' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'EMB-003', 'Jamón de Pierna', 'Don Diego', '7861000100465', c.id, 'LB', u.id,
  3.5, 3.1, 12, 'IVA_GENERAL', true, 7, 12, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Embutidos' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'EMB-004', 'Chorizo Ambateño', null, '7861001100471', c.id, 'LB', u.id,
  3.25, 2.9, 12, 'IVA_GENERAL', true, 5, 12, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Embutidos' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LAC-001', 'Leche Entera 1L', 'Vita', '7861002100487', c.id, 'UND', u.id,
  1.1, 0.95, 24, 'IVA_CERO', true, 7, 60, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Lácteos y Huevos' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LAC-002', 'Leche Entera 1L', 'Toni', '7861003100493', c.id, 'UND', u.id,
  1.15, 1, 24, 'IVA_CERO', true, 7, 50, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Lácteos y Huevos' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LAC-003', 'Queso Fresco 500g', 'La Holandesa', '7861004100508', c.id, 'UND', u.id,
  3.25, 2.9, 12, 'IVA_CERO', true, 5, 25, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Lácteos y Huevos' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LAC-004', 'Yogurt Natural 1L', 'Toni', '7861000100519', c.id, 'UND', u.id,
  2.75, 2.4, 12, 'IVA_GENERAL', true, 7, 25, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Lácteos y Huevos' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LAC-005', 'Mantequilla 250g', 'Bonella', '7861001100525', c.id, 'UND', u.id,
  2.2, 1.9, 12, 'IVA_CERO', true, 15, 20, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Lácteos y Huevos' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LAC-006', 'Huevos Cubeta x30', 'Indaves', '7861002100531', c.id, 'UND', u.id,
  4.5, 4, 10, 'IVA_CERO', true, 7, 30, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Lácteos y Huevos' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-001', 'Arroz Flor 2kg', 'Flor', '7861003100547', c.id, 'UND', u.id,
  2.85, 2.5, 12, 'IVA_CERO', true, 60, 60, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Granos y Cereales' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-002', 'Arroz Gustadina 2kg', 'Gustadina', '7861004100553', c.id, 'UND', u.id,
  2.75, 2.4, 12, 'IVA_CERO', true, 60, 50, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Granos y Cereales' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-003', 'Azúcar Blanca 2kg', 'San Carlos', '7861000100564', c.id, 'UND', u.id,
  2.4, 2.1, 12, 'IVA_CERO', true, 60, 50, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Granos y Cereales' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-004', 'Aceite Girasol 1L', 'La Favorita', '7861001100570', c.id, 'UND', u.id,
  2.95, 2.6, 12, 'IVA_CERO', true, 45, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Abarrotes' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-005', 'Fideo Tallarín 400g', 'Oriental', '7861002100586', c.id, 'UND', u.id,
  1.15, 0.95, 24, 'IVA_CERO', true, 60, 60, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Granos y Cereales' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-006', 'Atún en Aceite 180g', 'Real', '7861003100592', c.id, 'UND', u.id,
  1.85, 1.6, 24, 'IVA_CERO', true, 90, 70, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Abarrotes' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-007', 'Sal Yodada 2kg', 'Cris-Sal', '7861004100607', c.id, 'UND', u.id,
  1.1, 0.9, 24, 'IVA_CERO', true, 90, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Abarrotes' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-008', 'Lenteja', null, '7861000100618', c.id, 'LB', u.id,
  1.2, 0.95, 25, 'IVA_CERO', true, 60, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Granos y Cereales' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-009', 'Fréjol Canario Seco', null, '7861001100624', c.id, 'LB', u.id,
  1.6, 1.35, 25, 'IVA_CERO', true, 60, 30, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Granos y Cereales' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-010', 'Quinua', null, '7861002100630', c.id, 'LB', u.id,
  2.5, 2.1, 20, 'IVA_CERO', true, 60, 20, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Granos y Cereales' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-011', 'Morocho Partido', null, '7861003100646', c.id, 'LB', u.id,
  1.1, 0.9, 25, 'IVA_CERO', true, 60, 25, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Granos y Cereales' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-012', 'Machica', null, '7861004100652', c.id, 'LB', u.id,
  1.3, 1.05, 20, 'IVA_CERO', true, 45, 20, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Granos y Cereales' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-013', 'Panela Granulada', null, '7861000100663', c.id, 'LB', u.id,
  1.25, 1, 25, 'IVA_CERO', true, 60, 25, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Abarrotes' and u.codigo = 'LB'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-014', 'Café Instantáneo 170g', 'Nescafé', '7861001100679', c.id, 'UND', u.id,
  6.5, 5.9, 12, 'IVA_GENERAL', true, 90, 25, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Abarrotes' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'ABA-015', 'Avena en Hojuelas 400g', 'Quaker', '7861002100685', c.id, 'UND', u.id,
  1.95, 1.65, 18, 'IVA_CERO', true, 60, 30, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Granos y Cereales' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'BEB-001', 'Coca-Cola 1.35L', 'Coca-Cola', '7861003100691', c.id, 'UND', u.id,
  1.45, 1.25, 24, 'IVA_GENERAL', true, 60, 60, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Bebidas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'BEB-002', 'Fioravanti Fresa 1.35L', 'Fioravanti', '7861004100706', c.id, 'UND', u.id,
  1.35, 1.15, 24, 'IVA_GENERAL', true, 60, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Bebidas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'BEB-003', 'Agua Mineral 1L', 'Güitig', '7861000100717', c.id, 'UND', u.id,
  0.85, 0.7, 24, 'IVA_GENERAL', true, 90, 60, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Bebidas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'BEB-004', 'Agua sin Gas 500ml', 'Tesalia', '7861001100723', c.id, 'UND', u.id,
  0.6, 0.45, 36, 'IVA_GENERAL', true, 90, 80, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Bebidas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'BEB-005', 'Jugo Durazno 1L', 'Del Valle', '7861002100739', c.id, 'UND', u.id,
  1.5, 1.25, 24, 'IVA_GENERAL', true, 45, 35, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Bebidas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'BEB-006', 'Pony Malta 330ml', 'Pony Malta', '7861003100745', c.id, 'UND', u.id,
  0.85, 0.7, 24, 'IVA_GENERAL', true, 60, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Bebidas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'BEB-007', 'Gatorade 500ml', 'Gatorade', '7861004100751', c.id, 'UND', u.id,
  1.25, 1.05, 24, 'IVA_GENERAL', true, 60, 30, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Bebidas' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LIC-001', 'Cerveza Pilsener 600ml', 'Pilsener', '7861000100762', c.id, 'UND', u.id,
  1.75, 1.5, 24, 'IVA_GENERAL', false, 90, 60, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Licores' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LIC-002', 'Cerveza Club Verde 330ml', 'Club', '7861001100778', c.id, 'UND', u.id,
  1.35, 1.15, 24, 'IVA_GENERAL', false, 90, 48, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Licores' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LIC-003', 'Zhumir Durazno 750ml', 'Zhumir', '7861002100784', c.id, 'UND', u.id,
  8.5, 7.6, 12, 'IVA_GENERAL', false, 90, 20, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Licores' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LIC-004', 'Ron San Miguel 750ml', 'San Miguel', '7861003100790', c.id, 'UND', u.id,
  12.5, 11, 12, 'IVA_GENERAL', false, 90, 15, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Licores' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LIC-005', 'Vino Tinto 750ml', 'Clos', '7861004100805', c.id, 'UND', u.id,
  7.9, 7, 12, 'IVA_GENERAL', false, 90, 18, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Licores' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'SNK-001', 'Papas Ruffles 140g', 'Ruffles', '7861000100816', c.id, 'UND', u.id,
  2.35, 2, 24, 'IVA_GENERAL', true, 30, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Snacks y Confitería' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'SNK-002', 'Tortolines 150g', 'Tortolines', '7861001100822', c.id, 'UND', u.id,
  2.1, 1.8, 24, 'IVA_GENERAL', true, 30, 35, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Snacks y Confitería' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'SNK-003', 'Chifles 120g', 'Banchis', '7861002100838', c.id, 'UND', u.id,
  1.75, 1.5, 24, 'IVA_GENERAL', true, 30, 35, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Snacks y Confitería' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'SNK-004', 'Nachos Doritos 145g', 'Doritos', '7861003100844', c.id, 'UND', u.id,
  2.25, 1.95, 24, 'IVA_GENERAL', true, 30, 30, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Snacks y Confitería' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'SNK-005', 'K-Chitos 140g', 'K-Chitos', '7861004100850', c.id, 'UND', u.id,
  1.95, 1.65, 24, 'IVA_GENERAL', true, 30, 30, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Snacks y Confitería' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'SNK-006', 'Galletas Amor 96g', 'Amor', '7861000100861', c.id, 'UND', u.id,
  0.85, 0.7, 36, 'IVA_GENERAL', true, 60, 60, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Snacks y Confitería' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'SNK-007', 'Galletas Oreo 108g', 'Oreo', '7861001100877', c.id, 'UND', u.id,
  1.15, 0.95, 36, 'IVA_GENERAL', true, 60, 50, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Snacks y Confitería' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'SNK-008', 'Chocolate Manicho', 'Manicho', '7861002100883', c.id, 'UND', u.id,
  0.45, 0.35, 48, 'IVA_GENERAL', true, 60, 100, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Snacks y Confitería' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'SNK-009', 'Bon Bon Bum', 'Bon Bon Bum', '7861003100899', c.id, 'UND', u.id,
  0.3, 0.22, 50, 'IVA_GENERAL', true, 90, 120, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Snacks y Confitería' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LIM-001', 'Detergente en Polvo 2kg', 'Deja', '7861004100904', c.id, 'UND', u.id,
  5.5, 4.9, 12, 'IVA_GENERAL', false, 90, 25, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Limpieza' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LIM-002', 'Detergente en Polvo 1kg', 'Fab', '7861000100915', c.id, 'UND', u.id,
  3.25, 2.85, 12, 'IVA_GENERAL', false, 90, 25, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Limpieza' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LIM-003', 'Cloro 1L', 'Tips', '7861001100921', c.id, 'UND', u.id,
  1.25, 1.05, 24, 'IVA_GENERAL', false, 90, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Limpieza' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LIM-004', 'Lavavajilla 1kg', 'Lava', '7861002100937', c.id, 'UND', u.id,
  2.75, 2.4, 12, 'IVA_GENERAL', false, 90, 30, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Limpieza' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LIM-005', 'Papel Higiénico x4', 'Familia', '7861003100943', c.id, 'UND', u.id,
  2.95, 2.55, 12, 'IVA_GENERAL', false, 90, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Limpieza' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LIM-006', 'Desinfectante 1L', 'Sapolio', '7861004100959', c.id, 'UND', u.id,
  2.45, 2.1, 12, 'IVA_GENERAL', false, 90, 25, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Limpieza' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LIM-007', 'Fundas de Basura x10', null, '7861000100960', c.id, 'UND', u.id,
  1.5, 1.25, 24, 'IVA_GENERAL', false, 90, 35, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Limpieza' and u.codigo = 'UND'
on conflict (codigo) do nothing;
insert into productos (
  codigo, nombre, marca, ean13, categoria_id, unidad_medida, unidad_medida_id,
  precio_venta_menor, precio_venta_mayor, cantidad_minima_mayor,
  codigo_impuesto, maneja_lote, dias_alerta_caducidad, stock_minimo, permite_fraccion)
select 'LIM-008', 'Jabón de Tocador 110g', 'Protex', '7861001100976', c.id, 'UND', u.id,
  1.15, 0.95, 24, 'IVA_GENERAL', false, 90, 40, u.permite_fraccion
from categorias c, unidades_medida u
where c.nombre = 'Cuidado Personal' and u.codigo = 'UND'
on conflict (codigo) do nothing;

-- ---------- Ubicación de cada producto ----------
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-001' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 1 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-002' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 1 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-003' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 1 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-004' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 2 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-005' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 2 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-006' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 2 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-007' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 3 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-008' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 3 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-009' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 3 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-010' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 4 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-011' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 4 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-012' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 4 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-013' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'B' and u.estante = 1 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'FRU-014' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'B' and u.estante = 1 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-001' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'B' and u.estante = 1 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-002' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'B' and u.estante = 2 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-003' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'B' and u.estante = 2 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-004' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'B' and u.estante = 2 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-005' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'B' and u.estante = 3 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-006' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'B' and u.estante = 3 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-007' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'B' and u.estante = 3 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-008' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'B' and u.estante = 4 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-009' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'B' and u.estante = 4 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-010' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'B' and u.estante = 4 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-011' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 1 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-012' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 1 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-013' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 1 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-014' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 2 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-015' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 2 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-016' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 2 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-017' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 3 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-018' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 3 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'VER-019' and u.zona_id = z.id and z.codigo = 'PER'
  and u.pasillo = 'A' and u.estante = 3 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'CAR-001' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 1 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'CAR-002' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 1 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'CAR-003' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 2 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'CAR-004' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 2 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'CAR-005' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 3 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'CAR-006' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 3 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'CAR-007' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 1 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'CAR-008' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 1 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'CAR-009' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 2 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'CAR-010' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 2 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'EMB-001' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 3 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'EMB-002' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 3 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'EMB-003' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 1 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'EMB-004' and u.zona_id = z.id and z.codigo = 'CAR'
  and u.pasillo = 'C' and u.estante = 1 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LAC-001' and u.zona_id = z.id and z.codigo = 'LAC'
  and u.pasillo = 'D' and u.estante = 1 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LAC-002' and u.zona_id = z.id and z.codigo = 'LAC'
  and u.pasillo = 'D' and u.estante = 1 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LAC-003' and u.zona_id = z.id and z.codigo = 'LAC'
  and u.pasillo = 'D' and u.estante = 1 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LAC-004' and u.zona_id = z.id and z.codigo = 'LAC'
  and u.pasillo = 'D' and u.estante = 2 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LAC-005' and u.zona_id = z.id and z.codigo = 'LAC'
  and u.pasillo = 'D' and u.estante = 2 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LAC-006' and u.zona_id = z.id and z.codigo = 'LAC'
  and u.pasillo = 'D' and u.estante = 2 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-001' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 1 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-002' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 1 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-003' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 1 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-004' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 1 and u.nivel = 4
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-005' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 2 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-006' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 2 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-007' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 2 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-008' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 2 and u.nivel = 4
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-009' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 3 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-010' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 3 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-011' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 3 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-012' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 3 and u.nivel = 4
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-013' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 4 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-014' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 4 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'ABA-015' and u.zona_id = z.id and z.codigo = 'ABA'
  and u.pasillo = 'E' and u.estante = 4 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'BEB-001' and u.zona_id = z.id and z.codigo = 'BEB'
  and u.pasillo = 'G' and u.estante = 1 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'BEB-002' and u.zona_id = z.id and z.codigo = 'BEB'
  and u.pasillo = 'G' and u.estante = 1 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'BEB-003' and u.zona_id = z.id and z.codigo = 'BEB'
  and u.pasillo = 'G' and u.estante = 1 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'BEB-004' and u.zona_id = z.id and z.codigo = 'BEB'
  and u.pasillo = 'G' and u.estante = 2 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'BEB-005' and u.zona_id = z.id and z.codigo = 'BEB'
  and u.pasillo = 'G' and u.estante = 2 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'BEB-006' and u.zona_id = z.id and z.codigo = 'BEB'
  and u.pasillo = 'G' and u.estante = 2 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'BEB-007' and u.zona_id = z.id and z.codigo = 'BEB'
  and u.pasillo = 'G' and u.estante = 3 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LIC-001' and u.zona_id = z.id and z.codigo = 'LIC'
  and u.pasillo = 'H' and u.estante = 1 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LIC-002' and u.zona_id = z.id and z.codigo = 'LIC'
  and u.pasillo = 'H' and u.estante = 1 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LIC-003' and u.zona_id = z.id and z.codigo = 'LIC'
  and u.pasillo = 'H' and u.estante = 1 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LIC-004' and u.zona_id = z.id and z.codigo = 'LIC'
  and u.pasillo = 'H' and u.estante = 2 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LIC-005' and u.zona_id = z.id and z.codigo = 'LIC'
  and u.pasillo = 'H' and u.estante = 2 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'SNK-001' and u.zona_id = z.id and z.codigo = 'SNK'
  and u.pasillo = 'I' and u.estante = 1 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'SNK-002' and u.zona_id = z.id and z.codigo = 'SNK'
  and u.pasillo = 'I' and u.estante = 1 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'SNK-003' and u.zona_id = z.id and z.codigo = 'SNK'
  and u.pasillo = 'I' and u.estante = 1 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'SNK-004' and u.zona_id = z.id and z.codigo = 'SNK'
  and u.pasillo = 'I' and u.estante = 1 and u.nivel = 4
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'SNK-005' and u.zona_id = z.id and z.codigo = 'SNK'
  and u.pasillo = 'I' and u.estante = 2 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'SNK-006' and u.zona_id = z.id and z.codigo = 'SNK'
  and u.pasillo = 'I' and u.estante = 2 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'SNK-007' and u.zona_id = z.id and z.codigo = 'SNK'
  and u.pasillo = 'I' and u.estante = 2 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'SNK-008' and u.zona_id = z.id and z.codigo = 'SNK'
  and u.pasillo = 'I' and u.estante = 2 and u.nivel = 4
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'SNK-009' and u.zona_id = z.id and z.codigo = 'SNK'
  and u.pasillo = 'I' and u.estante = 3 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LIM-001' and u.zona_id = z.id and z.codigo = 'LIM'
  and u.pasillo = 'J' and u.estante = 1 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LIM-002' and u.zona_id = z.id and z.codigo = 'LIM'
  and u.pasillo = 'J' and u.estante = 1 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LIM-003' and u.zona_id = z.id and z.codigo = 'LIM'
  and u.pasillo = 'J' and u.estante = 1 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LIM-004' and u.zona_id = z.id and z.codigo = 'LIM'
  and u.pasillo = 'J' and u.estante = 2 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LIM-005' and u.zona_id = z.id and z.codigo = 'LIM'
  and u.pasillo = 'J' and u.estante = 2 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LIM-006' and u.zona_id = z.id and z.codigo = 'LIM'
  and u.pasillo = 'J' and u.estante = 2 and u.nivel = 3
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LIM-007' and u.zona_id = z.id and z.codigo = 'LIM'
  and u.pasillo = 'J' and u.estante = 3 and u.nivel = 1
on conflict (producto_id, ubicacion_id) do nothing;
insert into producto_ubicacion (producto_id, ubicacion_id, es_principal)
select p.id, u.id, true
from productos p, ubicaciones u, zonas z
where p.codigo = 'LIM-008' and u.zona_id = z.id and z.codigo = 'LIM'
  and u.pasillo = 'J' and u.estante = 3 and u.nivel = 2
on conflict (producto_id, ubicacion_id) do nothing;

-- ---------- Promociones de temporada ----------
insert into promociones (codigo, nombre, temporada, tipo, cantidad, valor, vigencia_desde, vigencia_hasta, aplica_tipo_venta, prioridad)
values ('PROMO-LIMON-3X1', '3 limones por $1', 'Permanente', 'N_POR_DOLAR', 3, 1, '2026-01-01', '2026-12-31', 'MENOR', 10)
on conflict (codigo) do nothing;
insert into promocion_alcance (promocion_id, producto_id)
select pr.id, p.id from promociones pr, productos p
where pr.codigo = 'PROMO-LIMON-3X1' and p.codigo = 'FRU-013'
and not exists (select 1 from promocion_alcance pa where pa.promocion_id = pr.id and pa.producto_id = p.id);
insert into promociones (codigo, nombre, temporada, tipo, cantidad, valor, vigencia_desde, vigencia_hasta, aplica_tipo_venta, prioridad)
values ('PROMO-NARANJA-4X1', '4 naranjas por $1', 'Cosecha', 'N_POR_DOLAR', 4, 1, '2026-01-01', '2026-12-31', 'MENOR', 10)
on conflict (codigo) do nothing;
insert into promocion_alcance (promocion_id, producto_id)
select pr.id, p.id from promociones pr, productos p
where pr.codigo = 'PROMO-NARANJA-4X1' and p.codigo = 'FRU-003'
and not exists (select 1 from promocion_alcance pa where pa.promocion_id = pr.id and pa.producto_id = p.id);
insert into promociones (codigo, nombre, temporada, tipo, cantidad, valor, vigencia_desde, vigencia_hasta, aplica_tipo_venta, prioridad)
values ('PROMO-SNACK-2X1', '2x1 en snacks seleccionados', 'Fin de semana', 'N_POR_M', 2, 1, '2026-01-01', '2026-12-31', 'MENOR', 5)
on conflict (codigo) do nothing;
insert into promocion_alcance (promocion_id, producto_id)
select pr.id, p.id from promociones pr, productos p
where pr.codigo = 'PROMO-SNACK-2X1' and p.codigo = 'SNK-006'
and not exists (select 1 from promocion_alcance pa where pa.promocion_id = pr.id and pa.producto_id = p.id);
insert into promocion_alcance (promocion_id, producto_id)
select pr.id, p.id from promociones pr, productos p
where pr.codigo = 'PROMO-SNACK-2X1' and p.codigo = 'SNK-008'
and not exists (select 1 from promocion_alcance pa where pa.promocion_id = pr.id and pa.producto_id = p.id);
insert into promociones (codigo, nombre, temporada, tipo, cantidad, valor, vigencia_desde, vigencia_hasta, aplica_tipo_venta, prioridad)
values ('PROMO-LICOR-NAVIDAD', '20% en licores por Navidad', 'Navidad', 'PORCENTAJE', null, 20, '2026-12-01', '2026-12-31', 'AMBAS', 8)
on conflict (codigo) do nothing;
insert into promocion_alcance (promocion_id, categoria_id)
select pr.id, c.id from promociones pr, categorias c
where pr.codigo = 'PROMO-LICOR-NAVIDAD' and c.nombre = 'Licores'
and not exists (select 1 from promocion_alcance pa where pa.promocion_id = pr.id and pa.categoria_id = c.id);
insert into promociones (codigo, nombre, temporada, tipo, cantidad, valor, vigencia_desde, vigencia_hasta, aplica_tipo_venta, prioridad)
values ('PROMO-PAPA-FIJO', 'Papa chola a $0.40 la libra', 'Cosecha', 'PRECIO_FIJO', null, 0.4, '2026-01-01', '2026-12-31', 'AMBAS', 6)
on conflict (codigo) do nothing;
insert into promocion_alcance (promocion_id, producto_id)
select pr.id, p.id from promociones pr, productos p
where pr.codigo = 'PROMO-PAPA-FIJO' and p.codigo = 'VER-001'
and not exists (select 1 from promocion_alcance pa where pa.promocion_id = pr.id and pa.producto_id = p.id);

-- ---------- Ingreso inicial de mercadería ----------
-- Se crea un documento de ingreso por proveedor y se confirma, lo que
-- genera automáticamente los lotes y los movimientos de kardex.
-- Solo se ejecuta si aún no existe un ingreso con esta referencia.
do $$
declare
  v_bodega uuid;
  v_doc uuid;
  v_prov uuid;
begin
  select id into v_bodega from bodegas where nombre = 'Bodega Principal';
  if exists (select 1 from documentos_ingreso where numero_documento = '001-001-000000001') then
    raise notice 'El ingreso inicial ya fue cargado; se omite.';
    return;
  end if;


  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000001', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 90, 0.22, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-001', current_date + 12 from productos where codigo = 'FRU-001';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 60, 0.58, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-002', current_date + 25 from productos where codigo = 'FRU-002';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 300, 0.07, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-003', current_date + 20 from productos where codigo = 'FRU-003';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 45, 0.78, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-004', current_date + 10 from productos where codigo = 'FRU-004';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 60, 0.55, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-005', current_date + 14 from productos where codigo = 'FRU-005';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000002', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 30, 1.6, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-006', current_date + 15 from productos where codigo = 'FRU-006';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 0.22, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-007', current_date + 14 from productos where codigo = 'FRU-007';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 36, 1.1, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-008', current_date + 6 from productos where codigo = 'FRU-008';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 36, 0.95, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-009', current_date + 12 from productos where codigo = 'FRU-009';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 30, 1.25, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-010', current_date + 10 from productos where codigo = 'FRU-010';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000003', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 45, 0.92, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-011', current_date + 14 from productos where codigo = 'FRU-011';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 45, 0.62, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-012', current_date + 15 from productos where codigo = 'FRU-012';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 75, 0.45, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-013', current_date + 20 from productos where codigo = 'FRU-013';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 90, 0.45, 'L-' || to_char(current_date, 'YYYYMMDD') || '-FRU-014', current_date + 10 from productos where codigo = 'FRU-014';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 300, 0.27, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-001', current_date + 30 from productos where codigo = 'VER-001';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000004', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 240, 0.31, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-002', current_date + 30 from productos where codigo = 'VER-002';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 150, 0.35, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-003', current_date + 30 from productos where codigo = 'VER-003';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 75, 0.45, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-004', current_date + 8 from productos where codigo = 'VER-004';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 0.42, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-005', current_date + 10 from productos where codigo = 'VER-005';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 0.3, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-006', current_date + 25 from productos where codigo = 'VER-006';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000005', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 60, 0.55, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-007', current_date + 8 from productos where codigo = 'VER-007';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 60, 0.48, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-008', current_date + 14 from productos where codigo = 'VER-008';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 75, 0.35, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-009', current_date + 7 from productos where codigo = 'VER-009';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 0.3, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-010', current_date + 8 from productos where codigo = 'VER-010';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 45, 0.75, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-011', current_date + 8 from productos where codigo = 'VER-011';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000006', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 45, 0.82, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-012', current_date + 8 from productos where codigo = 'VER-012';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 45, 0.62, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-013', current_date + 8 from productos where codigo = 'VER-013';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 90, 0.27, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-014', current_date + 18 from productos where codigo = 'VER-014';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 60, 0.36, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-015', current_date + 30 from productos where codigo = 'VER-015';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 54, 0.55, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-016', current_date + 12 from productos where codigo = 'VER-016';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000007', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 30, 0.95, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-017', current_date + 12 from productos where codigo = 'VER-017';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 90, 0.16, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-018', current_date + 5 from productos where codigo = 'VER-018';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 90, 0.16, 'L-' || to_char(current_date, 'YYYYMMDD') || '-VER-019', current_date + 5 from productos where codigo = 'VER-019';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 75, 1.95, 'L-' || to_char(current_date, 'YYYYMMDD') || '-CAR-001', current_date + 5 from productos where codigo = 'CAR-001';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 45, 3.35, 'L-' || to_char(current_date, 'YYYYMMDD') || '-CAR-002', current_date + 5 from productos where codigo = 'CAR-002';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000008', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 60, 1.78, 'L-' || to_char(current_date, 'YYYYMMDD') || '-CAR-003', current_date + 5 from productos where codigo = 'CAR-003';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 1.62, 'L-' || to_char(current_date, 'YYYYMMDD') || '-CAR-004', current_date + 6 from productos where codigo = 'CAR-004';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 105, 1.32, 'L-' || to_char(current_date, 'YYYYMMDD') || '-CAR-005', current_date + 6 from productos where codigo = 'CAR-005';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 90, 1.4, 'L-' || to_char(current_date, 'YYYYMMDD') || '-CAR-006', current_date + 6 from productos where codigo = 'CAR-006';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 60, 1.86, 'L-' || to_char(current_date, 'YYYYMMDD') || '-CAR-007', current_date + 5 from productos where codigo = 'CAR-007';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000009', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 54, 1.72, 'L-' || to_char(current_date, 'YYYYMMDD') || '-CAR-008', current_date + 5 from productos where codigo = 'CAR-008';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 45, 2, 'L-' || to_char(current_date, 'YYYYMMDD') || '-CAR-009', current_date + 4 from productos where codigo = 'CAR-009';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 30, 3.15, 'L-' || to_char(current_date, 'YYYYMMDD') || '-CAR-010', current_date + 4 from productos where codigo = 'CAR-010';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 60, 1.78, 'L-' || to_char(current_date, 'YYYYMMDD') || '-EMB-001', current_date + 45 from productos where codigo = 'EMB-001';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 45, 1.6, 'L-' || to_char(current_date, 'YYYYMMDD') || '-EMB-002', current_date + 30 from productos where codigo = 'EMB-002';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000010', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 36, 2.52, 'L-' || to_char(current_date, 'YYYYMMDD') || '-EMB-003', current_date + 30 from productos where codigo = 'EMB-003';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 36, 2.35, 'L-' || to_char(current_date, 'YYYYMMDD') || '-EMB-004', current_date + 20 from productos where codigo = 'EMB-004';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 180, 0.82, 'L-' || to_char(current_date, 'YYYYMMDD') || '-LAC-001', current_date + 21 from productos where codigo = 'LAC-001';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 150, 0.86, 'L-' || to_char(current_date, 'YYYYMMDD') || '-LAC-002', current_date + 21 from productos where codigo = 'LAC-002';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 75, 2.38, 'L-' || to_char(current_date, 'YYYYMMDD') || '-LAC-003', current_date + 15 from productos where codigo = 'LAC-003';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000011', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 75, 1.98, 'L-' || to_char(current_date, 'YYYYMMDD') || '-LAC-004', current_date + 25 from productos where codigo = 'LAC-004';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 60, 1.58, 'L-' || to_char(current_date, 'YYYYMMDD') || '-LAC-005', current_date + 60 from productos where codigo = 'LAC-005';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 90, 3.3, 'L-' || to_char(current_date, 'YYYYMMDD') || '-LAC-006', current_date + 21 from productos where codigo = 'LAC-006';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 180, 2.05, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-001', current_date + 365 from productos where codigo = 'ABA-001';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 150, 1.98, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-002', current_date + 365 from productos where codigo = 'ABA-002';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000012', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 150, 1.72, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-003', current_date + 540 from productos where codigo = 'ABA-003';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 2.15, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-004', current_date + 365 from productos where codigo = 'ABA-004';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 180, 0.82, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-005', current_date + 540 from productos where codigo = 'ABA-005';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 210, 1.32, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-006', current_date + 730 from productos where codigo = 'ABA-006';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 0.78, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-007', current_date + 900 from productos where codigo = 'ABA-007';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000013', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 0.85, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-008', current_date + 365 from productos where codigo = 'ABA-008';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 90, 1.15, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-009', current_date + 365 from productos where codigo = 'ABA-009';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 60, 1.8, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-010', current_date + 365 from productos where codigo = 'ABA-010';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 75, 0.78, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-011', current_date + 365 from productos where codigo = 'ABA-011';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 60, 0.92, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-012', current_date + 180 from productos where codigo = 'ABA-012';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000014', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 75, 0.88, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-013', current_date + 365 from productos where codigo = 'ABA-013';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 75, 4.85, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-014', current_date + 730 from productos where codigo = 'ABA-014';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 90, 1.38, 'L-' || to_char(current_date, 'YYYYMMDD') || '-ABA-015', current_date + 365 from productos where codigo = 'ABA-015';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 180, 1.05, 'L-' || to_char(current_date, 'YYYYMMDD') || '-BEB-001', current_date + 270 from productos where codigo = 'BEB-001';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 0.98, 'L-' || to_char(current_date, 'YYYYMMDD') || '-BEB-002', current_date + 270 from productos where codigo = 'BEB-002';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000015', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 180, 0.6, 'L-' || to_char(current_date, 'YYYYMMDD') || '-BEB-003', current_date + 365 from productos where codigo = 'BEB-003';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 240, 0.4, 'L-' || to_char(current_date, 'YYYYMMDD') || '-BEB-004', current_date + 365 from productos where codigo = 'BEB-004';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 105, 1.08, 'L-' || to_char(current_date, 'YYYYMMDD') || '-BEB-005', current_date + 180 from productos where codigo = 'BEB-005';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 0.6, 'L-' || to_char(current_date, 'YYYYMMDD') || '-BEB-006', current_date + 240 from productos where codigo = 'BEB-006';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 90, 0.9, 'L-' || to_char(current_date, 'YYYYMMDD') || '-BEB-007', current_date + 270 from productos where codigo = 'BEB-007';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000016', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 180, 1.28, null, null from productos where codigo = 'LIC-001';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 144, 0.98, null, null from productos where codigo = 'LIC-002';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 60, 6.3, null, null from productos where codigo = 'LIC-003';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 45, 9.4, null, null from productos where codigo = 'LIC-004';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 54, 5.85, null, null from productos where codigo = 'LIC-005';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000017', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 1.68, 'L-' || to_char(current_date, 'YYYYMMDD') || '-SNK-001', current_date + 120 from productos where codigo = 'SNK-001';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 105, 1.5, 'L-' || to_char(current_date, 'YYYYMMDD') || '-SNK-002', current_date + 120 from productos where codigo = 'SNK-002';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 105, 1.25, 'L-' || to_char(current_date, 'YYYYMMDD') || '-SNK-003', current_date + 90 from productos where codigo = 'SNK-003';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 90, 1.6, 'L-' || to_char(current_date, 'YYYYMMDD') || '-SNK-004', current_date + 120 from productos where codigo = 'SNK-004';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 90, 1.38, 'L-' || to_char(current_date, 'YYYYMMDD') || '-SNK-005', current_date + 120 from productos where codigo = 'SNK-005';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000018', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 180, 0.58, 'L-' || to_char(current_date, 'YYYYMMDD') || '-SNK-006', current_date + 240 from productos where codigo = 'SNK-006';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 150, 0.8, 'L-' || to_char(current_date, 'YYYYMMDD') || '-SNK-007', current_date + 270 from productos where codigo = 'SNK-007';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 300, 0.3, 'L-' || to_char(current_date, 'YYYYMMDD') || '-SNK-008', current_date + 180 from productos where codigo = 'SNK-008';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 360, 0.18, 'L-' || to_char(current_date, 'YYYYMMDD') || '-SNK-009', current_date + 365 from productos where codigo = 'SNK-009';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 75, 4.1, null, null from productos where codigo = 'LIM-001';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000019', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 75, 2.38, null, null from productos where codigo = 'LIM-002';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 0.88, null, null from productos where codigo = 'LIM-003';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 90, 2, null, null from productos where codigo = 'LIM-004';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 2.15, null, null from productos where codigo = 'LIM-005';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 75, 1.78, null, null from productos where codigo = 'LIM-006';

  select id into v_prov from proveedores where ruc = '1790016919001';
  insert into documentos_ingreso (proveedor_id, bodega_id, tipo_documento, numero_documento, fecha_emision, observacion)
  values (v_prov, v_bodega, 'FACTURA', '001-001-000000020', current_date, 'Carga inicial de inventario')
  returning id into v_doc;
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 105, 1.05, null, null from productos where codigo = 'LIM-007';
  insert into ingreso_detalle (documento_ingreso_id, producto_id, cantidad, costo_unitario, codigo_lote, fecha_caducidad)
  select v_doc, id, 120, 0.8, null, null from productos where codigo = 'LIM-008';

  -- Confirmar todos los ingresos creados en este bloque
  update documentos_ingreso set estado = 'CONFIRMADO'
  where estado = 'BORRADOR' and observacion = 'Carga inicial de inventario';
end $$;

-- ---------- Verificación ----------
select 'Productos cargados' as concepto, count(*)::text as valor from productos
union all select 'Con EAN-13 válido', count(*)::text from productos where fn_validar_ean13(ean13) and ean13 is not null
union all select 'Ubicaciones creadas', count(*)::text from ubicaciones
union all select 'Lotes generados', count(*)::text from lotes
union all select 'Valor del inventario', '$' || round(sum(stock * costo_promedio), 2)::text from inventario_saldos;

