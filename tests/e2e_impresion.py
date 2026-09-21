"""
Pruebas del comprobante impreso.

QUÉ SE COMPRUEBA Y POR QUÉ

El recibo salía maquetado en A4 sobre una impresora térmica de 80 mm:
el papel quedaba con el texto arrinconado arriba a la izquierda y la
columna de los valores cortada. La causa era que el comprobante se
componía dentro de un iframe oculto, y Chrome, al imprimir un marco,
aplica el tamaño de página del documento PRINCIPAL y descarta el @page
del marco.

Estas pruebas miran lo que de verdad importa en el papel:
  · que la regla @page declare el ancho del rollo y no A4,
  · que esa regla viva en el documento principal (no en un iframe),
  · que el cuerpo mida la zona imprimible (72 mm en el rollo de 80),
  · que no quede ninguna imagen —el logotipo salía como mancha gris—,
  · que al imprimir se oculte el resto de la aplicación,
  · que todo el texto sea negro, porque la térmica no tiene color,
  · y que el rollo de 58 mm cambie las medidas de verdad.

Uso:
    node tests/harness/generar_harness.mjs
    python3 -m http.server 8765        # desde la raíz del repositorio
    python3 tests/e2e_impresion.py
"""

import re
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8765/tests/harness/index.html"

fallos = []
errores_js = []


def revisar(descripcion, condicion, detalle=""):
    if condicion:
        print(f"  OK   {descripcion}")
    else:
        print(f"  FALLO {descripcion} {detalle}")
        fallos.append(descripcion)


# El diálogo de impresión bloquearía el navegador sin interfaz, así que
# se sustituye por un contador. Lo que se mide es el estado del
# documento en el instante en que la aplicación pide imprimir.
ESPIA = """
window.__IMPRESIONES = 0;
window.__ESTADO_AL_IMPRIMIR = null;
window.print = () => {
  window.__IMPRESIONES += 1;
  const caja = document.getElementById('comprobante-impresion');
  const estilo = document.getElementById('comprobante-impresion-estilo');
  window.__ESTADO_AL_IMPRIMIR = {
    hayCaja: Boolean(caja),
    hayEstilo: Boolean(estilo),
    css: estilo ? estilo.textContent : '',
    papel: caja ? caja.dataset.papelMm : null,
    anchoCaja: caja ? caja.getBoundingClientRect().width : 0,
    imagenes: caja ? caja.querySelectorAll('img, svg, canvas, picture').length : -1,
    // textContent y no innerText: en pantalla el recibo está apartado
    // con visibility:hidden para poder medirlo, e innerText devuelve
    // vacío para lo que no se ve.
    texto: caja ? caja.textContent : '',
    enIframe: document.querySelectorAll('iframe').length,
  };
};
"""

