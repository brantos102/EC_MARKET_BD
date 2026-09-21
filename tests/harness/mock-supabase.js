// Supabase simulado para pruebas de interfaz sin red.
// Implementa solo lo que la aplicación usa: el encadenado de consultas,
// insert/update y el objeto auth. Los datos son fijos y las escrituras
// quedan registradas en window.__ESCRITURAS para poder verificarlas.
//
// NO forma parte de la aplicación: solo lo carga tests/harness/index.html.

(function () {
  window.__ESCRITURAS = [];

  const BODEGA = 'bod-1';

  // Las pruebas del asistente necesitan una base "recién migrada". En vez
  // de mantener dos copias del simulador, se pide con ?instalar=1 en la
  // dirección y esta misma copia responde como si nada estuviera instalado.
  const SIN_INSTALAR = new URLSearchParams(location.search).has('instalar');

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
    instalacion: [
      { id: true, completada: true, tipo_negocio: 'MARKET', version_sistema: '011' },
    ],
    tipos_negocio: [
      { codigo: 'MARKET', nombre: 'Minimarket / Tienda de abarrotes',
        descripcion: 'Víveres, frutas y verduras, lácteos, snacks y bebidas.',
        icono: 'carrito', orden: 10, activo: true,
        unidades: ['UND','LB','KG','ARROBA','QUINTAL','LT'],
        categorias: ['Frutas','Verduras y hortalizas','Abarrotes','Bebidas'],
        zonas: [{ codigo: 'PER', nombre: 'Perecibles', conservacion: 'REFRIGERADO' }],
        maneja_caducidad: true, maneja_peso: true },
      { codigo: 'FERRETERIA', nombre: 'Ferretería',
        descripcion: 'Herramientas, materiales de construcción, pinturas y eléctricos.',
        icono: 'ajuste', orden: 20, activo: true,
        unidades: ['UND','METRO','KG','GALON','ROLLO'],
        categorias: ['Herramienta manual','Tornillería y fijación','Plomería'],
        zonas: [{ codigo: 'HER', nombre: 'Herramientas', conservacion: 'AMBIENTE' }],
        maneja_caducidad: false, maneja_peso: true },
      { codigo: 'FARMACIA', nombre: 'Farmacia / Botica',
        descripcion: 'Medicamentos y cuidado personal, con lote y caducidad obligatorios.',
        icono: 'escudo', orden: 30, activo: true,
        unidades: ['UND','CAJA','BLISTER','ML'],
        categorias: ['Analgésicos','Antibióticos','Cuidado personal'],
        zonas: [{ codigo: 'MED', nombre: 'Medicamentos', conservacion: 'AMBIENTE' }],
        maneja_caducidad: true, maneja_peso: false },
      { codigo: 'OTRO', nombre: 'Otro tipo de negocio',
        descripcion: 'Arranca con lo mínimo y usted define todo desde Catálogo.',
        icono: 'caja', orden: 90, activo: true,
        unidades: ['UND','CAJA','PAQUETE'], categorias: [],
        zonas: [{ codigo: 'GEN', nombre: 'General', conservacion: 'AMBIENTE' }],
        maneja_caducidad: false, maneja_peso: false },
    ],
    sedes: [
      { id: 'sede-1', codigo: '001', codigo_nave: 'ECM', nombre: 'Matriz', direccion: 'Quito',
        telefono: '02-2000000', punto_emision: '001', es_matriz: true, activa: true },
      { id: 'sede-2', codigo: '002', codigo_nave: 'ECN', nombre: 'Sucursal Norte', direccion: 'Carcelén',
        telefono: null, punto_emision: '001', es_matriz: false, activa: true },
    ],
    tipos_estructura: [
      { codigo: 'ESTANTERIA', nombre: 'Estantería mural', descripcion: 'Percha contra la pared.',
        prefijo_sugerido: 'A', temperatura: 'AMBIENTE', ancho_cm: 120, alto_cm: 200, fondo_cm: 45,
        columnas_defecto: 4, niveles_defecto: 5, doble_cara: false, color_hex: '#d8dee0', orden: 10 },
      { codigo: 'FRIGORIFICO', nombre: 'Frigorífico vertical', descripcion: 'Vitrina de puerta de vidrio.',
        prefijo_sugerido: 'FR', temperatura: 'REFRIGERADO', ancho_cm: 80, alto_cm: 200, fondo_cm: 65,
        columnas_defecto: 2, niveles_defecto: 5, doble_cara: false, color_hex: '#bcd4e6', orden: 40 },
      { codigo: 'NEVERA', nombre: 'Nevera horizontal', descripcion: 'Arcón de tapa superior.',
        prefijo_sugerido: 'NV', temperatura: 'CONGELADO', ancho_cm: 150, alto_cm: 90, fondo_cm: 70,
        columnas_defecto: 3, niveles_defecto: 2, doble_cara: false, color_hex: '#a9c9e0', orden: 50 },
      { codigo: 'MOSTRADOR', nombre: 'Mostrador / caja', descripcion: 'Donde se cobra.',
        prefijo_sugerido: 'MO', temperatura: 'AMBIENTE', ancho_cm: 180, alto_cm: 110, fondo_cm: 60,
        columnas_defecto: 4, niveles_defecto: 2, doble_cara: false, color_hex: '#c9a227', orden: 60 },
    ],
    v_estructuras_ocupacion: [
      { estructura_id: 'est-a', sede_id: 'sede-1', codigo_nave: 'ECM', literal: 'A',
        nombre: 'Perecibles', tipo: 'ESTANTERIA', tipo_nombre: 'Estantería mural',
        columnas: 2, niveles: 2, ancho_cm: 120, alto_cm: 200, fondo_cm: 45,
        pos_x_cm: 20, pos_y_cm: 40, rotacion_grados: 0, temperatura: 'AMBIENTE',
        calle: 'Calle 1', ancho_local_cm: 800, fondo_local_cm: 600,
        color_hex: '#d8dee0', doble_cara: false, activa: true, orden: 10,
        posiciones: 4, posiciones_ocupadas: 2, ocupacion_pct: 50.0 },
      { estructura_id: 'est-i', sede_id: 'sede-1', codigo_nave: 'ECM', literal: 'I',
        nombre: 'Snacks', tipo: 'ESTANTERIA', tipo_nombre: 'Estantería mural',
        columnas: 2, niveles: 2, ancho_cm: 120, alto_cm: 200, fondo_cm: 45,
        pos_x_cm: 180, pos_y_cm: 40, rotacion_grados: 0, temperatura: 'AMBIENTE',
        calle: 'Calle 1', ancho_local_cm: 800, fondo_local_cm: 600,
        color_hex: '#d8dee0', doble_cara: false, activa: true, orden: 20,
        posiciones: 4, posiciones_ocupadas: 1, ocupacion_pct: 25.0 },
      { estructura_id: 'est-fr1', sede_id: 'sede-1', codigo_nave: 'ECM', literal: 'FR1',
        nombre: 'Frigorífico de bebidas', tipo: 'FRIGORIFICO', tipo_nombre: 'Frigorífico vertical',
        columnas: 2, niveles: 2, ancho_cm: 80, alto_cm: 200, fondo_cm: 65,
        pos_x_cm: 340, pos_y_cm: 40, rotacion_grados: 0, temperatura: 'REFRIGERADO',
        calle: 'Calle 2', ancho_local_cm: 800, fondo_local_cm: 600,
        color_hex: '#bcd4e6', doble_cara: false, activa: true, orden: 30,
        posiciones: 4, posiciones_ocupadas: 0, ocupacion_pct: 0.0 },
    ],
    v_posiciones: [
      { ubicacion_id: 'u1', codigo: 'ECM-A-01-1', estructura_id: 'est-a', literal: 'A',
        estructura: 'Perecibles', tipo: 'ESTANTERIA', temperatura: 'AMBIENTE',
        sede_id: 'sede-1', codigo_nave: 'ECM', columna: 1, nivel: 1, activa: true,
        producto_id: 'prod-limon', producto_codigo: 'FRU-013', producto: 'Limón sutil',
        marca: null, categoria: 'Frutas', stock: 40, unidad: 'LB', calle: 'Calle 1',
        stock_minimo: 25, precio_venta_menor: 0.8, precio_venta_mayor: 0.6,
        costo_promedio: 0.45, valor_en_posicion: 18 },
      { ubicacion_id: 'u2', codigo: 'ECM-A-01-2', estructura_id: 'est-a', literal: 'A',
        estructura: 'Perecibles', tipo: 'ESTANTERIA', temperatura: 'AMBIENTE',
        sede_id: 'sede-1', codigo_nave: 'ECM', columna: 1, nivel: 2, activa: true,
        producto_id: null, producto_codigo: null, producto: null,
        marca: null, categoria: null, stock: 0, unidad: null },
      { ubicacion_id: 'u3', codigo: 'ECM-A-02-1', estructura_id: 'est-a', literal: 'A',
        estructura: 'Perecibles', tipo: 'ESTANTERIA', temperatura: 'AMBIENTE',
        sede_id: 'sede-1', codigo_nave: 'ECM', columna: 2, nivel: 1, activa: true,
        producto_id: 'prod-pina', producto_codigo: 'FRU-020', producto: 'Piña',
        marca: null, categoria: 'Frutas', stock: 0, unidad: 'UND', calle: 'Calle 1',
        stock_minimo: 5, precio_venta_menor: 1.2, precio_venta_mayor: 1.0,
        costo_promedio: 0.7, valor_en_posicion: 0 },
      { ubicacion_id: 'u4', codigo: 'ECM-A-02-2', estructura_id: 'est-a', literal: 'A',
        estructura: 'Perecibles', tipo: 'ESTANTERIA', temperatura: 'AMBIENTE',
        sede_id: 'sede-1', codigo_nave: 'ECM', columna: 2, nivel: 2, activa: true,
        producto_id: null, producto_codigo: null, producto: null,
        marca: null, categoria: null, stock: 0, unidad: null },
      { ubicacion_id: 'u5', codigo: 'ECM-I-01-1', estructura_id: 'est-i', literal: 'I',
        estructura: 'Snacks', tipo: 'ESTANTERIA', temperatura: 'AMBIENTE',
        sede_id: 'sede-1', codigo_nave: 'ECM', columna: 1, nivel: 1, activa: true,
        producto_id: 'prod-ruffles', producto_codigo: 'SNK-001', producto: 'Papas Ruffles 140g',
        marca: 'Ruffles', categoria: 'Snacks', stock: 12, unidad: 'UND', calle: 'Calle 1',
        stock_minimo: 6, precio_venta_menor: 2.35, precio_venta_mayor: 2.0,
        costo_promedio: 1.6, valor_en_posicion: 19.2 },
      { ubicacion_id: 'u6', codigo: 'ECM-I-01-2', estructura_id: 'est-i', literal: 'I',
        estructura: 'Snacks', tipo: 'ESTANTERIA', temperatura: 'AMBIENTE',
        sede_id: 'sede-1', codigo_nave: 'ECM', columna: 1, nivel: 2, activa: true,
        producto_id: null, producto_codigo: null, producto: null,
        marca: null, categoria: null, stock: 0, unidad: null },
      { ubicacion_id: 'u7', codigo: 'ECM-I-02-1', estructura_id: 'est-i', literal: 'I',
        estructura: 'Snacks', tipo: 'ESTANTERIA', temperatura: 'AMBIENTE',
        sede_id: 'sede-1', codigo_nave: 'ECM', columna: 2, nivel: 1, activa: true,
        producto_id: null, producto_codigo: null, producto: null,
        marca: null, categoria: null, stock: 0, unidad: null },
      { ubicacion_id: 'u8', codigo: 'ECM-I-02-2', estructura_id: 'est-i', literal: 'I',
        estructura: 'Snacks', tipo: 'ESTANTERIA', temperatura: 'AMBIENTE',
        sede_id: 'sede-1', codigo_nave: 'ECM', columna: 2, nivel: 2, activa: true,
        producto_id: null, producto_codigo: null, producto: null,
        marca: null, categoria: null, stock: 0, unidad: null },
      { ubicacion_id: 'u9', codigo: 'ECM-FR1-01-1', estructura_id: 'est-fr1', literal: 'FR1',
        estructura: 'Frigorífico de bebidas', tipo: 'FRIGORIFICO', temperatura: 'REFRIGERADO',
        sede_id: 'sede-1', codigo_nave: 'ECM', columna: 1, nivel: 1, activa: true,
        producto_id: null, producto_codigo: null, producto: null,
        marca: null, categoria: null, stock: 0, unidad: null },
      { ubicacion_id: 'u10', codigo: 'ECM-FR1-01-2', estructura_id: 'est-fr1', literal: 'FR1',
        estructura: 'Frigorífico de bebidas', tipo: 'FRIGORIFICO', temperatura: 'REFRIGERADO',
        sede_id: 'sede-1', codigo_nave: 'ECM', columna: 1, nivel: 2, activa: true,
        producto_id: null, producto_codigo: null, producto: null,
        marca: null, categoria: null, stock: 0, unidad: null },
      { ubicacion_id: 'u11', codigo: 'ECM-FR1-02-1', estructura_id: 'est-fr1', literal: 'FR1',
        estructura: 'Frigorífico de bebidas', tipo: 'FRIGORIFICO', temperatura: 'REFRIGERADO',
        sede_id: 'sede-1', codigo_nave: 'ECM', columna: 2, nivel: 1, activa: true,
        producto_id: null, producto_codigo: null, producto: null,
        marca: null, categoria: null, stock: 0, unidad: null },
      { ubicacion_id: 'u12', codigo: 'ECM-FR1-02-2', estructura_id: 'est-fr1', literal: 'FR1',
        estructura: 'Frigorífico de bebidas', tipo: 'FRIGORIFICO', temperatura: 'REFRIGERADO',
        sede_id: 'sede-1', codigo_nave: 'ECM', columna: 2, nivel: 2, activa: true,
        producto_id: null, producto_codigo: null, producto: null,
        marca: null, categoria: null, stock: 0, unidad: null },
    ],
    servicios_catalogo: [
      { id: 'srv-1', codigo: 'REC_CLARO', nombre: 'Recarga Claro', tipo: 'RECARGA',
        proveedor: 'Claro', comision_tipo: 'PORCENTAJE', comision_valor: 5,
        monto_minimo: 1, monto_maximo: 100, requiere_referencia: true,
        etiqueta_referencia: 'Número de celular', icono: 'senal',
        color_hex: '#d52b1e', activo: true, orden: 10 },
      { id: 'srv-2', codigo: 'REC_MOVISTAR', nombre: 'Recarga Movistar', tipo: 'RECARGA',
        proveedor: 'Movistar', comision_tipo: 'PORCENTAJE', comision_valor: 5,
        monto_minimo: 1, monto_maximo: 100, requiere_referencia: true,
        etiqueta_referencia: 'Número de celular', icono: 'senal',
        color_hex: '#019df4', activo: true, orden: 20 },
      { id: 'srv-3', codigo: 'PAGO_LUZ', nombre: 'Pago de luz', tipo: 'PAGO_SERVICIO',
        proveedor: 'Empresa Eléctrica', comision_tipo: 'FIJA', comision_valor: 0.25,
        monto_minimo: 1, monto_maximo: null, requiere_referencia: true,
        etiqueta_referencia: 'Número de suministro', icono: 'rayo',
        color_hex: '#f5c518', activo: true, orden: 50 },
    ],
    accesos_externos: [
      { id: 'acc-1', codigo: 'POSVIRTUAL', nombre: 'POSVirtual — Recargas',
        descripcion: 'Sistema de Ponle Más para recargar saldo.',
        url: 'https://posvirtual.ponlemas.com:86/login', icono: 'senal',
        color_hex: '#1f7a8c',
        instrucciones: 'Se abre en una ventana aparte porque es un sistema de otra empresa.',
        activo: true, orden: 10 },
    ],
    v_servicios_detalle: [
      { id: 'vs-1', numero: 'SRV-2026-00001', fecha: new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString(), servicio_codigo: 'REC_CLARO',
        servicio: 'Recarga Claro', tipo: 'RECARGA', proveedor: 'Claro',
        monto: 10, comision: 0.5, referencia: '0999123456', codigo_operadora: 'PV-778812',
        forma_pago: 'EFECTIVO', estado: 'COMPLETADA', cajero_nombre: 'Prueba',
        observacion: null, sede: 'Matriz', codigo_nave: 'ECM' },
    ],
    v_resumen_mensual: [
      { mes: '2026-09-01', sede_id: 'sede-1', origen: 'MERCADERIA',
        transacciones: 42, monto: 1580.40, comision: 0 },
      { mes: '2026-09-01', sede_id: 'sede-1', origen: 'SERVICIOS',
        transacciones: 18, monto: 210.00, comision: 10.50 },
    ],
    v_lotes_disponibles: [
      { producto_id: 'prod-limon', codigo_lote: 'L-20260919-FRU-013',
        fecha_caducidad: '2026-10-09', cantidad_disponible: 40, costo_unitario: 0.45 },
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
        logo_url: null, deuna_qr_url: null, deuna_qr_mime: null, deuna_qr_nombre: null,
        deuna_titular: null, deuna_telefono: null, deuna_activo: false,
        deuna_modo: 'QR_ESTATICO', deuna_comercio_id: null, deuna_api_base: null,
        deuna_instrucciones: 'Escanee el código con la app De Una y envíe el valor indicado en pantalla.' },
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
        codigos: [{ codigo: '7861000100014', unidades: 1, presentacion: null, precio: null }],
      },
      {
        producto_id: 'prod-ruffles',
        codigo: 'SNK-001',
        ean13: '7861000100021',
        nombre: 'Papas Ruffles 140g',
        // Dos códigos vivos a la vez: el de la funda y el de la caja de
        // 12. Es el caso real del proveedor que entrega en caja y el
        // market vende por unidad.
        codigos: [
          { codigo: '7861000100021', unidades: 1, presentacion: null, precio: null },
          { codigo: '7861000100045', unidades: 12, presentacion: 'Caja x 12', precio: 9.6 },
        ],
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

    // Lo que necesita el papel de la venta. ancho_papel_mm es lo que
    // decide si el recibo se maqueta para el rollo de 80 mm o el de 58:
    // sin este dato la prueba de impresión no comprobaría nada real.
    v_comprobante: [
      {
        venta_id: 'venta-1',
        numero_interno: 'VTA-2026-00001',
        numero_comprobante: '001-001-000000001',
        tipo_comprobante: 'NOTA_VENTA',
        confirmada_at: '2026-09-20T14:59:27-05:00',
        cajero_nombre: 'prueba@itsanet.com',
        tipo_venta: 'MENOR',
        subtotal: 9.0,
        descuento: 0,
        valor_impuesto: 0.87,
        total: 9.87,
        estado: 'CONFIRMADA',
        tipo_identificacion: 'CONSUMIDOR_FINAL',
        cliente_identificacion: '9999999999999',
        cliente_nombre: 'CONSUMIDOR FINAL',
        cliente_direccion: null,
        cliente_telefono: null,
        razon_social: 'MINIMARKET EL CULTIVO',
        nombre_comercial: 'Minimarket El Cultivo',
        ruc: '1728605070001',
        direccion_matriz: 'Quito',
        direccion_establecimiento: 'Sobre la avenida Manuel Córdova Galarza',
        empresa_telefono: '0984719370',
        empresa_email: 'mati_98x@hotmail.com',
        obligado_contabilidad: false,
        contribuyente_especial: null,
        ambiente: 'PRUEBAS',
        pie_recibo: 'Frescura y calidad en cada compra',
        logo_url: 'data:image/png;base64,iVBORw0KGgo=',
        ancho_papel_mm: 80,
      },
    ],
    venta_detalle: [
      { cantidad: 1, precio_unitario: 0.35, descuento: 0, subtotal: 0.35, valor_impuesto: 0,
        productos: { codigo: 'FRU-001', nombre: 'Guineo de seda', codigo_impuesto: 'IVA_0' } },
      { cantidad: 4, precio_unitario: 1.45, descuento: 0, subtotal: 5.8, valor_impuesto: 0.87,
        productos: { codigo: 'BEB-001', nombre: 'Coca-Cola 1.35L', codigo_impuesto: 'IVA_GENERAL' } },
      { cantidad: 1, precio_unitario: 2.85, descuento: 0, subtotal: 2.85, valor_impuesto: 0,
        productos: { codigo: 'ABA-001', nombre: 'Arroz Flor 2kg', codigo_impuesto: 'IVA_0' } },
    ],
    pagos_venta: [
      { forma_pago: 'EFECTIVO', monto: 9.87, recibido: 10, cambio: 0.13, codigo_transaccion: null },
    ],

    // --- Migración 015: presentaciones y códigos ---
    presentaciones: [
      { id: 'pres-ruf-base', producto_id: 'prod-ruffles', nombre: 'Unidad', tipo: 'UNIDAD',
        factor: 1, es_base: true, para_compra: true, para_venta: false, activo: true },
      { id: 'pres-ruf-caja', producto_id: 'prod-ruffles', nombre: 'Caja x 12', tipo: 'CAJA',
        factor: 12, es_base: false, para_compra: true, para_venta: true, precio_venta: 9.6,
        activo: true },
      { id: 'pres-lim-base', producto_id: 'prod-limon', nombre: 'Libra', tipo: 'UNIDAD',
        factor: 1, es_base: true, para_compra: true, para_venta: false, activo: true },
    ],
    v_stock_presentacion: [
      { producto_id: 'prod-limon', presentacion: 'Libra', factor: 1, lectura: '40 LB',
        se_vende_asi: false, precio_bulto: null, stock_unidades: 40 },
      { producto_id: 'prod-ruffles', presentacion: 'Unidad', factor: 1, lectura: '12 UND',
        se_vende_asi: false, precio_bulto: null, stock_unidades: 12 },
      { producto_id: 'prod-ruffles', presentacion: 'Caja x 12', factor: 12,
        lectura: '1 x Caja x 12', se_vende_asi: true, precio_bulto: 9.6, stock_unidades: 12 },
    ],
    v_producto_codigos: [
      { producto_id: 'prod-limon', codigo: '7861000100014', tipo: 'EAN13', principal: true,
        activo: true, presentacion_id: null, unidades_por_lectura: 1, producto: 'Limón sutil' },
      { producto_id: 'prod-ruffles', codigo: '7861000100021', tipo: 'EAN13', principal: true,
        activo: true, presentacion_id: null, unidades_por_lectura: 1, producto: 'Papas Ruffles 140g' },
      { producto_id: 'prod-ruffles', codigo: '7861000100045', tipo: 'EAN13', principal: false,
        activo: true, presentacion_id: 'pres-ruf-caja', unidades_por_lectura: 12,
        producto: 'Papas Ruffles 140g' },
    ],
    ingreso_detalle: [],
    v_recepcion_vs_orden: [],
    ordenes_compra: [
      { id: 'oc-1', numero: 'OC-2026-00001', estado: 'ENVIADA', proveedor_id: 'prov-1',
        fecha_requerida: '2026-09-25' },
    ],
    productos: [
      { id: 'prod-limon', codigo: 'FRU-013', nombre: 'Limón sutil', ean13: '7861000100014',
        maneja_lote: false, unidad_medida: 'LB', paso_venta: 0.5, categoria_id: 'cat-fru',
        precio_venta_menor: 0.8, permite_fraccion: true, activo: true,
        unidades_medida: { permite_fraccion: true } },
      { id: 'prod-ruffles', codigo: 'SNK-001', nombre: 'Papas Ruffles 140g',
        ean13: '7861000100021', maneja_lote: false, unidad_medida: 'UND', paso_venta: 1,
        categoria_id: 'cat-snk', precio_venta_menor: 2.35, permite_fraccion: false, activo: true,
        unidades_medida: { permite_fraccion: false } },
    ],
    proveedor_producto: [],
    proveedores: [
      { id: 'prov-1', ruc: '1790012345001', nombre_comercial: 'Distribuidora Andina',
        razon_social: 'DISTRIBUIDORA ANDINA S.A.', activo: true },
    ],
    documentos_ingreso: [
      { id: 'doc-1', numero_interno: 'ING-2026-00001', numero_documento: '001-001-000000123',
        tipo_documento: 'FACTURA', fecha_recepcion: '2026-09-20', subtotal: 45, valor_impuesto: 0,
        total: 45, estado: 'BORRADOR', clave_acceso: null, origen: 'MANUAL',
        proveedores: { nombre_comercial: 'Distribuidora Andina' } },
    ],
  };

  // Valores que devuelven los insert/update encadenados con .select().single()
  const RESPUESTAS_INSERT = {
    ventas: { id: 'venta-1', numero_interno: 'VTA-2026-00001' },
    documentos_ingreso: { id: 'doc-1', numero_interno: 'ING-2026-00001' },
  };

  function consulta(tabla) {
    const estado = { tabla, filtros: [], modo: 'select' };

    const api = {
      select() { return api; },
      order() { return api; },
      limit() { return api; },
      gt() { return api; },
      gte() { return api; },
      lt() { return api; },
      lte() { return api; },
      neq() { return api; },
      in() { return api; },
      ilike() { return api; },
      is() { return api; },
      range() { return api; },
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
    // --- Migración 015 ---
    if (nombre === 'fn_traducir_factura') {
      // Refleja lo que hace la base: lo ya emparejado entra solo, el
      // código de barras de la factura reconoce el producto, y un
      // parecido por nombre se ofrece pero NO se da por bueno.
      const lineas = args.p_lineas ?? [];
      return {
        data: lineas.map((l, i) => {
          const mapa = DATOS.proveedor_producto.find(
            (m) => m.proveedor_id === args.p_proveedor_id
                && m.codigo_proveedor === String(l.codigo).toUpperCase());
          if (mapa) {
            const p = DATOS.productos.find((x) => x.id === mapa.producto_id);
            return { indice: i + 1, codigo_proveedor: l.codigo, descripcion: l.descripcion,
              cantidad_factura: l.cantidad, precio_factura: l.precioUnitario,
              producto_id: mapa.producto_id, producto: p?.nombre, unidad: p?.unidad_medida,
              factor: mapa.factor, cantidad_real: l.cantidad * mapa.factor,
              costo_unitario: l.precioUnitario / mapa.factor,
              reconocido: true, sugerencia_id: null, sugerencia: null,
              motivo: 'Emparejado en una factura anterior' };
          }
          const porCodigo = DATOS.v_producto_codigos.find(
            (c) => c.activo && c.codigo === String(l.codigoAux ?? ''));
          if (porCodigo) {
            const p = DATOS.productos.find((x) => x.id === porCodigo.producto_id);
            return { indice: i + 1, codigo_proveedor: l.codigo, descripcion: l.descripcion,
              cantidad_factura: l.cantidad, precio_factura: l.precioUnitario,
              producto_id: porCodigo.producto_id, producto: p?.nombre, unidad: p?.unidad_medida,
              factor: 1, cantidad_real: l.cantidad, costo_unitario: l.precioUnitario,
              reconocido: true, sugerencia_id: porCodigo.producto_id, sugerencia: p?.nombre,
              motivo: 'Reconocido por el código de barras que trae la factura' };
          }
          return { indice: i + 1, codigo_proveedor: l.codigo, descripcion: l.descripcion,
            cantidad_factura: l.cantidad, precio_factura: l.precioUnitario,
            producto_id: null, producto: null, unidad: null, factor: 1,
            cantidad_real: l.cantidad, costo_unitario: l.precioUnitario,
            reconocido: false, sugerencia_id: null, sugerencia: null,
            motivo: 'Sin equivalencia: elija el producto o créelo' };
        }),
        error: null,
      };
    }
    if (nombre === 'fn_vincular_producto_proveedor') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_vincular_producto_proveedor',
                                 operacion: 'rpc', payload: args });
      DATOS.proveedor_producto = DATOS.proveedor_producto.filter(
        (m) => !(m.proveedor_id === args.p_proveedor_id
                 && m.codigo_proveedor === String(args.p_codigo_proveedor).toUpperCase()));
      DATOS.proveedor_producto.push({
        proveedor_id: args.p_proveedor_id,
        codigo_proveedor: String(args.p_codigo_proveedor).toUpperCase(),
        producto_id: args.p_producto_id,
        factor: Number(args.p_factor) || 1,
      });
      return { data: [{ estado: 'OK', mensaje: 'Equivalencia guardada.' }], error: null };
    }
    if (nombre === 'fn_mover_estructura') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_mover_estructura', operacion: 'rpc', payload: args });
      const e = DATOS.v_estructuras_ocupacion.find((x) => x.estructura_id === args.p_estructura_id);
      // Solape contra los demás muebles, igual que en la base
      const huella = (m) => {
        const r = ((Number(m.rotacion_grados ?? 0) % 360) + 360) % 360;
        return (r === 90 || r === 270)
          ? { a: m.fondo_cm, f: m.ancho_cm } : { a: m.ancho_cm, f: m.fondo_cm };
      };
      const mia = huella({ ...e, rotacion_grados: args.p_rotacion });
      const choque = DATOS.v_estructuras_ocupacion.find((o) => {
        if (o.estructura_id === args.p_estructura_id || !o.activa) return false;
        const h = huella(o);
        return args.p_x < o.pos_x_cm + h.a && args.p_x + mia.a > o.pos_x_cm
            && args.p_y < o.pos_y_cm + h.f && args.p_y + mia.f > o.pos_y_cm;
      });
      if (choque && !args.p_forzar) {
        return { data: [{ estado: 'SOLAPE',
          mensaje: `Ahí ya está ${choque.literal} (${choque.nombre}).` }], error: null };
      }
      if (e) {
        e.pos_x_cm = args.p_x; e.pos_y_cm = args.p_y;
        e.rotacion_grados = args.p_rotacion ?? e.rotacion_grados;
        if (args.p_calle) e.calle = args.p_calle;
      }
      return { data: [{ estado: choque ? 'GUARDADO_CON_SOLAPE' : 'OK',
        mensaje: `${e?.literal ?? ''} queda en x=${args.p_x}, y=${args.p_y}.` }], error: null };
    }
    if (nombre === 'fn_registrar_codigo_producto') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_registrar_codigo_producto', operacion: 'rpc', payload: args });
      const yaEs = DATOS.v_producto_codigos.find((c) => c.codigo === args.p_codigo);
      if (yaEs && yaEs.producto_id !== args.p_producto_id) {
        return { data: [{ estado: 'CONFLICTO',
          mensaje: `El código ${args.p_codigo} ya pertenece a otro producto.`, codigo_id: null }], error: null };
      }
      DATOS.v_producto_codigos.push({
        producto_id: args.p_producto_id, codigo: args.p_codigo, tipo: args.p_tipo ?? 'EAN13',
        principal: false, activo: true, presentacion_id: args.p_presentacion_id ?? null,
        unidades_por_lectura: 1,
      });
      return { data: [{ estado: 'AGREGADO',
        mensaje: `Código ${args.p_codigo} agregado. El código anterior sigue funcionando.`,
        codigo_id: 'cod-nuevo' }], error: null };
    }
    if (nombre === 'fn_agregar_linea_ingreso') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_agregar_linea_ingreso', operacion: 'rpc', payload: args });
      const pres = DATOS.presentaciones.find((x) => x.id === args.p_presentacion_id);
      const factor = Number(pres?.factor ?? 1);
      const cantidad = Number(args.p_bultos) * factor;
      const doc = args.p_bultos_documento == null
        ? cantidad : Number(args.p_bultos_documento) * factor;
      const prod = DATOS.v_pos_productos.find((x) => x.producto_id === args.p_producto_id);

      DATOS.ingreso_detalle.push({
        cantidad,
        cantidad_documento: doc,
        bultos: Number(args.p_bultos),
        costo_unitario: Number(args.p_costo_bulto) / factor,
        costo_bulto: Number(args.p_costo_bulto),
        subtotal: cantidad * (Number(args.p_costo_bulto) / factor),
        codigo_lote: args.p_codigo_lote ?? null,
        fecha_caducidad: args.p_fecha_caducidad ?? null,
        codigo_verificado: Boolean(args.p_codigo_escaneado),
        presentaciones: pres ? { nombre: pres.nombre, factor } : null,
        productos: { codigo: prod?.codigo ?? '—', nombre: prod?.nombre ?? '—',
                     unidad_medida: prod?.unidad ?? 'UND' },
      });

      if (cantidad !== doc) {
        return { data: [{ estado: 'DIFERENCIA',
          mensaje: `Anotado: la factura dice ${doc} y se recibieron ${cantidad}.`,
          detalle_id: 'det-1' }], error: null };
      }
      return { data: [{ estado: 'OK',
        mensaje: `${args.p_bultos} x ${factor} = ${cantidad} unidades.`,
        detalle_id: 'det-1' }], error: null };
    }
    if (nombre === 'fn_sugerir_precios') {
      const costo = Number(args.p_costo_unitario);
      const pm = Math.ceil(costo * 1.25 * 100) / 100;
      const py = Math.ceil(costo * 1.12 * 100) / 100;
      return { data: [{ costo_unitario: costo, margen_menor: 25, precio_menor: pm,
        margen_mayor: 12, precio_mayor: py, utilidad_menor: pm - costo,
        utilidad_mayor: py - costo,
        nota: `Sugerencia: $${pm} la unidad al público y $${py} al por mayor.` }], error: null };
    }
    if (nombre === 'fn_mi_perfil') {
      return { data: [{ usuario_id: 'u-1', nombre: 'prueba@itsanet.com', rol: 'ADMIN',
                        bodega_id: BODEGA, tipo_negocio: 'MARKET' }], error: null };
    }
    if (nombre === 'fn_estado_instalacion') {
      return {
        data: [{
          completada: !SIN_INSTALAR,
          tipo_negocio: SIN_INSTALAR ? null : 'MARKET',
          hay_usuarios: true,
        }],
        error: null,
      };
    }
    if (nombre === 'fn_completar_instalacion') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_completar_instalacion', operacion: 'rpc', payload: args });
      const t = DATOS.tipos_negocio.find((x) => x.codigo === args.p_tipo_negocio);
      return {
        data: {
          ok: true,
          tipo_negocio: args.p_tipo_negocio,
          unidades_activas: t?.unidades.length ?? 0,
          categorias_creadas: t?.categorias.length ?? 0,
          zonas_creadas: (t?.zonas ?? []).length,
          sede_id: 'sede-1',
        },
        error: null,
      };
    }
    if (nombre === 'fn_crear_estructura') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_crear_estructura', operacion: 'rpc', payload: args });
      return { data: 'est-nueva', error: null };
    }
    if (nombre === 'fn_redimensionar_estructura') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_redimensionar_estructura', operacion: 'rpc', payload: args });
      if (args.p_columnas < 2 || args.p_niveles < 2) {
        return { data: null, error: { message:
          'No se puede encoger: 1 posiciones todavía tienen producto (ECM-A-02-1). ' +
          'Mueva primero esos productos a otra ubicación.' } };
      }
      return { data: { ok: true, posiciones_creadas: 4, posiciones_eliminadas: 0 }, error: null };
    }
    if (nombre === 'fn_registrar_servicio') {
      window.__ESCRITURAS.push({ tabla: 'rpc:fn_registrar_servicio', operacion: 'rpc', payload: args });
      const s = DATOS.servicios_catalogo.find((x) => x.codigo === args.p_servicio_codigo);
      const com = s.comision_tipo === 'PORCENTAJE'
        ? Number(args.p_monto) * s.comision_valor / 100 : Number(s.comision_valor);
      return { data: { ok: true, id: 'vs-nueva', numero: 'SRV-2026-00002',
                       servicio: s.nombre, monto: args.p_monto, comision: com }, error: null };
    }
    if (nombre === 'fn_config_deuna') {
      const e = DATOS.empresa[0];
      return {
        data: [{
          activo: e.deuna_activo, modo: e.deuna_modo ?? 'QR_ESTATICO',
          qr_url: e.deuna_qr_url, qr_mime: e.deuna_qr_mime,
          titular: e.deuna_titular, telefono: e.deuna_telefono,
          instrucciones: e.deuna_instrucciones,
        }],
        error: null,
      };
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
