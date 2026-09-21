-- =========================================================
-- CENTRO DE CONTROL
-- Migración 014: ancho del rollo de la impresora térmica
--
-- QUÉ PROBLEMA RESUELVE
--
-- El recibo se estaba maquetando e imprimiendo en A4. En el papel de
-- una térmica de mostrador eso significa que el navegador compone una
-- hoja de 210 mm y la manda a una impresora de 80 mm: sale el recibo
-- arrinconado arriba a la izquierda, con la columna de los valores
-- cortada y metros de papel en blanco detrás.
--
-- La corrección de fondo está en la aplicación (web/js/lib/comprobante.js),
-- que ahora declara @page con el ancho del rollo. Pero el ancho no puede
-- ir escrito a mano en el código: no todos los locales usan el mismo
-- rollo. Aquí se guarda como dato de la empresa.
--
-- LOS DOS ANCHOS QUE EXISTEN EN ECUADOR
--   · 80 mm — el estándar de mostrador (Epson TM-T20 / TM-T88, Xprinter
--     XP-80, Bixolon SRP-350). Zona imprimible: 72 mm.
--   · 58 mm — portátiles, parqueaderos, cobro en ruta. Zona imprimible:
--     48 mm.
-- El ancho del PAPEL y el ancho IMPRIMIBLE no son el mismo número: el
-- cabezal no llega al borde. Esa conversión la hace la aplicación; aquí
-- solo se guarda el papel que compra el negocio, que es lo que el
-- administrador sabe.
--
-- Requiere: 013_seguridad_vistas.sql
-- =========================================================

-- ---------------------------------------------------------
-- PARTE 1 — El dato
-- ---------------------------------------------------------
alter table empresa
  add column if not exists ancho_papel_mm smallint not null default 80;

-- Se limita a los dos anchos reales. Un valor inventado (72, 76, 110)
-- no produciría un error visible: produciría recibos torcidos durante
-- semanas hasta que alguien se diera cuenta.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'empresa_ancho_papel_valido'
      and conrelid = 'empresa'::regclass
  ) then
    alter table empresa
      add constraint empresa_ancho_papel_valido check (ancho_papel_mm in (58, 80));
  end if;
end $$;

comment on column empresa.ancho_papel_mm is
  'Ancho del rollo de la impresora térmica en milímetros: 80 (mostrador) o 58 (portátil). '
  'La zona imprimible es menor que el papel: 72 mm y 48 mm respectivamente.';

-- ---------------------------------------------------------
-- PARTE 2 — Exponerlo en el comprobante
--
-- La caja lee una sola fila para imprimir (v_comprobante). Si el ancho
-- no viaja ahí, habría que hacer una segunda consulta a empresa en cada
-- venta solo para saber el tamaño del papel.
--
-- Se recrea la vista con security_invoker, como dejó la migración 013:
-- un CREATE OR REPLACE sin esa opción la devolvería a SECURITY DEFINER
-- y reaparecería el aviso CRITICAL del analizador de Supabase.
-- ---------------------------------------------------------
drop view if exists v_comprobante cascade;
create view v_comprobante
with (security_invoker = true)
as
select
  v.id as venta_id,
  v.numero_interno,
  v.numero_comprobante,
  v.tipo_comprobante,
  v.fecha,
  v.created_at,
  v.confirmada_at,
  v.cajero_nombre,
  v.subtotal,
  v.descuento,
  v.valor_impuesto,
  v.total,
  v.estado,
  v.tipo_venta,
  c.tipo_identificacion,
  c.identificacion as cliente_identificacion,
  c.nombre as cliente_nombre,
  c.direccion as cliente_direccion,
  c.telefono as cliente_telefono,
  c.email as cliente_email,
  e.razon_social,
  e.nombre_comercial,
  e.ruc,
  e.direccion_matriz,
  e.direccion_establecimiento,
  e.telefono as empresa_telefono,
  e.email as empresa_email,
  e.obligado_contabilidad,
  e.contribuyente_especial,
  e.ambiente,
  e.pie_recibo,
  e.logo_url,
  e.ancho_papel_mm
from ventas v
join clientes c on c.id = v.cliente_id
cross join (select * from empresa limit 1) e;

comment on view v_comprobante is
  'Todo lo que necesita el papel de una venta en una sola fila, incluido el ancho del rollo. '
  'El logotipo (logo_url) sigue aquí para la pantalla y los PDF: en la térmica no se imprime.';

notify pgrst, 'reload schema';

select 'Migración 014 aplicada: ancho del rollo térmico (80/58 mm) configurable.' as resultado;
