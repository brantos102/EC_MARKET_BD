// Venta activa: el carrito vive aquí, no dentro de la pantalla del POS.
//
// POR QUÉ: antes el carrito era una variable local de renderPOS, así que
// al navegar al mapa o a caducidades se destruía con la pantalla. El
// cajero perdía la venta a medio armar. Ahora el carrito vive en este
// módulo, sobrevive a la navegación, y un panel flotante lo muestra
// mientras el operador consulta cualquier otro módulo.
//
// Sigue sin reservar stock: la base de datos es la única autoridad y
// valida al confirmar (ver FLUJO_DE_TRABAJO.md).

import { calcularLinea, calcularImpuesto, totalizarCarrito } from './pricing.js';

const suscriptores = new Set();

const estado = {
  lineas: [],          // { producto, cantidad }
  tipoVenta: 'MENOR',
  clienteId: null,
  bodegaId: null,
  promos: [],
};

// ---------------------------------------------------------
// Lectura
// ---------------------------------------------------------
export function obtenerEstado() {
  return estado;
}

export function hayVentaActiva() {
  return estado.lineas.length > 0;
}

export function promoPara(producto) {
  const hoy = new Date().toISOString().slice(0, 10);
  const candidatas = estado.promos.filter((p) => {
    if (!p.activa) return false;
    if (p.vigencia_desde > hoy || p.vigencia_hasta < hoy) return false;
    if (p.aplica_tipo_venta !== 'AMBAS' && p.aplica_tipo_venta !== estado.tipoVenta) return false;
    return (p.promocion_alcance ?? []).some(
      (a) => a.producto_id === producto.producto_id || a.categoria_id === producto.categoria_id
    );
  });
  candidatas.sort((a, b) => b.prioridad - a.prioridad);
  return candidatas[0] ?? null;
}

/** Líneas con precio, promoción e impuesto ya calculados. */
export function lineasCalculadas() {
  return estado.lineas.map((l) => {
    const promo = promoPara(l.producto);
    const calculo = calcularLinea(l.producto, estado.tipoVenta, l.cantidad, promo);
    const impuesto = calcularImpuesto(calculo.totalConPromo, l.producto.tarifa_impuesto);
    return { ...l, calculo, impuesto };
  });
}

export function totales() {
  return totalizarCarrito(
    lineasCalculadas().map((l) => ({
      subtotal: l.calculo.totalConPromo,
      valor_impuesto: l.impuesto,
      descuento: l.calculo.descuento,
    }))
  );
}

// ---------------------------------------------------------
// Escritura
// ---------------------------------------------------------
export function configurar({ bodegaId, clienteId, promos }) {
  if (bodegaId !== undefined) estado.bodegaId = bodegaId;
  if (clienteId !== undefined) estado.clienteId = clienteId;
  if (promos !== undefined) estado.promos = promos;
  notificar();
}

export function fijarTipoVenta(tipo) {
  estado.tipoVenta = tipo;
  notificar();
}

/**
 * Agrega una unidad (o la cantidad indicada).
 * @returns {{ok: boolean, mensaje?: string}}
 */
export function agregar(producto, cantidad = 1) {
  if (!producto) return { ok: false, mensaje: 'Producto no válido' };

  const existente = estado.lineas.find((l) => l.producto.producto_id === producto.producto_id);
  const nueva = (existente?.cantidad ?? 0) + cantidad;

  if (nueva > Number(producto.stock)) {
    return {
      ok: false,
      mensaje: `Stock insuficiente de "${producto.nombre}": quedan ${Number(producto.stock).toFixed(2)} ${producto.unidad ?? ''}`,
    };
  }

  if (existente) existente.cantidad = nueva;
  else estado.lineas.push({ producto, cantidad });

  notificar();
  return { ok: true, mensaje: `${producto.nombre} agregado` };
}

export function cambiarCantidad(productoId, cantidad) {
  const linea = estado.lineas.find((l) => l.producto.producto_id === productoId);
  if (!linea) return { ok: false };

  if (cantidad <= 0) {
    estado.lineas = estado.lineas.filter((l) => l.producto.producto_id !== productoId);
    notificar();
    return { ok: true };
  }
  if (cantidad > Number(linea.producto.stock)) {
    return { ok: false, mensaje: `Stock insuficiente: quedan ${Number(linea.producto.stock).toFixed(2)}` };
  }
  linea.cantidad = cantidad;
  notificar();
  return { ok: true };
}

export function vaciar() {
  estado.lineas = [];
  notificar();
}

/**
 * Actualiza el stock conocido de un producto (lo llama el canal de
 * tiempo real cuando otra caja vende). Devuelve un aviso si la venta
 * en curso quedó por encima de lo disponible.
 */
export function actualizarStock(productoId, stockNuevo) {
  let aviso = null;
  for (const l of estado.lineas) {
    if (l.producto.producto_id === productoId) {
      l.producto.stock = stockNuevo;
      if (l.cantidad > stockNuevo) {
        aviso = `Otra caja acaba de vender "${l.producto.nombre}": quedan ${Number(stockNuevo).toFixed(2)} ` +
                `y tienes ${l.cantidad} en el carrito. Ajusta la cantidad antes de cobrar.`;
      }
    }
  }
  if (aviso) notificar();
  return aviso;
}

// ---------------------------------------------------------
// Suscripción
// ---------------------------------------------------------
export function suscribir(cb) {
  suscriptores.add(cb);
  return () => suscriptores.delete(cb);
}

function notificar() {
  for (const cb of suscriptores) {
    try {
      cb(estado);
    } catch (err) {
      console.error('Error notificando cambio de venta activa', err);
    }
  }
}
