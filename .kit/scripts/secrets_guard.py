#!/usr/bin/env python3
"""Guardián de secretos para hooks de agentes (ai-kit).

Bloquea el acceso a ficheros .env* y .envrc (salvo las plantillas sin secretos
.env.example, .env.dist, .env.sample y .env.template) cuando una herramienta los
lee, los edita, los busca o los usa en un comando de shell.

Entiende la entrada (stdin) de:
  - Claude Code PreToolUse:       {"tool_name", "tool_input"}
  - Cline, extensión de VS Code:  {"preToolUse": {"toolName", "parameters"}}  (valores como JSON en texto)
  - Cline, CLI/SDK:               {"tool_call": {"name", "input"}}

Salida según --format:
  claude  -> exit 2 y motivo por stderr si bloquea; exit 0 si permite
  cline   -> siempre exit 0 y JSON por stdout: {"cancel": true|false, "errorMessage": "..."}

Con --policy <fichero.json> bloquea además comandos y rutas peligrosos (lo usa
`ai-kit adopt` para impedir el acceso a producción):
  {"commands": [{"regex": "...", "reason": "..."}], "paths": [{"regex": "...", "reason": "..."}]}

Además, siempre:
  - Bloquea los comandos que escriben ficheros (PowerShell `Set-Content`/`Out-File`/`Add-Content`,
    `[IO.File]::Write*`, `sed -i`, `tee`, redirecciones `>` a ficheros...): se edita con la herramienta
    de edición del agente, no con la terminal.
  - Se protege a sí mismo: bloquea las ediciones (con herramienta o con comandos rm/del/mv/cp...,
    `git rm|mv|checkout|restore` y tras prefijos como `cmd /c`, `powershell -c` o `bash -c`) en
    `.claude/hooks/`, `.claude/settings*.json`, `.clinerules/hooks/` y `.kit/`; borrar o mover las carpetas
    `.claude` y `.clinerules` enteras también. Las lecturas se permiten.
  - Cline: si el modelo que actúa (`model.slug`) es el del arquitecto en `.kit/models.yaml`, bloquea las
    ediciones fuera de `docs/plans/`.
  - Cline: cuenta los fallos seguidos de herramientas (PostToolUse) y, al tercero, bloquea la siguiente
    hasta que la persona escriba (UserPromptSubmit, TaskStart o TaskResume lo reinician).

Eventos (--event): pre (por defecto, PreToolUse), post (PostToolUse, solo cuenta fallos), reset.
Entrada: stdin, o --input-file <ruta> (Windows: evita que PowerShell cambie la codificación del pipe).

No es una barrera absoluta (un programa puede abrir el fichero por su cuenta):
para aislar de verdad, devcontainer o sandbox.
"""
import hashlib
import json
import os
import posixpath
import re
import sys
import tempfile
from pathlib import Path

ALLOWED = {".env.example", ".env.dist", ".env.sample", ".env.template"}
# .env, .env.<algo> o .envrc como nombre de fichero, con o sin ruta delante
TOKEN = re.compile(r"(?<![\w.-])((?:[\w./~-]*/)?\.env(?:rc|\.[\w.-]+)?)(?![\w.-])")
PATCH_PATH = re.compile(r"^(?:\*\*\* (?:Add|Update|Delete) File|\*\*\* Move to): (.+)$", re.M)

PATH_KEYS = ("file_path", "path", "filePath", "notebook_path", "absolutePath")
PATH_LIST_KEYS = ("paths", "files", "file_paths")
COMMAND_KEYS = ("command", "commands", "cmd")


def is_secret(path):
    name = os.path.basename(str(path).strip().strip("\"'"))
    return bool(re.fullmatch(r"\.env(rc|\..+)?", name)) and name not in ALLOWED


def secrets_in_text(text):
    return [m.group(1) for m in TOKEN.finditer(text or "") if is_secret(m.group(1))]


def dejson(value):
    """Cline (extensión) envía los parámetros como JSON en texto."""
    if isinstance(value, str) and value[:1] in "[{\"":
        try:
            return json.loads(value)
        except ValueError:
            return value
    return value


