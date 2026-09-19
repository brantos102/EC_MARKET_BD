// Genera tests/harness/index.html a partir de web/index.html, cambiando
// solo el cliente de Supabase por el simulado. Así la página de pruebas
// nunca se desincroniza del HTML real de la aplicación.

import { readFileSync, writeFileSync } from 'node:fs';

const origen = new URL('../../web/index.html', import.meta.url);
let html = readFileSync(origen, 'utf8');

html = html
  .replace('href="css/styles.css"', 'href="../../web/css/styles.css"')
  // Las imágenes también viven en web/, no junto al banco de pruebas
  .replaceAll('src="img/', 'src="../../web/img/')
  .replaceAll('href="img/', 'href="../../web/img/')
  .replace('<script src="js/vendor/supabase.umd.js"></script>', '<script src="mock-supabase.js"></script>')
  .replace('src="js/app.js"', 'src="../../web/js/app.js"')
  .replace('<title>', '<title>[PRUEBAS] ');

writeFileSync(new URL('./index.html', import.meta.url), html);
console.log('Harness de pruebas generado desde web/index.html');
