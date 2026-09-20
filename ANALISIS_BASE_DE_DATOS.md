# ¿Migrar la base a Firebase?

Análisis técnico para decidir si conviene mover el sistema de Supabase
(PostgreSQL) a Firebase, si se puede conectar con herramientas SQL de
escritorio, y si este es el momento de hacerlo.

**Recomendación: no migrar. Quedarse en Supabase.** Abajo está el
razonamiento, con números.

---

## 1. Qué hay construido hoy sobre PostgreSQL

Antes de comparar conviene medir qué se movería. El sistema no es una
aplicación que guarda registros en una base: buena parte de las reglas de
negocio **viven dentro de la base de datos**, a propósito.

| Elemento | Cantidad |
|---|---|
| Tablas | 38 |
| Funciones PL/pgSQL | 55 |
| Triggers | 26 |
| Políticas de seguridad (RLS) | 53 |
| Vistas | 11 |
| Claves foráneas | 55 |
| Restricciones `check` | 75 |
| Líneas de SQL (sin el catálogo de ejemplo) | ~5.900 |

Y lo que hacen no es decorativo:

- **El costo promedio ponderado** se recalcula en
  `fn_procesar_movimiento_inventario()` cada vez que entra o sale
  mercadería. Está en la base y no en la aplicación para que dé el mismo
  resultado venga el movimiento de la caja, de un ingreso o de un script.
- **El kardex es inmutable**: un trigger impide modificar o borrar una
  línea ya registrada. Es lo que permite sostener una auditoría.
- **El consumo FEFO** elige qué lote sale primero según la caducidad,
  dentro de la misma transacción que descuenta el stock.
- **Los permisos por rol** son 53 políticas que PostgreSQL aplica sobre
  cada consulta. No se pueden saltar aunque alguien llame directamente a
  la API.
- **La numeración de comprobantes** por sede usa un `UPDATE ... RETURNING`
  sobre una fila bloqueada: dos cajas vendiendo a la vez nunca reciben el
  mismo número.

---

## 2. Lo que Firebase hace distinto

Firestore no es "otra base de datos SQL": es un almacén de documentos.
Las diferencias que importan aquí no son de gusto, son estructurales.

**No hay joins.** Una consulta como "el kardex del último mes con el
nombre del producto, su categoría, la bodega y el usuario que lo hizo"
—que en el sistema actual es una vista— en Firestore se resuelve leyendo
una colección y luego pidiendo, documento por documento, cada referencia.
Sobre mil movimientos son mil lecturas extra, que además se cobran.

**No hay lógica dentro de la base.** Firestore no tiene triggers ni
funciones. Las 55 funciones y 26 triggers habría que reescribirlos como
Cloud Functions, que corren *fuera* de la base y se disparan *después* de
que el dato ya se escribió. La consecuencia práctica: el costo promedio
ya no se calcularía dentro de la misma transacción que registra el
movimiento. Entre el momento en que se escribe la venta y el momento en
que la función ajusta el saldo hay una ventana en la que el inventario
está mal. En un minimarket con una caja quizá no se note; con dos cajas
vendiendo el mismo producto, sí.

**No hay integridad referencial.** Firestore no impide borrar una
categoría que tiene productos, ni guardar un movimiento con un
`producto_id` que no existe. Las 55 claves foráneas y las 75
restricciones `check` pasan a ser responsabilidad del código de la
aplicación, en cada lugar donde escriba. Es exactamente el tipo de regla
que se cumple hasta que alguien añade una pantalla nueva y se olvida.

**Las transacciones son más limitadas.** Firestore las tiene, pero con
restricciones de tamaño y con un modelo de reintentos optimista que no
encaja bien con "descontar de varios lotes por FEFO y actualizar el saldo
en un solo acto".

**Las reglas de seguridad son otro lenguaje.** Las 53 políticas RLS
habría que reescribirlas en el lenguaje de reglas de Firestore, que no
tiene la misma expresividad: no puede consultar otra colección para
decidir (como hace `fn_rol_actual()` leyendo el perfil del usuario) sin
pagar una lectura extra por cada regla evaluada.

---

## 3. La pregunta concreta: ¿herramientas SQL de escritorio?

Esta respuesta es corta y es, probablemente, la más decisiva.

**Con Supabase: sí, directamente.** La base es PostgreSQL de verdad, con
puerto abierto. Desde DBeaver, pgAdmin, DataGrip o el `psql` de la
terminal se conecta con una cadena normal:

```
postgresql://postgres.[PROYECTO]:[CLAVE]@[HOST-POOLER]:5432/postgres
```

En el panel de Supabase, el botón **Connect** entrega esa cadena hecha.
Hay tres formas según el caso: conexión directa (puerto 5432), pooler en
modo sesión (5432, la que sirve para herramientas de escritorio en redes
IPv4) y pooler en modo transacción (6543, para funciones sin estado). Con
cualquiera de ellas usted abre la base, escribe `select`, corre un
`update`, saca un respaldo con `pg_dump` o conecta Excel o Power BI por
ODBC.

**Con Firebase: no.** Firestore no habla el protocolo de PostgreSQL ni
ningún dialecto SQL. No existe un cliente de escritorio al que darle una
cadena de conexión. Se mira desde la consola web de Google, se consulta
desde el SDK, o se exporta a BigQuery —que sí acepta SQL, pero es un
almacén analítico aparte, con su propio costo, y una copia, no la base
viva. Para corregir un dato a mano habría que entrar a la consola y
editar el documento en un formulario.

Para un ingeniero que quiere abrir la base y revisar, esa diferencia sola
ya inclina la decisión.

