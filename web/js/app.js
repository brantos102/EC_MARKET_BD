import './auth.js';
import { onAuthReady } from './auth.js';
import { renderDashboard } from './dashboard.js';
import { renderProductos } from './productos.js';
import { renderBodegas } from './bodegas.js';
import { renderMovimientos } from './movimientos.js';
import { renderKardex } from './kardex.js';

const routes = {
  dashboard: { render: renderDashboard, title: 'Dashboard' },
  productos: { render: renderProductos, title: 'Productos' },
  bodegas: { render: renderBodegas, title: 'Bodegas' },
  movimientos: { render: renderMovimientos, title: 'Registrar movimiento' },
  kardex: { render: renderKardex, title: 'Kardex' },
};

const content = document.getElementById('content');
const pageTitle = document.getElementById('page-title');
const navLinks = document.querySelectorAll('.nav-link');

async function navigate() {
  const hash = (location.hash || '#dashboard').replace('#', '');
  const route = routes[hash] ?? routes.dashboard;

  navLinks.forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${hash}`);
  });
  pageTitle.textContent = route.title;
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
