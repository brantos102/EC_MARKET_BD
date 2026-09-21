"""
Pruebas de recargas y servicios, del QR ampliado de De Una y de la
versión móvil.

Van aparte de e2e_pos.py porque la parte móvil necesita un navegador con
tamaño y gestos de teléfono, y mezclarlo con las pruebas de escritorio
haría que un fallo de una cosa pareciera de la otra.

Uso:
    node tests/harness/generar_harness.mjs
    python3 -m http.server 8765        # desde la raíz del repositorio
    python3 tests/e2e_servicios_movil.py
"""

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


with sync_playwright() as p:
    navegador = p.chromium.launch()

    # =========================================================
    # ESCRITORIO
    # =========================================================
    pagina = navegador.new_page(viewport={"width": 1440, "height": 900})
    pagina.on("pageerror", lambda e: errores_js.append(str(e)))
    pagina.on("console", lambda m: errores_js.append(m.text) if m.type == "error" else None)

    pagina.goto(BASE, wait_until="networkidle", timeout=20000)
    pagina.wait_for_timeout(900)

    # ---------------------------------------------------------
    print("\n--- Recargas: acceso al sistema externo")
    pagina.evaluate("location.hash = '#servicios'")
    pagina.wait_for_selector(".servicio-tarjeta", timeout=8000)
    pagina.wait_for_timeout(400)

    revisar("se ofrece el acceso a POSVirtual",
            "POSVirtual" in pagina.inner_text(".acceso-externo"))
    revisar("se explica por qué se abre aparte",
            "otra empresa" in pagina.inner_text(".acceso-externo"))

    pagina.click("[data-abrir='POSVIRTUAL']")
    pagina.wait_for_selector(".externo-url", timeout=5000)
    pagina.wait_for_timeout(300)
    revisar("el modal muestra la dirección exacta a la que va",
            "posvirtual.ponlemas.com" in pagina.inner_text(".externo-url"))
    revisar("advierte que las credenciales son de otro sistema",
            "credenciales" in pagina.inner_text(".modal").lower())

    # El enlace tiene que abrir una VENTANA NUEVA, no navegar dentro de la
    # aplicación: si navegara, el cajero perdería la venta en curso.
    # Se intercepta window.open en vez de dejar que abra de verdad, porque
    # lo que se está probando es la decisión del código, no que el sitio
    # de un tercero responda.
    pagina.evaluate("""() => {
        window.__ABIERTO = null;
        window.open = (url, destino, opciones) => {
            window.__ABIERTO = { url, destino, opciones };
            return null;
        };
    }""")
    pagina.click(".modal-pie button:last-child")
    pagina.wait_for_timeout(500)
    abierto = pagina.evaluate("window.__ABIERTO")
    revisar("abre POSVirtual en una ventana aparte", abierto is not None)
    if abierto:
        revisar("va a la dirección correcta",
                "posvirtual.ponlemas.com" in abierto["url"], f"({abierto['url']})")
        revisar("se abre en otra pestaña, sin sacar al cajero de la venta",
                abierto["destino"] == "_blank")
        revisar("la página abierta no puede manipular la aplicación",
                "noopener" in (abierto["opciones"] or ""),
                f"({abierto['opciones']})")
    revisar("la aplicación sigue en su sitio",
            "/tests/harness/index.html" in pagina.url)
    pagina.wait_for_timeout(300)

    # ---------------------------------------------------------
    print("\n--- Registrar una recarga")
    revisar("se ofrecen las operadoras configuradas",
            len(pagina.query_selector_all(".servicio-tarjeta")) == 3)
    revisar("cada servicio muestra su comisión",
            "comisión" in pagina.inner_text(".servicio-tarjeta"))

    pagina.click("[data-servicio='REC_CLARO']")
    pagina.wait_for_selector("#sv-monto", timeout=5000)
    pagina.wait_for_timeout(300)

    revisar("pide el número de celular por su nombre",
            "Número de celular" in pagina.inner_text(".modal"))
    revisar("ofrece los montos que más se venden",
            len(pagina.query_selector_all(".monto-rapido")) >= 4)

    pagina.click(".monto-rapido[data-m='10']")
    pagina.wait_for_timeout(300)
    revisar("al elegir un monto rápido se llena el campo",
            pagina.input_value("#sv-monto") == "10")
    revisar("la comisión se calcula mientras se digita",
            pagina.inner_text("#sv-comision") == "$0.50",
            f"(dice {pagina.inner_text('#sv-comision')})")

    pagina.fill("#sv-ref", "0999123456")
    pagina.fill("#sv-codigo", "PV-991122")
    pagina.click(".modal-pie button:last-child")
    pagina.wait_for_timeout(900)

    registros = [e for e in pagina.evaluate("window.__ESCRITURAS")
                 if e["tabla"] == "rpc:fn_registrar_servicio"]
    revisar("la recarga se registra en la base", len(registros) == 1)
    if registros:
        carga = registros[0]["payload"]
        revisar("se envía el servicio y el monto",
                carga.get("p_servicio_codigo") == "REC_CLARO" and carga.get("p_monto") == 10)
        revisar("se envía la referencia del cliente",
                carga.get("p_referencia") == "0999123456")
        revisar("se guarda el código que devolvió POSVirtual",
                carga.get("p_codigo_operadora") == "PV-991122")
        revisar("la comisión NO se envía desde el navegador",
                "p_comision" not in carga)

    revisar("se confirma la operación al cajero",
            "SRV-" in pagina.inner_text("#serv-msg"),
            f"(dice '{pagina.inner_text('#serv-msg')[:60]}')")

    # ---------------------------------------------------------
    print("\n--- Trazabilidad de los servicios")
    revisar("lo registrado hoy queda a la vista",
            "Recarga Claro" in pagina.inner_text("#serv-hoy"))
    revisar("se resume cuánto se recargó y cuánto se ganó",
            len(pagina.query_selector_all("#serv-hoy .tarjeta-mini")) == 3)

    pagina.click('.tab[data-v="resumen"]')
    pagina.wait_for_selector("#tabla-resumen", timeout=6000)
    pagina.wait_for_timeout(400)
    resumen = pagina.inner_text("#tabla-resumen")
    revisar("el resumen separa mercadería de servicios",
            "Mercadería" in pagina.inner_text("#serv-vista")
            and "Servicios" in pagina.inner_text("#serv-vista"))
    revisar("y muestra la comisión en su propia columna",
            "Comisión ganada" in pagina.inner_text("#serv-vista"))
    revisar("el mes trae los dos orígenes sumados",
            "1580.40" in resumen and "210.00" in resumen,
            f"({resumen[:90]})")
    revisar("se explica que la comisión es lo que gana el negocio",
            "realmente gana" in pagina.inner_text("#serv-vista"))

    print("\n--- Exportación de los movimientos")
    pagina.click('.tab[data-v="movimientos"]')
    pagina.wait_for_selector("#tabla-mov .dyn-table", timeout=8000)
    pagina.wait_for_timeout(500)
    with pagina.expect_download(timeout=20000) as d:
        pagina.click('.btn-exp[data-formato="csv"][data-exp-id="srv"]')
    with open(d.value.path(), "r", encoding="utf-8-sig") as f:
        csv = f.read()
    revisar("el CSV de servicios trae la comisión", "Comisión" in csv)
    revisar("y trae la referencia del cliente", "0999123456" in csv)

    # ---------------------------------------------------------
    print("\n--- QR de De Una a tamaño de mostrador")
    pagina.evaluate("location.hash = '#pos'")
    pagina.wait_for_selector("#pos-scan", timeout=8000)
    pagina.wait_for_timeout(500)
    pagina.fill("#pos-scan", "7861000100021")
    pagina.press("#pos-scan", "Enter")
    pagina.wait_for_timeout(500)
    pagina.click("#pos-cobrar")
    pagina.wait_for_selector(".forma-pago", timeout=5000)
    pagina.click(".forma-pago[data-forma='TRANSFERENCIA_DEUNA']")
    pagina.wait_for_timeout(400)

    revisar("desde el cobro se puede ampliar el código",
            pagina.is_visible("#deuna-ampliar"))

    pagina.click("#deuna-ampliar")
    pagina.wait_for_selector(".qr-marco", timeout=5000)
    pagina.wait_for_timeout(400)

    revisar("el QR se abre en su propia ventana", pagina.is_visible(".qr-pantalla"))
    revisar("el monto se muestra en grande",
            "$" in pagina.inner_text(".qr-monto"))
    revisar("se explica al cliente qué hacer, paso a paso",
            len(pagina.query_selector_all(".qr-pasos li")) == 3)

    tamano_inicial = pagina.eval_on_selector(
        ".qr-marco", "el => el.getBoundingClientRect().width")
    revisar("el código sale mucho más grande que en el modal de cobro",
            tamano_inicial >= 300, f"({tamano_inicial:.0f} px)")

    pagina.click("#qr-mas")
    pagina.wait_for_timeout(350)
    tamano_mas = pagina.eval_on_selector(
        ".qr-marco", "el => el.getBoundingClientRect().width")
    revisar("el vendedor puede agrandarlo", tamano_mas > tamano_inicial,
            f"({tamano_inicial:.0f} → {tamano_mas:.0f} px)")

    pagina.click("#qr-menos")
    pagina.click("#qr-menos")
    pagina.wait_for_timeout(350)
    revisar("y puede volver a achicarlo",
            pagina.eval_on_selector(".qr-marco", "el => el.getBoundingClientRect().width")
            < tamano_mas)

    pagina.eval_on_selector("#qr-tamano",
                            "el => { el.value = 600; el.dispatchEvent(new Event('input')); }")
    pagina.wait_for_timeout(350)
    revisar("el control deslizante también lo ajusta",
            pagina.eval_on_selector(".qr-marco", "el => el.getBoundingClientRect().width") > 500)

    # El tamaño elegido se recuerda: el mostrador no cambia de sitio.
    guardado = pagina.evaluate("localStorage.getItem('elcultivo.qr.tamano')")
    revisar("el tamaño elegido queda recordado", guardado == "600",
            f"(guardó '{guardado}')")

    pagina.click(".modal-pie button:last-child")
    pagina.wait_for_timeout(600)
    revisar("al cerrar el QR se vuelve al cobro, no se pierde la venta",
            pagina.is_visible(".forma-pago"))

    pagina.click(".modal-cerrar")
    pagina.wait_for_timeout(300)
    pagina.click("#pos-limpiar")
    pagina.wait_for_timeout(300)

    # =========================================================
    # MÓVIL
    # =========================================================
    print("\n--- Versión móvil")
    movil = navegador.new_page(
        viewport={"width": 390, "height": 844},   # un teléfono corriente
        device_scale_factor=3,
        is_mobile=True,
        has_touch=True,
    )
    movil.on("pageerror", lambda e: errores_js.append("móvil: " + str(e)))

    movil.goto(BASE, wait_until="networkidle", timeout=20000)
    movil.wait_for_timeout(1200)

    revisar("en el celular aparece la barra superior",
            movil.is_visible(".barra-movil"))
    revisar("el menú lateral arranca escondido",
            movil.eval_on_selector(
                ".sidebar",
                "el => el.getBoundingClientRect().right <= 1"),
            f"(borde derecho {movil.eval_on_selector('.sidebar', 'el => el.getBoundingClientRect().right'):.0f})")
    revisar("la barra muestra en qué pantalla está",
            len(movil.inner_text("#titulo-movil")) > 3)

    movil.click("#btn-menu")
    movil.wait_for_timeout(500)
    revisar("el botón de menú abre el cajón",
            movil.eval_on_selector(".sidebar", "el => el.getBoundingClientRect().left >= -1"))
    revisar("el cajón se anuncia como abierto",
            movil.eval_on_selector("#btn-menu", "el => el.getAttribute('aria-expanded') === 'true'"))

    # Se toca a la derecha del cajón, que es donde el velo queda
    # descubierto: un clic en el centro caería sobre el propio menú.
    movil.mouse.click(370, 400)
    movil.wait_for_timeout(500)
    revisar("tocar fuera lo cierra",
            movil.eval_on_selector(".sidebar", "el => el.getBoundingClientRect().right <= 1"))

    movil.click("#btn-menu")
    movil.wait_for_timeout(400)
    movil.click("a[href='#pos']")
    movil.wait_for_selector("#pos-scan", timeout=8000)
    movil.wait_for_timeout(700)
    revisar("elegir un módulo cierra el menú solo",
            movil.eval_on_selector(".sidebar", "el => el.getBoundingClientRect().right <= 1"))
    revisar("y el título de la barra cambia",
            movil.inner_text("#titulo-movil") == "Punto de venta")

    # Nada puede desbordar el ancho de la pantalla: un desborde obliga a
    # desplazarse en horizontal para llegar al botón de cobrar.
    desborde = movil.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    revisar("la caja no desborda el ancho del teléfono", desborde <= 1,
            f"(desborda {desborde} px)")

    movil.fill("#pos-scan", "7861000100021")
    movil.press("#pos-scan", "Enter")
    movil.wait_for_timeout(600)
    revisar("se puede vender desde el celular",
            len(movil.query_selector_all("#pos-lineas tr")) == 1)

    # Los controles tienen que poder tocarse con el dedo: menos de 40 px
    # de alto es donde la gente empieza a fallar el toque.
    alto_boton = movil.eval_on_selector(".cant-btn", "el => el.getBoundingClientRect().height")
    revisar("los botones de cantidad se pueden tocar con el dedo", alto_boton >= 34,
            f"({alto_boton:.0f} px de alto)")

    alto_cobrar = movil.eval_on_selector("#pos-cobrar", "el => el.getBoundingClientRect().height")
    revisar("el botón de cobrar es grande", alto_cobrar >= 42, f"({alto_cobrar:.0f} px)")

    # La tabla del carrito no puede romper el ancho
    movil.evaluate("location.hash = '#layout'")
    movil.wait_for_selector(".estructura-2d", timeout=8000)
    movil.wait_for_timeout(700)
    desborde_mapa = movil.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    revisar("el mapa del local tampoco desborda", desborde_mapa <= 1,
            f"(desborda {desborde_mapa} px)")
    revisar("los muebles se apilan en una columna",
            movil.eval_on_selector(".mapa-local",
                                   "el => getComputedStyle(el).gridTemplateColumns.split(' ').length") == 1)

    movil.click('.tab[data-v="tabla"]')
    movil.wait_for_selector("#tabla-posiciones .dyn-table", timeout=8000)
    movil.wait_for_timeout(500)
    # La tabla es más ancha que el teléfono a propósito: se desplaza
    # dentro de su propia caja. Lo que no puede pasar es que arrastre la
    # página entera, que es cuando el usuario "pierde" el menú.
    desplaza = movil.eval_on_selector(
        "#tabla-posiciones",
        """el => {
            const cajas = [el, ...el.querySelectorAll('*')];
            return cajas.some(c => c.scrollWidth > c.clientWidth + 1
                                   && getComputedStyle(c).overflowX !== 'visible');
        }""")
    desborde_tabla = movil.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    revisar("la tabla se desplaza dentro de su caja", desplaza)
    revisar("y no arrastra la página entera", desborde_tabla <= 1,
            f"(desborda {desborde_tabla} px)")

    # ---------------------------------------------------------
    # Imprimir desde el celular. Es el mismo recibo y el mismo formato
    # de rollo: lo que cambia es que en el teléfono no hay lector ni
    # impresora conectada por USB, así que el diálogo del navegador es
    # el que manda el trabajo (a una impresora de red, o a "Guardar como
    # PDF" para enviarlo por WhatsApp).
    print("\n--- Imprimir el recibo desde el celular")
    movil.evaluate("""
      window.__IMPRESIONES = 0;
      window.__ESTADO_MOVIL = null;
      window.print = () => {
        window.__IMPRESIONES += 1;
        const caja = document.getElementById('comprobante-impresion');
        const estilo = document.getElementById('comprobante-impresion-estilo');
        window.__ESTADO_MOVIL = {
          hayCaja: Boolean(caja),
          css: estilo ? estilo.textContent : '',
          papel: caja ? caja.dataset.papelMm : null,
          imagenes: caja ? caja.querySelectorAll('img, svg, canvas').length : -1,
        };
      };
    """)
    movil.evaluate("""async () => {
      const m = await import('/web/js/lib/comprobante.js');
      await m.imprimirComprobante('venta-1');
    }""")
    movil.wait_for_timeout(500)

    est = movil.evaluate("window.__ESTADO_MOVIL")
    revisar("desde el teléfono también se manda a imprimir", est is not None)
    if est:
        revisar("y sale con el mismo formato de rollo, no en A4",
                "80mm" in est["css"] and "210mm" not in est["css"])
        revisar("el recibo del teléfono tampoco lleva logotipo",
                est["imagenes"] == 0, f"({est['imagenes']} imágenes)")
        revisar("la maqueta no depende del ancho de la pantalla del teléfono",
                est["papel"] == "80", f"(papel={est['papel']})")

    movil.evaluate("window.dispatchEvent(new Event('afterprint'))")
    movil.wait_for_timeout(200)
    revisar("y al terminar la pantalla del celular queda limpia",
            movil.evaluate("document.getElementById('comprobante-impresion') === null"))

    print("\n--- Errores de JavaScript")
    revisar("ninguna pantalla lanzó un error de JavaScript",
            len(errores_js) == 0, f"({errores_js[:2]})")

    navegador.close()

print("\n" + "=" * 55)
if fallos:
    print(f"RESULTADO: {len(fallos)} comprobaciones fallaron")
    for f in fallos:
        print(f"  - {f}")
    sys.exit(1)
print("RESULTADO: servicios, QR ampliado y versión móvil pasaron todas las comprobaciones")
