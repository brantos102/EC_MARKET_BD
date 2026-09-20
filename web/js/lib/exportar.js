// Exportación de cualquier tabla del sistema a CSV, Excel o PDF.
//
// DECISIONES QUE VALE LA PENA EXPLICAR:
//
// 1. Las librerías (SheetJS para Excel, jsPDF para PDF) se cargan solo
//    cuando alguien exporta. Son 250 KB y 500 KB: cargarlas al arrancar
//    haría más lenta la apertura de la caja todos los días para una
//    función que se usa una vez por semana.
//
// 2. Están guardadas en web/js/vendor/, no traídas de un CDN. El día que
//    la tienda se quede sin internet, la caja tiene que seguir abriendo
//    y el dueño tiene que poder sacar su reporte.
//
// 3. El CSV se arma a mano y sale con BOM UTF-8. Sin el BOM, Excel en
//    Windows abre "Cantón" como "CantÃ³n", y el usuario concluye,
//    razonablemente, que el sistema está roto.

const cargadas = new Map();

/**
 * Carga un <script> clásico una sola vez y espera a que esté listo.
 *
 * La ruta se calcula desde la URL de ESTE módulo, no desde la de la
 * página. Con una ruta relativa a la página, el banco de pruebas —que
 * vive en otra carpeta— buscaría las librerías donde no están, y la
 * exportación fallaría solo ahí, que es la peor clase de fallo: el que
 * no aparece hasta producción o el que aparece solo en las pruebas.
 */
function cargarScript(archivo) {
  if (cargadas.has(archivo)) return cargadas.get(archivo);

  const promesa = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL(`../vendor/${archivo}`, import.meta.url).href;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(
      `No se encontró ${archivo}. Verifique que la carpeta js/vendor esté completa.`));
    document.head.appendChild(s);
  });

  cargadas.set(archivo, promesa);
  return promesa;
}

// =========================================================
// Utilidades comunes
// =========================================================

/** Nombre de archivo sin caracteres que Windows rechaza. */
function nombreArchivo(base, extension) {
  const fecha = new Date().toISOString().slice(0, 10);
  const limpio = String(base)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim().replace(/\s+/g, '_')
    .slice(0, 60) || 'reporte';
  return `${limpio}_${fecha}.${extension}`;
}

function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se libera después de que el navegador haya empezado la descarga.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Normaliza lo que recibe a { columnas, filas }.
 * Acepta { columnas:[{key,label}], filas:[{}] } o un arreglo de objetos.
 */
function normalizar(datos) {
  if (Array.isArray(datos)) {
    const claves = [...new Set(datos.flatMap((f) => Object.keys(f)))];
    return {
      columnas: claves.map((k) => ({ key: k, label: k })),
      filas: datos,
    };
  }
  return { columnas: datos.columnas ?? [], filas: datos.filas ?? [] };
}

function valor(fila, col) {
  const v = fila[col.key];
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toLocaleDateString('es-EC');
  return v;
}

