#!/usr/bin/env bash
# Hook PreToolUse de Claude Code (generado por ai-kit).
# Bloquea el acceso a ficheros de secretos .env* y .envrc desde cualquier herramienta,
# salvo las plantillas (.env.example, .env.dist, .env.sample, .env.template).
# La lógica, común a Claude Code y Cline, está en .kit/scripts/secrets_guard.py.
root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
scripts="$root/.kit/scripts"; [ -d "$scripts" ] || scripts="$root/scripts"   # en el repo del kit: scripts/
py=""   # el primer intérprete que EJECUTA: en Windows, python3 suele ser el lanzador de la Microsoft Store (sale con 49)
for c in python3 python; do
  if "$c" -c '' >/dev/null 2>&1; then py="$c"; break; fi
done
if [ -z "$py" ]; then
  echo "ai-kit: no hay un Python que funcione (python3 o python). Instala Python 3: sin él, la protección de .env no puede comprobar nada y se bloquea la acción." >&2
  exit 2
fi
exec "$py" "$scripts/secrets_guard.py" --format claude
