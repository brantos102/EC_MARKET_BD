# Cómo aplicar las migraciones

Lo primero, porque es la confusión más común: **GitHub no ejecuta nada**.
GitHub solo guarda los archivos. Las migraciones se ejecutan contra la base
de datos de Supabase. Da exactamente igual si los archivos `.sql` los lee
desde su clon local o los copia desde la página de GitHub: lo que importa es
que se ejecuten en Supabase, y en orden.

Hay dos caminos. Los dos llegan al mismo sitio.

## Camino A — el editor SQL de Supabase (sin instalar nada)

1. Entre a su proyecto en Supabase → **SQL Editor** → *New query*.
2. Abra el archivo en VS Code, seleccione todo (`Ctrl+A`), copie (`Ctrl+C`)
   y pegue en el editor de Supabase.
3. Pulse **Run**. Espere a que termine antes de pasar al siguiente.
4. Repita con el archivo siguiente, **en orden de número**.

Sirve bien para uno o dos archivos. Para cinco o seis se vuelve tedioso y es
fácil saltarse uno o pegar a medias, que es la peor forma de fallar: la mitad
de una migración aplicada es más difícil de diagnosticar que ninguna.

## Camino B — desde su terminal con `psql` (recomendado)

Necesita el cliente `psql` instalado y la cadena de conexión de Supabase.

**La cadena de conexión:** Supabase → *Project Settings* → *Database* →
*Connection string* → pestaña **URI**. Copie esa línea y reemplace
`[YOUR-PASSWORD]` por la contraseña de la base de datos.

> Esa cadena incluye la contraseña de su base. **No la guarde en ningún
> archivo del repositorio** y no la pegue en un chat. Va en una variable de
> entorno de su terminal, que se borra al cerrarla.

### En PowerShell (Windows)

```powershell
cd C:\ruta\a\EC_MARKET_BD
git pull

$env:DB = "postgresql://postgres.xxxxx:CONTRASENA@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

# 1) Primero el diagnóstico: le dice exactamente qué falta
psql $env:DB -f db/000_diagnostico.sql
```

Lea la lista que imprime. Cada migración sale como `APLICADA` o como
`FALTA — ejecútala`. Ejecute **solo las que faltan**, en orden:

```powershell
psql $env:DB -v ON_ERROR_STOP=1 -f db/013_seguridad_vistas.sql
psql $env:DB -v ON_ERROR_STOP=1 -f db/014_impresion_termica.sql
psql $env:DB -v ON_ERROR_STOP=1 -f db/015_presentaciones_codigos.sql
psql $env:DB -v ON_ERROR_STOP=1 -f db/016_plano_editable.sql
psql $env:DB -v ON_ERROR_STOP=1 -f db/017_facturas_proveedor.sql
psql $env:DB -v ON_ERROR_STOP=1 -f db/018_transformaciones.sql
```

### En bash (Linux, macOS, Git Bash, WSL)

Lo mismo, cambiando solo cómo se declara la variable:

```bash
cd ~/ruta/a/EC_MARKET_BD
git pull

export DB="postgresql://postgres.xxxxx:CONTRASENA@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

psql "$DB" -f db/000_diagnostico.sql
psql "$DB" -v ON_ERROR_STOP=1 -f db/013_seguridad_vistas.sql
# …y así con las que falten
```

`-v ON_ERROR_STOP=1` es importante: hace que `psql` se detenga en el primer
error en vez de seguir ejecutando el resto del archivo sobre un estado a
medias.

## Al terminar, siempre estas dos cosas

**1. Vuelva a correr el diagnóstico.** Tiene que decir *"Todas las
migraciones están aplicadas"*. Si alguna sigue en rojo, no siga: ejecútela.

```powershell
psql $env:DB -f db/000_diagnostico.sql
```

**2. Recargue la página del sistema con `Ctrl+F5`.**

Esto segundo no es un detalle. Supabase expone la base a través de PostgREST,
que guarda en memoria un mapa de las tablas y funciones que existen. Cuando
usted crea una función nueva, ese mapa queda viejo y la aplicación sigue
diciendo *"Could not find the function …"* **aunque la función ya exista**.
El diagnóstico refresca ese caché al final (por eso imprime `NOTIFY`), pero
el navegador también tiene su copia del JavaScript. `Ctrl+F5` fuerza las dos.

Si necesita refrescar el caché por su cuenta:

```sql
notify pgrst, 'reload schema';
```

## Preguntas que surgen siempre

**¿Puedo ejecutar la misma migración dos veces?**
Sí. Las 013 a 018 están comprobadas como repetibles: usan `if not exists`,
`drop … if exists` y `on conflict`, así que volver a ejecutarlas no duplica
ni borra nada. Verá avisos del tipo *"policy … does not exist, skipping"*:
eso es normal, es la migración limpiando antes de crear.

**¿En qué orden?**
Por número, de menor a mayor, sin saltarse ninguna. Cada una da por hecho lo
que creó la anterior.

**¿Y si me sale "new row violates row-level security policy"?**
Ejecute `db/FIX_RLS_URGENTE.sql`. Es el arreglo aislado de ese bloqueo.

**¿Tengo que ejecutar `db/006_seed_ecuador.sql`?**
No, si ya tiene datos reales. Esa carga el catálogo de ejemplo y se usa solo
en una instalación nueva o en una base de pruebas.

**¿Y los archivos `db/tests_*.sql`?**
Son pruebas, no migraciones. No hacen falta para que el sistema funcione.
Si quiere correrlas, hágalo contra una base de prueba y no contra la de
producción: crean usuarios y productos de prueba, y aunque limpian lo que
crean, el kardex es inmutable a propósito y deja rastro.
