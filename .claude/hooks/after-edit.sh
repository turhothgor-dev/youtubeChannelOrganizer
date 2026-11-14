#!/usr/bin/env bash
# Hook PostToolUse de Claude Code (generado por ai-kit).
# Comprueba el fichero recién editado con `make check-file`. Si falla, sale con
# código 2 y el error llega a Claude para que lo corrija.
set -o pipefail

py=""   # el primer intérprete que EJECUTA (en Windows, python3 puede ser el lanzador de la Microsoft Store)
for c in python3 python; do
  if "$c" -c '' >/dev/null 2>&1; then py="$c"; break; fi
done
[ -z "$py" ] && exit 0

export PYTHONUTF8=1   # salida en UTF-8 también en Windows
input="$(cat)"
file="$(printf '%s' "$input" | "$py" -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null)"
[ -z "$file" ] && exit 0

# Rutas de Windows: `\` -> `/` y `X:/...` -> `/x/...` (letra de unidad en minúscula, como en Git Bash).
norm() {
  local p="${1//\\//}" d
  if [[ "$p" =~ ^([A-Za-z]):/(.*)$ ]]; then
    d="$(printf '%s' "${BASH_REMATCH[1]}" | tr 'A-Z' 'a-z')"
    p="/$d/${BASH_REMATCH[2]}"
  fi
  printf '%s' "$p"
}

root="$(norm "${CLAUDE_PROJECT_DIR:-$(pwd)}")"
root="${root%/}"
file="$(norm "$file")"
case "$file" in "$root"/*) rel="${file#"$root"/}" ;; *) rel="$file" ;; esac

if command -v make >/dev/null 2>&1; then
  cmd=(make -s -C "$root" check-file FILE="$rel"); label="make check-file"
elif [ -f "$root/scripts/check_file.py" ] && [ ! -d "$root/.kit/scripts" ]; then
  # Repo del kit sin make
  cmd=("$py" "$root/scripts/check_file.py" "$rel"); label="scripts/check_file.py"
elif [ -f "$root/Makefile.ps1" ] && ps="$(command -v pwsh || command -v powershell.exe || command -v powershell)"; then
  cmd=("$ps" -NoProfile -ExecutionPolicy Bypass -File "$root/Makefile.ps1" check-file -FILE "$rel"); label="Makefile.ps1 check-file"
else
  echo "AVISO: no hay make, ni scripts/check_file.py, ni Makefile.ps1 con PowerShell: no se comprueba $rel." >&2
  exit 0
fi

if ! out="$(cd "$root" && "${cmd[@]}" 2>&1)"; then
  printf '%s falló para %s:\n%s\n' "$label" "$rel" "$out" >&2
  exit 2
fi
exit 0
