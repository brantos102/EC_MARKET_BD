"""
Pruebas del asistente de instalación y de la pantalla de conexión.

Van en un archivo aparte de e2e_pos.py porque necesitan una base
"recién migrada": el simulador responde que nada está instalado cuando
la dirección lleva ?instalar=1.

Uso:
    node tests/harness/generar_harness.mjs
    python3 -m http.server 8765        # desde la raíz del repositorio
    python3 tests/e2e_instalador.py
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
    pagina = navegador.new_page(viewport={"width": 1280, "height": 900})
    pagina.on("pageerror", lambda e: errores_js.append(str(e)))
    pagina.on("console", lambda m: errores_js.append(m.text) if m.type == "error" else None)

    # =========================================================
    print("\n--- Base recién migrada: aparece el asistente")
    pagina.goto(f"{BASE}?instalar=1", wait_until="networkidle", timeout=20000)
    pagina.wait_for_selector(".inst-tipos", timeout=10000)
    pagina.wait_for_timeout(400)

    revisar("no se entra al sistema sin instalar",
            pagina.eval_on_selector("#app-shell", "el => el.classList.contains('hidden')"))
    revisar("se muestra el asistente de instalación",
            pagina.is_visible("#instalador-screen"))
    revisar("el asistente indica en qué paso va",
            pagina.eval_on_selector_all(".inst-paso", "els => els.length") == 3)
    revisar("arranca en el primer paso",
            pagina.eval_on_selector(".inst-paso", "el => el.classList.contains('actual')"))

    # =========================================================
    print("\n--- Paso 1: elegir el tipo de negocio")
    revisar("ofrece varios tipos de negocio",
            pagina.eval_on_selector_all(".inst-tipo", "els => els.length") >= 4)
    revisar("incluye la ferretería",
            "Ferretería" in pagina.inner_text(".inst-tipos"))
    revisar("cada tipo explica qué carga",
            "unidades" in pagina.inner_text(".inst-tipo"))
    revisar("advierte que la elección es definitiva",
            "No se puede cambiar después" in pagina.inner_text("#inst-cuerpo"))
    revisar("no deja continuar sin elegir",
            pagina.is_disabled("#inst-siguiente"))

    pagina.click('.inst-tipo[data-tipo="FERRETERIA"]')
    pagina.wait_for_timeout(250)
    revisar("el tipo elegido queda marcado",
            pagina.eval_on_selector('.inst-tipo[data-tipo="FERRETERIA"]',
                                    "el => el.classList.contains('elegido')"))
    revisar("y se habilita el botón de continuar",
            not pagina.is_disabled("#inst-siguiente"))

    pagina.click("#inst-siguiente")
    pagina.wait_for_selector("#inst-form", timeout=5000)
    pagina.wait_for_timeout(300)

    # =========================================================
    print("\n--- Paso 2: datos del contribuyente")
    revisar("recuerda el tipo elegido en el paso anterior",
            "Ferretería" in pagina.inner_text("#inst-cuerpo"))
    revisar("la razón social es obligatoria",
            pagina.eval_on_selector("input[name=razon_social]", "el => el.required"))

    pagina.fill("input[name=razon_social]", "FERRETERIA EL PERNO")
    pagina.fill("input[name=nombre_comercial]", "El Perno")
    pagina.fill("input[name=ruc]", "123")
    pagina.fill("input[name=sede]", "Local Sur")
    pagina.click("#inst-form button[type=submit]")
    pagina.wait_for_timeout(400)
    revisar("un RUC incompleto se rechaza antes de seguir",
            "13 dígitos" in pagina.inner_text("#inst-msg"),
            f"(dice '{pagina.inner_text('#inst-msg')}')")
    revisar("y se dice qué hacer si todavía no lo tiene",
            "vacío" in pagina.inner_text("#inst-msg"))

    pagina.fill("input[name=ruc]", "1728605070001")
    pagina.click("#inst-form button[type=submit]")
    pagina.wait_for_selector("#inst-entendido", timeout=5000)
    pagina.wait_for_timeout(300)

    # =========================================================
    print("\n--- Paso 3: confirmación")
    resumen = pagina.inner_text(".inst-resumen")
    revisar("el resumen muestra el tipo de negocio", "Ferretería" in resumen)
    revisar("el resumen muestra la razón social", "FERRETERIA EL PERNO" in resumen)
    revisar("el resumen muestra el RUC", "1728605070001" in resumen)
    revisar("el resumen muestra el local", "Local Sur" in resumen)
    revisar("el resumen dice cuántas categorías se crearán",
            "Categorías" in resumen)

    revisar("no deja instalar sin aceptar que el tipo queda fijo",
            pagina.is_disabled("#inst-instalar"))
    pagina.check("#inst-entendido")
    pagina.wait_for_timeout(200)
    revisar("al aceptarlo se habilita el botón de instalar",
            not pagina.is_disabled("#inst-instalar"))

    # Se puede volver atrás sin perder lo escrito
    pagina.click("#inst-atras")
    pagina.wait_for_selector("#inst-form", timeout=5000)
    pagina.wait_for_timeout(300)
    revisar("volver atrás conserva lo que ya se escribió",
            pagina.input_value("input[name=razon_social]") == "FERRETERIA EL PERNO")
    pagina.click("#inst-form button[type=submit]")
    pagina.wait_for_selector("#inst-entendido", timeout=5000)
    pagina.check("#inst-entendido")
    pagina.wait_for_timeout(200)

    # =========================================================
    print("\n--- Instalación")
    pagina.click("#inst-instalar")
    pagina.wait_for_selector(".inst-listo", timeout=8000)
    pagina.wait_for_timeout(400)

    escrituras = pagina.evaluate("window.__ESCRITURAS")
    instalacion = next(
        (e for e in escrituras if e["tabla"] == "rpc:fn_completar_instalacion"), None)

    revisar("la instalación se hace contra la base, no en el navegador",
            instalacion is not None)
    if instalacion:
        carga = instalacion["payload"]
        revisar("se envía el tipo de negocio elegido",
                carga.get("p_tipo_negocio") == "FERRETERIA",
                f"({carga.get('p_tipo_negocio')})")
        revisar("se envía la razón social",
                carga.get("p_razon_social") == "FERRETERIA EL PERNO")
        revisar("se envía el RUC validado",
                carga.get("p_ruc") == "1728605070001")
        revisar("se pide cargar los catálogos del tipo",
                carga.get("p_cargar_catalogos") is True)

    listo = pagina.inner_text(".inst-listo")
    revisar("se confirma qué quedó instalado", "FERRETERIA" in listo)
    revisar("se informa cuántas categorías se crearon", "Categorías creadas" in listo)
    revisar("se explica cuál es el siguiente paso real",
            "Ingreso de mercadería" in listo)
    revisar("hay un botón para entrar al sistema",
            pagina.is_visible("#inst-entrar"))

    # =========================================================
    print("\n--- Base ya instalada: el asistente no aparece")
    pagina.goto(BASE, wait_until="networkidle", timeout=20000)
    pagina.wait_for_selector(".nav-grupo-bloque", timeout=10000)
    pagina.wait_for_timeout(500)
    revisar("se entra directo al sistema",
            not pagina.eval_on_selector("#app-shell", "el => el.classList.contains('hidden')"))
    revisar("el asistente queda oculto",
            pagina.eval_on_selector("#instalador-screen",
                                    "el => el.classList.contains('hidden')"))

    # =========================================================
    print("\n--- Pantalla de conexión")
    pagina.evaluate("""() => {
        document.getElementById('app-shell').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
    }""")
    pagina.wait_for_timeout(200)
    revisar("desde el ingreso se puede configurar la conexión",
            pagina.is_visible("#btn-conexion"))

    pagina.click("#btn-conexion")
    pagina.wait_for_selector("#cx-url", timeout=5000)
    pagina.wait_for_timeout(300)
    revisar("pide la dirección del proyecto", pagina.is_visible("#cx-url"))
    revisar("pide la clave pública", pagina.is_visible("#cx-key"))
    revisar("no se puede guardar sin probar antes",
            pagina.is_disabled("#cx-guardar"))
    revisar("explica dónde encontrar esos datos",
            "Settings" in pagina.inner_text(".inst-caja"))

    # Una dirección mal formada se rechaza con una explicación
    pagina.fill("#cx-url", "esto no es una url")
    pagina.fill("#cx-key", "sb_publishable_algo_suficientemente_largo")
    pagina.click("#cx-probar")
    pagina.wait_for_timeout(400)
    revisar("una dirección inválida se explica en palabras",
            "URL válida" in pagina.inner_text("#cx-resultado"),
            f"(dice '{pagina.inner_text('#cx-resultado')}')")

    # http:// sin cifrar se rechaza
    pagina.fill("#cx-url", "http://abcdefgh.supabase.co")
    pagina.click("#cx-probar")
    pagina.wait_for_timeout(400)
    revisar("una dirección sin cifrar se rechaza",
            "https" in pagina.inner_text("#cx-resultado"))

    # Y lo más importante: pegar la clave secreta se detecta
    pagina.fill("#cx-url", "https://abcdefgh.supabase.co")
    pagina.fill("#cx-key", "sb_secret_estoNoDebeIrEnElNavegador123")
    pagina.click("#cx-probar")
    pagina.wait_for_timeout(400)
    texto = pagina.inner_text("#cx-resultado")
    revisar("pegar la clave SECRETA se detecta y se explica el riesgo",
            "SECRETA" in texto and "pública" in texto,
            f"(dice '{texto[:90]}')")
    revisar("y no deja guardarla", pagina.is_disabled("#cx-guardar"))

    # =========================================================
    print("\n--- Errores de JavaScript")
    revisar("ningún error de JavaScript durante las pruebas",
            len(errores_js) == 0,
            f"({errores_js[:2]})")

    navegador.close()

print("\n" + "=" * 55)
if fallos:
    print(f"RESULTADO: {len(fallos)} comprobaciones fallaron")
    for f in fallos:
        print(f"  - {f}")
    sys.exit(1)
print("RESULTADO: el asistente de instalación pasó todas las comprobaciones")
