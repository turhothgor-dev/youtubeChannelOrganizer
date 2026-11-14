#!/usr/bin/env bash
# Línea de estado de Claude Code (generada por ai-kit):
#   modelo de la sesión · coste de la sesión · contexto usado · rama de git
# Claude Code pasa el estado como JSON por la entrada estándar.
# El modelo es el de la conversación principal; el de cada subagente se ve en /usage.
py=""   # el primer intérprete que EJECUTA (en Windows, python3 puede ser el lanzador de la Microsoft Store)
for c in python3 python; do
  if "$c" -c '' >/dev/null 2>&1; then py="$c"; break; fi
done
[ -z "$py" ] && exit 0
# PYTHONUTF8=1: UTF-8 también en Windows (si no, el separador sale en cp1252)
PYTHONUTF8=1 "$py" -c '
import json, subprocess, sys
try:
    d = json.load(sys.stdin)
except Exception:
    print("ai-kit"); sys.exit(0)
model = (d.get("model") or {}).get("display_name") or "?"
cost = (d.get("cost") or {}).get("total_cost_usd")
ctx = (d.get("context_window") or {}).get("used_percentage")
proj = (d.get("workspace") or {}).get("project_dir") or d.get("cwd") or "."
try:
    branch = subprocess.run(["git", "-C", proj, "branch", "--show-current"],
                            capture_output=True, text=True, timeout=2).stdout.strip()
except Exception:
    branch = ""
parts = [model]
if cost is not None:
    parts.append(f"${cost:.2f}")
if ctx is not None:
    parts.append(f"ctx {ctx:.0f}%")
if branch:
    parts.append(branch)
print(" · ".join(parts))
'
