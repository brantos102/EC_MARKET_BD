// Traducción de errores de Supabase a algo que el operador entienda.
//
// PostgREST devuelve "Could not find the table 'public.X' in the schema cache"
// tanto cuando la tabla no existe como cuando su caché está desactualizado.
// Ese mensaje no le dice nada a quien opera el market, así que se mapea cada
// tabla a la migración que la crea y se explica qué hacer.

const MIGRACION_POR_TABLA = {
  productos: '001 schema.sql',
  bodegas: '001 schema.sql',
  categorias: '001 schema.sql',
  movimientos_inventario: '001 schema.sql',
  inventario_saldos: '001 schema.sql',

  unidades_medida: '002_catalogos_ubicaciones.sql',
  tarifas_impuesto: '002_catalogos_ubicaciones.sql',
  proveedores: '002_catalogos_ubicaciones.sql',
  clientes: '002_catalogos_ubicaciones.sql',
  zonas: '002_catalogos_ubicaciones.sql',
  ubicaciones: '002_catalogos_ubicaciones.sql',
  producto_ubicacion: '002_catalogos_ubicaciones.sql',
  lotes: '002_catalogos_ubicaciones.sql',

  documentos_ingreso: '003_ingresos.sql',
  ingreso_detalle: '003_ingresos.sql',
  secuencias: '003_ingresos.sql',

  promociones: '004_ventas_promociones.sql',
  promocion_alcance: '004_ventas_promociones.sql',
  ventas: '004_ventas_promociones.sql',
  venta_detalle: '004_ventas_promociones.sql',
  pagos_venta: '004_ventas_promociones.sql',

  auditoria_log: '005_auditoria_vistas.sql',
  v_stock_actual: '005_auditoria_vistas.sql',
  v_alertas_caducidad: '005_auditoria_vistas.sql',
  v_ocupacion_layout: '005_auditoria_vistas.sql',
  v_pos_productos: '005_auditoria_vistas.sql',
  v_ventas_resumen: '005_auditoria_vistas.sql',
  v_productos_mas_vendidos: '005_auditoria_vistas.sql',
};

/**
 * Devuelve HTML listo para insertar, explicando el error en términos útiles.
 * @param {{message?: string, code?: string}} error
 * @param {string} [tablaEsperada] tabla que el módulo intentaba consultar
 */
export function traducirErrorSupabase(error, tablaEsperada) {
  const mensaje = error?.message ?? String(error);

  const faltante = mensaje.match(/'public\.([a-z0-9_]+)'/i)?.[1] ?? tablaEsperada;
  const esTablaFaltante = /schema cache|does not exist|Could not find the table/i.test(mensaje);

  if (esTablaFaltante && faltante) {
    const migracion = MIGRACION_POR_TABLA[faltante];
    return `
      <div class="aviso-migracion">
        <h3>Falta aplicar una migración en la base de datos</h3>
        <p>Este módulo necesita <code>${faltante}</code>, que todavía no existe en tu proyecto de Supabase.</p>
        ${migracion ? `<p>La crea el archivo <b>db/${migracion}</b>.</p>` : ''}
        <ol>
          <li>Abre tu proyecto en Supabase → <b>SQL Editor</b>.</li>
          <li>Ejecuta <code>db/000_diagnostico.sql</code> para ver exactamente qué migraciones faltan.</li>
          <li>Ejecuta las que falten <b>en orden numérico</b> (002, 003, 004, 005 y opcionalmente 006).</li>
          <li>Recarga esta página.</li>
        </ol>
        <p class="nota">Si el diagnóstico dice que todas están aplicadas y el error sigue,
        es el caché de PostgREST: el propio diagnóstico lo refresca al final.</p>
      </div>`;
  }

  if (/JWT|not authenticated|401/i.test(mensaje)) {
    return `<div class="aviso-migracion">
      <h3>Sesión expirada</h3>
      <p>Vuelve a iniciar sesión para continuar.</p></div>`;
  }

  if (/permission denied|row-level security|42501/i.test(mensaje)) {
    return `<div class="aviso-migracion">
      <h3>Sin permisos sobre estos datos</h3>
      <p>La política de seguridad (RLS) bloqueó la consulta. Verifica que iniciaste
      sesión y que las políticas de la migración correspondiente se aplicaron.</p></div>`;
  }

  const div = document.createElement('div');
  div.textContent = mensaje;
  return `<p class="error">${div.innerHTML}</p>`;
}
