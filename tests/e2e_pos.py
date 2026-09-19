"""
Pruebas de interfaz del punto de venta con navegador headless.

Levanta la aplicación real contra un Supabase simulado (tests/harness/)
y verifica el comportamiento que el usuario ve: escaneo de código de
barras, aplicación de promociones, validación de stock, cálculo de IVA,
modal de pago y cálculo del cambio.

Uso:
    node tests/harness/generar_harness.mjs
    python3 -m http.server 8765        # desde la raíz del repositorio
    python3 tests/e2e_pos.py
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
    pagina = navegador.new_page()
    pagina.on("pageerror", lambda e: errores_js.append(str(e)))
    pagina.on("console", lambda m: errores_js.append(m.text) if m.type == "error" else None)

    # ---------------------------------------------------------
    print("\n--- Carga de la aplicación")
    pagina.goto(BASE, wait_until="networkidle", timeout=20000)
    pagina.wait_for_timeout(600)
    revisar("la sesión simulada entra directo al shell",
            not pagina.eval_on_selector("#app-shell", "el => el.classList.contains('hidden')"))
    revisar("el menú lateral muestra el punto de venta",
            pagina.is_visible("a[href='#pos']"))

    # ---------------------------------------------------------
    print("\n--- Navegación al punto de venta")
    pagina.click("a[href='#pos']")
    pagina.wait_for_selector("#pos-scan", timeout=8000)
    pagina.wait_for_timeout(400)
    revisar("el título cambia a Punto de venta",
            pagina.inner_text("#page-title") == "Punto de venta")
    revisar("el botón de cobrar arranca deshabilitado",
            pagina.is_disabled("#pos-cobrar"))

    # ---------------------------------------------------------
    print("\n--- Escaneo por EAN-13 y promoción 3 x $1")
    for _ in range(7):
        pagina.fill("#pos-scan", "7861000100014")
        pagina.press("#pos-scan", "Enter")
        pagina.wait_for_timeout(60)

    pagina.wait_for_timeout(300)
    filas = pagina.query_selector_all("#pos-lineas tr")
    revisar("las 7 lecturas se agrupan en una sola línea", len(filas) == 1,
            f"(hay {len(filas)})")

    cantidad = pagina.input_value("#pos-lineas .cant-input")
    revisar("la cantidad acumulada es 7", cantidad == "7", f"(es {cantidad})")

    subtotal = pagina.inner_text("#pos-subtotal")
    revisar("7 limones con promo 3x$1 cuestan $2.80", subtotal == "$2.80", f"(dice {subtotal})")

    descuento = pagina.inner_text("#pos-descuento")
    revisar("el descuento mostrado es $2.80", descuento == "-$2.80", f"(dice {descuento})")

    revisar("la línea muestra la insignia de promoción",
            pagina.is_visible("#pos-lineas .badge-promo"))

    revisar("el botón de cobrar se habilitó", not pagina.is_disabled("#pos-cobrar"))

    # ---------------------------------------------------------
    print("\n--- IVA sobre producto de tarifa general")
    pagina.fill("#pos-scan", "7861000100021")
    pagina.press("#pos-scan", "Enter")
    pagina.wait_for_timeout(300)

    iva = pagina.inner_text("#pos-iva")
    # 1 Ruffles a 2.35 con IVA 15% = 0.3525 -> se muestra $0.35
    revisar("el IVA del snack aparece calculado", iva == "$0.35", f"(dice {iva})")

    total = pagina.inner_text("#pos-total")
    # 2.80 (limones) + 2.35 (ruffles) = 5.15 subtotal + 0.35 IVA = 5.50
    revisar("el total combina ambos productos con su IVA", total == "$5.50", f"(dice {total})")

    # ---------------------------------------------------------
    print("\n--- Validación de stock en el escaneo")
    for _ in range(4):  # el mock tiene stock 3 de Ruffles; ya hay 1 en el carrito
        pagina.fill("#pos-scan", "7861000100021")
        pagina.press("#pos-scan", "Enter")
        pagina.wait_for_timeout(80)

    mensaje = pagina.inner_text("#pos-scan-msg")
    revisar("se bloquea el escaneo al superar el stock",
            "Stock insuficiente" in mensaje, f"(dice '{mensaje}')")

    filas_ruffles = pagina.input_value("#pos-lineas tr:nth-child(2) .cant-input")
    revisar("la cantidad no supera el stock disponible", filas_ruffles == "3",
            f"(es {filas_ruffles})")

    # ---------------------------------------------------------
    print("\n--- Cambio a precio por mayor")
    pagina.check("input[name='tipo-venta'][value='MAYOR']")
    pagina.wait_for_timeout(300)
    # 7 limones no alcanzan el mínimo de 25 -> sigue precio menor, pero la
    # promoción es solo MENOR, así que ahora se cobra sin descuento: 7 x 0.80 = 5.60
    subtotal_mayor = pagina.inner_text("#pos-subtotal")
    revisar("al pasar a mayor se retira la promoción exclusiva de detalle",
            subtotal_mayor != "$2.80", f"(dice {subtotal_mayor})")
    pagina.check("input[name='tipo-venta'][value='MENOR']")
    pagina.wait_for_timeout(300)

    # ---------------------------------------------------------
    print("\n--- Modal de cobro y cálculo del cambio")
    pagina.click("#pos-cobrar")
    pagina.wait_for_selector(".modal", timeout=5000)
    revisar("se abre el modal de pago", pagina.is_visible(".modal"))
    revisar("ofrece las formas de pago incluyendo De Una",
            pagina.is_visible("button[data-forma='TRANSFERENCIA_DEUNA']"))

    pagina.fill("#pago-recibido", "20")
    pagina.wait_for_timeout(200)
    cambio = pagina.inner_text("#pago-cambio")
    # total esperado 2.80 + (3 x 2.35 = 7.05) + IVA 1.0575 -> 10.91
    print(f"       (cambio calculado: {cambio})")
    revisar("el cambio se calcula al ingresar el efectivo", cambio != "$0.00")

    print("\n--- Pago insuficiente es rechazado")
    pagina.fill("#pago-recibido", "1")
    pagina.click("#btn-confirmar-pago")
    pagina.wait_for_timeout(200)
    msg_pago = pagina.inner_text("#pago-msg")
    revisar("se rechaza el efectivo que no cubre el total",
            "no cubre" in msg_pago, f"(dice '{msg_pago}')")

    print("\n--- Transferencia De Una exige código")
    pagina.click("button[data-forma='TRANSFERENCIA_DEUNA']")
    pagina.wait_for_timeout(200)
    revisar("aparece el campo de código de comprobante",
            pagina.is_visible("#pago-codigo-input"))
    etiqueta = pagina.inner_text("#pago-codigo-label")
    revisar("la etiqueta se adapta a De Una", "De Una" in etiqueta, f"(dice '{etiqueta}')")
    pagina.click("#btn-confirmar-pago")
    pagina.wait_for_timeout(200)
    revisar("se rechaza la transferencia sin código",
            "código" in pagina.inner_text("#pago-msg").lower())

    # ---------------------------------------------------------
    print("\n--- Venta completa con código de transferencia")
    pagina.fill("#pago-codigo-input", "DEUNA-99887766")
    pagina.click("#btn-confirmar-pago")
    pagina.wait_for_timeout(900)

    escrituras = pagina.evaluate("window.__ESCRITURAS")
    tablas = [e["tabla"] for e in escrituras]
    revisar("se creó la venta", "ventas" in tablas)
    revisar("se registró el detalle", "venta_detalle" in tablas)
    revisar("se registró el pago", "pagos_venta" in tablas)

    pago = next((e for e in escrituras if e["tabla"] == "pagos_venta"), None)
    if pago:
        fila = pago["payload"][0] if isinstance(pago["payload"], list) else pago["payload"]
        revisar("el pago guarda la forma De Una",
                fila.get("forma_pago") == "TRANSFERENCIA_DEUNA", f"({fila.get('forma_pago')})")
        revisar("el pago guarda el código de la transacción",
                fila.get("codigo_transaccion") == "DEUNA-99887766")

    confirmacion = next(
        (e for e in escrituras if e["tabla"] == "ventas" and e["operacion"] == "update"), None
    )
    revisar("la venta se confirmó explícitamente",
            confirmacion is not None and confirmacion["payload"].get("estado") == "CONFIRMADA")

    revisar("se muestra el comprobante", pagina.is_visible(".comprobante"))

    # Cerrar el comprobante para dejar libre la interfaz
    pagina.click(".modal-cerrar")
    pagina.wait_for_timeout(300)
    revisar("al cerrar el comprobante la caja queda lista para la siguiente venta",
            not pagina.is_visible(".modal"))

    # ---------------------------------------------------------
    print("\n--- Sincronización en tiempo real entre cajas")
    pagina.wait_for_timeout(400)
    revisar("el indicador muestra sesión sincronizada",
            "sincronizado" in pagina.inner_text("#pos-conexion"),
            f"(dice '{pagina.inner_text('#pos-conexion')}')")

    # La venta anterior vació el carrito: se arma uno nuevo con 2 Ruffles
    for _ in range(2):
        pagina.fill("#pos-scan", "7861000100021")
        pagina.press("#pos-scan", "Enter")
        pagina.wait_for_timeout(80)
    pagina.wait_for_timeout(300)

    # Otra caja vende y deja el stock en 1, por debajo de lo que hay en el carrito
    pagina.evaluate("window.__emitirCambioStock('prod-ruffles', 1)")
    pagina.wait_for_timeout(400)
    aviso = pagina.inner_text("#pos-scan-msg")
    revisar("avisa cuando otra caja deja el carrito sin respaldo de stock",
            "Otra caja" in aviso, f"(dice '{aviso}')")

    pagina.click("#pos-limpiar")
    pagina.wait_for_timeout(200)

    print("\n--- Autocompletado del campo de escaneo")
    pagina.fill("#pos-scan", "ruff")
    pagina.wait_for_selector(".ac-lista .ac-opcion", timeout=5000)
    revisar("escribir parte del nombre sugiere el producto",
            "Ruffles" in pagina.inner_text(".ac-lista"))
    revisar("la sugerencia muestra código, ubicación y stock",
            "SNK-001" in pagina.inner_text(".ac-lista")
            and "SNK-I-02-1" in pagina.inner_text(".ac-lista"))
    revisar("resalta la parte coincidente", pagina.is_visible(".ac-texto mark"))

    pagina.fill("#pos-scan", "zzzzz")
    pagina.wait_for_timeout(300)
    revisar("avisa cuando no hay coincidencias",
            "Sin coincidencias" in pagina.inner_text(".ac-lista"))
    pagina.fill("#pos-scan", "")
    pagina.keyboard.press("Escape")
    pagina.wait_for_timeout(200)

    print("\n--- La venta sobrevive al cambio de módulo")
    for _ in range(2):
        pagina.fill("#pos-scan", "7861000100014")
        pagina.press("#pos-scan", "Enter")
        pagina.wait_for_timeout(120)
    pagina.wait_for_timeout(300)
    total_antes = pagina.inner_text("#pos-total")
    revisar("hay una venta armada antes de navegar", total_antes != "$0.00",
            f"(total {total_antes})")

    pagina.evaluate("location.hash = '#layout'")
    pagina.wait_for_timeout(800)
    revisar("aparece el panel de venta en curso al salir de la caja",
            pagina.is_visible(".panel-venta"))
    revisar("el panel muestra el mismo total",
            total_antes in pagina.inner_text(".pv-total"),
            f"(panel dice {pagina.inner_text('.pv-total')})")

    pagina.fill(".pv-scan", "7861000100014")
    pagina.press(".pv-scan", "Enter")
    pagina.wait_for_timeout(400)
    revisar("se puede seguir escaneando desde el panel sin volver a la caja",
            total_antes not in pagina.inner_text(".pv-total"),
            f"(ahora {pagina.inner_text('.pv-total')})")

    pagina.click(".pv-cobrar")
    pagina.wait_for_selector("#pos-scan", timeout=8000)
    pagina.wait_for_timeout(600)
    revisar("al volver a la caja el carrito sigue intacto",
            len(pagina.query_selector_all("#pos-lineas tr")) == 1)
    revisar("el panel flotante se oculta dentro del punto de venta",
            not pagina.is_visible(".panel-venta"))

    pagina.click("#pos-limpiar")
    pagina.wait_for_timeout(300)

    print("\n--- Panel flotante de consulta")
    pagina.keyboard.press("F2")
    pagina.wait_for_selector(".panel-flotante", timeout=5000)
    revisar("F2 abre el panel flotante", pagina.is_visible(".panel-flotante"))
    revisar("el panel se declara de solo lectura",
            "solo lectura" in pagina.inner_text(".pf-head").lower(),
            f"(dice '{pagina.inner_text('.pf-head')}')")

    pagina.fill("#panel-buscar", "Limón")
    pagina.wait_for_selector(".pf-tarjeta", timeout=5000)
    revisar("muestra la ubicación del producto consultado",
            "PER-A-01-1" in pagina.inner_text(".pf-tarjeta"))
    revisar("muestra el precio de venta",
            "0.80" in pagina.inner_text(".pf-tarjeta"))

    # La prueba clave: el panel sobrevive al cambio de módulo
    carrito_antes = len(pagina.query_selector_all("#pos-lineas tr"))
    pagina.evaluate("location.hash = '#caducidades'")
    pagina.wait_for_timeout(700)
    revisar("el panel sigue abierto tras navegar a otro módulo",
            pagina.is_visible(".panel-flotante"))
    revisar("conserva la consulta que se estaba viendo",
            "Limón" in pagina.input_value("#panel-buscar"))

    pagina.evaluate("location.hash = '#pos'")
    pagina.wait_for_selector("#pos-scan", timeout=8000)
    pagina.wait_for_timeout(600)
    revisar("el panel sigue abierto al volver al punto de venta",
            pagina.is_visible(".panel-flotante"))

    pagina.click('.pf-btn[data-accion="cerrar"]')
    pagina.wait_for_timeout(200)
    revisar("el panel se cierra con su botón",
            not pagina.is_visible(".panel-flotante"))

    print("\n--- Mapa del market")
    pagina.evaluate("location.hash = '#layout'")
    pagina.wait_for_selector(".zona", timeout=8000)
    pagina.wait_for_timeout(400)
    revisar("dibuja las zonas del market", len(pagina.query_selector_all(".zona")) == 2)

    # Los conteos se comparan contra los KPI que calcula la propia aplicación:
    # así la prueba verifica que el mapa y el resumen cuentan lo mismo, en vez
    # de depender de números fijos que se rompen al cambiar los datos de prueba.
    kpis = [int(e.inner_text()) for e in pagina.query_selector_all(".kpi-value")[:2]]
    total_kpi = kpis[1]
    ocupadas_kpi = int(pagina.query_selector_all(".kpi-value")[2].inner_text())
    libres_kpi = int(pagina.query_selector_all(".kpi-value")[3].inner_text())

    celdas = len(pagina.query_selector_all(".celda"))
    ocupadas_celdas = len(pagina.query_selector_all(".celda.ocupada")) + \
                      len(pagina.query_selector_all(".celda.sin-stock"))
    libres_celdas = len(pagina.query_selector_all(".celda.vacia"))

    revisar("el mapa dibuja una celda por ubicación", celdas == total_kpi,
            f"({celdas} celdas vs {total_kpi} ubicaciones)")
    revisar("las celdas ocupadas coinciden con el KPI", ocupadas_celdas == ocupadas_kpi,
            f"({ocupadas_celdas} vs {ocupadas_kpi})")
    revisar("las celdas libres coinciden con el KPI", libres_celdas == libres_kpi,
            f"({libres_celdas} vs {libres_kpi})")

    pagina.fill("#layout-buscar", "Ruffles")
    pagina.wait_for_timeout(400)
    revisar("el buscador resalta la ubicación del producto",
            pagina.is_visible(".celda.resaltada"))
    revisar("muestra el código de ubicación encontrado",
            "SNK-I-02-1" in pagina.inner_text("#layout-resultado-busqueda"))

    pagina.click(".celda.ocupada")
    pagina.wait_for_selector(".modal", timeout=5000)
    revisar("al hacer clic en una celda abre el detalle con sus lotes",
            "Lotes disponibles" in pagina.inner_text(".modal"))
    pagina.click(".modal-cerrar")
    pagina.wait_for_timeout(200)

    print("\n--- Vista 3D del layout")
    pagina.click('.tab[data-v="tresd"]')
    pagina.wait_for_selector(".caja-3d", timeout=6000)
    revisar("dibuja las cajas en perspectiva 3D",
            len(pagina.query_selector_all(".caja-3d")) >= 2)
    transform_antes = pagina.eval_on_selector("#mundo", "el => el.style.transform")
    pagina.eval_on_selector("#rot-y", "el => { el.value = 40; el.dispatchEvent(new Event('input')); }")
    pagina.wait_for_timeout(300)
    transform_despues = pagina.eval_on_selector("#mundo", "el => el.style.transform")
    revisar("el control de giro rota la escena", transform_antes != transform_despues)

    print("\n--- Tabla de posiciones")
    pagina.click('.tab[data-v="tabla"]')
    pagina.wait_for_selector("#tabla-posiciones .dyn-table", timeout=6000)
    filas_tabla = len(pagina.query_selector_all("#tabla-posiciones tbody tr"))
    revisar("la tabla lista las mismas posiciones que el mapa", filas_tabla == total_kpi,
            f"({filas_tabla} filas vs {total_kpi} ubicaciones)")
    revisar("distingue las posiciones libres",
            "Libre" in pagina.inner_text("#tabla-posiciones"))
    pagina.fill("#tabla-posiciones input[type='search']", "SNK")
    pagina.wait_for_timeout(300)
    revisar("la tabla de posiciones filtra",
            len(pagina.query_selector_all("#tabla-posiciones tbody tr")) == 1)

    print("\n--- Análisis de ocupación")
    pagina.click('.tab[data-v="ocupacion"]')
    pagina.wait_for_selector(".barras-ocupacion", timeout=6000)
    barras = pagina.query_selector_all(".barra-fila")
    revisar("dibuja una barra por zona", len(barras) == 2, f"(hay {len(barras)})")
    revisar("cada barra lleva su valor como etiqueta directa",
            all(p.strip().endswith("%") for p in
                [b.query_selector(".barra-numero").inner_text() for b in barras]))
    revisar("la tabla de ocupación clasifica el estado de la zona",
            any(e in pagina.inner_text("#tabla-ocupacion")
                for e in ["Saturada", "Alta", "Holgada", "Subutilizada"]))

    print("\n--- Identidad de la marca")
    revisar("el menú muestra el logotipo de El Cultivo",
            pagina.is_visible(".logo-menu"))
    revisar("aparece el lema de la empresa",
            "Frescura y calidad" in pagina.inner_text(".lema"))
    revisar("el título de la pestaña es el del minimarket",
            "El Cultivo" in pagina.title(), f"(dice '{pagina.title()}')")
    revisar("el botón de perfil está disponible", pagina.is_visible("#btn-perfil"))

    pagina.click("#btn-perfil")
    pagina.wait_for_selector(".lista-permisos", timeout=5000)
    revisar("el perfil detalla lo que permite el rol",
            "Vender" in pagina.inner_text(".lista-permisos"))
    revisar("el perfil muestra el rol de la sesión",
            "admin" in pagina.inner_text(".modal .rol-chip").lower())
    pagina.click(".modal-cerrar")
    pagina.wait_for_timeout(250)

    print("\n--- Cliente y tipo de comprobante en la caja")
    pagina.evaluate("location.hash = '#pos'")
    pagina.wait_for_selector("#pos-scan", timeout=8000)
    pagina.wait_for_timeout(500)
    revisar("por defecto sale nota de venta a consumidor final",
            "NOTA DE VENTA" in pagina.inner_text("#pos-tipo-comp")
            and "CONSUMIDOR FINAL" in pagina.inner_text("#pos-cliente-nombre"))

    pagina.click("#pos-cliente-btn")
    pagina.wait_for_selector(".sel-comprobante", timeout=5000)
    revisar("ofrece elegir entre consumidor final y factura",
            len(pagina.query_selector_all(".opcion-comprobante")) == 2)

    pagina.click('.opcion-comprobante[data-tipo="FACTURA"]')
    pagina.wait_for_timeout(250)
    revisar("al elegir factura pide la identificación",
            pagina.is_visible("#cli-identificacion"))

    # Cliente que ya existe: se recupera por cédula
    pagina.fill("#cli-identificacion", "1710034065")
    pagina.click("#btn-buscar-cliente")
    pagina.wait_for_selector("#btn-usar-cliente", timeout=5000)
    revisar("encuentra al cliente registrado por su cédula",
            "MARIA LOPEZ" in pagina.inner_text("#cli-encontrado"))
    pagina.click("#btn-usar-cliente")
    pagina.wait_for_timeout(400)
    revisar("la caja pasa a modo factura con ese cliente",
            "FACTURA" in pagina.inner_text("#pos-tipo-comp")
            and "MARIA LOPEZ" in pagina.inner_text("#pos-cliente-nombre"))

    # Cliente nuevo: se registra sin salir de la venta
    pagina.click("#pos-cliente-btn")
    pagina.wait_for_selector(".sel-comprobante", timeout=5000)
    pagina.click('.opcion-comprobante[data-tipo="FACTURA"]')
    pagina.fill("#cli-identificacion", "1710034073")
    pagina.click("#btn-buscar-cliente")
    pagina.wait_for_selector("#cli-nuevo:not(.hidden)", timeout=5000)
    revisar("si no existe, ofrece registrarlo en el momento",
            pagina.is_visible("#cli-nuevo"))
    pagina.fill("#cli-nuevo [name=nombre]", "PEDRO RAMIREZ")
    pagina.fill("#cli-nuevo [name=email]", "pedro@correo.ec")
    pagina.click("#cli-nuevo button[type=submit]")
    pagina.wait_for_timeout(600)
    revisar("el cliente nuevo queda seleccionado para la factura",
            "PEDRO RAMIREZ" in pagina.inner_text("#pos-cliente-nombre"))
    registros = [e for e in pagina.evaluate("window.__ESCRITURAS")
                 if e["tabla"] == "rpc:fn_registrar_cliente"]
    revisar("el registro se hace contra la base, con validación de cédula",
            len(registros) == 1)

    print("\n--- Administración y roles")
    pagina.evaluate("location.hash = '#admin'")
    pagina.wait_for_selector(".tabs", timeout=6000)
    pagina.wait_for_timeout(500)
    revisar("lista los usuarios con su rol",
            "Cajero" in pagina.inner_text("#tabla-usuarios")
            or "VENDEDOR" in pagina.inner_text("#tabla-usuarios"))
    revisar("permite cambiar el rol desde un desplegable",
            pagina.is_visible(".sel-rol"))
    revisar("permite asignar la sede desde un desplegable",
            pagina.is_visible(".sel-sede"))
    revisar("permite crear un usuario sin salir de la aplicación",
            pagina.is_visible("#form-usuario"))
    revisar("el alta pide rol y sede para el usuario nuevo",
            pagina.is_visible("#us-rol") and pagina.is_visible("#us-sede"))

    # Si la función de alta no está publicada, el administrador no puede
    # quedarse sin camino: tiene que aparecer el procedimiento manual.
    pagina.fill("#us-nombre", "Cajera de prueba")
    pagina.fill("#us-email", "cajera.prueba@elcultivo.ec")
    pagina.fill("#us-clave", "clave-temporal-123")
    pagina.click("#form-usuario button[type=submit]")
    pagina.wait_for_timeout(1200)
    revisar("si falta publicar la función de alta, se muestra el camino manual",
            "Add user" in pagina.inner_text("#admin-vista"))

    # --- Matriz de permisos, ahora en su propia pestaña ---
    pagina.click('.tab[data-a="roles"]')
    pagina.wait_for_selector(".matriz-permisos", timeout=6000)
    pagina.wait_for_timeout(300)
    revisar("el admin ve la matriz de permisos por rol",
            pagina.is_visible(".matriz-permisos"))
    revisar("la matriz incluye el rol de supervisor",
            "Supervisor" in pagina.inner_text("#admin-vista"))
    revisar("cada rol trae su descripción en palabras",
            pagina.eval_on_selector_all(".rol-tarjeta", "els => els.length") >= 4)
    revisar("el administrador no se puede quitar permisos a sí mismo",
            pagina.eval_on_selector_all(
                '.chk-perm[data-rol="ADMIN"]',
                "els => els.length > 0 && els.every(e => e.disabled)"))

    # Marcar "editar" debe encender "ver" solo, para no dejar a alguien
    # con permiso de guardar en una pantalla que no puede abrir.
    pagina.eval_on_selector(
        '.chk-perm[data-rol="VENDEDOR"][data-mod="compras"][data-campo="puede_ver"]',
        "el => el.checked = false")
    pagina.click('.chk-perm[data-rol="VENDEDOR"][data-mod="compras"][data-campo="puede_editar"]')
    pagina.wait_for_timeout(400)
    revisar("marcar Editar enciende Ver automáticamente",
            pagina.eval_on_selector(
                '.chk-perm[data-rol="VENDEDOR"][data-mod="compras"][data-campo="puede_ver"]',
                "el => el.checked"))
    revisar("el cambio de permiso se guarda en la base",
            pagina.evaluate(
                "window.__ESCRITURAS.some(e => e.tabla === 'permisos_rol')"))

    pagina.click('.tab[data-a="usuarios"]')
    pagina.wait_for_selector("#tabla-usuarios", timeout=6000)
    revisar("el menú muestra el rol de la sesión",
            "admin" in pagina.inner_text("#rol-actual").lower(),
            f"(dice '{pagina.inner_text('#rol-actual')}')")

    pagina.click('.tab[data-a="tokens"]')
    pagina.wait_for_selector("#form-token", timeout=5000)
    pagina.fill("#tk-desc", "Prueba automatizada")
    pagina.click("#form-token button[type=submit]")
    pagina.wait_for_selector(".token-grande", timeout=5000)
    revisar("emite un token y lo muestra una sola vez",
            len(pagina.inner_text(".token-grande").strip()) >= 8)
    rpc = [e for e in pagina.evaluate("window.__ESCRITURAS")
           if e["tabla"] == "rpc:fn_emitir_token"]
    revisar("el token se pide a la base, no se inventa en el navegador", len(rpc) == 1)
    pagina.click(".modal-cerrar")
    pagina.wait_for_timeout(200)

    pagina.click('.tab[data-a="proveedores"]')
    pagina.wait_for_selector("#form-prov", timeout=5000)
    pagina.fill("#pv-ruc", "1790016919001")
    pagina.fill("#pv-razon", "DISTRIBUIDORA DE PRUEBA")
    pagina.click("#form-prov button[type=submit]")
    pagina.wait_for_timeout(500)
    provs = [e for e in pagina.evaluate("window.__ESCRITURAS")
             if e["tabla"] == "rpc:fn_registrar_proveedor"]
    revisar("el admin puede registrar proveedores sin tocar el código", len(provs) == 1)

    pagina.click('.tab[data-a="empresa"]')
    pagina.wait_for_selector("#form-empresa", timeout=5000)
    revisar("permite editar los datos fiscales para el recibo",
            pagina.input_value("input[name=ruc]") == "1728605070001")
    revisar("ofrece cargar el logotipo desde un archivo",
            pagina.is_visible("#logo-archivo"))
    revisar("muestra la vista previa del logotipo actual",
            pagina.is_visible("#logo-previa"))
    revisar("ofrece cargar el QR de cobro De Una",
            pagina.is_visible("#deuna-archivo"))

    # --- Sedes ---
    pagina.click('.tab[data-a="sedes"]')
    pagina.wait_for_selector("#form-sede", timeout=5000)
    pagina.wait_for_timeout(400)
    revisar("lista las sedes con su código de establecimiento",
            "Sucursal Norte" in pagina.inner_text("#admin-vista"))
    revisar("distingue la matriz de las sucursales",
            "Matriz" in pagina.inner_text("#tabla-sedes"))

    # --- Correo y plantillas ---
    pagina.click('.tab[data-a="correo"]')
    pagina.wait_for_selector("#form-correo", timeout=5000)
    pagina.wait_for_timeout(400)
    revisar("permite configurar el remitente corporativo",
            pagina.is_visible("input[name=remitente_email]"))
    revisar("advierte que la clave del proveedor no va en el navegador",
            "secreto" in pagina.inner_text("#correo-vista").lower())

    pagina.click('.sub-tab[data-s="plantillas"]')
    pagina.wait_for_selector(".plantilla-fila", timeout=5000)
    pagina.wait_for_timeout(300)
    revisar("lista las plantillas de correo",
            "Comprobante al cliente" in pagina.inner_text("#correo-vista"))

    pagina.click('[data-editar="COMPROBANTE_CLIENTE"]')
    pagina.wait_for_selector("#ep-cuerpo", timeout=5000)
    pagina.wait_for_timeout(300)
    revisar("abre el editor HTML de la plantilla",
            pagina.is_visible("#ep-cuerpo"))
    revisar("ofrece las etiquetas que se pueden insertar",
            pagina.eval_on_selector_all(".ep-etiqueta", "els => els.length") > 5)

    antes = pagina.input_value("#ep-cuerpo")
    pagina.click('.ep-etiqueta[data-clave="venta.total"]')
    pagina.wait_for_timeout(200)
    revisar("al hacer clic inserta la etiqueta en el cuerpo",
            "{{venta.total}}" in pagina.input_value("#ep-cuerpo")
            and pagina.input_value("#ep-cuerpo") != antes)

    pagina.click('.ep-modo[data-m="previa"]')
    pagina.wait_for_timeout(400)
    revisar("la vista previa reemplaza las etiquetas por datos de ejemplo",
            pagina.eval_on_selector(
                "#ep-previa",
                "el => !el.srcdoc.includes('{{') && el.srcdoc.includes('MARÍA')"))

    pagina.click(".modal-pie button:last-child")
    pagina.wait_for_timeout(400)
    revisar("guardar la plantilla escribe en la base",
            pagina.evaluate(
                "window.__ESCRITURAS.some(e => e.tabla === 'plantillas_correo')"))

    pagina.click('.sub-tab[data-s="bandeja"]')
    pagina.wait_for_selector("#tabla-cola", timeout=5000)
    pagina.wait_for_timeout(300)
    revisar("la bandeja de salida muestra los correos en espera",
            "PENDIENTE" in pagina.inner_text("#correo-vista"))


    # ---------------------------------------------------------
    print("\n--- Menú desplegable con íconos")
    pagina.evaluate("location.hash = '#dashboard'")
    pagina.wait_for_timeout(400)
    revisar("el menú se arma en grupos, no como lista plana",
            pagina.eval_on_selector_all(".nav-grupo-bloque", "els => els.length") >= 2)
    revisar("cada enlace del menú lleva su ícono",
            pagina.eval_on_selector_all(".nav-modulos .nav-link .nav-icono",
                                        "els => els.length") >= 3)
    revisar("cada grupo dice cuántos módulos contiene",
            pagina.eval_on_selector_all(".nav-grupo-cuenta", "els => els.length") >= 2)

    grupo = ".nav-grupo-bloque:first-child"
    abierto_antes = pagina.eval_on_selector(grupo, "el => el.classList.contains('abierto')")
    pagina.click(f"{grupo} .nav-grupo-btn")
    pagina.wait_for_timeout(350)
    revisar("al pulsar el grupo se pliega o despliega",
            pagina.eval_on_selector(grupo, "el => el.classList.contains('abierto')")
            != abierto_antes)
    revisar("el estado del grupo queda anunciado para lectores de pantalla",
            pagina.eval_on_selector(
                f"{grupo} .nav-grupo-btn",
                "el => el.getAttribute('aria-expanded') === String(el.closest('.nav-grupo-bloque').classList.contains('abierto'))"))

    # Un módulo activo no puede quedar escondido dentro de un grupo plegado
    pagina.click(f"{grupo} .nav-grupo-btn")
    pagina.wait_for_timeout(250)
    revisar("la sede de la sesión aparece en la cabecera del menú",
            "Matriz" in pagina.text_content("#sede-actual"))

    # ---------------------------------------------------------
    print("\n--- Cantidades por unidad, no por decimales")
    # Las secciones anteriores ya vendieron parte del stock simulado; se
    # devuelve a un valor conocido para que esta prueba mida lo que quiere
    # medir y no el saldo que dejó la anterior.
    pagina.evaluate("window.__FIJAR_STOCK('prod-ruffles', 12)")
    pagina.evaluate("location.hash = '#dashboard'")
    pagina.wait_for_timeout(250)
    pagina.evaluate("location.hash = '#pos'")
    pagina.wait_for_selector("#pos-scan", timeout=8000)
    pagina.click("#pos-limpiar")
    pagina.wait_for_timeout(300)

    # Papas Ruffles: se venden por unidad
    pagina.fill("#pos-scan", "7861000100021")
    pagina.press("#pos-scan", "Enter")
    pagina.wait_for_timeout(400)
    revisar("un producto por unidad entra con cantidad 1",
            pagina.input_value(".cant-input") == "1",
            f"(dice '{pagina.input_value('.cant-input')}')")
    revisar("la celda de cantidad es un control con + y −",
            pagina.is_visible(".cant-stepper .cant-btn[data-mas]"))
    revisar("un producto por unidad no ofrece teclado de peso",
            pagina.eval_on_selector_all(".cant-peso", "els => els.length") == 0)
    revisar("el paso del campo es 1, no 0.01",
            pagina.eval_on_selector(".cant-input", "el => el.step") == "1")
    revisar("la línea dice en qué unidad se despacha",
            "unidad" in pagina.inner_text(".cant-unidad").lower())

    pagina.click(".cant-btn[data-mas]")
    pagina.wait_for_timeout(300)
    revisar("el botón + suma una unidad entera",
            pagina.input_value(".cant-input") == "2",
            f"(dice '{pagina.input_value('.cant-input')}')")

    # Escribir un decimal a mano se corrige y se avisa
    pagina.fill(".cant-input", "1.03")
    pagina.press(".cant-input", "Tab")
    pagina.wait_for_timeout(400)
    revisar("escribir 1,03 en un producto por unidad se corrige a 1",
            pagina.input_value(".cant-input") == "1",
            f"(dice '{pagina.input_value('.cant-input')}')")
    revisar("y se le explica al cajero por qué",
            "entera" in pagina.inner_text("#pos-scan-msg").lower(),
            f"(dice '{pagina.inner_text('#pos-scan-msg')}')")

    pagina.click(".cant-btn[data-menos]")
    pagina.wait_for_timeout(300)
    revisar("el botón − quita una unidad",
            pagina.eval_on_selector_all(".cant-input", "els => els.length") == 0
            or pagina.input_value(".cant-input") == "1")

    # ---------------------------------------------------------
    print("\n--- Teclado de peso para lo que se pesa")
    pagina.click("#pos-limpiar")
    pagina.wait_for_timeout(300)
    pagina.fill("#pos-scan", "7861000100014")      # limón, por libra
    pagina.press("#pos-scan", "Enter")
    pagina.wait_for_timeout(400)
    revisar("un producto a peso entra con 1 al escanearlo",
            pagina.input_value(".cant-input") == "1",
            f"(dice '{pagina.input_value('.cant-input')}')")
    revisar("un producto a peso sí ofrece el teclado de balanza",
            pagina.is_visible(".cant-peso"))
    revisar("su paso es medio, no una centésima",
            pagina.eval_on_selector(".cant-input", "el => el.step") == "0.5")

    pagina.click(".cant-peso")
    pagina.wait_for_selector("#peso-valor", timeout=5000)
    pagina.wait_for_timeout(300)
    revisar("el teclado de peso muestra el importe mientras se digita",
            pagina.is_visible("#peso-importe"))

    pagina.fill("#peso-valor", "")
    for tecla in ["1", ".", "0", "3"]:
        pagina.click(f'.peso-tecla[data-t="{tecla}"]')
    pagina.wait_for_timeout(250)
    revisar("las teclas arman el peso exacto de la balanza",
            pagina.input_value("#peso-valor") == "1.03",
            f"(dice '{pagina.input_value('#peso-valor')}')")
    revisar("el importe se recalcula con el peso digitado",
            pagina.inner_text("#peso-importe") == "$0.82",
            f"(dice '{pagina.inner_text('#peso-importe')}')")

    pagina.click(".modal-pie button:last-child")
    pagina.wait_for_timeout(400)
    revisar("el peso decimal sí se conserva en un producto que se pesa",
            pagina.input_value(".cant-input") == "1.03",
            f"(dice '{pagina.input_value('.cant-input')}')")

    # ---------------------------------------------------------
    print("\n--- Cobro con De Una")
    pagina.click("#pos-cobrar")
    pagina.wait_for_selector(".forma-pago", timeout=5000)
    pagina.click('.forma-pago[data-forma="TRANSFERENCIA_DEUNA"]')
    pagina.wait_for_timeout(350)
    revisar("al elegir De Una se abre el panel del QR",
            pagina.is_visible("#pago-deuna"))
    revisar("si no hay QR cargado se dice qué hacer",
            "Administración" in pagina.inner_text("#deuna-nota"))
    revisar("igual se puede cobrar anotando el código de la transacción",
            pagina.is_visible("#pago-codigo-input"))
    pagina.click(".modal-cerrar")
    pagina.wait_for_timeout(300)

    # ---------------------------------------------------------
    print("\n--- Compras a proveedores")
    pagina.evaluate("location.hash = '#compras'")
    pagina.wait_for_selector("#tabla-rep", timeout=8000)
    pagina.wait_for_timeout(500)
    revisar("lista lo que está bajo el mínimo",
            "Limón sutil" in pagina.inner_text("#tabla-rep"))
    revisar("marca como agotado lo que quedó en cero",
            "AGOTADO" in pagina.inner_text("#tabla-rep"))
    revisar("muestra la rotación que justifica la cantidad a pedir",
            "/día" in pagina.inner_text("#tabla-rep"))
    revisar("cuenta cuántos productos no tienen proveedor asignado",
            "sin proveedor" in pagina.inner_text("#compras-vista"))

    pagina.click("#btn-agrupar")
    pagina.wait_for_selector(".chk-prov", timeout=5000)
    pagina.wait_for_timeout(300)
    revisar("agrupa el pedido por proveedor",
            "DISTRIBUIDORA ANDINA" in pagina.inner_text(".modal-cuerpo"))
    revisar("avisa de los productos que quedan fuera por no tener proveedor",
            "Papas Ruffles" in pagina.inner_text(".modal-cuerpo"))

    pagina.click(".modal-pie button:last-child")
    pagina.wait_for_timeout(600)
    escrituras = pagina.evaluate("window.__ESCRITURAS")
    revisar("crea la orden de compra contra la base",
            any(e["tabla"] == "rpc:fn_crear_orden_compra" for e in escrituras))
    revisar("y deja el correo al proveedor en la bandeja de salida",
            any(e["tabla"] == "rpc:fn_enviar_orden_compra" for e in escrituras))

    pagina.click('.tab[data-a="ordenes"]')
    pagina.wait_for_selector("#tabla-oc", timeout=5000)
    pagina.wait_for_timeout(300)
    revisar("las órdenes generadas quedan listadas",
            "OC-2026-00001" in pagina.inner_text("#tabla-oc"))

    print("\n--- Otras pantallas cargan sin romperse")
    for ruta, selector in [
        ("#caducidades", ".kpi-row"),
        ("#promociones", "#form-promo"),
        ("#ingresos", "#form-cabecera"),
        ("#reportes", ".tabs"),
        ("#auditoria", "#form-filtro-audit"),
        ("#dashboard", ".kpi-row"),
    ]:
        pagina.evaluate(f"location.hash = '{ruta}'")
        try:
            pagina.wait_for_selector(selector, timeout=6000)
            print(f"  OK   {ruta} renderiza")
        except Exception:
            print(f"  FALLO {ruta} no renderizó {selector}")
            fallos.append(f"{ruta} no renderiza")

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

print("RESULTADO: todas las comprobaciones de interfaz pasaron")
