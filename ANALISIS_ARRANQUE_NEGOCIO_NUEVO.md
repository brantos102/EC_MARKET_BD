# Arrancar el sistema en un negocio nuevo, desde cero

Análisis del camino de puesta en marcha: qué existe hoy, qué falta, y en qué
orden conviene hacerlo el día que se instale en un local que nunca ha tenido
sistema.

---

## 1. Lo que ya está construido

El asistente de instalación (migración 011) cubre el primer tramo y funciona:

1. **Elegir el tipo de negocio** — market, ferretería, farmacia, tecnología,
   papelería u otro. Esta elección **se bloquea al terminar**: cambiarla
   después exige una base nueva. Es a propósito. El tipo de negocio decide
   qué unidades de medida existen, si se manejan lotes y caducidades, y qué
   categorías y zonas se siembran; cambiarlo con inventario cargado dejaría
   productos en unidades que ya no existen.
2. **Datos de la empresa** — razón social, RUC (validado de verdad, con el
   dígito verificador), nombre comercial, dirección, teléfono, correo.
3. **La sede matriz**, con su establecimiento y punto de emisión.
4. **Los catálogos base** del tipo elegido: unidades, categorías, zonas y
   tarifas de impuesto vigentes en Ecuador.
5. **La conexión a la base**: URL y clave pública del proyecto de Supabase,
   con la pantalla rechazando activamente una clave secreta pegada por error.

El asistente se salta solo si el sistema ya está instalado, y hay una prueba
automatizada (44 comprobaciones) que lo verifica.

## 2. Lo que falta para arrancar de verdad

Instalar no es lo mismo que **arrancar**. Después de la instalación el local
tiene un sistema configurado y un inventario vacío, y lo que sigue es el
trabajo real:

### a) El catálogo de productos

Es el cuello de botella. Un minimarket chico tiene entre 400 y 1.500
productos distintos. Cargarlos uno por uno es dos semanas de trabajo, y por
eso la mayoría de las instalaciones de sistemas de inventario mueren aquí.

Hay tres caminos, y conviene usar los tres:

- **Desde las facturas de compra.** Ya funciona: cada XML de proveedor trae
  código, descripción, precio y a veces el EAN. Cargando las facturas de los
  últimos dos meses entra solo la mercadería que de verdad rota. Lo que no
  aparece en dos meses de compras probablemente no vale la pena cargarlo
  todavía.
- **Escaneando la percha.** Con el celular, recorriendo el local y leyendo
  códigos de barras. El que no existe se crea ahí mismo con nombre, precio y
  posición. Es lento pero es el único que garantiza que lo que está en la
  percha está en el sistema.
- **Importando una hoja de cálculo**, si el negocio ya lleva una. **Esto no
  está implementado** y es lo que más falta: una pantalla que acepte un
  `.xlsx` o `.csv` con código, nombre, unidad, precio y stock, muestre lo que
  entendió y deje corregir antes de guardar.

### b) El stock inicial

Con los productos cargados hay que decir cuánto hay de cada uno. El sistema
ya tiene el tipo de documento `AJUSTE_INICIAL` para esto, que entra al kardex
como un movimiento con su fecha y su responsable — no como un número
apareciendo de la nada.

Lo que **falta** es una pantalla de **toma de inventario**: recorrer el local
con el celular, escanear y contar, y que al cerrar genere el ajuste inicial
de todo el local de una vez. Hoy habría que cargarlo como un documento de
ingreso largo, que funciona pero es incómodo.

Detalle que importa: el stock inicial necesita un **costo**. Si no se tiene,
el costo promedio arranca en cero y el primer reporte de utilidad saldrá
absurdo (todo parecería ganancia). Conviene usar el último precio de compra
conocido, aunque sea aproximado, y dejarlo anotado.

### c) Proveedores y precios de compra

Los proveedores se crean solos al importar facturas, porque el XML trae el
RUC y la razón social. Los precios de compra también. Esto ya no es trabajo
manual.

### d) Precios de venta

Con el costo real cargado, el sistema propone el precio al público y el de
mayorista sobre el margen objetivo por categoría. Sigue haciendo falta
revisarlos uno por uno —el mercado manda más que el margen— pero se parte de
una propuesta razonable y no de una hoja en blanco.

### e) El plano del local

Medir la sala, crear los muebles, acomodarlos en el plano y asignar cada
producto a su posición. Ya funciona todo. **Es lo último que se hace**, y no
por casualidad: sin productos cargados no hay nada que ubicar.

### f) Los usuarios

El primer usuario se crea en Supabase (Authentication → Users) y desde ahí se
crean los demás en Administración, con su rol. Está documentado en
`PUBLICACION.md`.

## 3. El orden que recomiendo

Este es el orden por el que el negocio empieza a recibir valor antes, no el
orden por el que el sistema queda "completo":

| Día | Qué se hace | Qué se gana |
|---|---|---|
| 1 | Instalación, empresa, sede, conexión, usuarios | El sistema abre |
| 1 | Importar las facturas de compra de los últimos 2 meses | Entra el catálogo que rota, con costos reales |
| 2 | Recorrer la percha escaneando lo que falte | El catálogo queda completo |
| 2 | Revisar y fijar precios de venta | Se puede vender |
| 3 | Toma de inventario inicial (ajuste inicial) | El stock es real |
| 3 | **Empezar a vender con el sistema** | Desde aquí ya sirve |
| Semana 2 | Medir el local, crear y acomodar los muebles | Se encuentra la mercadería |
| Semana 2 | Asignar posiciones a los productos | El plano sirve de verdad |
| Semana 3+ | Mínimos de stock, promociones, plantillas de correo | Reposición y automatismos |

Lo importante de este orden: **el negocio vende con el sistema desde el día
3**, no cuando todo esté perfecto. Un sistema que exige estar completo antes
de usarse no se termina de configurar nunca.

## 4. Lo que hay que construir antes del primer arranque real

Dos cosas, y ninguna es grande:

1. **Importar el catálogo desde una hoja de cálculo.** Con vista previa y
   corrección antes de guardar. Es lo que convierte dos semanas de digitación
   en una tarde, para los negocios que ya llevan una hoja.
2. **La pantalla de toma de inventario.** Escanear, contar, y cerrar
   generando el ajuste inicial. Sirve para arrancar y después para los
   inventarios periódicos, así que se paga dos veces.

Las dos se apoyan en lo que ya existe (el escáner con la cámara, las
presentaciones, el kardex) y no tocan nada publicado.

## 5. Una advertencia sobre la instalación bloqueada

El tipo de negocio se bloquea al terminar la instalación, y eso está bien.
Pero conviene decirlo en voz alta antes de instalar en un cliente:

**Si se elige mal el tipo de negocio, la corrección es una base de datos
nueva.** No hay pantalla que lo deshaga a propósito: deshacerlo con
inventario cargado dejaría productos en unidades de medida que ya no
existirían, y ese es el tipo de daño que no se ve hasta que alguien intenta
vender algo.

La recomendación práctica: en la primera instalación de cada cliente, hacer
una prueba en un proyecto de Supabase aparte, confirmar que el tipo elegido
tiene las unidades y categorías que el negocio necesita, y recién ahí
instalar en el proyecto definitivo. Cuesta media hora y evita rehacerlo todo.
