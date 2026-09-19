// Supabase simulado para pruebas de interfaz sin red.
// Implementa solo lo que la aplicación usa: el encadenado de consultas,
// insert/update y el objeto auth. Los datos son fijos y las escrituras
// quedan registradas en window.__ESCRITURAS para poder verificarlas.
//
// NO forma parte de la aplicación: solo lo carga tests/harness/index.html.

(function () {
  window.__ESCRITURAS = [];

  const BODEGA = 'bod-1';

  const DATOS = {
    bodegas: [{ id: BODEGA, nombre: 'Bodega Principal', activa: true }],
    clientes: [
      { id: 'cli-1', identificacion: '9999999999999', nombre: 'CONSUMIDOR FINAL',
        tipo_identificacion: 'CONSUMIDOR_FINAL', activo: true },
      { id: 'cli-2', identificacion: '1710034065', nombre: 'MARIA LOPEZ',
        tipo_identificacion: 'CEDULA', email: 'maria@correo.ec', telefono: '0999123456', activo: true },
    ],
    promociones: [
      {
        id: 'promo-1',
        nombre: '3 x $1',
        tipo: 'N_POR_DOLAR',
        cantidad: 3,
        valor: 1.0,
        aplica_tipo_venta: 'MENOR',
        prioridad: 10,
        activa: true,
        vigencia_desde: '2000-01-01',
        vigencia_hasta: '2099-12-31',
        promocion_alcance: [{ producto_id: 'prod-limon', categoria_id: null }],
      },
    ],
    perfiles_usuario: [
      { usuario_id: 'u-1', nombre: 'prueba@itsanet.com', rol: 'ADMIN', activo: true,
        created_at: '2026-09-01T10:00:00Z' },
      { usuario_id: 'u-2', nombre: 'cajera@itsanet.com', rol: 'VENDEDOR', activo: true,
        created_at: '2026-09-10T10:00:00Z' },
    ],
    tokens_autorizacion: [],
    sedes: [
      { id: 'sede-1', codigo: '001', nombre: 'Matriz', direccion: 'Quito',
        telefono: '02-2000000', punto_emision: '001', es_matriz: true, activa: true },
      { id: 'sede-2', codigo: '002', nombre: 'Sucursal Norte', direccion: 'Carcelén',
        telefono: null, punto_emision: '001', es_matriz: false, activa: true },
    ],
    roles_catalogo: [
      { codigo: 'ADMIN', nombre: 'Administrador', descripcion: 'Configura todo el sistema.', nivel: 1, activo: true },
      { codigo: 'SUPERVISOR', nombre: 'Supervisor de tienda', descripcion: 'Todo lo operativo, sin administración.', nivel: 2, activo: true },
      { codigo: 'BODEGUERO', nombre: 'Bodeguero', descripcion: 'Recibe y ubica mercadería.', nivel: 3, activo: true },
      { codigo: 'VENDEDOR', nombre: 'Cajero / Vendedor', descripcion: 'Atiende la caja.', nivel: 4, activo: true },
    ],
    modulos_sistema: [
      { codigo: 'dashboard', nombre: 'Dashboard', grupo: 'Operación', icono: 'tablero', orden: 10, activo: true },
      { codigo: 'pos', nombre: 'Punto de venta', grupo: 'Operación', icono: 'carrito', orden: 20, activo: true },
      { codigo: 'compras', nombre: 'Compras a proveedores', grupo: 'Catálogo', icono: 'camion', orden: 105, activo: true },
      { codigo: 'admin', nombre: 'Administración', grupo: 'Control', icono: 'engranaje', orden: 130, activo: true },
    ],
    permisos_rol: [
      { rol: 'ADMIN', modulo: 'dashboard', puede_ver: true, puede_editar: true, requiere_token: false },
      { rol: 'ADMIN', modulo: 'pos', puede_ver: true, puede_editar: true, requiere_token: false },
      { rol: 'ADMIN', modulo: 'compras', puede_ver: true, puede_editar: true, requiere_token: false },
      { rol: 'ADMIN', modulo: 'admin', puede_ver: true, puede_editar: true, requiere_token: false },
      { rol: 'VENDEDOR', modulo: 'dashboard', puede_ver: true, puede_editar: false, requiere_token: false },
      { rol: 'VENDEDOR', modulo: 'pos', puede_ver: true, puede_editar: true, requiere_token: false },
      { rol: 'VENDEDOR', modulo: 'compras', puede_ver: false, puede_editar: false, requiere_token: false },
      { rol: 'VENDEDOR', modulo: 'admin', puede_ver: false, puede_editar: false, requiere_token: false },
    ],
    correo_config: [
      { id: true, proveedor: 'RESEND', remitente_email: null,
        remitente_nombre: 'Minimarket El Cultivo', responder_a: null,
        copia_oculta: null, firma_html: null, activo: false },
    ],
    plantillas_correo: [
      { codigo: 'COMPROBANTE_CLIENTE', nombre: 'Comprobante al cliente',
        descripcion: 'Se envía al cliente cuando deja su correo.',
        asunto: '{{empresa.nombre_comercial}} — comprobante {{venta.numero_comprobante}}',
        cuerpo_html: '<p>Estimado/a <b>{{cliente.nombre}}</b>: su total fue {{venta.total}}.</p>',
        activa: true, es_sistema: true },
      { codigo: 'ORDEN_COMPRA_PROVEEDOR', nombre: 'Orden de compra al proveedor',
        descripcion: 'Solicitud de abastecimiento.',
        asunto: 'Orden de compra {{orden.numero}}',
        cuerpo_html: '<p>Señores {{proveedor.razon_social}}: {{orden.detalle_html}}</p>',
        activa: true, es_sistema: true },
    ],
    cola_correo: [
      { id: 'mail-1', plantilla: 'COMPROBANTE_CLIENTE', destinatario: 'maria@correo.ec',
        asunto: 'Minimarket El Cultivo — comprobante 001-001-000000147',
        estado: 'PENDIENTE', intentos: 0, ultimo_error: null,
        created_at: '2026-09-19T15:00:00Z', enviado_at: null },
    ],
    ordenes_compra: [
      { id: 'oc-1', numero: 'OC-2026-00001', fecha: '2026-09-18', fecha_requerida: '2026-09-21',
        estado: 'ENVIADA', total_estimado: 128.5, observaciones: null,
        created_at: '2026-09-18T09:00:00Z',
        proveedores: { razon_social: 'DISTRIBUIDORA ANDINA S.A.', email: 'ventas@andina.ec' } },
    ],
    v_sugerencia_reposicion: [
      { producto_id: 'prod-limon', codigo: 'FRU-013', nombre: 'Limón sutil',
        stock_minimo: 25, bodega_id: BODEGA, sede_id: 'sede-1', stock: 4,
        vendido_30d: 60, promedio_diario: 2, cantidad_sugerida: 49.5,
        proveedor_id: 'prov-1', proveedor: 'DISTRIBUIDORA ANDINA S.A.',
        proveedor_email: 'ventas@andina.ec', ultimo_costo: 0.45, urgencia: 'CRITICO' },
      { producto_id: 'prod-ruffles', codigo: 'SNK-001', nombre: 'Papas Ruffles 140g',
        stock_minimo: 10, bodega_id: BODEGA, sede_id: 'sede-1', stock: 0,
        vendido_30d: 30, promedio_diario: 1, cantidad_sugerida: 24,
        proveedor_id: null, proveedor: null, proveedor_email: null,
        ultimo_costo: null, urgencia: 'AGOTADO' },
    ],
    empresa: [
      { id: true, razon_social: 'MINIMARKET EL CULTIVO', nombre_comercial: 'Minimarket El Cultivo',
        ruc: '1728605070001', direccion_matriz: 'Quito', telefono: '02-2000000',
        email: 'market@prueba.ec', establecimiento: '001', punto_emision: '001',
        ambiente: 'PRUEBAS', tipo_negocio: 'MARKET', obligado_contabilidad: false,
        pie_recibo: 'Frescura y calidad en cada compra', color_primario: '#17803A',
        logo_url: null, deuna_qr_url: null, deuna_titular: null,
        deuna_telefono: null, deuna_activo: false },
    ],
    v_stock_actual: [
      {
        producto_id: 'prod-limon', codigo: 'FRU-013', ean13: '7861000100014',
        producto: 'Limón sutil', marca: null, categoria: 'Frutas',
        bodega_id: 'bod-1', bodega: 'Bodega Principal', unidad: 'LB',
        stock: 40, costo_promedio: 0.45, valor_total: 18,
        precio_venta_menor: 0.8, precio_venta_mayor: 0.6,
        stock_minimo: 25, bajo_minimo: false,
        ubicacion: 'PER-A-01-1', zona: 'Perecibles',
      },
      {
        producto_id: 'prod-ruffles', codigo: 'SNK-001', ean13: '7861000100021',
        producto: 'Papas Ruffles 140g', marca: 'Ruffles', categoria: 'Snacks',
        bodega_id: 'bod-1', bodega: 'Bodega Principal', unidad: 'UND',
        stock: 3, costo_promedio: 1.68, valor_total: 5.04,
        precio_venta_menor: 2.35, precio_venta_mayor: 2.0,
        stock_minimo: 40, bajo_minimo: true,
        ubicacion: 'SNK-I-02-1', zona: 'Snacks',
      },
    ],
    v_ocupacion_layout: [
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-A11', ubicacion: 'PER-A-01-1', pasillo: 'A', estante: 1, nivel: 1,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-A12', ubicacion: 'PER-A-01-2', pasillo: 'A', estante: 1, nivel: 2,
        capacidad_maxima: 200, producto_id: null, producto_codigo: null,
        producto: null, ean13: null, stock: 0, porcentaje_ocupacion: null },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-A13', ubicacion: 'PER-A-01-3', pasillo: 'A', estante: 1, nivel: 3,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-A21', ubicacion: 'PER-A-02-1', pasillo: 'A', estante: 2, nivel: 1,
        capacidad_maxima: 200, producto_id: null, producto_codigo: null,
        producto: null, ean13: null, stock: 0, porcentaje_ocupacion: null },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-A22', ubicacion: 'PER-A-02-2', pasillo: 'A', estante: 2, nivel: 2,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-A23', ubicacion: 'PER-A-02-3', pasillo: 'A', estante: 2, nivel: 3,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-A31', ubicacion: 'PER-A-03-1', pasillo: 'A', estante: 3, nivel: 1,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-A32', ubicacion: 'PER-A-03-2', pasillo: 'A', estante: 3, nivel: 2,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-A33', ubicacion: 'PER-A-03-3', pasillo: 'A', estante: 3, nivel: 3,
        capacidad_maxima: 200, producto_id: null, producto_codigo: null,
        producto: null, ean13: null, stock: 0, porcentaje_ocupacion: null },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-A41', ubicacion: 'PER-A-04-1', pasillo: 'A', estante: 4, nivel: 1,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-A42', ubicacion: 'PER-A-04-2', pasillo: 'A', estante: 4, nivel: 2,
        capacidad_maxima: 200, producto_id: null, producto_codigo: null,
        producto: null, ean13: null, stock: 0, porcentaje_ocupacion: null },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-A43', ubicacion: 'PER-A-04-3', pasillo: 'A', estante: 4, nivel: 3,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-B11', ubicacion: 'PER-B-01-1', pasillo: 'B', estante: 1, nivel: 1,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-B12', ubicacion: 'PER-B-01-2', pasillo: 'B', estante: 1, nivel: 2,
        capacidad_maxima: 200, producto_id: null, producto_codigo: null,
        producto: null, ean13: null, stock: 0, porcentaje_ocupacion: null },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-B13', ubicacion: 'PER-B-01-3', pasillo: 'B', estante: 1, nivel: 3,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-B21', ubicacion: 'PER-B-02-1', pasillo: 'B', estante: 2, nivel: 1,
        capacidad_maxima: 200, producto_id: null, producto_codigo: null,
        producto: null, ean13: null, stock: 0, porcentaje_ocupacion: null },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-B22', ubicacion: 'PER-B-02-2', pasillo: 'B', estante: 2, nivel: 2,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-B23', ubicacion: 'PER-B-02-3', pasillo: 'B', estante: 2, nivel: 3,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-B31', ubicacion: 'PER-B-03-1', pasillo: 'B', estante: 3, nivel: 1,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-B32', ubicacion: 'PER-B-03-2', pasillo: 'B', estante: 3, nivel: 2,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-B33', ubicacion: 'PER-B-03-3', pasillo: 'B', estante: 3, nivel: 3,
        capacidad_maxima: 200, producto_id: null, producto_codigo: null,
        producto: null, ean13: null, stock: 0, porcentaje_ocupacion: null },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-B41', ubicacion: 'PER-B-04-1', pasillo: 'B', estante: 4, nivel: 1,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-B42', ubicacion: 'PER-B-04-2', pasillo: 'B', estante: 4, nivel: 2,
        capacidad_maxima: 200, producto_id: null, producto_codigo: null,
        producto: null, ean13: null, stock: 0, porcentaje_ocupacion: null },
      { zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-B43', ubicacion: 'PER-B-04-3', pasillo: 'B', estante: 4, nivel: 3,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limon sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20 },
      {
        zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-1', ubicacion: 'PER-A-01-1', pasillo: 'A', estante: 1, nivel: 1,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limón sutil', ean13: '7861000100014', stock: 40, porcentaje_ocupacion: 20,
      },
      {
        zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-2', ubicacion: 'PER-A-01-2', pasillo: 'A', estante: 1, nivel: 2,
        capacidad_maxima: 200, producto_id: null, producto_codigo: null,
        producto: null, ean13: null, stock: 0, porcentaje_ocupacion: null,
      },
      {
        zona_id: 'z-snk', zona_codigo: 'SNK', zona: 'Snacks', color_hex: '#ec4899',
        tipo_conservacion: 'AMBIENTE', orden: 7,
        ubicacion_id: 'u-3', ubicacion: 'SNK-I-02-1', pasillo: 'I', estante: 2, nivel: 1,
        capacidad_maxima: 200, producto_id: 'prod-ruffles', producto_codigo: 'SNK-001',
        producto: 'Papas Ruffles 140g', ean13: '7861000100021', stock: 3, porcentaje_ocupacion: 1.5,
      },
    ],
    lotes: [
      { codigo_lote: 'L-20260919-FRU-013', fecha_caducidad: '2026-10-09', cantidad_disponible: 40, costo_unitario: 0.45 },
    ],
    v_pos_productos: [
      {
        producto_id: 'prod-limon',
        codigo: 'FRU-013',
        ean13: '7861000100014',
        nombre: 'Limón sutil',
        marca: null,
        categoria_id: 'cat-fru',
        categoria: 'Frutas',
        unidad: 'LB',
        unidad_nombre: 'Libra',
        permite_fraccion: true,
        paso_venta: 0.5,
        precio_venta_menor: 0.8,
        precio_venta_mayor: 0.6,
        cantidad_minima_mayor: 25,
        codigo_impuesto: 'IVA_CERO',
        tarifa_impuesto: 0,
        bodega_id: BODEGA,
        stock: 40,
        ubicacion: 'PER-A-01-1',
      },
      {
        producto_id: 'prod-ruffles',
        codigo: 'SNK-001',
        ean13: '7861000100021',
        nombre: 'Papas Ruffles 140g',
        marca: 'Ruffles',
        categoria_id: 'cat-snk',
        categoria: 'Snacks',
        unidad: 'UND',
        unidad_nombre: 'Unidad',
        permite_fraccion: false,
        paso_venta: 1,
        precio_venta_menor: 2.35,
        precio_venta_mayor: 2.0,
        cantidad_minima_mayor: 24,
        codigo_impuesto: 'IVA_GENERAL',
        tarifa_impuesto: 15,
        bodega_id: BODEGA,
        stock: 3,
        ubicacion: 'SNK-I-02-1',
      },
    ],
  };

  // Valores que devuelven los insert/update encadenados con .select().single()
  const RESPUESTAS_INSERT = {
    ventas: { id: 'venta-1', numero_interno: 'VTA-2026-00001' },
  };

  function consulta(tabla) {
    const estado = { tabla, filtros: [], modo: 'select' };

    const api = {
      select() { return api; },
      order() { return api; },
      limit() { return api; },
      gt() { return api; },
      gte() { return api; },
      eq(campo, valor) { estado.filtros.push([campo, valor]); return api; },
      or(expresion) { estado.or = expresion; return api; },

      insert(payload) {
        estado.modo = 'insert';
        estado.payload = payload;
        window.__ESCRITURAS.push({ tabla, operacion: 'insert', payload });
        return api;
      },
      upsert(payload) {
        estado.modo = 'upsert';
        estado.payload = payload;
        window.__ESCRITURAS.push({ tabla, operacion: 'upsert', payload });
        return api;
      },

      update(payload) {
        estado.modo = 'update';
        estado.payload = payload;
        window.__ESCRITURAS.push({ tabla, operacion: 'update', payload });
        return api;
      },

      single() { return api.then((r) => ({ data: unaFila(r.data), error: null })); },
      maybeSingle() { return api.then((r) => ({ data: unaFila(r.data), error: null })); },

      then(resolver, rechazo) {
        return Promise.resolve(resultado()).then(resolver, rechazo);
      },
    };

    function resultado() {
      if (estado.modo !== 'select') {
        if (tabla === 'ventas' && estado.modo === 'update') {
          return { data: [ventaConfirmada()], error: null };
        }
        return { data: [RESPUESTAS_INSERT[tabla] ?? { id: `${tabla}-nuevo` }], error: null };
      }

      if (tabla === 'ventas') return { data: [ventaConfirmada()], error: null };

      let filas = DATOS[tabla] ?? [];
      for (const [campo, valor] of estado.filtros) {
        filas = filas.filter((f) => f[campo] === valor || f[campo] === undefined);
      }
      return { data: filas, error: null };
    }

    function unaFila(d) { return Array.isArray(d) ? d[0] ?? null : d; }

    function ventaConfirmada() {
      return {
        id: 'venta-1',
        numero_interno: 'VTA-2026-00001',
        subtotal: 2.8,
        descuento: 2.8,
        valor_impuesto: 0,
        total: 2.8,
        estado: 'CONFIRMADA',
        tipo_comprobante: 'NOTA_VENTA',
        numero_comprobante: '001-001-000000001',
      };
    }

    return api;
  }

  window.__CANALES = [];

  function canalSimulado(nombre) {
    const canal = {
      nombre,
      manejadores: [],
      on(_evento, _filtro, cb) { canal.manejadores.push(cb); return canal; },
      subscribe(cb) { setTimeout(() => cb && cb('SUBSCRIBED'), 30); return canal; },
    };
    window.__CANALES.push(canal);
    return canal;
  }

  // Permite que las pruebas simulen una venta hecha por otra caja
  window.__emitirCambioStock = (producto_id, stock) => {
    for (const c of window.__CANALES) {
      for (const m of c.manejadores) {
        m({ new: { producto_id, bodega_id: BODEGA, stock } });
      }
    }
  };

  async function rpc(nombre, args) {
    if (nombre === 'fn_mi_perfil') {
      return { data: [{ usuario_id: 'u-1', nombre: 'prueba@itsanet.com', rol: 'ADMIN',
                        bodega_id: BODEGA, tipo_negocio: 'MARKET' }], error: null };
    }
    if (nombre === 'fn_mi_perfil_completo') {
      return { data: [{ usuario_id: 'u-1', nombre: 'prueba@itsanet.com', rol: 'ADMIN',
                        rol_nombre: 'Administrador',
                        rol_descripcion: 'Configura todo el sistema.',
                        sede_id: 'sede-1', sede_nombre: 'Matriz', sede_codigo: '001',
                        activo: true }], error: null };
    }
    if (nombre === 'fn_mis_modulos') {
      const rol = 'ADMIN';
      const data = DATOS.modulos_sistema.map((m) => {
        const p = DATOS.permisos_rol.find((x) => x.rol === rol && x.modulo === m.codigo) ?? {};
        return { ...m, puede_ver: !!p.puede_ver, puede_editar: !!p.puede_editar,
                 requiere_token: !!p.requiere_token, descripcion: m.descripcion ?? m.nombre };
      });
      return { data, error: null };
    }
    if (nombre === 'fn_crear_orden_compra') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_crear_orden_compra', operacion: 'rpc', payload: args });
      return { data: 'oc-nueva', error: null };
    }
    if (nombre === 'fn_enviar_orden_compra') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_enviar_orden_compra', operacion: 'rpc', payload: args });
      return { data: 'mail-nuevo', error: null };
    }
    if (nombre === 'fn_encolar_correo') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_encolar_correo', operacion: 'rpc', payload: args });
      return { data: 'mail-nuevo', error: null };
    }
    if (nombre === 'fn_datos_correo_venta') {
      return { data: { venta: { total: '$12.50' }, cliente: { nombre: 'MARIA LOPEZ' } }, error: null };
    }
    if (nombre === 'fn_buscar_cliente') {
      const id = (args?.p_identificacion ?? '').trim();
      const cli = DATOS.clientes.find((c) => c.identificacion === id);
      return { data: cli ? [{ ...cli, tipo_identificacion: cli.tipo_identificacion ?? 'CEDULA' }] : [], error: null };
    }
    if (nombre === 'fn_registrar_cliente') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_registrar_cliente', operacion: 'rpc', payload: args });
      const nuevo = {
        id: 'cli-nuevo', identificacion: args.p_identificacion,
        nombre: args.p_nombre, tipo_identificacion: 'CEDULA', activo: true,
      };
      DATOS.clientes.push(nuevo);
      return { data: 'cli-nuevo', error: null };
    }
    if (nombre === 'fn_registrar_proveedor') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_registrar_proveedor', operacion: 'rpc', payload: args });
      return { data: 'prov-nuevo', error: null };
    }
    if (nombre === 'fn_emitir_token') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_emitir_token', operacion: 'rpc', payload: args });
      return { data: 'ABCD-2345', error: null };
    }
    return { data: null, error: { message: `rpc no simulada: ${nombre}` } };
  }

  // Gancho solo para las pruebas: permite devolver el stock a un valor
  // conocido entre secciones, para que una prueba no dependa de cuánto
  // vendió la anterior.
  window.__FIJAR_STOCK = function (productoId, valor) {
    for (const fila of DATOS.v_pos_productos) {
      if (fila.producto_id === productoId) fila.stock = valor;
    }
    for (const fila of DATOS.v_stock_actual) {
      if (fila.producto_id === productoId) fila.stock = valor;
    }
  };

  window.supabase = {
    createClient() {
      return {
        from: consulta,
        rpc,
        channel: canalSimulado,
        removeChannel: (c) => {
          window.__CANALES = window.__CANALES.filter((x) => x !== c);
        },
        auth: {
          getSession: async () => ({
            data: { session: { user: { id: 'u-1', email: 'prueba@itsanet.com' } } },
          }),
          getUser: async () => ({ data: { user: { id: 'u-1', email: 'prueba@itsanet.com' } } }),
          onAuthStateChange: (cb) => {
            setTimeout(
              () => cb('SIGNED_IN', { user: { id: 'u-1', email: 'prueba@itsanet.com' } }),
              0
            );
            return { data: { subscription: { unsubscribe() {} } } };
          },
          signInWithPassword: async () => ({ error: null }),
          signOut: async () => ({ error: null }),
        },
      };
    },
  };
})();
