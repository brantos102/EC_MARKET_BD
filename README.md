# Centro de Control - Market

Sistema de gestión para un market de abastos en Ecuador: inventario con
trazabilidad Kardex, ingreso de mercadería, layout físico de bodega, punto
de venta con lectura de código de barras, promociones de temporada y
bitácora de auditoría. Construido sobre Supabase (PostgreSQL).

## Estado del proyecto

| Módulo | Estado |
|---|---|
| Inventario / Kardex (costeo promedio ponderado) | Funcional y probado |
| Ingreso de mercadería con factura de proveedor | Funcional y probado |
| Layout del market (zonas, pasillos, ubicaciones) | Funcional y probado |
| Lotes con caducidad y consumo FEFO | Funcional y probado |
| Punto de venta con escaneo EAN-13 | Funcional y probado |
| Venta al por mayor y al detalle | Funcional y probado |
| Promociones de temporada | Funcional y probado |
| Formas de pago (efectivo, tarjeta, De Una, transferencia) | Funcional y probado |
| Bitácora de auditoría | Funcional y probado |
| Reportes de ventas, inventario y movimientos | Funcional |
| **Facturación electrónica SRI** | **No implementado** |
| **Envío de factura por correo** | **No implementado** |
| **Contabilidad integral (asientos, cierres)** | **No implementado** |
| **ATS y estados financieros** | **No implementado** |

Los cuatro últimos son deliberadamente un proyecto aparte: la facturación
electrónica certificada requiere el certificado de firma del contribuyente,
firma XAdES-BES, clave de acceso de 49 dígitos y conexión a los web services
de recepción y autorización del SRI, con manejo de contingencia. Eso necesita
un backend propio, no puede hacerse desde el navegador (la clave privada del
`.p12` nunca debe salir del servidor).

## Instalación

### 1. Aplicar las migraciones en Supabase

En el proyecto de Supabase → **SQL Editor** → pegar y ejecutar **en orden**:

| # | Archivo | Qué crea |
|---|---|---|
| 1 | `db/schema.sql` | Productos, bodegas, kardex y costeo promedio ponderado |
| 2 | `db/002_catalogos_ubicaciones.sql` | Unidades, IVA parametrizable, EAN-13, layout, lotes |
| 3 | `db/003_ingresos.sql` | Ingreso de mercadería y numeración de trazabilidad |
| 4 | `db/004_ventas_promociones.sql` | Ventas, promociones, FEFO y pagos |
| 5 | `db/005_auditoria_vistas.sql` | Bitácora de auditoría y vistas de negocio |
| 6 | `db/006_seed_ecuador.sql` | Catálogo de 97 productos de consumo en Quito (opcional) |

Todos los scripts son re-ejecutables sin romper nada.

### 2. Crear el usuario

**Authentication → Users → Add user** (correo y contraseña). La aplicación
exige sesión iniciada: eso es lo que protege el inventario detrás de la
anon key, que es pública por diseño.

### 3. Levantar la aplicación

Requiere un servidor HTTP: abrir `index.html` con doble clic no funciona
porque el navegador bloquea los módulos ES sobre `file://`.

