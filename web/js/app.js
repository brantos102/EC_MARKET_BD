import './auth.js';
import { onAuthReady } from './auth.js';
import { renderDashboard } from './dashboard.js';
import { renderProductos } from './productos.js';
import { renderBodegas } from './bodegas.js';
import { renderMovimientos } from './movimientos.js';
import { renderKardex } from './kardex.js';
import { renderIngresos } from './ingresos.js';
import { renderPOS, cerrarCanalPOS } from './pos.js';
import { renderLayout } from './layout.js';
import { renderCaducidades } from './caducidades.js';
import { renderPromociones } from './promociones.js';
import { renderAuditoria } from './auditoria.js';
import { renderReportes } from './reportes.js';
import { cerrarModal } from './lib/modal.js';
import { alternarPanel } from './lib/panel.js';
import { actualizarPanelVenta } from './lib/panel-venta.js';
import { renderAdmin } from './admin.js';
import { aplicarRolEnMenu, limpiarPerfil } from './lib/sesion.js';
import { abrirPerfil } from './lib/perfil.js';

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

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${hash}`);
  });
  pageTitle.textContent = route.title;
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

window.addEventListener('hashchange', navigate);

document.getElementById('btn-consulta-global')?.addEventListener('click', alternarPanel);
document.getElementById('btn-perfil')?.addEventListener('click', abrirPerfil);

onAuthReady(async (session) => {
  if (!session) {
    limpiarPerfil();
    return;
  }
  await aplicarRolEnMenu();
  const inicial = document.getElementById('perfil-inicial');
  if (inicial) inicial.textContent = (session.user?.email ?? '?').charAt(0);
  navigate();
});
