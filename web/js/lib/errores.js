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

  empresa: '008_roles_seguridad.sql',
  perfiles_usuario: '008_roles_seguridad.sql',
  tokens_autorizacion: '008_roles_seguridad.sql',
  tokens_uso: '008_roles_seguridad.sql',

  v_comprobante: '009_comprobantes_clientes.sql',

  sedes: '010_operacion_multisede.sql',
  roles_catalogo: '010_operacion_multisede.sql',
  modulos_sistema: '010_operacion_multisede.sql',
  permisos_rol: '010_operacion_multisede.sql',
  correo_config: '010_operacion_multisede.sql',
  plantillas_correo: '010_operacion_multisede.sql',
  cola_correo: '010_operacion_multisede.sql',
  ordenes_compra: '010_operacion_multisede.sql',
  orden_compra_detalle: '010_operacion_multisede.sql',
  v_sugerencia_reposicion: '010_operacion_multisede.sql',

  tipos_negocio: '011_instalacion_deuna.sql',
  instalacion: '011_instalacion_deuna.sql',
  deuna_transacciones: '011_instalacion_deuna.sql',

  tipos_estructura: '012_estructuras_servicios.sql',
  estructuras: '012_estructuras_servicios.sql',
  servicios_catalogo: '012_estructuras_servicios.sql',
  ventas_servicio: '012_estructuras_servicios.sql',
  accesos_externos: '012_estructuras_servicios.sql',
  v_estructuras_ocupacion: '012_estructuras_servicios.sql',
  v_posiciones: '012_estructuras_servicios.sql',
  v_servicios_detalle: '012_estructuras_servicios.sql',
  v_resumen_mensual: '012_estructuras_servicios.sql',

  v_lotes_disponibles: '013_seguridad_vistas.sql',

  presentaciones: '015_presentaciones_codigos.sql',
  producto_codigos: '015_presentaciones_codigos.sql',
  v_stock_presentacion: '015_presentaciones_codigos.sql',
  v_producto_codigos: '015_presentaciones_codigos.sql',
  v_recepcion_vs_orden: '015_presentaciones_codigos.sql',

  proveedor_producto: '017_facturas_proveedor.sql',
};

// v_comprobante se rehace en la 014 para llevar el ancho del rollo, así
// que si falta hay que ejecutar desde la 009 igual: la lista de
// pendientes que sale abajo ya incluye la 014 por ir después.

// Todos los archivos, en el orden en que hay que ejecutarlos. La lista
// vive aquí para que el mensaje de error pueda decir exactamente cuáles
// faltan a partir de la que crea la tabla que dio problema, en vez de
// repetir una lista escrita a mano que se queda vieja —que es lo que
// pasó: el aviso seguía diciendo "002, 003, 004, 005" cuando el sistema
// ya iba por la 013.
const ORDEN_MIGRACIONES = [
  'schema.sql',
  '002_catalogos_ubicaciones.sql',
  '003_ingresos.sql',
  '004_ventas_promociones.sql',
  '005_auditoria_vistas.sql',
  '006_seed_ecuador.sql',
  '007_realtime.sql',
  '008_roles_seguridad.sql',
  '009_comprobantes_clientes.sql',
  '010_operacion_multisede.sql',
  '011_instalacion_deuna.sql',
  '012_estructuras_servicios.sql',
  '013_seguridad_vistas.sql',
  '014_impresion_termica.sql',
  '015_presentaciones_codigos.sql',
  '016_plano_editable.sql',
  '017_facturas_proveedor.sql',
];

/** Migraciones desde la que crea la tabla que falta, en adelante. */
function pendientesDesde(migracion) {
  const i = ORDEN_MIGRACIONES.indexOf(migracion);
  if (i === -1) return [];
  // El catálogo de ejemplo se salta: no se ejecuta sobre datos reales.
  return ORDEN_MIGRACIONES.slice(i).filter((m) => m !== '006_seed_ecuador.sql');
}

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
    const pendientes = pendientesDesde(migracion);

    return `
      <div class="aviso-migracion">
        <h3>Falta aplicar una migración en la base de datos</h3>
        <p>Esta pantalla necesita <code>${faltante}</code>, que todavía no existe en su
        proyecto de Supabase.</p>

        ${migracion ? `
          <p>Lo crea el archivo <b>db/${migracion}</b>. Como las migraciones van
          encadenadas, desde ahí en adelante hay que ejecutar <b>todas</b>:</p>
          <ol class="lista-migraciones">
            ${pendientes.map((m) => `<li><code>db/${m}</code></li>`).join('')}
          </ol>
          <p class="nota">Son re-ejecutables: volver a correr una ya aplicada no rompe nada.
          Si alguna estaba puesta, simplemente no hará cambios.</p>
        ` : `
          <ol>
            <li>Abra su proyecto en Supabase → <b>SQL Editor</b>.</li>
            <li>Ejecute <code>db/000_diagnostico.sql</code>: le dirá con nombre y apellido
                qué archivos faltan y en qué orden.</li>
            <li>Ejecute los que falten y recargue esta página.</li>
          </ol>`}

        <p>Para verlo todo de una vez, ejecute <code>db/000_diagnostico.sql</code> en el
        <b>SQL Editor</b> de Supabase: lista los archivos pendientes y refresca el caché.</p>

        <p class="nota">Si el diagnóstico dice que todas están aplicadas y el error sigue,
        es el caché de PostgREST: el propio diagnóstico lo refresca al final. Recargue la
        página con Ctrl+F5.</p>
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
      <p>La política de seguridad de la base (RLS) bloqueó la consulta.</p>
      <p class="nota">Compruebe que inició sesión, que su usuario tiene un perfil con rol
      asignado en <b>Administración → Usuarios</b>, y que las migraciones de seguridad
      (<code>db/008_roles_seguridad.sql</code> y <code>db/013_seguridad_vistas.sql</code>)
      están aplicadas.</p></div>`;
  }

  const div = document.createElement('div');
  div.textContent = mensaje;
  return `<p class="error">${div.innerHTML}</p>`;
}