// =========================================================
// CSV
// =========================================================
export function exportarCSV(datos, titulo = 'reporte') {
  const { columnas, filas } = normalizar(datos);

  const escapar = (v) => {
    const t = String(v ?? '');
    // Coma, comillas o salto de línea obligan a entrecomillar.
    return /[",\n\r;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };

  const lineas = [
    columnas.map((c) => escapar(c.label ?? c.key)).join(','),
    ...filas.map((f) => columnas.map((c) => escapar(valor(f, c))).join(',')),
  ];

  // ﻿ es el BOM: sin él Excel en Windows rompe los acentos.
  const blob = new Blob(['﻿' + lineas.join('\r\n')],
    { type: 'text/csv;charset=utf-8;' });
  descargar(blob, nombreArchivo(titulo, 'csv'));
  return { ok: true, filas: filas.length };
}

// =========================================================
// Excel
// =========================================================
export async function exportarExcel(datos, titulo = 'reporte', meta = {}) {
  await cargarScript('xlsx.mini.min.js');
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error('No se pudo cargar el generador de Excel');

  const { columnas, filas } = normalizar(datos);

  // Encabezado con los datos de la empresa: un archivo que sale del
  // sistema y llega al contador tiene que decir de quién es.
  const cabecera = [];
  if (meta.empresa) cabecera.push([meta.empresa]);
  if (meta.ruc) cabecera.push([`RUC: ${meta.ruc}`]);
  cabecera.push([titulo]);
  cabecera.push([`Generado: ${new Date().toLocaleString('es-EC')}`]);
  if (meta.filtro) cabecera.push([`Filtro: ${meta.filtro}`]);
  cabecera.push([]);

  const cuerpo = [
    columnas.map((c) => c.label ?? c.key),
    ...filas.map((f) => columnas.map((c) => {
      const v = valor(f, c);
      // Un número guardado como texto no se puede sumar en Excel, que es
      // justamente lo primero que hace quien abre el archivo.
      const n = typeof v === 'string' ? Number(v.replace(/[$\s]/g, '').replace(',', '.')) : v;
      return (typeof v !== 'boolean' && v !== '' && Number.isFinite(n) && /^[-$\s\d.,]+$/.test(String(v)))
        ? n : v;
    })),
  ];

  const hoja = XLSX.utils.aoa_to_sheet([...cabecera, ...cuerpo]);

  // Ancho de columna según el contenido más largo, con tope para que
  // una observación de 300 caracteres no deje la hoja inservible.
  hoja['!cols'] = columnas.map((c, i) => {
    const largos = filas.map((f) => String(valor(f, c)).length);
    const max = Math.max(String(c.label ?? c.key).length, ...largos, 8);
    return { wch: Math.min(max + 2, 45) };
  });

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, titulo.slice(0, 28) || 'Reporte');
  XLSX.writeFile(libro, nombreArchivo(titulo, 'xlsx'));
  return { ok: true, filas: filas.length };
}

// =========================================================
// PDF
// =========================================================
export async function exportarPDF(datos, titulo = 'reporte', meta = {}) {
  await cargarScript('jspdf.umd.min.js');
  await cargarScript('jspdf.autotable.js');

  const jsPDFCtor = window.jspdf?.jsPDF;
  if (!jsPDFCtor) throw new Error('No se pudo cargar el generador de PDF');

  const { columnas, filas } = normalizar(datos);

  // Horizontal cuando hay muchas columnas: en vertical se aprietan
  // tanto que el reporte deja de leerse.
  const doc = new jsPDFCtor({
    orientation: columnas.length > 6 ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const ancho = doc.internal.pageSize.getWidth();
  let y = 40;

  // Logotipo, si la empresa cargó uno y es una imagen que jsPDF entiende
  if (meta.logo && /^data:image\/(png|jpeg)/.test(meta.logo)) {
    try {
      doc.addImage(meta.logo, 'PNG', 40, y - 12, 46, 46);
    } catch {
      // Un logotipo que no se pudo dibujar no puede impedir el reporte.
    }
  }

  const margenTexto = meta.logo ? 96 : 40;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(1, 61, 16);
  doc.text(meta.empresa ?? 'Reporte', margenTexto, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90, 107, 92);
  if (meta.ruc) doc.text(`RUC: ${meta.ruc}`, margenTexto, y + 18);
  if (meta.sede) doc.text(meta.sede, margenTexto, y + 30);

  doc.setFontSize(11);
  doc.setTextColor(22, 36, 26);
  doc.text(titulo, margenTexto, y + 46);

  doc.setFontSize(8);
  doc.setTextColor(120, 130, 122);
  doc.text(`Generado: ${new Date().toLocaleString('es-EC')}`, ancho - 40, y + 4, { align: 'right' });
  if (meta.filtro) {
    doc.text(String(meta.filtro).slice(0, 90), ancho - 40, y + 16, { align: 'right' });
  }

  doc.autoTable({
    startY: y + 58,
    head: [columnas.map((c) => c.label ?? c.key)],
    body: filas.map((f) => columnas.map((c) => String(valor(f, c)))),
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [1, 61, 16], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 247, 241] },
    margin: { left: 40, right: 40 },
    didDrawPage: (d) => {
      const pagina = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(140, 150, 142);
      doc.text(`Página ${d.pageNumber} de ${pagina}`,
        ancho / 2, doc.internal.pageSize.getHeight() - 20, { align: 'center' });
    },
  });

  // Totales de las columnas numéricas, que es lo que se busca al abrir
  // un reporte de ventas o de inventario.
  if (meta.totalizar?.length) {
    let ty = doc.lastAutoTable.finalY + 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(22, 36, 26);
    for (const clave of meta.totalizar) {
      const col = columnas.find((c) => c.key === clave);
      if (!col) continue;
      const suma = filas.reduce((acc, f) => {
        const n = Number(String(valor(f, col)).replace(/[$\s]/g, '').replace(',', '.'));
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0);
      doc.text(`${col.label ?? col.key}: ${suma.toFixed(2)}`, 40, ty);
      ty += 14;
    }
  }

  doc.save(nombreArchivo(titulo, 'pdf'));
  return { ok: true, filas: filas.length };
}

// =========================================================
// Barra de botones reutilizable
// =========================================================
/**
 * Devuelve el HTML de los tres botones. `id` los distingue cuando hay
 * más de una tabla exportable en la misma pantalla.
 */
export function botonesExportar(id = 'exp') {
  return `
    <div class="exportar-barra" data-exp="${id}">
      <span class="exportar-etiqueta">Exportar</span>
      <button type="button" class="btn-exp" data-formato="excel" data-exp-id="${id}"
              title="Abrir en Excel con las columnas numéricas listas para sumar">Excel</button>
      <button type="button" class="btn-exp" data-formato="pdf" data-exp-id="${id}"
              title="PDF con el logotipo y los datos de la empresa">PDF</button>
      <button type="button" class="btn-exp" data-formato="csv" data-exp-id="${id}"
              title="Archivo de texto separado por comas, para otros sistemas">CSV</button>
      <span class="exportar-msg" data-exp-msg="${id}"></span>
    </div>`;
}

/**
 * Conecta los botones con los datos. `obtener()` se llama en el momento
 * de exportar, no antes: así el archivo sale con el filtro que el
 * usuario tiene puesto en ese instante, no con el que había al pintar.
 */
export function conectarExportar(contenedor, id, obtener, titulo, meta = {}) {
  contenedor.querySelectorAll(`[data-exp-id="${id}"]`).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const msg = contenedor.querySelector(`[data-exp-msg="${id}"]`);
      const datos = obtener();
      const { filas } = normalizar(datos);

      if (!filas.length) {
        if (msg) {
          msg.textContent = 'No hay filas que exportar con el filtro actual.';
          msg.className = 'exportar-msg error';
        }
        return;
      }

      if (msg) {
        msg.textContent = 'Generando…';
        msg.className = 'exportar-msg';
      }

      try {
        const t = typeof titulo === 'function' ? titulo() : titulo;
        const m = typeof meta === 'function' ? meta() : meta;

        if (btn.dataset.formato === 'csv') exportarCSV(datos, t);
        else if (btn.dataset.formato === 'excel') await exportarExcel(datos, t, m);
        else await exportarPDF(datos, t, m);

        if (msg) {
          msg.textContent = `${filas.length} filas exportadas.`;
          msg.className = 'exportar-msg ok';
        }
      } catch (err) {
        if (msg) {
          msg.textContent = err.message;
          msg.className = 'exportar-msg error';
        }
      }
    });
  });
}

/** Datos de la empresa para el encabezado de los archivos. */
export function metaDeEmpresa(empresa, extra = {}) {
  return {
    empresa: empresa?.nombre_comercial || empresa?.razon_social || 'Reporte',
    ruc: empresa?.ruc ?? null,
    logo: empresa?.logo_url ?? null,
    ...extra,
  };
}
