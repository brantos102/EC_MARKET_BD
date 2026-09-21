# Ingresar la mercadería desde la factura del proveedor

Análisis y decisión de ingeniería. Escrito a partir de las cuatro facturas
reales que se enviaron: 3B Distribución, Proabastos, Tesalia Springs y el
ticket de Titan (Corporación Favorita).

---

## 1. La pregunta era la equivocada

La pregunta fue «cómo escaneamos estas facturas como imágenes o PDF para
sacar los ítems». Tiene una respuesta mejor, y está impresa en las mismas
fotos que se enviaron.

Mírelas otra vez:

| Documento | Lo que trae impreso |
|---|---|
| 3B Distribución | `CLAVE DE ACCESO` + código de barras + `0909202601179322318600120010030000247786316875011` |
| Proabastos | `NA: 11092026011792029082001200400100015304300000000 18` |
| Tesalia Springs | `CLAVE ACCESO SRI: 16092026011790005739001200501000832051508320515 10` |
| Titan (Favorita) | *no trae clave* — es un ticket de venta al consumidor, no una factura de compra |

Tres de los cuatro documentos llevan la **clave de acceso**: 49 dígitos que
identifican ante el SRI una factura electrónica ya autorizada. Y eso cambia
todo, porque significa que **esa factura existe como un archivo XML firmado**
y el papel que le entregaron es solo su impresión — su RIDE, en la jerga del
SRI.

No hay que *reconocer* la factura. Hay que **abrirla**.

## 2. Por qué el OCR es el peor de los caminos disponibles

Reconocer la foto del papel parece más cómodo: no hay que conseguir ningún
archivo. Pero un OCR confunde 0 con O, 1 con 7, 5 con 6 y 8 con B, y en una
factura esas confusiones no son erratas: son cantidades y precios.

Haga la cuenta con la factura de Proabastos que envió. Seis líneas, y cada
línea tiene código, cantidad, valor unitario, descuento, IVA y total: unos
cuarenta números, más los de la cabecera. Un OCR del 97 % — que es bueno —
se equivoca en más de uno. **Y no dice en cuáles.** Alguien tendría que
revisar los cuarenta números contra el papel, que es exactamente el trabajo
que se quería evitar.

Peor aún: el error no se nota. Un costo de compra mal leído no rompe nada
visible. Se guarda, entra al costo promedio, y de ahí sale el precio de
venta. El daño aparece meses después como un margen que no cuadra, y para
entonces nadie puede reconstruir de dónde salió.

La foto de Tesalia que envió lo ilustra: está tomada de noche, con reflejo y
en ángulo. Ningún OCR lee `0.37833` de forma confiable ahí. Y ese quinto
decimal es real: es el precio unitario con el que se calcula todo.

## 3. Los tres caminos, en orden de preferencia

### A. El XML — exacto, y ya está implementado

Es el documento original. Cantidades, precios, descuentos, IVA por línea:
todo sale tal cual, sin interpretar nada.

**Cómo se consigue:**

1. **El proveedor lo manda por correo.** Está obligado: la factura
   electrónica se entrega como XML. Lo que suele pasar es que el correo va a
   una dirección vieja o el adjunto se ignora porque «ya está el PDF».
   Pedirle al proveedor que lo mande a una dirección fija del negocio es una
   llamada, y resuelve el problema para siempre.
2. **Descargándolo de SRI en línea.** En *Facturación electrónica →
   Comprobantes electrónicos recibidos* se filtran las facturas emitidas
   contra el RUC del negocio y se bajan en XML, incluso por lote de un
   período. Sirve además para descubrir compras que no llegaron por correo.
3. **Por la clave de acceso.** El SRI publica un servicio (el
   `AutorizacionComprobantesOffline` del esquema offline) que devuelve el XML
   autorizado a partir de esos 49 dígitos. Es lo que usan los sistemas
   contables del país. Esto **todavía no está implementado** y explico abajo
   por qué.

**Qué hace hoy el sistema:** en *Ingresos → Nuevo ingreso* hay una caja donde
se abre o se arrastra el `.xml`. El sistema lee la factura, avisa si ya se
ingresó, avisa si está a nombre de otro RUC, y muestra cada línea con el
código y la descripción del proveedor al lado del producto del market.

### B. El PDF con capa de texto — posible, no prioritario

El PDF que manda el proveedor suele llevar el texto debajo, no solo la
imagen. Se puede leer sin OCR y con precisión razonable. Pero el PDF y el
XML viajan en el mismo correo: si tiene uno, tiene el otro, y el XML es
mejor. Queda como respaldo para el proveedor que manda PDF y no XML.

### C. La foto con OCR — último recurso, y con revisión obligatoria