---

## 4. Costo

Con cinco usuarios y un minimarket, los dos caben en plan gratuito. La
diferencia aparece en cómo cobra cada uno cuando el negocio crece.

Supabase cobra por **tamaño y recursos**: el plan Pro son unos 25 dólares
al mes por proyecto, con respaldos automáticos, y las consultas no se
cuentan. Un reporte pesado que recorre el kardex de un año no cuesta más
por ejecutarse veinte veces.

Firestore cobra por **operación**: lecturas, escrituras y borrados. Un
tablero que muestra el stock de 500 productos son 500 lecturas cada vez
que alguien lo abre. Un reporte de rotación que recorre los movimientos
de 30 días son varios miles. Y como no hay joins, cada dato relacionado
que se necesite es una lectura más. En un sistema de inventario con
reportes, ese modelo se vuelve caro y —peor— **impredecible**: la factura
depende de cuánto miren el tablero los empleados.

---

## 5. Cuándo Firebase sí sería la elección correcta

Para ser justo con la herramienta: Firestore es muy bueno en lo suyo.
Sería la opción acertada si el sistema fuera una aplicación móvil que
tiene que **funcionar sin conexión y sincronizar sola** cuando vuelve la
señal —su caché local es de lo mejor que hay—, si los datos fueran
documentos sueltos sin relaciones entre sí (un chat, notificaciones, un
catálogo de solo lectura), o si se esperaran picos enormes de usuarios
concurrentes y despreocuparse del escalado valiera el precio.

Nada de eso describe un punto de venta de barrio con cinco usuarios,
contabilidad de inventario y obligaciones tributarias.

---

## 6. El costo real de migrar hoy

Si aun así se decidiera migrar, esto es lo que implicaría:

- Reescribir 55 funciones y 26 triggers como Cloud Functions, con el
  cambio de semántica que eso supone (de dentro de la transacción a
  después de ella).
- Reescribir 53 políticas de seguridad en el lenguaje de reglas de
  Firestore, aceptando que algunas no se pueden expresar igual.
- Reemplazar 55 claves foráneas y 75 restricciones por validaciones en el
  código de la aplicación.
- Rehacer las 11 vistas como consultas compuestas, o duplicar datos
  (desnormalizar) y mantener esas copias sincronizadas a mano.
- Rehacer los reportes, que hoy son SQL de unas pocas líneas.
- Volver a escribir las pruebas: las 14 funcionales, las 12 de seguridad
  y las 25 de las migraciones 010 y 011 están escritas en SQL y no
  tendrían dónde correr.
- Migrar los datos existentes y verificar que el inventario cuadra.

Y al terminar, el resultado sería un sistema **con menos garantías** que
el actual: sin integridad referencial, sin cálculo de costo dentro de la
transacción, sin kardex inmutable a nivel de motor, y sin poder abrir la
base con una herramienta de escritorio.

No es una migración: es reescribir el sistema.

---

## 7. Conclusión

**Quedarse en Supabase.** No por inercia, sino porque el diseño de este
sistema —lógica contable dentro de la base, inmutabilidad del kardex,
permisos aplicados por el motor, reportes en SQL— es precisamente lo que
una base relacional hace bien y lo que un almacén de documentos no hace.

Y porque la pregunta que usted hizo tiene una respuesta directa: **sobre
Supabase sí puede abrir la base con DBeaver o pgAdmin y trabajarla como
cualquier PostgreSQL; sobre Firebase, no.**

Si en el futuro aparece una aplicación móvil para el inventario físico
que deba funcionar en la bodega sin señal, ese caso concreto sí es el
fuerte de Firestore. Se puede resolver poniendo Firestore *solo* para esa
aplicación y sincronizando contra PostgreSQL, sin mover el sistema
central. Pero eso es una decisión para cuando exista ese requisito, no
ahora.

---

## Anexo — Conectar la base desde el escritorio

1. En Supabase, botón **Connect** (arriba, junto al nombre del proyecto).
2. Copie la cadena de **Session pooler** si su red es IPv4 (lo normal en
   Ecuador), o la de **Direct connection** si tiene IPv6.
3. En DBeaver: *Nueva conexión → PostgreSQL*, pegue el host, el puerto
   (5432), la base (`postgres`), el usuario y la contraseña de la base
   —que **no es** la de su cuenta de Supabase; se establece en
   *Settings → Database*.
4. Marque SSL como `require`.

Dos advertencias que conviene tener presentes al trabajar así:

Conectado de esta forma usted entra como superusuario y **RLS no se le
aplica**: ve y modifica todo. Es cómodo para revisar y peligroso para
corregir a la ligera. Es, de hecho, el motivo por el que las pruebas
funcionales de este proyecto no detectaron en su momento el problema de
permisos que sí aparecía desde la aplicación, y por el que después se
añadió `db/tests_rls.sql`, que corre como un usuario sin privilegios.

Y los triggers de inmutabilidad siguen activos: si intenta corregir a
mano una venta confirmada, la base se lo va a impedir. Eso no es un
estorbo, es el sistema haciendo su trabajo.

---

**Fuentes consultadas:**
[Conexión a Postgres en Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres) ·
[Postgres vs Firebase](https://www.weweb.io/blog/postgres-vs-firebase-comparison-guide) ·
[Buenas prácticas de consulta en Firestore](https://estuary.dev/blog/firestore-query-best-practices/) ·
[Cloud SQL vs Firestore](https://cloudwebschool.com/docs/gcp/comparisons/cloud-sql-vs-firestore/)
