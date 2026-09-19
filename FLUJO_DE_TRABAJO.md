# Flujo de trabajo y control de concurrencia

Análisis de cómo opera el sistema con varias personas trabajando a la vez, qué
puede chocar, y qué decisiones de diseño evitan que choque.

## El problema real: dos cajas, un solo inventario

En un market con dos cajas abiertas, la situación inevitable es esta: quedan 3
unidades de un producto, la caja 1 escanea 2 y la caja 2 escanea 3. Ambas ven
stock suficiente en su pantalla, porque ambas leyeron el stock antes de que la
otra vendiera. Si el sistema confía en lo que cada caja tiene en memoria, vende
5 unidades de 3 y el inventario queda en negativo.

Hay tres formas de resolverlo y solo una sirve para un market.

**Bloquear el stock al escanear** (reservarlo mientras está en el carrito) es lo
que hacen las tiendas en línea. En una caja física es malo: si el cliente se
arrepiente o el cajero abandona el carrito, esas unidades quedan retenidas hasta
que algo las libere, y en hora pico la percha se "agota" sin estar agotada.

**Confiar en la pantalla del cajero** es lo que hace un sistema ingenuo. Vende de
más y el descuadre aparece recién en el arqueo físico.

**Dejar que la base de datos sea el único árbitro** es lo que hace este sistema.
El carrito vive solo en el navegador y no reserva nada. La verdad está en
`inventario_saldos`, y el trigger de confirmación valida contra ella dentro de la
misma transacción. La segunda venta simplemente se rechaza con un mensaje
concreto: *"Stock insuficiente de X: disponible 1, solicitado 3"*.

Esto está probado: la prueba funcional 8 (`db/tests_funcionales.sql`) confirma
que una venta sin respaldo de stock no se puede confirmar.

## Por qué además hace falta el tiempo real

La validación del servidor garantiza que el inventario nunca miente, pero llega
tarde para la persona: el cajero se entera al cobrar, con el cliente enfrente y
la fila esperando. Hay que deshacer líneas, explicar, recobrar.

Por eso el punto de venta se suscribe a los cambios de `inventario_saldos`
(`db/007_realtime.sql`). Cuando otra caja vende, el carrito abierto se entera en
el momento y avisa: *"Otra caja acaba de vender X: quedan 1 y tienes 3 en el
carrito"*. El cajero corrige antes de llegar al cobro.

El indicador verde junto al total dice si esa sincronización está activa. Si se
cae, la venta sigue funcionando igual — solo se pierde el aviso temprano, no la
seguridad. Esa es la distinción importante: **el tiempo real es comodidad, la
base de datos es la garantía.** Nunca se invierte esa relación.

## Por qué el panel flotante es de solo lectura

El panel de consulta (F2) existe porque el operador necesita responder "¿dónde
está esto?" o "¿cuánto queda?" mientras tiene una venta a medio armar, sin
perder el carrito.

Se quedó en solo lectura por una razón concreta. Si desde el panel se pudiera
registrar un movimiento o corregir un precio, habría dos partes de la misma
pantalla modificando el mismo inventario, y el carrito abierto quedaría
calculando sobre datos que acaban de cambiar debajo. Sería fabricar exactamente
el choque de información que el resto del diseño evita.

Consultar no modifica nada, así que el panel puede estar abierto en cualquier
momento, sobre cualquier módulo, sin ningún riesgo. Vive fuera del área de
contenido, por eso sobrevive al cambio de módulo con su consulta intacta.

Cuando haga falta corregir algo, se hace en su módulo, con la venta cerrada.
Esa fricción es deliberada.

## Qué no se puede editar, y por qué

Tres cosas del sistema son inmutables a propósito:

El **kardex** (`movimientos_inventario`) no acepta UPDATE ni DELETE, bloqueado
por trigger y sin política RLS que lo permita. Un error se corrige con un
movimiento de ajuste, no borrando el original. Si el kardex se pudiera editar,
ningún saldo histórico sería defendible en una auditoría.

Un **ingreso confirmado** no se puede modificar. Confirmar es lo que genera los
lotes y los movimientos de stock; permitir editarlo después dejaría el documento
y el inventario contando cosas distintas.

La **bitácora de auditoría** solo la escribe la base de datos. No hay política de
INSERT, UPDATE ni DELETE para la aplicación: ni siquiera con la clave correcta se
puede alterar el registro de quién hizo qué.

## Velocidad en caja

Las decisiones que apuntan a vender rápido:

El campo de escaneo tiene el foco desde que abre la pantalla y lo recupera
después de cada operación. El lector de códigos se comporta como un teclado que
escribe y manda Enter, así que escanear es la operación por defecto: sin clics,
sin elegir campo.

Escanear el mismo producto varias veces acumula cantidad en una sola línea en
vez de agregar siete filas de limón. Es lo que hace naturalmente quien pasa
varias unidades del mismo artículo.

El cálculo de precios y promociones corre en el navegador mientras se escanea,
así que el total se actualiza al instante. La base de datos vuelve a calcularlo
al guardar y es la que manda — pero el cajero no espera a la red para ver el
total, y `web/js/lib/pricing.js` es espejo exacto de la función SQL para que
ambos números coincidan.

En el cobro en efectivo hay botones de denominación ($5, $10, $20, $50 y
"Exacto") porque teclear "20" es más lento que tocar el billete que el cliente
entregó, y el cambio se calcula solo.

La validación de stock ocurre al escanear, no al cobrar: si no hay, el operador
se entera antes de armar toda la venta.

## Lo que falta para producción

**Roles diferenciados.** Hoy cualquier usuario autenticado puede hacer todo:
vender, ingresar mercadería, cambiar precios y crear promociones. Un cajero no
debería poder cambiar precios. Este es el hueco más grande que queda y se
resuelve con políticas RLS por rol.

**Cierre de caja por turno**, cuadrando el efectivo declarado contra los pagos
registrados.

**Devoluciones y notas de crédito**, que hoy solo se pueden reflejar como ajustes
manuales de inventario, lo cual no deja rastro comercial del motivo.

**Modo sin conexión.** Si se cae el internet, la caja se detiene, porque toda la
validación vive en Supabase. Para un market esto es serio; la solución honesta
no es cachear ventas en el navegador (se pierden y descuadran), sino un servidor
local que sincronice.
