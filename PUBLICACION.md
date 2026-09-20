# Publicación del sistema

Guía para poner el sistema en producción: dónde alojarlo, cómo evitar que
los datos de un establecimiento se mezclen con los de otro, qué correo
corporativo hace falta, cómo crear usuarios y qué se necesita para cobrar
con De Una.

---

## 0. La primera vez: el asistente de instalación

Una base recién migrada no entra al sistema: entra al asistente. Son tres
pasos y arranca solo, la primera vez que alguien inicia sesión.

**Paso 1 — tipo de negocio.** Minimarket, ferretería, farmacia, tecnología,
papelería u "otro". La elección carga las unidades de medida, las categorías y
las zonas de bodega que le corresponden: una ferretería arranca con metros,
galones y rollos y sin control de caducidad; una farmacia arranca con blísters
y con el lote obligatorio.

**Esta elección no se puede cambiar después.** No es un capricho de la
interfaz: hay un trigger en la base que lo impide, así que se cumple también si
alguien edita la tabla desde un cliente SQL. El motivo es contable — un
minimarket con seis meses de kardex en libras y arrobas convertido en ferretería
dejaría un histórico que ya no significa nada. Para otro tipo de negocio, base
nueva. Es lo mismo que hace un sistema contable con el plan de cuentas cuando ya
hay movimientos cargados.

**Paso 2 — datos del contribuyente.** Razón social, RUC, dirección, teléfono y
nombre del local. Todo esto sí se corrige después desde Administración.

**Paso 3 — confirmación.** Se muestra el resumen, hay que marcar explícitamente
que se entiende que el tipo queda fijo, y recién ahí se habilita el botón.

Al terminar, quien instaló queda como administrador y el sistema queda listo
para cargar el inventario inicial desde *Ingreso de mercadería*.

### Conectar esta copia a su base

El mismo paquete sirve para varios negocios, así que la conexión no obliga a
editar archivos. En la pantalla de ingreso hay un enlace **Configurar la
conexión a la base**: se pega la dirección del proyecto y la clave pública, se
pulsa *Probar conexión* y solo si la base responde se habilita el botón de
guardar. Lo guardado en ese equipo manda sobre lo que trae `web/js/config.js`,
que queda como valor de fábrica.

La pantalla distingue tres situaciones y lo dice con nombre y apellido: que la
dirección esté mal escrita, que el proyecto exista pero le falten las
migraciones, o que el dominio de la página no esté autorizado en el CORS de
Supabase. Y si alguien pega por error la clave **secreta** (`service_role`), la
rechaza explicando por qué: esa clave abre la base entera saltándose los
permisos y en el navegador queda a la vista de cualquiera.

---

## 1. Qué se publica y dónde

El sistema tiene dos mitades que se publican por separado.

La **base de datos** ya está publicada: es el proyecto de Supabase. Ahí viven
las tablas, las funciones, las políticas de seguridad y las cuentas de los
usuarios. No hay que instalar nada: basta con aplicar las migraciones de la
carpeta `db/` en el orden numérico desde el SQL Editor.

La **aplicación** es un sitio estático. No tiene servidor propio, no compila
nada, no necesita Node ni Python en producción: son archivos HTML, CSS y
JavaScript que el navegador descarga y que hablan directamente con Supabase.
Eso la hace barata y difícil de tumbar.

Para el caso de un minimarket con cinco usuarios, la opción con mejor relación
entre esfuerzo y resultado es **Cloudflare Pages** o **Vercel**, ambos con
plan gratuito suficiente y certificado HTTPS automático. El procedimiento con
Cloudflare Pages:

1. Suba el repositorio a GitHub (ya está en `github.com/brantos102/EC_MARKET_BD`).
2. En el panel de Cloudflare, entre a *Workers & Pages → Create → Pages →
   Connect to Git* y elija el repositorio.
3. En la configuración de compilación deje el comando de build **vacío** y
   ponga `web` como *Build output directory*. No hay proceso de compilación.