**Windows, sin instalar nada** — desde `web\`:

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

**Con Python o Node** — desde `web/`:

```bash
python3 -m http.server 8080    # o
npx serve .
```

**Publicado** — GitHub Pages: Settings → Pages → rama `main`, carpeta `/web`.

## Cómo funciona

### Costeo: promedio ponderado

Método declarado explícitamente (era un vacío del documento de requisitos).
Cada **entrada** recalcula el costo promedio; las **salidas** se valúan al
promedio vigente y no lo modifican. El kardex es un ledger de solo
inserción: no se puede editar ni borrar, las correcciones se hacen con un
movimiento de ajuste. La lógica vive en `fn_procesar_movimiento_inventario`
(PostgreSQL) y está espejada en `web/js/lib/costing.js` para la vista previa
del frontend.

### Caducidad: lotes y FEFO

La fecha de caducidad pertenece al **lote**, no al producto: el mismo arroz
entra en fechas distintas. Al vender, `fn_consumir_lotes_fefo` descuenta
primero el lote que caduca antes (*first expired, first out*), que es la
práctica correcta en alimentos, y deja registrada la trazabilidad de qué
lote salió en cada línea de venta.

### Códigos de barras: EAN-13

El dígito verificador se valida en la base de datos con un `CHECK`
constraint, no solo en el frontend: un código mal escaneado o mal digitado
no entra. Los productos del catálogo de ejemplo llevan prefijo **786**
(Ecuador en GS1) con verificador calculado. El lector de códigos se maneja
como teclado: escribe y envía Enter, y la aplicación también acepta UPC-A
de 12 dígitos convirtiéndolo a EAN-13.

### IVA parametrizable

La tarifa nunca está hardcodeada. `tarifas_impuesto` guarda las vigencias
(12% hasta marzo de 2024, 15% desde abril de 2024) y `fn_tarifa_impuesto`
resuelve la que corresponde a la fecha de la transacción. Cuando el SRI
cambie la tarifa, se agrega una fila: no se toca el código.

La clasificación de qué producto va a 0% y cuál a tarifa general sigue el
criterio del Art. 55 de la LRTI, **pero debe validarla el contador antes de
facturar en producción**.

### Promociones de temporada

Cuatro tipos, con vigencia por fechas y alcance por producto o categoría:

| Tipo | Parámetros | Ejemplo |
|---|---|---|
| `N_POR_DOLAR` | cantidad=3, valor=1.00 | 3 limones por $1 |
| `N_POR_M` | cantidad=2, valor=1 | 2x1 |
| `PORCENTAJE` | valor=20 | 20% de descuento |
| `PRECIO_FIJO` | valor=0.40 | papa chola a $0.40 la libra |

Una promoción nunca puede encarecer el producto: si el cálculo sale mayor al
precio de lista, se ignora. Las unidades sueltas que no completan un grupo se
cobran al precio normal.

## Pruebas

```bash
# 46 pruebas unitarias de la lógica de negocio en JavaScript
node --test tests/costing.test.mjs tests/ean13.test.mjs tests/pricing.test.mjs

# 14 pruebas funcionales contra PostgreSQL (requiere las migraciones aplicadas)
psql "<cadena de conexión>" -f db/tests_funcionales.sql

