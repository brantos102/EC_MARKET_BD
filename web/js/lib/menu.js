// Menú lateral: se arma leyendo la base, no una lista escrita en el código.
//
// fn_mis_modulos() devuelve los módulos que el rol del usuario puede ver,
// con su grupo, su ícono y su orden. Si el administrador cambia la matriz
// de permisos en la pantalla de Administración, el menú cambia en la
// siguiente sesión sin tocar un archivo.
//
// Esconder un módulo del menú NO es la protección: lo que protege son las
// políticas RLS de la base. Esto es comodidad, no seguridad.

import { supabase } from '../supabaseClient.js';
import { icono, flecha } from './iconos.js';

const CLAVE_ABIERTOS = 'elcultivo.menu.grupos';

// Orden en que se muestran los grupos. Lo que no esté aquí va al final.
const ORDEN_GRUPOS = ['Operación', 'Bodega', 'Catálogo', 'Control'];

// Respaldo si la base todavía no tiene la migración 010: el menú no se
// queda vacío, se arma con la estructura que ya traía la aplicación.
const RESPALDO = [
  { codigo: 'dashboard',   nombre: 'Dashboard',             grupo: 'Operación', icono: 'tablero',   orden: 10 },
  { codigo: 'pos',         nombre: 'Punto de venta',        grupo: 'Operación', icono: 'carrito',   orden: 20 },
  { codigo: 'ingresos',    nombre: 'Ingreso de mercadería', grupo: 'Operación', icono: 'entrada',   orden: 30 },
  { codigo: 'layout',      nombre: 'Mapa del market',       grupo: 'Bodega',    icono: 'mapa',      orden: 40 },
  { codigo: 'caducidades', nombre: 'Caducidades',           grupo: 'Bodega',    icono: 'reloj',     orden: 50 },
  { codigo: 'kardex',      nombre: 'Kardex',                grupo: 'Bodega',    icono: 'libro',     orden: 60 },
  { codigo: 'movimientos', nombre: 'Ajuste manual',         grupo: 'Bodega',    icono: 'ajuste',    orden: 70 },
  { codigo: 'productos',   nombre: 'Productos',             grupo: 'Catálogo',  icono: 'caja',      orden: 80 },
  { codigo: 'promociones', nombre: 'Promociones',           grupo: 'Catálogo',  icono: 'etiqueta',  orden: 90 },
  { codigo: 'bodegas',     nombre: 'Bodegas',               grupo: 'Catálogo',  icono: 'almacen',   orden: 100 },
  { codigo: 'compras',     nombre: 'Compras a proveedores', grupo: 'Catálogo',  icono: 'camion',    orden: 105 },
  { codigo: 'reportes',    nombre: 'Reportes',              grupo: 'Control',   icono: 'grafico',   orden: 110 },
  { codigo: 'auditoria',   nombre: 'Auditoría',             grupo: 'Control',   icono: 'escudo',    orden: 120 },
  { codigo: 'admin',       nombre: 'Administración',        grupo: 'Control',   icono: 'engranaje', orden: 130 },
];

let modulos = [];

/** Módulos visibles para el usuario de la sesión. */
export function modulosVisibles() {
  return modulos;
}

export function puedeEditar(codigo) {
  return modulos.find((m) => m.codigo === codigo)?.puede_editar ?? false;
}

function leerAbiertos() {
  try {
    const guardado = localStorage.getItem(CLAVE_ABIERTOS);
    if (guardado) return new Set(JSON.parse(guardado));
  } catch {
    // Navegador con almacenamiento bloqueado: se abren todos y ya.
  }
  return null;
}

function guardarAbiertos(set) {
  try {
    localStorage.setItem(CLAVE_ABIERTOS, JSON.stringify([...set]));
  } catch {
    // Sin almacenamiento el menú sigue funcionando, solo no recuerda
    // qué grupos dejó abiertos el usuario.
  }
}

/**
 * Construye el menú dentro del elemento indicado.
 * @param {HTMLElement} destino contenedor <div class="nav-modulos">
 */
export async function construirMenu(destino) {
  if (!destino) return;

  const { data, error } = await supabase.rpc('fn_mis_modulos');

  if (error || !Array.isArray(data) || data.length === 0) {
    modulos = RESPALDO.map((m) => ({ ...m, puede_ver: true, puede_editar: true }));
  } else {
    modulos = data.filter((m) => m.puede_ver);
  }

  // Agrupar respetando el orden de cada módulo
  const grupos = new Map();
  for (const m of [...modulos].sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999))) {
    if (!grupos.has(m.grupo)) grupos.set(m.grupo, []);
    grupos.get(m.grupo).push(m);
  }

  const ordenados = [...grupos.entries()].sort((a, b) => {
    const ia = ORDEN_GRUPOS.indexOf(a[0]);
    const ib = ORDEN_GRUPOS.indexOf(b[0]);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Por defecto se abre todo; luego manda lo que el usuario dejó abierto.
  const guardados = leerAbiertos();
  const abiertos = guardados ?? new Set(ordenados.map(([g]) => g));

  destino.innerHTML = ordenados.map(([grupo, items]) => `
    <section class="nav-grupo-bloque ${abiertos.has(grupo) ? 'abierto' : ''}" data-grupo="${escapar(grupo)}">
      <button type="button" class="nav-grupo-btn" aria-expanded="${abiertos.has(grupo)}">
        <span class="nav-grupo-texto">${escapar(grupo)}</span>
        <span class="nav-grupo-cuenta">${items.length}</span>
        ${flecha()}
      </button>
      <div class="nav-submenu">
        ${items.map((m) => `
          <a href="#${m.codigo}" class="nav-link ${m.codigo === 'pos' ? 'destacado' : ''}"
             title="${escapar(m.descripcion ?? m.nombre)}">
            ${icono(m.icono ?? 'punto')}
            <span class="nav-texto">${escapar(m.nombre)}</span>
          </a>`).join('')}
      </div>
    </section>`).join('');

  destino.querySelectorAll('.nav-grupo-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const bloque = btn.closest('.nav-grupo-bloque');
      const grupo = bloque.dataset.grupo;
      const seAbre = !bloque.classList.contains('abierto');
      bloque.classList.toggle('abierto', seAbre);
      btn.setAttribute('aria-expanded', String(seAbre));
      if (seAbre) abiertos.add(grupo); else abiertos.delete(grupo);
      guardarAbiertos(abiertos);
    });
  });

  marcarActivo();
}

/**
 * Resalta el módulo actual y abre su grupo si estaba cerrado, para que
 * nunca quede una pantalla activa escondida en un grupo plegado.
 */
export function marcarActivo() {
  const hash = location.hash || '#dashboard';
  document.querySelectorAll('.nav-link').forEach((link) => {
    const activo = link.getAttribute('href') === hash;
    link.classList.toggle('active', activo);
    if (activo) {
      const bloque = link.closest('.nav-grupo-bloque');
      if (bloque && !bloque.classList.contains('abierto')) {
        bloque.classList.add('abierto');
        bloque.querySelector('.nav-grupo-btn')?.setAttribute('aria-expanded', 'true');
      }
    }
  });
}

function escapar(t) {
  const d = document.createElement('div');
  d.textContent = t ?? '';
  return d.innerHTML.replace(/"/g, '&quot;');
}