4. Publique. Queda una dirección `https://<nombre>.pages.dev`.
5. Si el negocio tiene dominio propio, agréguelo en *Custom domains*.

Después de publicar, hay un paso de seguridad que **no se puede saltar**: en
Supabase, entre a *Authentication → URL Configuration* y ponga la dirección
publicada en *Site URL* y en *Redirect URLs*. Sin eso, cualquier sitio ajeno
podría montar una copia de la pantalla de ingreso apuntando a su base.

Revise también, en *Settings → API → CORS*, que solo figure el dominio
publicado. Dejarlo en `*` significa que cualquier página de internet puede
hacer peticiones a su base con la clave pública; las políticas RLS seguirían
protegiendo los datos, pero no hay razón para regalar esa superficie.

### El navegador de la caja

La caja conviene abrirla en modo aplicación, sin barra de direcciones, para
que un cajero no navegue a otro sitio por accidente:

```
chrome.exe --app=https://sudominio.com --kiosk
```

---

## 2. Que no se mezclen los datos entre establecimientos

Esta pregunta tiene dos respuestas distintas según de qué se trate, y
confundirlas es la forma más común de terminar con una contabilidad
inservible.

### Caso A — varios locales del mismo negocio (sucursales)

Un minimarket que abre una segunda tienda sigue siendo **un solo
contribuyente, con un solo RUC**. Las dos tiendas comparten catálogo de
productos, proveedores y clientes, pero cada una tiene su propio inventario y
—esto es lo importante— **su propia numeración de comprobantes**. El SRI
numera como `establecimiento-puntoEmisión-secuencial`: la matriz emite
`001-001-000000001` y la sucursal `002-001-000000001`. Si las dos compartieran
el contador, se repetirían números y eso es un problema tributario serio.

Esto ya está resuelto en la migración 010. En **Administración → Sedes** se
crea cada local con su código de establecimiento, y en **Administración →
Usuarios** se asigna a cada persona la sede donde trabaja. A partir de ahí:

- Cada sede lleva su propio secuencial, guardado por separado en la tabla
  `secuencias` con la clave `COMP_<tipo>_<código de sede>`.
- La sede de una venta **la decide la base de datos**, no el navegador: un
  trigger la sella al crear el documento tomándola de la bodega o del perfil
  del cajero. Nadie puede facturar a nombre de otro local manipulando la
  página.
- El cajero ve en qué sede está parado, arriba en el menú.

### Caso B — negocios distintos (el minimarket y la ferretería)

Aquí la respuesta es la contraria: **un proyecto de Supabase para cada
negocio**. No comparta base.

La razón no es técnica sino legal y práctica. Son dos contribuyentes con RUC
distinto, con obligaciones tributarias separadas y, probablemente, con dueños
distintos. Meterlos en la misma base significa que un error en una política de
seguridad expone los datos de un cliente al otro, que un respaldo o una
restauración afecta a los dos, y que el día que uno de los dos quiera llevarse
su información hay que separarla a mano.

Con proyectos separados, en cambio: cada negocio tiene su propia dirección
web, sus propios usuarios, su propio respaldo y su propio plan. La aplicación
es exactamente el mismo código; lo único que cambia son las dos líneas de
`web/js/config.js`. Y si mañana uno crece y el otro no, se escala solo el que
lo necesita.

El plan gratuito de Supabase cubre de sobra un minimarket de cinco usuarios.
Cuando el negocio crezca —o cuando quiera respaldos automáticos diarios, que
es lo primero que se debería pagar— el plan Pro cuesta alrededor de 25 dólares
mensuales por proyecto.

> **Regla práctica:** ¿mismo RUC? Sedes dentro del mismo proyecto.
> ¿RUC distinto? Proyecto distinto.

---

## 3. Correo corporativo: qué hace falta y por qué

El sistema genera tres tipos de correo: el comprobante al cliente, la orden de
compra al proveedor cuando un producto cae bajo el mínimo, y el aviso interno
de stock bajo. Para que esos correos **lleguen** hace falta más que una
dirección de Gmail.