Tiene un lugar: la nota de entrega escrita a mano, el proveedor pequeño que
no factura electrónicamente, la compra en el mercado mayorista. Si se
implementa, debe ser **con pantalla de revisión obligatoria línea por línea**
y marcando el documento con origen `FOTO_OCR`, para que un costo raro se
pueda rastrear hasta ahí. Nunca en silencio.

## 4. El problema que nadie ve venir (y que es el verdadero trabajo)

Leer el XML es la parte fácil. Esto es lo que dice la factura de 3B:

```
Q-10001203   BONICESSOTE FRESA X 10   1   1.74
```

Y esto es lo que hay en el market:

```
SNK-014   Bonice fresa   se vende por unidad   $0.35
```

Nada en el XML dice que `Q-10001203` es `SNK-014`. Ni que ese «1» son **diez
unidades**, porque el proveedor factura la caja de 10. Ni que el costo real
por unidad es $0,174 y no $1,74.

El proveedor factura con **su** código, **su** descripción y **su**
presentación. Emparejar eso a mano en cada factura sería más trabajo que
digitar, así que nadie lo haría y el módulo quedaría sin usar.

**La solución: el sistema lo aprende una vez.** La tabla
`proveedor_producto` guarda, por proveedor, qué producto del market es cada
código suyo y cuántas unidades trae. La primera factura de 3B se empareja a
mano; de la segunda en adelante entra sola.

Hay dos atajos que reducen ese trabajo inicial:

- **El código auxiliar.** Muchos proveedores ponen el EAN del producto en
  `codigoAuxiliar`. Si el market ya tiene ese código de barras, el
  emparejamiento es automático desde la primera factura.
- **El parecido por nombre**, que se ofrece como **sugerencia** y nunca se da
  por bueno. «ARROZ FLOR 2KG» y «ARROZ FLOR 5KG» se parecen mucho y son
  productos distintos con precios distintos; aceptar el parecido
  automáticamente sería cargar mercadería al producto equivocado.

## 5. Precios: compra, público y mayorista

Con el costo real ya calculado —después de dividir entre el factor— el
sistema propone el precio al público y el de mayorista sobre el margen
objetivo, que se configura **por categoría** y no uno solo para todo: las
gaseosas no aguantan el margen de los abarrotes y forzar un número único saca
precios fuera de mercado.

El redondeo va **hacia arriba** al centavo. $0,8749 se cobra $0,88, nunca
$0,87: redondear hacia abajo en cada venta se come el margen sin que nadie lo
note.

El sistema propone. Decide una persona. Por eso hay un botón «Aplicar estos
precios» y no una aplicación automática.

## 6. Lo que la factura NO puede decidir: cuánto entra al stock

Esto es importante y es la razón por la que importar la factura **no cierra**
el ingreso.

La factura dice lo que el proveedor facturó. Lo que entra al inventario es lo
que bajó del camión, y no siempre es lo mismo. Por eso el ingreso importado
queda en borrador, con las cantidades de la factura precargadas, y hay que
contar la mercadería y corregir lo que no coincida. La diferencia queda
escrita para reclamar al proveedor, y al stock entra lo físico.

Un sistema que confirme el ingreso solo porque llegó el XML produce un
inventario que cuadra en la pantalla y no en la bodega.

## 7. Lo que falta, y por qué no está hecho todavía

**Traer el XML escaneando la clave de acceso.** Es el paso que haría esto
perfecto: escanear con el celular el código de barras del papel y que el
sistema baje el XML solo, sin buscar correos ni entrar al portal.

No está implementado por una razón técnica concreta: el servicio del SRI es
**SOAP y no permite llamadas desde el navegador** (la política de origen
cruzado lo impide). Hace falta un paso en el servidor — una función de borde
en Supabase que reciba la clave, consulte al SRI y devuelva el XML. Es una
tarea acotada, de una tarde, pero toca la parte publicada del sistema y
prefiero hacerla después de publicar, con todo lo demás funcionando y
probado.

Mientras tanto, lo que ya funciona cubre el caso real: el XML llega por
correo o se baja del portal, y se abre en la pantalla de ingresos.

**El ticket de Titan** que envió no entra por ninguno de estos caminos, y es
correcto que no entre: no es una factura de compra a un proveedor, es un
ticket de consumidor final de un supermercado. Esa compra se registra a mano
como cualquier gasto menor.

---

## Resumen para decidir

| | Exactitud | Trabajo del operador | Estado |
|---|---|---|---|
| XML del SRI | 100 % | Emparejar una vez por producto | **Funcionando** |
| XML por clave de acceso | 100 % | Escanear el código de barras | Falta la función de borde |
| PDF con texto | Alta | Revisar | No implementado |
| Foto con OCR | Media | Revisar línea por línea | No implementado, y no lo recomiendo salvo para notas a mano |

La recomendación es cerrar el círculo con el escaneo de la clave de acceso
después de publicar. Es el único paso que falta para que recibir mercadería
sea: escanear el papel, contar los bultos, confirmar.