def as_list(value):
    value = dejson(value)
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def normalize(data):
    """Devuelve (formato de entrada, herramienta, parámetros)."""
    if "preToolUse" in data:
        pre = data.get("preToolUse") or {}
        params = {k: dejson(v) for k, v in (pre.get("parameters") or {}).items()}
        return "cline", pre.get("toolName") or pre.get("tool", ""), params
    if "tool_call" in data:
        call = data.get("tool_call") or {}
        return "cline", call.get("name", ""), dejson(call.get("input")) or {}
    return "claude", data.get("tool_name", ""), data.get("tool_input") or {}


def commands_of(params):
    out = []
    for key in COMMAND_KEYS:
        for cmd in as_list(params.get(key)):
            if isinstance(cmd, dict):
                cmd = " ".join([str(cmd.get("command", ""))] + [str(a) for a in as_list(cmd.get("args"))])
            out.append(str(cmd))
    return out


def paths_of(params):
    out = [str(params[k]) for k in PATH_KEYS if params.get(k)]
    for key in PATH_LIST_KEYS:
        for item in as_list(params.get(key)):
            item = dejson(item)
            if isinstance(item, dict):
                item = item.get("path") or item.get("file_path") or item.get("filePath") or ""
            if item:
                out.append(str(item))
    return out


def policy_findings(params, policy):
    """Reglas extra de --policy: comandos (regex sobre el comando completo) y rutas."""
    found = []
    if not isinstance(params, dict):
        return found
    cmds = commands_of(params)
    paths = paths_of(params)
    for rule in policy.get("commands", []):
        rx = re.compile(rule["regex"])
        found += [rule.get("reason") or rule["regex"] for c in cmds if rx.search(c)]
    for rule in policy.get("paths", []):
        rx = re.compile(rule["regex"])
        found += [rule.get("reason") or rule["regex"] for p in paths + cmds if rx.search(p)]
    return sorted(set(found))


# --- Escribir ficheros con la terminal -------------------------------------------------------
SHELL_WRITERS = [
    (re.compile(r"(?i)\b(Set-Content|Add-Content|Out-File|Clear-Content)\b"), "PowerShell (Set-Content/Out-File/Add-Content)"),
    (re.compile(r"(?i)\bNew-Item\b[^|;]*-Value\b"), "PowerShell New-Item -Value"),
    (re.compile(r"(?i)\[(System\.)?IO\.File\]::(Write|Append)"), "PowerShell [IO.File]::Write"),
    (re.compile(r"(?<![\w-])sed\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*i"), "sed -i"),
    (re.compile(r"(?<![\w-])perl\s+-[a-zA-Z]*i"), "perl -i"),
    (re.compile(r"(?<![\w-])tee\b(?!\s+/dev/null)"), "tee"),
    (re.compile(r"(?<![\w-])(truncate|dd\s+.*of=)"), "truncate/dd"),
    (re.compile(r"python[0-9.]*\s+-c\s+.*open\(.*['\"][wax]"), "python -c con open(..., 'w')"),
]
# > o >> hacia un fichero (no >&N, /dev/null, $null ni NUL)
REDIRECT = re.compile(r"(?<![<>&|=-])\d?>{1,2}(?![&>])\s*(?!/dev/null|\$null\b|nul\b|NUL\b)([^\s|;&)]+)")
QUOTED = re.compile(r"'[^']*'|\"(?:[^\"\\]|\\.)*\"")


def shell_write_findings(params):
    found = []
    for cmd in commands_of(params) if isinstance(params, dict) else []:
        for rx, what in SHELL_WRITERS:
            if rx.search(cmd):
                found.append(what)
        bare = QUOTED.sub('""', cmd)
        bare = re.sub(r"<<-?\s*['\"]?\w+['\"]?", "", bare)
        for m in REDIRECT.finditer(bare):
            found.append(f"redirección a {m.group(1)}")
    return sorted(set(found))


# --- Rol arquitecto (Cline: model.slug) ------------------------------------------------------
EDIT_TOOLS = {"editor", "apply_patch", "write_to_file", "replace_in_file", "new_file", "Edit", "Write", "MultiEdit", "NotebookEdit"}