### Por qué una cuenta de Gmail gratuita no sirve

Cuando un servidor de correo recibe un mensaje, comprueba si el servidor que
lo envió está autorizado por el dominio del remitente. Esa autorización se
publica en el DNS del dominio (los registros SPF, DKIM y DMARC).

El dominio `gmail.com` es de Google y su política dice, en resumen, que solo
los servidores de Google pueden enviar en su nombre. Si el sistema intenta
enviar como `minimarketelcultivo@gmail.com` desde el servidor del proveedor de
envío, el correo del proveedor rebota o cae en spam. No es un detalle de
configuración: es el diseño del sistema y no se puede evitar.

Además, aunque funcionara, un correo de factura que llega desde una dirección
`@gmail.com` le dice al cliente que el negocio no tiene dominio propio. Para
una orden de compra a un proveedor, eso pesa.

### Lo que sí se necesita

**Un dominio propio.** Un `.ec` cuesta alrededor de 30 a 40 dólares al año en
un registrador ecuatoriano; un `.com` alrededor de 12 a 15. Con el dominio en
la mano, el correo corporativo tiene dos caminos, y conviene tener claro que
son cosas distintas:

**El buzón donde el dueño lee y escribe.** Aquí Google Workspace Business
Starter (alrededor de 7 dólares al mes por usuario) o Zoho Mail (que tiene un
plan gratuito para pocos usuarios con dominio propio) resuelven bien. Esto es
para que el administrador tenga `gerencia@elcultivo.ec` y lo use como usa
cualquier correo.

**El envío automático que hace el sistema.** Esto es otra cosa y no debe salir
del buzón del dueño. Los correos automáticos se mandan con un servicio de
envío transaccional —**Resend** es el que la función incluida usa— que da
plan gratuito de 3.000 correos al mes y hasta 100 por día, suficiente con
holgura para un minimarket. Se configura una dirección como
`facturacion@elcultivo.ec` que solo envía.

La diferencia importa porque si los envíos automáticos salieran del buzón
personal, un rebote masivo o una queja de spam podría dejar sin correo al
dueño.

### Configuración, paso a paso

