#!/usr/bin/env python3
"""Hook PostToolUse de Cline (ai-kit): comprueba los ficheros editados (`make check-file`; sin make,
`Makefile.ps1 check-file` con PowerShell; en el repo del kit, `scripts/check_file.py`).

Lee el JSON de Cline por stdin (extensión: postToolUse.{toolName,parameters};
CLI: tool_call.{name,input}), saca las rutas editadas y, si `make check-file`
falla en alguna, devuelve los errores en "contextModification". Nunca cancela.

Uso: cline_post_edit.py <raíz del proyecto>
"""
import json
import os
import re
import shutil
import subprocess
import sys

EDIT_TOOLS = {"editor", "apply_patch", "write_to_file", "replace_in_file", "new_file"}
PATCH_PATH = re.compile(r"^\*\*\* (?:Add|Update) File: (.+)$|^\*\*\* Move to: (.+)$", re.M)


def dejson(value):
    if isinstance(value, str) and value[:1] in "[{\"":
        try:
            return json.loads(value)
        except ValueError:
            return value
    return value


def edited_paths(data):
    if "postToolUse" in data:
        post = data.get("postToolUse") or {}
        tool = post.get("toolName") or post.get("tool", "")
        params = {k: dejson(v) for k, v in (post.get("parameters") or {}).items()}
        if post.get("success") is False:
            return []
    else:
        call = data.get("tool_call") or {}
        tool, params = call.get("name", ""), dejson(call.get("input")) or {}
    if tool not in EDIT_TOOLS or not isinstance(params, dict):
        return []
    paths = [params.get(k) for k in ("path", "file_path", "filePath") if isinstance(params.get(k), str)]
    for key in ("input", "patch", "diff"):
        if isinstance(params.get(key), str):
            paths += [a or b for a, b in PATCH_PATH.findall(params[key])]
    return [p.strip() for p in paths if p and p.strip()]


def check_command(root, rel):
    """(etiqueta, comando) para comprobar `rel`, o None. Igual que after-edit.sh: make; en el repo del
    kit sin make, check_file.py; en Windows sin make, Makefile.ps1 con PowerShell."""
    if shutil.which("make"):
        return "make check-file", ["make", "-s", "-C", root, "check-file", f"FILE={rel}"]
    if os.path.isfile(os.path.join(root, "scripts", "check_file.py")) and not os.path.isdir(os.path.join(root, ".kit", "scripts")):
        return "scripts/check_file.py", [sys.executable, os.path.join(root, "scripts", "check_file.py"), rel]
    ps = shutil.which("pwsh") or shutil.which("powershell")
    if ps and os.path.isfile(os.path.join(root, "Makefile.ps1")):
        return "Makefile.ps1 check-file", [ps, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                                           os.path.join(root, "Makefile.ps1"), "check-file", "-FILE", rel]
    return None


def read_input():
    try:
        if "--input-file" in sys.argv:
            with open(sys.argv[sys.argv.index("--input-file") + 1], encoding="utf-8-sig") as fh:
                return json.load(fh)
        raw = sys.stdin.buffer.read().decode("utf-8-sig", errors="replace")
        return json.loads(raw) if raw.strip() else {}
    except (OSError, ValueError, IndexError):
        return {}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--input-file" in sys.argv:
        args = [a for a in args if a != sys.argv[sys.argv.index("--input-file") + 1]]
    root = os.path.abspath(args[0] if args else ".")
    data = read_input()
    data = data if isinstance(data, dict) else {}
    notes = []
    # Fallos seguidos de herramientas (el bloqueo al tercero lo hace PreToolUse)
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import secrets_guard
        data.setdefault("workspaceRoots", [root])
        if secrets_guard.record_result(data) == secrets_guard.MAX_FAILURES - 1:
            notes.append("ai-kit: dos herramientas han fallado seguidas. Un último intento con otro enfoque (relee las "
                         "líneas exactas); si vuelve a fallar, para y explica a la persona qué ha pasado. No rodees el "
                         "fallo con la terminal.")
    except Exception:  # noqa: BLE001 - el contador nunca debe romper el hook
        pass
    errors = []
    label = "check-file"
    unchecked = False
    for path in edited_paths(data):
        full = path if os.path.isabs(path) else os.path.join(root, path)
        rel = os.path.relpath(full, root)
        if rel.startswith("..") or not os.path.exists(full):
            continue
        found = check_command(root, rel)
        if not found:
            unchecked = True
            continue
        label, cmd = found
        env = dict(os.environ, PYTHONUTF8="1")
        try:
            r = subprocess.run(cmd, cwd=root, capture_output=True, text=True, encoding="utf-8", errors="replace",
                               timeout=110, env=env)
        except (OSError, subprocess.SubprocessError) as exc:
            errors.append(f"{rel}:\n{exc}")
            continue
        if r.returncode != 0:
            errors.append(f"{rel}:\n{(r.stdout + r.stderr).strip()[-1500:]}")
    if errors:
        notes.append(f"{label} ha fallado; corrígelo antes de seguir:\n\n" + "\n\n".join(errors))
    elif unchecked:
        notes.append("AVISO ai-kit: no hay make, ni scripts/check_file.py, ni Makefile.ps1 con PowerShell: "
                     "no se comprueba el fichero editado.")
    out = {"cancel": False}
    if notes:
        out["contextModification"] = "\n\n".join(notes)
    print(json.dumps(out))   # ASCII: PowerShell no puede estropear los acentos
    return 0


if __name__ == "__main__":
    sys.exit(main())
