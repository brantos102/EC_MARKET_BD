#!/usr/bin/env bash
# Reconstruye la base desde cero en el PostgreSQL local y aplica todas las
# migraciones en orden. Sirve para validar que un instalador nuevo puede
# correr db/*.sql de arriba a abajo sin errores. NO toca Supabase.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PSQL=(psql -h /tmp/pgrun -p 5433 -U postgres -v ON_ERROR_STOP=1 -q)

DB="${1:-market_test}"

psql -h /tmp/pgrun -p 5433 -U postgres -q -c "drop database if exists $DB;" >/dev/null
psql -h /tmp/pgrun -p 5433 -U postgres -q -c "create database $DB;" >/dev/null

aplicar() {
  echo "  → $1"
  "${PSQL[@]}" -d "$DB" -f "$RAIZ/$1" >/dev/null
}

echo "Reconstruyendo $DB"
aplicar tests/sql/supabase_shim.sql
aplicar db/schema.sql
aplicar db/002_catalogos_ubicaciones.sql
aplicar db/003_ingresos.sql
aplicar db/004_ventas_promociones.sql
aplicar db/005_auditoria_vistas.sql
aplicar db/006_seed_ecuador.sql
aplicar db/007_realtime.sql
aplicar db/008_roles_seguridad.sql
aplicar db/009_comprobantes_clientes.sql
aplicar db/010_operacion_multisede.sql
aplicar db/011_instalacion_deuna.sql
aplicar db/012_estructuras_servicios.sql
echo "OK — migraciones 001-012 aplicadas sin error"