with sync_playwright() as p:
    navegador = p.chromium.launch()
    pagina = navegador.new_page()
    pagina.on("pageerror", lambda e: errores_js.append(str(e)))
    pagina.on("console", lambda m: errores_js.append(m.text) if m.type == "error" else None)

    pagina.goto(BASE, wait_until="networkidle", timeout=20000)
    pagina.wait_for_timeout(600)
    pagina.evaluate(ESPIA)

    # ---------------------------------------------------------
    print("\n--- El comprobante se imprime en el rollo, no en A4")
    pagina.evaluate("""async () => {
      const m = await import('/web/js/lib/comprobante.js');
      window.__comprobante = m;
      await m.imprimirComprobante('venta-1');
    }""")
    pagina.wait_for_timeout(400)

    estado = pagina.evaluate("window.__ESTADO_AL_IMPRIMIR")
    revisar("la aplicación llegó a pedir la impresión", estado is not None)

    if estado:
        css = estado["css"]

        revisar("el recibo se insertó en la propia página", estado["hayCaja"])
        revisar("no se usó ningún iframe para imprimir",
                estado["enIframe"] == 0, f"(había {estado['enIframe']})")

        regla = re.search(r"@page\s*\{([^}]*)\}", css)
        revisar("se declara una regla @page", regla is not None)
        if regla:
            texto_regla = regla.group(1)
            medida = re.search(r"size:\s*(\d+)mm\s+(\d+(?:\.\d+)?)mm", texto_regla)

            # "size: 80mm auto" parece lo lógico para un rollo continuo
            # pero NO es CSS válido: el navegador descarta la regla
            # entera y se cae a A4. Tiene que haber DOS medidas.
            revisar("el tamaño de página lleva dos medidas (no 'auto', que invalida la regla)",
                    medida is not None, f"(decía '{texto_regla.strip()}')")
            if medida:
                ancho_mm, alto_mm = int(medida.group(1)), float(medida.group(2))
                revisar("el ancho de página es el rollo de 80 mm, no los 210 de A4",
                        ancho_mm == 80, f"({ancho_mm} mm)")
                revisar("el alto se midió sobre el recibo, no es una hoja entera",
                        40 <= alto_mm <= 200, f"({alto_mm} mm; A4 son 297)")
            revisar("el margen de página es cero: la térmica no tiene margen",
                    re.search(r"margin:\s*0", texto_regla) is not None)

        revisar("la caja declara el ancho del rollo que vino de la empresa",
                estado["papel"] == "80", f"(decía '{estado['papel']}')")

        # En pantalla el recibo está oculto —solo existe para imprimir—,
        # así que para medirlo hay que ponerse en modo impresión. Es lo
        # que ve la impresora, que es lo único que importa aquí.
        print("\n--- Medido tal como lo ve la impresora")
        pagina.emulate_media(media="print")
        pagina.wait_for_timeout(200)

        medido = pagina.evaluate("""() => {
          const caja = document.getElementById('comprobante-impresion');
          const otros = [...document.body.children].filter((el) => el.id !== 'comprobante-impresion');
          return {
            ancho: caja.getBoundingClientRect().width,
            visible: getComputedStyle(caja).display,
            anchoBody: document.body.getBoundingClientRect().width,
            otrosVisibles: otros.filter((el) => getComputedStyle(el).display !== 'none').length,
            fondo: getComputedStyle(caja).backgroundColor,
            colorTexto: getComputedStyle(caja.querySelector('.empresa')).color,
          };
        }""")
        pagina.emulate_media(media="screen")

        revisar("en modo impresión el recibo sí se dibuja",
                medido["visible"] == "block", f"(display: {medido['visible']})")

        # 72 mm a 96 px/pulgada = 272,1 px. Se admite holgura por el
        # redondeo del navegador.
        revisar("el cuerpo mide la zona imprimible (72 mm), no el papel entero",
                270 <= medido["ancho"] <= 275,
                f"({medido['ancho']:.1f} px; 72 mm son ~272 px)")
        revisar("el papel mide 80 mm (~302 px), no A4 (~794 px)",
                298 <= medido["anchoBody"] <= 306, f"({medido['anchoBody']:.1f} px)")
        revisar("no se imprime nada más de la aplicación",
                medido["otrosVisibles"] == 0, f"({medido['otrosVisibles']} elementos visibles)")
        revisar("el texto sale en negro puro",
                medido["colorTexto"] == "rgb(0, 0, 0)", f"({medido['colorTexto']})")

        print("\n--- Sin logotipo y sin color")
        revisar("no queda ninguna imagen en el papel",
                estado["imagenes"] == 0, f"(había {estado['imagenes']})")
        revisar("el logotipo de la empresa no viaja al recibo",
                "data:image" not in css and "logo" not in css.lower())
        revisar("todo el texto se fuerza a negro",
                re.search(r"color:\s*#000\s*!important", css) is not None)
        revisar("las imágenes quedan ocultas aunque alguien las agregue",
                re.search(r"img[^{]*\{[^}]*display:\s*none", css) is not None)

        print("\n--- Al imprimir solo sale el recibo")
        revisar("el resto de la aplicación se oculta en @media print",
                "@media print" in css and "body > *" in css)
        revisar("html y body se fuerzan al ancho del rollo",
                re.search(r"width:\s*80mm\s*!important", css) is not None)

        print("\n--- El contenido del papel")
        texto = estado["texto"]
        for esperado in ["MINIMARKET EL CULTIVO", "RUC: 1728605070001", "NOTA DE VENTA",
                         "001-001-000000001", "Guineo de seda", "TOTAL",
                         "9.87", "EFECTIVO", "RECIBIDO", "CAMBIO",
                         "DOCUMENTO SIN VALIDEZ TRIBUTARIA"]:
            revisar(f"el recibo incluye «{esperado}»", esperado in texto)

        revisar("las cantidades enteras se imprimen sin decimales",
                re.search(r"^\s*4\s", texto, re.M) is not None and "4.00" not in texto)

    # ---------------------------------------------------------
    print("\n--- Al terminar, la pantalla queda limpia")
    pagina.evaluate("window.dispatchEvent(new Event('afterprint'))")
    pagina.wait_for_timeout(200)
    revisar("el recibo se quita de la página",
            pagina.evaluate("document.getElementById('comprobante-impresion') === null"))
    revisar("y su hoja de estilos también",
            pagina.evaluate("document.getElementById('comprobante-impresion-estilo') === null"))

    # ---------------------------------------------------------
    print("\n--- El rollo de 58 mm cambia las medidas de verdad")
    medidas = pagina.evaluate("""() => {
      const a = window.__comprobante.anchoPapel({ ancho_papel_mm: 58 });
      const b = window.__comprobante.anchoPapel({ ancho_papel_mm: 80 });
      const c = window.__comprobante.anchoPapel({});
      return { a, b, c };
    }""")
    revisar("58 mm de papel dan 48 mm imprimibles",
            medidas["a"]["papel"] == 58 and medidas["a"]["util"] == 48, str(medidas["a"]))
    revisar("80 mm de papel dan 72 mm imprimibles",
            medidas["b"]["papel"] == 80 and medidas["b"]["util"] == 72, str(medidas["b"]))
    revisar("sin configurar, se asume el rollo estándar de 80 mm",
            medidas["c"]["papel"] == 80, str(medidas["c"]))
    revisar("la letra se achica en el rollo angosto",
            medidas["a"]["fuente"] < medidas["b"]["fuente"])

    navegador.close()

# ---------------------------------------------------------
reales = [e for e in errores_js if "Failed to load resource" not in e]
print("\n" + "=" * 55)
if reales:
    print(f"ERRORES DE JAVASCRIPT ({len(reales)}):")
    for e in reales[:10]:
        print("  -", e)
    fallos.append("errores de javascript")

if fallos:
    print(f"RESULTADO: {len(fallos)} comprobaciones fallaron")
    sys.exit(1)

print("RESULTADO: el comprobante sale listo para la impresora térmica")