def project_root(data):
    roots = data.get("workspaceRoots") if isinstance(data, dict) else None
    if isinstance(roots, list) and roots:
        return Path(str(roots[0]))
    here = Path(__file__).resolve().parent            # <raíz>/.kit/scripts o <kit>/scripts
    return here.parent.parent if here.parent.name == ".kit" else here.parent


def architect_model(root):
    f = root / ".kit" / "models.yaml"
    if not f.is_file():
        return None
    m = re.search(r"^\s*architect:\s*\n(?:\s+.*\n)*?\s+scaleway:\s*(\S+)", f.read_text(encoding="utf-8"), re.M)
    return m.group(1) if m else None


def edit_paths(params):
    paths = paths_of(params) if isinstance(params, dict) else []
    for key in ("input", "patch", "diff"):
        text = params.get(key) if isinstance(params, dict) else None
        if isinstance(text, str):
            paths += [p.strip() for p in PATCH_PATH.findall(text)]
    return paths


def architect_findings(data, tool, params):
    # Con "OpenAI Compatible" Cline envía model.slug = "unknown": no coincide con el arquitecto
    # de .kit/models.yaml y esta comprobación no se aplica (se documenta como limitación).
    model = ((data.get("model") or {}).get("slug") or "") if isinstance(data, dict) else ""
    if not model or tool not in EDIT_TOOLS:
        return []
    root = project_root(data)
    arch = architect_model(root)
    if not arch or not (model == arch or model.endswith("/" + arch)):
        return []
    bad = []
    for p in edit_paths(params):
        rel = Path(p)
        try:
            rel = rel.resolve().relative_to(root.resolve()) if rel.is_absolute() else rel
        except ValueError:
            pass
        if not rel.as_posix().lstrip("./").startswith("docs/plans/"):
            bad.append(str(p))
    return bad


# --- Protección de los ficheros del propio agente --------------------------------------------
# Hooks, permisos y .kit/ los cambia la persona o `make kit-update` / `make self-sync`, que no pasan por
# los hooks del agente. Leerlos sí se permite.
PROTECTED = re.compile(r"(?:\.claude/hooks|\.clinerules/hooks|\.kit)(?:/|$)|\.claude/settings(?:\.local)?\.json$")
PROTECTED_IN_TEXT = re.compile(r"(?<![\w.-])(?:(?:\.claude/hooks|\.clinerules/hooks|\.kit)(?![\w.-])|"
                               r"\.claude/settings(?:\.local)?\.json)", re.I)
# Comandos que borran, mueven o copian ficheros (las escrituras con redirección ya las bloquea SHELL_WRITERS)
SHELL_MUTATORS = re.compile(r"(?i)(rm|rmdir|rd|del|erase|remove-item|ri|mv|move|move-item|mi|cp|copy|copy-item|cpi)(\.exe)?")
GIT_MUTATORS = {"rm", "mv", "checkout", "restore"}
INTERPRETERS = {"powershell", "powershell.exe", "pwsh", "pwsh.exe", "bash", "sh"}
# Las carpetas .claude y .clinerules completas (solo en comandos que borran, mueven o copian)
PROTECTED_DIRS = re.compile(r"(?<![\w.-])\.(?:claude|clinerules)(?:/+(?![\w.-])|(?![\w./-]))", re.I)
COMMAND_SPLIT = re.compile(r"&&|\|\||[;|\n]")   # separadores de comandos en bash y PowerShell


def roots_of(data):
    roots = []
    if isinstance(data, dict):
        found = data.get("workspaceRoots")
        roots += [str(r) for r in found] if isinstance(found, list) else []
        if data.get("cwd"):
            roots.append(str(data["cwd"]))
    roots.append(str(project_root(data)))
    return roots


def is_protected(path, roots):
    """Ruta normalizada (\\ y /, mayúsculas de unidad, relativa a la raíz del proyecto) dentro de lo protegido."""
    p = str(path).strip().strip("\"'").replace("\\", "/").lower()
    for root in roots:
        r = root.replace("\\", "/").rstrip("/").lower()
        if r and p.startswith(r + "/"):
            p = p[len(r) + 1:]
            break
    else:
        if re.match(r"([a-z]:)?/|~", p):
            return False                                   # absoluta y fuera del proyecto
    return bool(PROTECTED.match(posixpath.normpath(p)))


