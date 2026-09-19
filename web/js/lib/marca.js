// Identidad visual leída de la base de datos.
//
// EL BUG QUE ESTO CORRIGE: el logotipo estaba escrito a mano en el HTML
// (<img src="img/logo-menu.png">), así que cambiarlo desde Administración
// guardaba el dato en `empresa.logo_url` y no pasaba nada en pantalla.
// Ahora el HTML trae el archivo local solo como imagen inicial, y en
// cuanto llega la fila de `empresa` se reemplaza por lo que el
// administrador haya cargado: logotipo, nombre, lema y color de marca.

import { supabase } from '../supabaseClient.js';

let empresa = null;

export function empresaActual() {
  return empresa;
}

/** Vuelve a leer la empresa y repinta. Se llama tras guardar en Administración. */
export async function refrescarMarca() {
  empresa = null;
  return aplicarMarca();
}

export async function aplicarMarca() {
  if (!empresa) {
    const { data, error } = await supabase.from('empresa').select('*').limit(1).maybeSingle();
    if (error || !data) return null;      // base sin migrar: se queda el logo del archivo
    empresa = data;
  }

  const nombre = empresa.nombre_comercial || empresa.razon_social || 'Minimarket';
  const lema = empresa.pie_recibo || '';

  // Logotipo del menú y del login
  if (empresa.logo_url) {
    for (const img of document.querySelectorAll('.logo-menu, .login-logo')) {
      img.src = empresa.logo_url;
      img.alt = nombre;
    }
    // Ícono de la pestaña: solo si es una imagen que el navegador puede
    // usar como favicon (PNG, SVG o data URI). Un .ico externo se deja.
    if (/^data:image\/(png|svg\+xml|jpeg);/.test(empresa.logo_url) ||
        /\.(png|svg)$/i.test(empresa.logo_url)) {
      let icono = document.querySelector('link[rel="icon"]');
      if (!icono) {
        icono = document.createElement('link');
        icono.rel = 'icon';
        document.head.appendChild(icono);
      }
      icono.href = empresa.logo_url;
    }
  }

  // Nombre y lema
  document.title = `${nombre} | Sistema de Gestión`;
  for (const el of document.querySelectorAll('.lema, .login-card .subtitle')) {
    if (lema) el.textContent = lema;
  }

  // Color de marca: solo si es un color hexadecimal válido, para que un
  // valor mal escrito no rompa la hoja de estilos entera.
  if (/^#[0-9a-fA-F]{6}$/.test(empresa.color_primario ?? '')) {
    document.documentElement.style.setProperty('--marca', empresa.color_primario);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', empresa.color_primario);
  }

  return empresa;
}

/**
 * Reduce una imagen a un cuadrado de `lado` píxeles y la devuelve como
 * data URI PNG.
 *
 * POR QUÉ: el logotipo se guarda dentro de la fila de `empresa`, y esa
 * fila viaja en cada carga de la aplicación. Un PNG de 2 MB convertido a
 * base64 pesa 2,7 MB y haría lentísimo el arranque de la caja. A 256 px
 * el logotipo se ve nítido en el menú y ocupa unas pocas decenas de KB.
 */
export function redimensionarImagen(archivo, lado = 256) {
  return new Promise((resolve, reject) => {
    if (!archivo.type.startsWith('image/')) {
      reject(new Error('El archivo seleccionado no es una imagen'));
      return;
    }
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('La imagen está dañada o el formato no es compatible'));
      img.onload = () => {
        const lienzo = document.createElement('canvas');
        lienzo.width = lado;
        lienzo.height = lado;
        const ctx = lienzo.getContext('2d');

        // Se encaja la imagen completa dentro del cuadrado, sin recortar:
        // un logotipo recortado es un logotipo arruinado.
        const escala = Math.min(lado / img.width, lado / img.height);
        const ancho = img.width * escala;
        const alto = img.height * escala;
        ctx.drawImage(img, (lado - ancho) / 2, (lado - alto) / 2, ancho, alto);

        resolve(lienzo.toDataURL('image/png'));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}
