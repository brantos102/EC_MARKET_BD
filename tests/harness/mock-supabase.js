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
    empresa: [
      { id: true, razon_social: 'MARKET DE PRUEBA', nombre_comercial: 'Market',
        ruc: '1790016919001', direccion_matriz: 'Quito', telefono: '02-2000000',
        email: 'market@prueba.ec', establecimiento: '001', punto_emision: '001',
        ambiente: 'PRUEBAS', tipo_negocio: 'MARKET', obligado_contabilidad: false,
        pie_recibo: '¡Gracias por su compra!', logo_url: null },
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
        permite_fraccion: true,
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
        permite_fraccion: false,
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