def protected_findings(data, tool, params):
    if not isinstance(params, dict):
        return []
    roots = roots_of(data)
    found = []
    if tool in EDIT_TOOLS:
        found += [p for p in edit_paths(params) if is_protected(p, roots)]
    for cmd in commands_of(params):
        # Solo cuenta si el comando que borra, mueve o copia está al principio de un comando (no "del" como
        # palabra en un mensaje de commit), y la ruta protegida va en ese mismo comando.
        for segment in COMMAND_SPLIT.split(cmd.replace("\\", "/")):
            words = mutator_words(segment)
            if words and (SHELL_MUTATORS.fullmatch(words[0])
                          or (words[0].lower() in ("git", "git.exe") and len(words) > 1 and words[1].lower() in GIT_MUTATORS)):
                found += [m.group(0) for m in PROTECTED_IN_TEXT.finditer(segment)]
                found += [m.group(0) for m in PROTECTED_DIRS.finditer(segment)]
    return sorted(set(found))


def mutator_words(segment):
    """Palabras del segmento sin prefijos (sudo, cmd /c, powershell -c, bash -c...) ni comillas de apertura."""
    words = [w for w in segment.strip().lstrip("(&").split() if w]
    while words:
        first = words[0].lstrip("\"'(&").lower()
        if not first:
            words = words[1:]
        elif first in ("sudo", "command", "builtin"):
            words = words[1:]
        elif first in ("cmd", "cmd.exe"):
            words = words[1:]
            while words and words[0].startswith("/"):
                words = words[1:]
        elif first in INTERPRETERS:
            words = words[1:]
            while words and words[0].startswith("-"):
                words = words[1:]
        else:
            words[0] = words[0].lstrip("\"'(&")
            break
    return words


# --- Fallos seguidos (Cline) -----------------------------------------------------------------
MAX_FAILURES = 3


def state_file(data):
    key = hashlib.sha1(str(project_root(data)).encode()).hexdigest()[:12]
    return Path(tempfile.gettempdir()) / f"ai-kit-agent-{key}.json"


