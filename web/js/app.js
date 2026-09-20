import './auth.js';
import { onAuthReady } from './auth.js';
import { renderDashboard } from './dashboard.js';
import { renderProductos } from './productos.js';
import { renderBodegas } from './bodegas.js';
import { renderMovimientos } from './movimientos.js';
import { renderKardex } from './kardex.js';
import { renderIngresos } from './ingresos.js';
import { renderPOS, cerrarCanalPOS } from './pos.js';
import { renderLayout, cerrarLayout } from './layout.js';
import { renderCaducidades } from './caducidades.js';
import { renderPromociones } from './promociones.js';
import { renderAuditoria } from './auditoria.js';
import { renderReportes } from './reportes.js';
import { cerrarModal } from './lib/modal.js';
import { alternarPanel } from './lib/panel.js';
import { actualizarPanelVenta } from './lib/panel-venta.js';
import { renderAdmin } from './admin.js';
import { renderCompras } from './compras.js';
import { renderServicios } from './servicios.js';
import { aplicarRolEnMenu, limpiarPerfil } from './lib/sesion.js';
import { abrirPerfil } from './lib/perfil.js';
import { marcarActivo } from './lib/menu.js';
import { aplicarMarca } from './lib/marca.js';
import { estadoInstalacion, abrirInstalador, abrirConfiguracionConexion } from './instalador.js';

const routes = {
  dashboard:    { render: renderDashboard,    title: 'Dashboard' },
  pos:          { render: renderPOS,          title: 'Punto de venta' },
  ingresos:     { render: renderIngresos,     title: 'Ingreso de mercadería' },
  layout:       { render: renderLayout,       title: 'Mapa del market' },
  caducidades:  { render: renderCaducidades,  title: 'Control de caducidades' },
  promociones:  { render: renderPromociones,  title: 'Promociones de temporada' },
  productos:    { render: renderProductos,    title: 'Productos' },
  bodegas:      { render: renderBodegas,      title: 'Bodegas' },
  movimientos:  { render: renderMovimientos,  title: 'Ajuste manual de inventario' },
  kardex:       { render: renderKardex,       title: 'Kardex' },
  reportes:     { render: renderReportes,     title: 'Reportes' },
  auditoria:    { render: renderAuditoria,    title: 'Bitácora de auditoría' },
  compras:      { render: renderCompras,      title: 'Compras a proveedores' },
  servicios:    { render: renderServicios,    title: 'Recargas y servicios' },
  admin:        { render: renderAdmin,        title: 'Administración' },
};

const content = document.getElementById('content');
const pageTitle = document.getElementById('page-title');

async function navigate() {
  cerrarModal();
  // El panel flotante NO se cierra al navegar: ese es justamente su
  // propósito — seguir consultando mientras se cambia de módulo.
  const hash = (location.hash || '#dashboard').replace('#', '');
  const route = routes[hash] ?? routes.dashboard;

  // Al salir del punto de venta se libera la suscripción de tiempo real
  if (hash !== 'pos') cerrarCanalPOS();
  // Y al salir del mapa se libera la escena 3D, que ocupa memoria de la
  // tarjeta gráfica mientras esté viva.
  if (hash !== 'layout') cerrarLayout();

  marcarActivo();
  pageTitle.textContent = route.title;
  const tituloMovil = document.getElementById('titulo-movil');
  if (tituloMovil) tituloMovil.textContent = route.title;
  cerrarMenuMovil();
  document.body.classList.toggle('modo-pos', hash === 'pos');

  content.innerHTML = '<p class="loading">Cargando...</p>';
  // El panel de la venta en curso se muestra u oculta según el módulo:
  // en el punto de venta sobra, en cualquier otro es lo que evita
  // perder el carrito al ir a consultar algo.
  actualizarPanelVenta();
  try {
    await route.render(content);
  } catch (err) {
    content.innerHTML = `<p class="error">Error inesperado: ${err.message}</p>`;
    console.error(err);
  }
}

// ---------------------------------------------------------
// Menú en el celular
//
// En una pantalla angosta el menú lateral se convierte en un cajón. Se
// cierra al elegir un módulo, al tocar fuera y con Escape: si se quedara
// abierto, taparía justamente la pantalla a la que se acaba de entrar.
// ---------------------------------------------------------
const velo = document.getElementById('velo-menu');
const barraBoton = document.getElementById('btn-menu');

function cerrarMenuMovil() {
  document.body.classList.remove('menu-abierto');
  velo?.classList.add('hidden');
  barraBoton?.setAttribute('aria-expanded', 'false');
}

function alternarMenuMovil() {
  const abierto = document.body.classList.toggle('menu-abierto');
  velo?.classList.toggle('hidden', !abierto);
  barraBoton?.setAttribute('aria-expanded', String(abierto));
}

barraBoton?.addEventListener('click', alternarMenuMovil);
velo?.addEventListener('click', cerrarMenuMovil);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrarMenuMovil();
});

window.addEventListener('hashchange', navigate);

document.getElementById('btn-consulta-global')?.addEventListener('click', alternarPanel);
document.getElementById('btn-perfil')?.addEventListener('click', abrirPerfil);

// La pantalla de conexión se puede abrir sin haber iniciado sesión:
// es justamente para cuando la aplicación todavía no sabe a qué base
// hablar.
const pantallaInst = document.getElementById('instalador-screen');
const cuerpoInst = document.getElementById('instalador-contenido');

document.getElementById('btn-conexion')?.addEventListener('click', () => {
  document.getElementById('login-screen')?.classList.add('hidden');
  pantallaInst.classList.remove('hidden');
  document.getElementById('inst-titulo').textContent = 'Conexión a la base de datos';
  document.getElementById('inst-subtitulo').textContent =
    'Dónde vive el inventario de este negocio';
  const salir = document.getElementById('inst-salir');
  salir.classList.remove('hidden');
  salir.onclick = () => location.reload();
  abrirConfiguracionConexion(cuerpoInst);
});

onAuthReady(async (session) => {
  if (!session) {
    limpiarPerfil();
    return;
  }

  // Antes de pintar nada se comprueba si esta base ya fue instalada. Una
  // base recién migrada no tiene tipo de negocio ni catálogos, así que
  // llevar al usuario directo al dashboard sería mostrarle un sistema
  // vacío sin decirle qué le falta.
  const estado = await estadoInstalacion();
  if (!estado.completada) {
    document.getElementById('app-shell')?.classList.add('hidden');
    pantallaInst.classList.remove('hidden');
    await abrirInstalador(cuerpoInst, () => location.reload());
    return;
  }

  pantallaInst.classList.add('hidden');

  // La identidad (logotipo, nombre, lema, color) se lee de la base para
  // que cambiarla en Administración se vea de inmediato, sin editar HTML.
  await aplicarMarca();
  await aplicarRolEnMenu();
  const inicial = document.getElementById('perfil-inicial');
  if (inicial) inicial.textContent = (session.user?.email ?? '?').charAt(0);
  navigate();
});
