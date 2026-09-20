# ¿Publicar en Google Apps Script?

Análisis de la idea de alojar el sistema dentro de Google Apps Script con
Workspace, frente al plan actual de sitio estático externo más Supabase.

**Recomendación: no usar Apps Script para este sistema.** Sí usar
Workspace, pero para el correo y el dominio, que es donde aporta.
El razonamiento, con números.

---

## 1. La idea y por qué tiene sentido plantearla

La propuesta es razonable a primera vista: si el negocio ya va a pagar
Workspace para tener correo con dominio propio, Apps Script viene
incluido, no cuesta nada más, y permite servir una página HTML. Todo
quedaría en un solo proveedor y con una sola factura.

El problema no está en la idea, está en para qué sirve Apps Script.

---

## 2. Lo que Apps Script es y lo que no

Apps Script está pensado para **automatizar Google Workspace**: mover
filas de una hoja de cálculo, mandar un correo cuando alguien llena un
formulario, generar un documento desde una plantilla. Para eso es
excelente y no tiene rival por su precio.

No está pensado para ser el servidor de una aplicación transaccional que
atiende cajas en tiempo real. Los límites publicados por Google lo dicen
sin ambigüedad:

| Límite | Consumidor (gmail.com) | Workspace |
|---|---|---|
| Tiempo por ejecución | 6 minutos | 6 minutos |
| Ejecuciones simultáneas | 30 por usuario · 1.000 por script | igual |
| Llamadas URL Fetch al día | 20.000 | 100.000 |
| Destinatarios de correo al día | 100 | 1.500 |
| Tiempo total de disparadores al día | 90 minutos | 6 horas |

Google además advierte que estas cuotas "están sujetas a eliminación,
reducción o cambio en cualquier momento, sin previo aviso". Para un
sistema de facturación de un negocio en marcha, esa frase es lo más
importante de la tabla.

---

## 3. Los tres problemas que lo vuelven inviable aquí

### La base de datos seguiría siendo la misma

Apps Script no reemplaza a PostgreSQL. Las 55 funciones, los 26 triggers,
las 53 políticas de seguridad y el costeo promedio ponderado seguirían
viviendo en Supabase. Apps Script solo serviría para **entregar los
archivos HTML y JavaScript** al navegador — exactamente lo mismo que hace
Cloudflare Pages, pero más lento y con más restricciones.

La alternativa sería mover los datos a Google Sheets, y ahí el sistema
directamente deja de funcionar: una hoja de cálculo no tiene
transacciones, ni integridad referencial, ni bloqueo de filas. Dos cajas
vendiendo el mismo producto al mismo tiempo se pisarían el stock sin que
nada lo impida.

### La latencia se nota en la caja

Apps Script no sirve archivos estáticos: **ejecuta una función del lado
del servidor en cada carga** y devuelve el HTML que esa función arma. Ese
arranque en frío cuesta entre uno y varios segundos. En una caja que se
abre una vez al día quizá se tolere, pero cualquier recarga de la página
—un F5 tras un corte de luz, el cambio de turno— vuelve a pagarlo.

Cloudflare Pages entrega el mismo archivo desde un servidor cercano en
decenas de milisegundos, porque no ejecuta nada: solo lo entrega.

### El sandbox rompe cosas que el sistema ya usa

Apps Script sirve la página dentro de un `iframe` con restricciones. En
la práctica eso significa problemas con: el lector de código de barras
(que escribe como si fuera un teclado), la impresión del comprobante
térmico, la pantalla completa para el QR de De Una, el almacenamiento
local donde se recuerda la conexión y el tamaño del QR, y la escena 3D
con WebGL. Cada una de esas cosas tendría que probarse de nuevo y algunas
no tendrían arreglo.

Tampoco hay forma cómoda de publicar en un dominio propio:
`script.google.com/macros/s/AKfycb.../exec` es la dirección real, y
ponerle `minimarket.com` por delante exige montar un proxy, con lo que ya
se estaría pagando otro servicio y el ahorro desaparece.

---

## 4. Lo que sí conviene tomar de Google

Esto no es un rechazo a Google, es un reparto de tareas.

**Workspace, sí, para el correo.** El negocio necesita
`gerencia@sudominio.ec` y `facturacion@sudominio.ec`. Business Starter
cuesta alrededor de 7 dólares al mes por usuario y resuelve el buzón, el
calendario y el Drive. Es un gasto que se justifica solo.

**Pero el envío automático no va por Gmail.** Con Workspace el límite es
de 1.500 destinatarios al día, que alcanza de sobra; el problema es otro.
Si los comprobantes y las órdenes de compra salen desde el buzón del
dueño, un rebote masivo o una queja de spam puede dejarlo sin correo. Los
envíos automáticos van por un servicio transaccional —la función incluida
usa Resend— con una dirección que solo envía. El dominio es el mismo, la
reputación queda separada.

**Apps Script, para lo que es bueno.** Si mañana el contador quiere que
los cierres diarios caigan solos en una hoja de cálculo compartida, o que
un formulario de inventario físico escriba en Drive, Apps Script es la
herramienta correcta para ese puente. Eso vive *al lado* del sistema, no
debajo.

---

## 5. Comparación, en concreto

| | Apps Script + Workspace | Sitio estático + Supabase |
|---|---|---|
| Costo de alojar la aplicación | incluido en Workspace | gratis (Cloudflare Pages) |
| Tiempo de carga | 1-3 s (ejecuta en cada carga) | decenas de ms |
| Dominio propio | necesita proxy aparte | incluido |
| Lector de códigos, impresión, WebGL | por verificar, con riesgo | ya probado |
| Dónde viven los datos | Supabase igual | Supabase |
| Límites que pueden cambiar sin aviso | sí, Google lo advierte | no |
| Respaldo del código | en la cuenta de Google | en Git, versionado |

El punto de la última fila merece una línea más: hoy el proyecto está en
GitHub, con su historial y sus migraciones numeradas. Un proyecto de Apps
Script vive dentro de una cuenta de Google y sacarlo de ahí es trabajo
manual.

---

## 6. Conclusión

**Mantener el plan: Cloudflare Pages (o Vercel) para la aplicación,
Supabase para los datos, Workspace para el correo del negocio y Resend
para los envíos automáticos.**

Es gratis en la parte de alojamiento, es más rápido, no depende de cuotas
que pueden cambiar sin aviso, y no obliga a volver a probar el lector de
códigos ni la impresión.

Apps Script queda como herramienta futura para conectar el sistema con
las hojas de cálculo del contador, que es donde de verdad va a rendir.

---

**Fuentes:**
[Cuotas de Apps Script (Google)](https://developers.google.com/apps-script/guides/services/quotas) ·
[Cuotas 2026: consumidor vs Workspace](https://medium.com/@stackarchitect123/google-apps-script-quotas-2026-official-limits-6-minute-rule-consumer-vs-workspace-d18245035715) ·
[Precios de Google Workspace](https://workspace.google.com/pricing) ·
[Resend](https://resend.com/pricing)