def load_state(data):
    try:
        return json.loads(state_file(data).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def save_state(data, state):
    try:
        state_file(data).write_text(json.dumps(state), encoding="utf-8", newline="\n")
    except OSError:
        pass


def task_id(data):
    return str(data.get("taskId") or "sin-tarea") if isinstance(data, dict) else "sin-tarea"


def record_result(data):
    """PostToolUse: suma un fallo si la herramienta falló; vuelve a cero si funcionó. Devuelve el contador."""
    post = data.get("postToolUse") if isinstance(data, dict) else None
    if not isinstance(post, dict) or "success" not in post:
        return 0
    state = load_state(data)
    tid = task_id(data)
    state[tid] = 0 if post.get("success") else int(state.get(tid, 0)) + 1
    save_state(data, state)
    return state[tid]


def failures(data):
    return int(load_state(data).get(task_id(data), 0))


def reset(data):
    state = load_state(data)
    state.pop(task_id(data), None)
    save_state(data, state)


def findings(tool, params):
    found = []
    if not isinstance(params, dict):
        params = {"value": params}

    # Comandos de shell (Claude: Bash; Cline: run_commands / execute_command)
    for key in COMMAND_KEYS:
        for cmd in as_list(params.get(key)):
            if isinstance(cmd, dict):
                cmd = " ".join([str(cmd.get("command", ""))] + [str(a) for a in as_list(cmd.get("args"))])
            found += secrets_in_text(str(cmd))

    # Rutas de ficheros
    for key in PATH_KEYS:
        if params.get(key) and is_secret(params[key]):
            found.append(params[key])
    for key in PATH_LIST_KEYS:
        for item in as_list(params.get(key)):
            item = dejson(item)
            if isinstance(item, dict):
                item = item.get("path") or item.get("file_path") or item.get("filePath") or ""
            if item and is_secret(item):
                found.append(item)

    # Parches (Cline apply_patch): rutas en las cabeceras
    for key in ("input", "patch", "value"):
        text = params.get(key)
        if isinstance(text, str):
            found += [p.strip() for p in PATCH_PATH.findall(text) if is_secret(p.strip())]

    # Patrones de ficheros: "glob" (Grep), "pattern" solo en Glob, "file_pattern" (Cline search_files).
    # En Grep, "pattern" es el texto buscado y no se comprueba.
    patterns = [params.get("glob"), params.get("file_pattern")]
    if tool == "Glob":
        patterns.append(params.get("pattern"))
    for pattern in patterns:
        if isinstance(pattern, str) and ".env" in pattern and not any(a in pattern for a in ALLOWED):
            found.append(pattern)

    return sorted(set(map(str, found)))


def read_input():
    try:
        if "--input-file" in sys.argv:
            with open(sys.argv[sys.argv.index("--input-file") + 1], encoding="utf-8-sig") as fh:
                return json.load(fh)
        raw = sys.stdin.buffer.read().decode("utf-8-sig", errors="replace")
        return json.loads(raw) if raw.strip() else {}
    except (OSError, ValueError, IndexError):
        return {}


def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv and sys.argv.index(name) + 1 < len(sys.argv) else default


def main():
    fmt = arg("--format", "claude")
    event = arg("--event", "pre")
    policy = {}
    if "--policy" in sys.argv:
        try:
            with open(arg("--policy"), encoding="utf-8") as fh:
                policy = json.load(fh)
        except (OSError, ValueError, TypeError):
            policy = {}
    data = read_input()
    data = data if isinstance(data, dict) else {}

    if event == "reset":
        reset(data)
        print(json.dumps({"cancel": False}))
        return 0
    if event == "post":
        n = record_result(data)
        out = {"cancel": False}
        if n == MAX_FAILURES - 1:
            out["contextModification"] = ("ai-kit: dos herramientas han fallado seguidas. Un último intento con otro enfoque "
                                          "(relee las líneas exactas); si vuelve a fallar, para y explica a la persona qué ha "
                                          "pasado. No rodees el fallo con la terminal.")
        print(json.dumps(out))
        return 0

    _, tool, params = normalize(data)
    parts = []
    if fmt == "cline" and failures(data) >= MAX_FAILURES:
        parts.append(f"{MAX_FAILURES} herramientas han fallado seguidas en esta tarea. Para: explica a la persona qué "
                     "intentabas, qué ha fallado y qué propones; la tarea sigue cuando ella escriba")
    found = findings(tool, params)
    if found:
        parts.append("acceso a ficheros de secretos (" + ", ".join(found) + "). Usa .env.example para ver qué "
                     "variables existen; si necesitas un valor real, pídeselo a la persona")
    writes = shell_write_findings(params)
    if writes:
        parts.append("no se escriben ficheros con comandos (" + "; ".join(writes) + "). Usa la herramienta de edición "
                     "del agente; si la edición ha fallado dos veces, para y pide ayuda a la persona")
    for p in protected_findings(data, tool, params):
        parts.append(f"{p} forma parte de las protecciones del agente; la cambia la persona o `make kit-update`")
    arch = architect_findings(data, tool, params)
    if arch:
        parts.append("el arquitecto solo escribe planes en docs/plans/ (" + ", ".join(arch) + "). Termina el plan y pide "
                     "a la persona que lo apruebe y cambie a modo Act")
    blocked = policy_findings(params, policy) if policy else []
    if blocked:
        parts.append("comando o ruta que puede acceder a producción o a credenciales (" + "; ".join(blocked) + "). "
                     "Lo ejecuta una persona: explícale qué hace falta y por qué")
    message = "Bloqueado por ai-kit: " + ". También: ".join(parts) + "." if parts else ""

    if fmt == "cline":
        print(json.dumps({"cancel": True, "errorMessage": message} if parts else {"cancel": False}))
        return 0
    if parts:
        sys.stderr.write(message + "\n")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