# Pruebas de interfaz con navegador headless y Supabase simulado
node tests/harness/generar_harness.mjs
python3 -m http.server 8765        # desde la raíz del repositorio
python3 tests/e2e_pos.py
```

Las pruebas funcionales verifican, contra una base real: validez de todos los
EAN-13 del catálogo, rechazo de códigos con verificador incorrecto, cálculo
de las cuatro clases de promoción, activación del precio mayorista solo sobre
la cantidad mínima, descuento de stock y consumo FEFO al confirmar una venta,
IVA aplicado solo a tarifa general, rechazo de venta sin stock, transición a
PAGADA al cubrir el total, inmutabilidad del kardex y de los ingresos
confirmados, y registro en la bitácora.

Las pruebas de interfaz manejan la aplicación real como lo haría un cajero:
escanean siete veces el mismo código y comprueban que se agrupan en una línea
con la promoción aplicada, que el stock insuficiente bloquea el escaneo, que
el modal de pago calcula el cambio, que rechaza efectivo insuficiente y
transferencias sin código, y que el mapa del market resalta la ubicación
buscada.

## Normas y estándares aplicados

| Norma | Dónde se aplica |
|---|---|
| **ISO/IEC 15420** (GS1 EAN-13) | Cálculo y validación del dígito verificador, en base de datos y frontend |
| **ISO/IEC 27001:2022, A.8.15** (registro de eventos) | `auditoria_log`: quién, qué, cuándo y estado anterior de cada cambio, escrito por la base de datos y no alterable desde la aplicación |
| **ISO/IEC 27001, A.8.3** (restricción de acceso) | Row Level Security en todas las tablas; el kardex y la bitácora no tienen política de escritura |
| **ISO 8601** | Todas las fechas y marcas de tiempo (`timestamptz`) |
| **ISO 4217** | Moneda USD |
| **ISO/IEC 25010** (calidad de producto software) | Mantenibilidad: lógica de negocio en la base de datos con espejo en JS, migraciones versionadas y re-ejecutables, cobertura de pruebas en tres niveles |
| **NIC 2 / NIIF** (inventarios) | Costeo por promedio ponderado con declaración explícita del método |
| **LRTI Art. 55** (Ecuador) | Clasificación de tarifa de IVA por producto |

Lo que **todavía no cumple** y hace falta para producción: política de
respaldos y retención documental de 7 años (ISO/IEC 27001 A.8.13 y normativa
tributaria), roles diferenciados por perfil de usuario —hoy todo usuario
autenticado tiene los mismos permisos— y cifrado de datos personales de
clientes en reposo más allá del que ya aplica Supabase.

## Seguridad

La `anon/publishable key` está en `web/js/config.js` y **debe** estar ahí:
es pública por diseño. La protección real es el Row Level Security. La
`service_role key` **no está en ningún archivo del repositorio** y nunca
debe ponerse en código que corra en el navegador.

Si compartiste credenciales por chat durante el desarrollo, rótalas:
GitHub en *Settings → Developer settings → Personal access tokens*, y
Supabase en *Project Settings → API → regenerar service_role key*.

## Estructura

```
db/
  schema.sql                      1. Inventario y kardex
  002_catalogos_ubicaciones.sql   2. Unidades, IVA, EAN-13, layout, lotes
  003_ingresos.sql                3. Ingreso de mercadería
  004_ventas_promociones.sql      4. Ventas, promociones, FEFO, pagos
  005_auditoria_vistas.sql        5. Auditoría y vistas
  006_seed_ecuador.sql            6. Catálogo de Quito (generado)
  generar_seed.mjs                Generador del catálogo con EAN-13 válidos
  tests_funcionales.sql           14 pruebas del motor de negocio
  seed_ejemplo.sql                Datos mínimos de la primera versión

web/
  index.html
  serve.ps1                       Servidor local para Windows
  css/styles.css
  js/
    config.js                     URL y anon key (públicas)
    supabaseClient.js
    auth.js  app.js               Sesión y ruteo
    pos.js                        Punto de venta
    ingresos.js                   Ingreso de mercadería
    layout.js                     Mapa del market
    caducidades.js  promociones.js
    dashboard.js  productos.js  bodegas.js  movimientos.js  kardex.js
    reportes.js  auditoria.js
    lib/
      costing.js                  Promedio ponderado (espejo del trigger SQL)
      pricing.js                  Precios y promociones (espejo del SQL)
      ean13.js                    Validación EAN-13
      table.js                    Tabla ordenable y filtrable
      modal.js
    vendor/supabase.umd.js        Cliente Supabase empaquetado local

tests/
  costing.test.mjs  ean13.test.mjs  pricing.test.mjs
  e2e_pos.py                      Pruebas de interfaz con navegador
  harness/                        Supabase simulado para las pruebas de UI
```

## Próximos pasos sugeridos

1. **Roles de usuario** (cajero, bodeguero, administrador) con políticas RLS
   diferenciadas. Hoy es el hueco de seguridad más grande.
2. **Módulo de facturación electrónica SRI** en un backend propio (Python con
   `lxml`, `signxml`, `cryptography` y `zeep` es un camino razonable), que
   tome las ventas ya registradas y genere el XML firmado.
3. **Devoluciones y notas de crédito**, que hoy solo se pueden reflejar con
   ajustes manuales de inventario.
4. **Cierre de caja por turno**, cuadrando los pagos en efectivo contra lo
   registrado.
5. **Arqueo físico** reutilizando la experiencia de ITSANET IMS: conteo por
   ubicación usando el layout ya construido.