1. Compre el dominio.
2. Cree la cuenta en [resend.com](https://resend.com) y agregue el dominio en
   *Domains*. Resend le da tres registros DNS (SPF, DKIM y DMARC).
3. Publique esos tres registros en el panel DNS del dominio y espere a que
   Resend los marque como verificados. Suele tardar entre minutos y unas
   horas.
4. Genere una clave de API en Resend.
5. Publique la función de envío y guarde la clave como secreto:

   ```bash
   supabase functions deploy enviar-correos --no-verify-jwt
   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
   ```

6. Programe la función para que vacíe la bandeja cada cinco minutos. En el
   SQL Editor de Supabase:

   ```sql
   select cron.schedule('vaciar-bandeja', '*/5 * * * *', $$
     select net.http_post(
       url := 'https://<su-proyecto>.supabase.co/functions/v1/enviar-correos',
       headers := jsonb_build_object('Authorization', 'Bearer <anon key>')
     );
   $$);
   ```

7. En la aplicación, entre a **Administración → Correo y plantillas**, ponga
   el remitente `facturacion@sudominio.ec`, el nombre que verá el
   destinatario, y marque **Activo**.

**La clave de Resend nunca se pega en la aplicación.** Vive como secreto de la
función, en el servidor. Si estuviera en el navegador, cualquiera que abra el
código fuente de la página podría leerla y mandar correos a nombre del
negocio.

Mientras el envío no esté configurado, el sistema **no pierde nada**: los
correos se acumulan en **Administración → Correo → Bandeja de salida** en
estado PENDIENTE y salen todos el día que se active.

### Las plantillas

En **Administración → Correo → Plantillas** hay un editor HTML con vista
previa. Lo que va entre llaves dobles se reemplaza al enviar:
`{{cliente.nombre}}` se convierte en el nombre de quien compró,
`{{venta.total}}` en el valor cobrado, `{{orden.detalle_html}}` en la tabla de
productos solicitados. El panel de la derecha lista todas las etiquetas
disponibles para esa plantilla y las inserta con un clic.

Una etiqueta mal escrita no rompe el correo: sale vacía. La vista previa usa
datos de ejemplo y corre dentro de un marco aislado, así que el HTML de la
plantilla no puede tocar la aplicación.

---

## 4. Cómo crear vendedores y otros usuarios

Hay dos caminos. El primero es el normal.

### Desde la aplicación (recomendado)

Requiere publicar una vez la función de alta:

```bash
supabase functions deploy crear-usuario
```

Después, en **Administración → Usuarios** hay un formulario: nombre, correo,
contraseña temporal, rol y sede. La persona entra con esa contraseña y la
cambia.

Esa función comprueba tres cosas antes de crear nada: que quien la llama traiga
una sesión válida, que esa sesión sea de un usuario con rol ADMIN activo, y que
el rol y la sede pedidos existan. Un vendedor que descubra la dirección de la
función y la llame a mano recibe un rechazo.

### Desde Supabase, a mano (respaldo)

Si la función todavía no está publicada, la aplicación lo detecta y muestra el
procedimiento manual:

1. En Supabase, *Authentication → Users → Add user*.
2. Correo de la persona, contraseña temporal, marcar **Auto Confirm User**.
3. Pedirle que entre una vez al sistema. En ese momento aparece en la lista de
   **Administración → Usuarios** con el rol más restringido.
4. Ahí se le cambia el rol y se le asigna la sede.

### Los roles

| Rol | Para quién | Qué puede hacer |
|---|---|---|
| **Administrador** | Dueño o gerente | Todo: configuración, usuarios, precios, tokens |
| **Supervisor de tienda** | Jefe de turno | Todo lo operativo, incluido ajustar inventario y anular ventas; no administra usuarios ni datos de la empresa |
| **Bodeguero** | Quien recibe mercadería | Ingresos, ubicaciones, caducidades, traslados; puede vender si cubre caja |
| **Cajero / Vendedor** | Caja | Vender, cobrar, emitir comprobante, consultar stock y ubicaciones |

La matriz completa —qué módulo ve cada rol, cuál puede editar, y cuál exige
token— se edita en **Administración → Roles y permisos**. Los cambios se
guardan al instante y se aplican en el siguiente ingreso del usuario.

Cuando un cajero necesita hacer algo que su rol no permite (un ajuste de
inventario, anular una venta), el administrador le emite un **token** desde
**Administración → Tokens**: un código de pocos minutos, de un solo uso, que
queda registrado en la bitácora a nombre de ambos. Así el dueño no tiene que
sentarse en la caja cada vez.

Estos permisos **no son solo de pantalla**. Están aplicados como políticas en
la base de datos, así que se respetan aunque alguien intente saltarse la
interfaz. Esconder un botón es comodidad; lo que protege son las políticas.

---

## 5. Cobro con De Una!

De Una es el servicio de pago digital del Banco Pichincha, con más de cinco
millones de usuarios. Hay dos formas de usarlo y conviene no confundirlas.

### Lo que ya funciona hoy: QR estático

El comercio descarga su código de cobro desde la banca en línea del Banco
Pichincha y lo carga en **Administración → Empresa → De Una**, tal como venga:
PNG, JPG o el PDF que entrega el banco. Un .docx no sirve —el navegador no lo
puede dibujar—; si el QR está dentro de un Word, ábralo, clic derecho sobre la
imagen y guárdela como PNG.

Al elegir *De Una* en el cobro, la caja muestra el código en grande junto al
monto que el cliente debe enviar. El cliente escanea, digita ese valor en su
aplicación y transfiere.

**El cobro con De Una no pide código, y eso es deliberado.** De Una es una
transferencia: no hay token ni comprobante que el sistema pueda comprobar en el
momento. Obligar al cajero a escribir algo para poder cerrar la venta solo
conseguía frenar la fila y empujarlo a inventar cualquier cosa, que es peor que
no tener el dato. Queda un campo de referencia **opcional**, por si el cliente
dicta el número de su comprobante.

Tarjeta y transferencia bancaria sí lo siguen pidiendo, porque ahí el voucher
existe en ese instante y es lo que permite cuadrar la caja al cierre.

Esto no necesita ningún trámite más allá de tener la cuenta del banco.

### Lo que requiere contrato: la API

Deuna ofrece a las empresas una API que permite generar una solicitud de pago
con el monto ya incluido, consultar el estado de la transacción, recibir un
webhook cuando el cliente paga y anular o devolver cobros. Con eso, la caja
podría mostrar un QR con el valor exacto y **marcar la venta como pagada sola**,
sin que el cajero anote nada.

Para acceder a eso hacen falta: cuenta activa en Banco Pichincha, RUC vigente,
cédula y nombramiento del representante legal, y el formulario de afiliación
firmado. La comisión publicada es del **2% sobre el monto cobrado**.

Ese 2% es la decisión de negocio que hay que tomar antes de integrarla. En un
minimarket con ticket promedio bajo y margen estrecho, dos puntos sobre cada
venta digital puede pesar más que el ahorro de tiempo en caja. Conviene medir
primero, con el QR estático, qué porcentaje de las ventas se paga por De Una;
si resulta significativo, la integración se justifica.

**La integración de la API se puede hacer después de publicar sin tocar nada de
lo que ya funciona.** El terreno ya está preparado: en Administración hay un
selector de modo (*QR fijo* / *API con token*), y la tabla
`deuna_transacciones` existe desde la migración 011 precisamente para no tener
que migrar en producción con ventas en curso el día que el banco habilite el
servicio. Mientras el modo API no esté conectado, la caja sigue cobrando con el
QR fijo aunque el modo quede elegido.

La clave del API no se guardará en la base ni en la pantalla: va como secreto de
una función en el servidor, por la misma razón que la del correo.

---

## 6. Calidad y normas

El sistema se construyó sobre criterios que conviene poder sustentar si algún
día hay una auditoría.

**Registro contable del inventario.** El costo se lleva por **promedio
ponderado**, que es uno de los dos métodos que admite la NIC 2 (el otro es
PEPS); LIFO no está permitido. El cálculo lo hace la base de datos en
`fn_procesar_movimiento_inventario()`, no la aplicación, así que no depende de
por qué pantalla entró el movimiento.

**Kardex inmutable.** La tabla `movimientos_inventario` es de solo inserción:
un trigger impide modificar o borrar una línea ya registrada. Un error no se
borra, se corrige con un movimiento de ajuste que queda a la vista con su
motivo y su autor. Es la misma lógica de un libro contable.

**Bitácora de auditoría** (ISO/IEC 27001, control A.8.15). Toda operación
sensible queda en `auditoria_log` con usuario, fecha, tabla, valores anteriores
y nuevos. Las anulaciones y los ajustes guardan además qué token los autorizó y
quién lo emitió.

**Control de acceso** (ISO/IEC 27001, A.5.15 y A.8.2). Roles con el principio
de menor privilegio, aplicados como políticas de la base de datos —no como
botones escondidos— y autorización por token de un solo uso para lo
excepcional.

**Trazabilidad de lotes y caducidades.** El consumo de stock es FEFO: sale
primero lo que vence primero. Cada lote guarda su fecha de caducidad, lo que
permite responder ante un retiro de producto qué lotes se vendieron y cuándo,
que es lo que exige una buena práctica de manipulación de alimentos.

**Códigos de barras** conforme a ISO/IEC 15420: los EAN-13 se validan con su
dígito verificador antes de aceptarse, y el prefijo 786 corresponde a GS1
Ecuador.

**Calidad del software** (ISO/IEC 25010). El repositorio trae pruebas
automatizadas que se corren antes de cada entrega: unitarias de las reglas de
precio, costo, cantidades y códigos de barras; funcionales contra una base
PostgreSQL real; de seguridad, que verifican las políticas RLS ejecutándose
como un usuario sin privilegios; y de interfaz con navegador headless.

Un punto que conviene decir en voz alta: **la facturación electrónica ante el
SRI todavía no está implementada**. El comprobante que imprime el sistema sale
marcado como *DOCUMENTO SIN VALIDEZ TRIBUTARIA*. Para que una factura sea
válida necesita clave de acceso de 49 dígitos, firma electrónica XAdES-BES con
certificado vigente y autorización en línea del SRI. Inventar ese número
convertiría el documento en un comprobante falso, con consecuencias sobre el
RUC del negocio. Sirve como nota de venta interna y control de caja; la
facturación electrónica real es la siguiente etapa y exige el certificado de
firma del contribuyente.

---

## 7. Antes de publicar: lista de verificación

**Base de datos**

- [ ] Migraciones `db/*.sql` aplicadas en orden hasta `011`.
- [ ] `db/tests_010.sql` y `db/tests_011.sql` corren sin errores.
- [ ] Asistente de instalación completado con el tipo de negocio correcto.
      Revíselo dos veces: es lo único que no se puede corregir después.
- [ ] Datos de la empresa completos en **Administración → Empresa**: razón
      social, RUC, direcciones, teléfono.
- [ ] Logotipo cargado.
- [ ] Sedes creadas con su código de establecimiento.
- [ ] Ambiente en **PRODUCCION** cuando deje de ser una prueba.

**Seguridad**

- [ ] *Site URL* y *Redirect URLs* apuntando al dominio publicado.
- [ ] CORS limitado a ese dominio.
- [ ] La clave `service_role` **no aparece** en ningún archivo de `web/`.
      Compruébelo: `grep -r "service_role" web/` no debe devolver nada.
- [ ] Un usuario por persona. Ninguna cuenta compartida: la bitácora pierde
      todo su valor si tres cajeros entran con el mismo correo.
- [ ] Cada usuario con el rol mínimo que necesita.

**Operación**

- [ ] Inventario inicial cargado con un ingreso de mercadería (no con ajustes
      manuales: el ingreso deja el costo bien calculado).
- [ ] Stock mínimo revisado en los productos de más rotación, que es lo que
      alimenta la sugerencia de reposición.
- [ ] Proveedores con correo registrado, si va a usar órdenes de compra.
- [ ] Una venta de prueba completa: escanear, cobrar, imprimir.

**Respaldos**

- [ ] El plan gratuito de Supabase **no incluye respaldos automáticos**. Para
      un negocio en marcha esto es lo primero que vale la pena pagar. Mientras
      tanto, exporte manualmente desde *Database → Backups* con regularidad.

---

## 8. Qué viene después

En orden de lo que más valor agrega:

1. **Facturación electrónica ante el SRI.** Requiere el certificado de firma
   electrónica del contribuyente. Es lo que convierte el comprobante en un
   documento válido.
2. **Exportación de reportes** a Excel, PDF y CSV con el logotipo.
3. **API de De Una**, si el QR estático demuestra que el volumen lo justifica.
4. **Traslados entre ubicaciones desde la interfaz.** La función
   `fn_transferir_ubicacion` ya existe en la base; falta la pantalla.
5. **Mejora de la vista 3D de la bodega**, para que se parezca a una
   visualización de racks y pasillos de verdad.
6. **Contabilidad y ATS.**

---

## 9. Por qué PostgreSQL y no Firebase

La pregunta está respondida con números en
[`ANALISIS_BASE_DE_DATOS.md`](ANALISIS_BASE_DE_DATOS.md). El resumen: 55
funciones, 26 triggers y 53 políticas de seguridad viven dentro de la base a
propósito, y Firestore no tiene dónde ponerlas. Además, sobre Supabase la base
se abre desde DBeaver o pgAdmin como cualquier PostgreSQL; sobre Firebase, no
existe esa posibilidad.
