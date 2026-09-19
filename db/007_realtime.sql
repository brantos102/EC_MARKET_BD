-- =========================================================
-- CENTRO DE CONTROL - MARKET
-- Migración 007: sincronización en tiempo real del stock
--
-- Permite que el punto de venta de una caja se entere al instante
-- cuando otra caja vende, en vez de descubrirlo al confirmar.
--
-- Requiere: 005_auditoria_vistas.sql
-- =========================================================

-- Supabase Realtime transmite los cambios de las tablas que estén en la
-- publicación 'supabase_realtime'. Solo se publica inventario_saldos:
-- es lo único que el punto de venta necesita vigilar, y publicar de más
-- significa mandar tráfico innecesario a cada navegador conectado.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventario_saldos'
  ) then
    alter publication supabase_realtime add table inventario_saldos;
  end if;
exception
  when undefined_object then
    raise notice 'La publicación supabase_realtime no existe en esta base (normal fuera de Supabase). Se omite.';
end $$;

-- Para que el payload de UPDATE incluya las columnas necesarias
-- (bodega_id y producto_id, que forman la clave primaria), basta con
-- la identidad por defecto. Se deja explícito para que no dependa de
-- configuraciones heredadas.
alter table inventario_saldos replica identity default;

select 'Realtime habilitado para inventario_saldos.' as resultado;
