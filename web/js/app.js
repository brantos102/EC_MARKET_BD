import './auth.js';
import { onAuthReady } from './auth.js';
import { renderDashboard } from './dashboard.js';
import { renderProductos } from './productos.js';
import { renderBodegas } from './bodegas.js';
import { renderMovimientos } from './movimientos.js';
import { renderKardex } from './kardex.js';
import { renderIngresos } from './ingresos.js';
import { renderPOS } from './pos.js';
import { renderLayout } from './layout.js';
import { renderCaducidades } from './caducidades.js';
import { renderPromociones } from './promociones.js';
import { renderAuditoria } from './auditoria.js';
import { renderReportes } from './reportes.js';
import { cerrarModal } from './lib/modal.js';

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
};

const content = document.getElementById('content');
const pageTitle = document.getElementById('page-title');

async function navigate() {
  cerrarModal();
  const hash = (location.hash || '#dashboard').replace('#', '');
  const route = routes[hash] ?? routes.dashboard;

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${hash}`);
  });
  pageTitle.textContent = route.title;
  document.body.classList.toggle('modo-pos', hash === 'pos');

  content.innerHTML = '<p class="loading">Cargando...</p>';
  try {
    await route.render(content);
  } catch (err) {
    content.innerHTML = `<p class="error">Error inesperado: ${err.message}</p>`;
    console.error(err);
  }
}

window.addEventListener('hashchange', navigate);

onAuthReady((session) => {
  if (session) navigate();
});
