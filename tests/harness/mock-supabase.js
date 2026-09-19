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
      { id: 'cli-1', identificacion: '9999999999999', nombre: 'CONSUMIDOR FINAL', activo: true },
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
    v_ocupacion_layout: [
      {
        zona_id: 'z-per', zona_codigo: 'PER', zona: 'Perecibles', color_hex: '#22c55e',
        tipo_conservacion: 'AMBIENTE', orden: 1,
        ubicacion_id: 'u-1', ubicacion: 'PER-A-01-1', pasillo: 'A', estante: 1, nivel: 1,
        capacidad_maxima: 200, producto_id: 'prod-limon', producto_codigo: 'FRU-013',
        producto: 'Limón sutil', ean13: '7861000100017', stock: 40, porcentaje_ocupacion: 20,
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
        producto: 'Papas Ruffles 140g', ean13: '7861000100024', stock: 3, porcentaje_ocupacion: 1.5,
      },
    ],
    lotes: [
      { codigo_lote: 'L-20260919-FRU-013', fecha_caducidad: '2026-10-09', cantidad_disponible: 40, costo_unitario: 0.45 },
    ],
    v_pos_productos: [
      {
        producto_id: 'prod-limon',
        codigo: 'FRU-013',
        ean13: '7861000100017',
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
        ean13: '7861000100024',
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
      };
    }

    return api;
  }

  window.supabase = {
    createClient() {
      return {
        from: consulta,
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
