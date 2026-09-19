# Centro de Control - Market

Sistema de gestión empresarial para el mercado ecuatoriano (inventario, facturación
electrónica SRI, contabilidad y BI). Este repositorio contiene el **módulo de
Inventario (Kardex por costeo Promedio Ponderado)**, entregado como MVP funcional
y probado sobre Supabase (PostgreSQL).

## ⚠️ Alcance real de esta entrega

Un ERP completo con **facturación electrónica certificada ante el SRI** (firma
XAdES-BES, clave de acceso de 49 dígitos, web services de recepción/autorización,
contingencia offline), **contabilidad integral** (asientos automáticos, cierres de
período) y **BI/ATS** es un proyecto de varias semanas/meses, no de horas. Esta
entrega prioriza, con acuerdo explícito, el módulo que sí se puede dejar
**funcional y probado hoy**: inventario con trazabilidad Kardex.

Los módulos de facturación, contabilidad y BI **no están implementados todavía**.
El esquema de base de datos y la arquitectura del frontend están hechos para
extenderse a esos módulos sin rehacer lo ya construido (ver "Próximos pasos").

## Qué incluye

- **Base de datos** (`db/schema.sql`): catálogos (categorías, bodegas, productos),
  tabla de saldos por producto/bodega, ledger de movimientos (Kardex) con
  costeo automático por **Promedio Ponderado** vía trigger de PostgreSQL, vista
  de stock actual, y Row Level Security (solo usuarios autenticados).
- **Frontend** (`web/`): app HTML/JS sin build step, con menú lateral fijo y
  tablas dinámicas (ordenables y filtrables), tal como se especificó:
  login, dashboard de stock, CRUD de productos y bodegas, registro de
  movimientos (con vista previa del cálculo antes de guardar), y consulta de
  Kardex por producto/bodega.
- **Pruebas** (`tests/costing.test.mjs`): 9 pruebas unitarias sobre la lógica de
  costeo (la misma que corre en la base de datos), todas pasando.

## 1. Aplicar el esquema en Supabase (obligatorio, ~1 minuto)

Por política de red de este entorno en la nube no pude conectarme directamente
a tu proyecto Supabase para aplicar el esquema, así que este único paso queda
manual:

1. Entra a tu proyecto → **SQL Editor**.
2. Pega el contenido completo de [`db/schema.sql`](db/schema.sql) → **Run**.
3. (Opcional, para probar con datos de ejemplo) pega y corre
   [`db/seed_ejemplo.sql`](db/seed_ejemplo.sql).

## 2. Crear tu primer usuario

La app exige login (Supabase Auth) antes de mostrar cualquier dato — es lo que
protege tu inventario detrás de la anon key pública. Crea al menos un usuario:

**Dashboard → Authentication → Users → Add user** (correo + contraseña).

## 3. Correr la app localmente

No requiere `npm install` ni build, pero sí un servidor HTTP: la app usa módulos
ES, que los navegadores bloquean si se abre `index.html` con doble clic
(`file://`).

**Windows (sin instalar nada)** — desde `web\`:

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

El script `serve.ps1` levanta un servidor con .NET (ya incluido en Windows) y
abre el navegador solo. Para usar otro puerto: `... -File .\serve.ps1 -Port 8090`.

**Linux / macOS / con Node instalado** — desde `web/`:

```bash
python3 -m http.server 8080    # o
npx serve .
```

Abre `http://localhost:8080` e inicia sesión con el usuario que creaste.

## 4. Publicarla (GitHub Pages)

1. En GitHub → **Settings → Pages**.
2. Source: `Deploy from a branch` → rama `main`, carpeta `/web`.
3. Guardar. En 1-2 minutos queda disponible en
   `https://brantos102.github.io/EC_MARKET_BD/`.

(También funciona en Vercel/Netlify apuntando a la carpeta `web/` como raíz
estática — no hay backend propio que desplegar, todo el acceso a datos pasa
por Supabase directamente desde el navegador, protegido por RLS.)

## 5. Pruebas

```bash
node --test tests/
```

Verifican la lógica de Promedio Ponderado: entradas recalculan el costo
promedio, salidas lo mantienen y descuentan stock, salidas mayores al stock
disponible lanzan error, ajustes positivos/negativos, y validaciones de
entrada. La misma lógica está implementada en paralelo en la base de datos
(`fn_procesar_movimiento_inventario` en `db/schema.sql`), que es la fuente de
verdad real — el frontend solo la usa para la vista previa antes de guardar.

También se verificó con un navegador headless que el frontend carga sin
errores de JavaScript y muestra correctamente la pantalla de login.

## 🔒 Seguridad — acción pendiente tuya

Compartiste el token de GitHub y la `service_role/secret key` de Supabase
directamente en el chat para esta sesión. Ambos quedan registrados en el
historial de la conversación, así que te recomiendo **rotarlos** apenas
termines de revisar esta entrega:

- GitHub: **Settings → Developer settings → Personal access tokens** → revocar
  el token usado y generar uno nuevo si lo necesitas para el futuro.
- Supabase: **Project Settings → API** → regenerar la `service_role key`.

La `anon/publishable key` (la que sí quedó en `web/js/config.js`) **no
necesita rotarse** — está diseñada para ser pública; la protección real es el
Row Level Security del paso 1. La `service_role key` **no se usó ni se guardó
en ningún archivo de este repositorio**.

## Próximos pasos (fuera del alcance de esta entrega)

- **Facturación electrónica SRI**: generación de XML, firma XAdES-BES, clave de
  acceso, integración a los web services de recepción/autorización del SRI,
  manejo de contingencia. Requiere certificado de firma electrónica del
  contribuyente.
- **Contabilidad integral**: asientos automáticos desde compras/ventas/
  inventario, catálogo de cuentas, cierres de período.
- **BI y auditoría**: estados financieros, ATS (Anexo Transaccional
  Simplificado), reportes de auditoría de 7 años de retención.
- Roles diferenciados (hoy cualquier usuario autenticado tiene los mismos
  permisos) y tasa de IVA parametrizable en vez de hardcodeada, para cuando se
  construya facturación.

## Estructura del repositorio

```
db/
  schema.sql          Esquema completo + costeo + RLS (aplicar en Supabase)
  seed_ejemplo.sql     Datos de prueba opcionales
web/
  index.html
  css/styles.css
  js/
    config.js          URL + anon key (pública, segura de commitear)
    supabaseClient.js
    auth.js
    lib/costing.js      Lógica de Promedio Ponderado (espejo del trigger SQL)
    lib/table.js         Tabla dinámica ordenable/filtrable reutilizable
    dashboard.js, productos.js, bodegas.js, movimientos.js, kardex.js
    vendor/supabase.umd.js   Cliente de Supabase, empaquetado localmente
tests/
  costing.test.mjs
```
