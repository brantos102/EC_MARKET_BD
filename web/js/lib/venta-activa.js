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
import { normalizar, formatear } from './cantidad.js';

const suscriptores = new Set();

const estado = {
  lineas: [],          // { producto, cantidad }
  tipoVenta: 'MENOR',
  clienteId: null,
  clienteNombre: 'CONSUMIDOR FINAL',
  clienteIdentificacion: '9999999999999',
  tipoComprobante: 'NOTA_VENTA',
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
export function configurar({ bodegaId, clienteId, promos,
                             clienteNombre, clienteIdentificacion, tipoComprobante }) {
  if (bodegaId !== undefined) estado.bodegaId = bodegaId;
  if (clienteId !== undefined) estado.clienteId = clienteId;
  if (promos !== undefined) estado.promos = promos;
  if (clienteNombre !== undefined) estado.clienteNombre = clienteNombre;
  if (clienteIdentificacion !== undefined) estado.clienteIdentificacion = clienteIdentificacion;
  if (tipoComprobante !== undefined) estado.tipoComprobante = tipoComprobante;
  notificar();
}

/** Tras cobrar se vuelve a consumidor final: es el caso por defecto. */
export function reiniciarCliente(clienteIdConsumidorFinal) {
  estado.clienteId = clienteIdConsumidorFinal ?? estado.clienteId;
  estado.clienteNombre = 'CONSUMIDOR FINAL';
  estado.clienteIdentificacion = '9999999999999';
  estado.tipoComprobante = 'NOTA_VENTA';
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
export function agregar(producto, cantidad = null) {
  if (!producto) return { ok: false, mensaje: 'Producto no válido' };

  // Cada lectura del escáner suma 1, siempre: el lector no sabe pesar,
  // solo dice "pasó un producto más". En algo que se vende por libra eso
  // significa una libra, que el cajero corrige con el teclado de peso si
  // la balanza marca otra cosa. Los botones + y − sí se mueven por el
  // paso del producto, pero eso lo resuelve sumarPaso(), no esto.
  const incremento = cantidad === null ? 1 : Number(cantidad);

  const existente = estado.lineas.find((l) => l.producto.producto_id === producto.producto_id);
  const bruto = (existente?.cantidad ?? 0) + incremento;
  const ajuste = normalizar(bruto, producto);
  const nueva = ajuste.cantidad;

  if (nueva <= 0) return { ok: false, mensaje: 'La cantidad debe ser mayor que cero' };

  if (nueva > Number(producto.stock)) {
    return {
      ok: false,
      mensaje: `Stock insuficiente de "${producto.nombre}": quedan ${Number(producto.stock).toFixed(2)} ${producto.unidad ?? ''}`,
    };
  }

  if (existente) existente.cantidad = nueva;
  else estado.lineas.push({ producto, cantidad: nueva });

  notificar();
  return {
    ok: true,
    mensaje: `${producto.nombre} · ${formatear(nueva, producto)} ${producto.unidad ?? ''}`.trim(),
  };
}

export function cambiarCantidad(productoId, cantidad) {
  const linea = estado.lineas.find((l) => l.producto.producto_id === productoId);
  if (!linea) return { ok: false };

  if (Number(cantidad) <= 0) {
    estado.lineas = estado.lineas.filter((l) => l.producto.producto_id !== productoId);
    notificar();
    return { ok: true };
  }

  // Si escribieron 1,03 en algo que se vende por unidad, se corrige a 1 y
  // se avisa. Se guarda el valor corregido igual: dejar el campo en rojo
  // y la línea sin actualizar confunde más de lo que ayuda.
  const ajuste = normalizar(cantidad, linea.producto);

  if (ajuste.cantidad > Number(linea.producto.stock)) {
    notificar();
    return {
      ok: false,
      mensaje: `Stock insuficiente de "${linea.producto.nombre}": ` +
               `quedan ${formatear(linea.producto.stock, linea.producto)} ${linea.producto.unidad ?? ''}`.trim(),
    };
  }

  linea.cantidad = ajuste.cantidad;
  notificar();
  return ajuste.ok ? { ok: true } : { ok: false, mensaje: ajuste.mensaje };
}

/**
 * Fija a mano el precio por unidad de una línea.
 *
 * PARA QUÉ. Lo que se vende al peso cambia de precio seguido: la libra
 * de pollo sube, la de papa baja con la cosecha. El cajero tiene el
 * producto en la balanza y el cliente delante; obligarlo a irse a
 * Administración a corregir el precio antes de cobrar es la forma
 * segura de que termine cobrando el precio viejo.
 *
 * El precio fijado vale SOLO para esta línea y esta venta: se clona el
 * producto para no tocar el catálogo que comparten las demás pantallas.
 * Guardarlo en el producto es una acción aparte y explícita.
 *
 * Se anula el salto automático a precio de mayorista, porque un precio
 * escrito a mano que la aplicación cambie sola sería peor que no
 * poder escribirlo.
 */
export function fijarPrecioUnitario(productoId, precio) {
  const linea = estado.lineas.find((l) => l.producto.producto_id === productoId);
  if (!linea) return { ok: false, mensaje: 'Esa línea ya no está en la venta' };

  const p = Number(precio);
  if (!Number.isFinite(p) || p <= 0) {
    return { ok: false, mensaje: 'El precio tiene que ser mayor que cero' };
  }

  linea.producto = {
    ...linea.producto,
    precio_venta_menor: p,
    precio_venta_mayor: p,
    cantidad_minima_mayor: 0,
    precio_original: linea.producto.precio_original ?? Number(linea.producto.precio_venta_menor ?? 0),
    precio_editado: true,
  };
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
