#!/usr/bin/env bash
# =============================================================================
# ai-kit doctor · Linux / WSL / macOS
#
# Comprueba los prerrequisitos de los módulos activos, explica cada problema
# y, con --fix, ofrece arreglarlo pidiendo confirmación. Nunca ejecuta sudo
# en silencio y nunca muestra el valor de un secreto.
#
# Uso:
#   doctor.sh                       comprueba los módulos de .kit/modules.txt
#   doctor.sh --modules a,b         comprueba esos módulos (core siempre incluido)
#   doctor.sh --all                 comprueba todos los módulos
#   doctor.sh --fix                 ofrece arreglos tras la comprobación
#   doctor.sh --json                salida JSON (para agentes)
#   doctor.sh --strict              código de salida 1 si hay fallos (CI)
#   doctor.sh --list                lista módulos y sus checks
#
# Por defecto el código de salida es 0: nada es bloqueante. Esto permite
# usarlo en initializeCommand del devcontainer sin impedir abrirlo.
# Debe mantenerse alineado con manifest/kit.yaml (ver tests/check-manifest.sh).
# =============================================================================
set -o pipefail

# Versión única del kit: se lee del manifiesto que acompaña a doctor
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KIT_MANIFEST="${KIT_MANIFEST:-$SCRIPT_DIR/../manifest/kit.yaml}"
KIT_VERSION="$(awk '/^kit:/{k=1;next} k&&/^[^ ]/{k=0} k&&/^  version:/{gsub(/["\x27]/,"",$2);print $2;exit}' "$KIT_MANIFEST" 2>/dev/null)"
KIT_VERSION="${KIT_VERSION:-desconocida}"
FIX=0; JSON=0; STRICT=0; ALL=0; LIST=0; MODULES_ARG=""

usage() { sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --fix) FIX=1 ;;
    --json) JSON=1 ;;
    --strict) STRICT=1 ;;
    --all) ALL=1 ;;
    --list) LIST=1 ;;
    --modules) shift; MODULES_ARG="${1:-}" ;;
    --modules=*) MODULES_ARG="${1#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; usage; exit 2 ;;
  esac
  shift
done

# -----------------------------------------------------------------------------
# Módulos → checks (alineado con manifest/kit.yaml, incluidas dependencias)
# -----------------------------------------------------------------------------
ALL_MODULES="core kit-dev adapter-claude-code adapter-cline adapter-continue adapter-phpstorm compose-base devcontainer ci-bitbucket ci-github mcp-atlassian mcp-docs mcp-db-local mcp-playwright gcloud-fixtures subagents provider-scaleway preset-php-mysql-react preset-webext lang-python lang-node lang-php frontend-react frontend-qt6 svc-mysql env-devcontainer env-docker-only env-native"

module_checks() {
  case "$1" in
    core)                   echo "git make git-line-endings copier python3 markdownlint pre-commit disk-space" ;;
    kit-dev)                echo "pyyaml markdownlint pwsh" ;;   # solo en el repo del kit (se añade solo)
    adapter-claude-code)    echo "claude-cli anthropic-key" ;;
    adapter-cline)          echo "vscode-cli ext-cline cline-mcp-config" ;;
    adapter-continue)       echo "vscode-cli ext-continue continue-secrets" ;;
    adapter-phpstorm)       echo "phpstorm" ;;
    compose-base)           echo "docker-cli docker-real docker-daemon docker-permissions compose-v2" ;;
    devcontainer)           echo "docker-cli docker-real docker-daemon docker-permissions compose-v2 wsl-repo-location selinux-mounts ports-free devcontainer-extension" ;;
    mcp-atlassian)          echo "atlassian-token" ;;
    mcp-docs|mcp-playwright) echo "node" ;;
    mcp-db-local)           echo "docker-cli docker-real docker-daemon docker-permissions compose-v2" ;;
    gcloud-fixtures)        echo "gcloud-cli gcloud-auth" ;;
    provider-scaleway)      echo "scaleway-key scaleway-models" ;;
    preset-php-mysql-react) echo "docker-cli docker-real docker-daemon docker-permissions compose-v2 node node-version ports-free" ;;
    preset-webext)          echo "node node-version firefox" ;;
    ci-bitbucket|ci-github|subagents) echo "" ;;
    # Nuevos módulos modulares
    lang-python)            echo "python-version" ;;
    lang-node)              echo "node" ;;
    lang-php)               echo "php" ;;
    frontend-react)         echo "node node-version" ;;
    frontend-qt6)           echo "qt6 venv uv" ;;
    svc-mysql)              echo "docker-cli docker-real docker-daemon docker-permissions compose-v2" ;;
    env-devcontainer)       echo "docker-cli docker-real docker-daemon docker-permissions compose-v2 ports-free" ;;
    env-docker-only)        echo "docker-cli docker-real docker-daemon docker-permissions compose-v2" ;;
    env-native)             echo "venv uv" ;;
    *) echo "__unknown__" ;;
  esac
}

if [ "$LIST" = 1 ]; then
  for m in $ALL_MODULES; do printf '%-24s %s\n' "$m" "$(module_checks "$m")"; done
  exit 0
fi

# -----------------------------------------------------------------------------
# Entorno
# -----------------------------------------------------------------------------
have() { command -v "$1" >/dev/null 2>&1; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

OS="linux"
case "$(uname -s)" in
  Darwin) OS="macos" ;;
  Linux) grep -qiE 'microsoft|wsl' /proc/version 2>/dev/null && OS="wsl" ;;
esac
DISTRO="unknown"
if [ -r /etc/os-release ]; then DISTRO="$(. /etc/os-release && echo "${ID:-unknown}")"; fi
[ "$OS" = "macos" ] && DISTRO="macos"
# Solo para tests: simular otro sistema
OS="${KIT_TEST_OS:-$OS}"; DISTRO="${KIT_TEST_DISTRO:-$DISTRO}"; ROOT="${KIT_TEST_ROOT:-$ROOT}"

# Módulos activos
MODULES="core"
if [ "$ALL" = 1 ]; then
  MODULES="$ALL_MODULES"
elif [ -n "$MODULES_ARG" ]; then
  MODULES="core $(echo "$MODULES_ARG" | tr ',' ' ')"
elif [ -f "$ROOT/.kit/modules.txt" ]; then
  MODULES="core $(grep -vE '^\s*(#|$)' "$ROOT/.kit/modules.txt" | tr '\n' ' ')"
fi
# En el repo del propio kit, también lo que hace falta para desarrollarlo (make test)
KIT_REPO=0
if [ -f "$ROOT/manifest/kit.yaml" ] && [ -f "$ROOT/copier.yml" ] && [ ! -f "$ROOT/.kit/modules.txt" ]; then
  KIT_REPO=1
  case " $MODULES " in *" kit-dev "*) ;; *) MODULES="$MODULES kit-dev" ;; esac
fi

# Lista de checks sin duplicados, en orden
CHECKS=""; UNKNOWN_MODULES=""
for m in $MODULES; do
  c="$(module_checks "$m")"
  if [ "$c" = "__unknown__" ]; then UNKNOWN_MODULES="$UNKNOWN_MODULES $m"; continue; fi
  for id in $c; do
    case " $CHECKS " in *" $id "*) ;; *) CHECKS="$CHECKS $id" ;; esac
  done
done

# Dentro del devcontainer, lo que depende del equipo (Docker, WSL, puertos, VS Code) se comprueba fuera
IN_DEVCONTAINER=0
if [ "${AI_KIT_DEVCONTAINER:-}" = 1 ]; then
  IN_DEVCONTAINER=1
  HOST_ONLY=" docker-cli docker-real docker-daemon docker-permissions compose-v2 wsl-repo-location wsl2 docker-desktop-wsl selinux-mounts ports-free devcontainer-extension vscode-cli "
  kept=""; for id in $CHECKS; do case "$HOST_ONLY" in *" $id "*) ;; *) kept="$kept $id" ;; esac; done
  CHECKS="$kept"
fi

# -----------------------------------------------------------------------------
# Resultados
# -----------------------------------------------------------------------------
R_ID=(); R_STATUS=(); R_MSG=(); R_FIX=(); R_RISK=()
# record <id> <ok|warn|fail|info> <mensaje> [comando de arreglo] [riesgo: bajo|medio|alto|manual]
record() {
  R_ID+=("$1"); R_STATUS+=("$2"); R_MSG+=("$3"); R_FIX+=("${4:-}"); R_RISK+=("${5:-}")
}

pkg_install() {   # comando de instalación de un paquete según la distro
  case "$DISTRO" in
    fedora|rhel|centos|rocky|almalinux) echo "sudo dnf install -y $1" ;;
    ubuntu|debian|pop|linuxmint) echo "sudo apt-get update && sudo apt-get install -y $1" ;;
    arch|manjaro) echo "sudo pacman -S --needed $1" ;;
    macos) echo "brew install $1" ;;
    *) echo "" ;;
  esac
}

fedora_docker_install() {   # Docker CE desde el repositorio oficial (dnf5 o dnf4)
  local addrepo="sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo"
  if dnf --version 2>/dev/null | grep -qi dnf5; then
    addrepo="sudo dnf config-manager addrepo --from-repofile=https://download.docker.com/linux/fedora/docker-ce.repo"
  fi
  echo "sudo dnf install -y dnf-plugins-core && $addrepo && sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin && sudo systemctl enable --now docker"
}

# -----------------------------------------------------------------------------
# Checks (uno por id del manifiesto: check_<id con _>)
# -----------------------------------------------------------------------------
check_git() {
  if have git; then record git ok "$(git --version)"
  else record git fail "git no está instalado" "$(pkg_install git)" medio; fi
}

check_make() {
  if have make; then record make ok "$(make --version | head -1)"
  else record make fail "make no está instalado" "$(pkg_install make)" medio; fi
}

check_git_line_endings() {
  have git || return 0
  local v; v="$(git config --global core.autocrlf 2>/dev/null)"
  if [ "$v" = "true" ]; then
    record git-line-endings warn "core.autocrlf=true convierte a CRLF y rompe scripts y hooks" "git config --global core.autocrlf input" bajo
  else
    record git-line-endings ok "core.autocrlf=${v:-sin definir}"
  fi
}

check_copier() {
  if have copier; then record copier ok "Copier $(copier --version 2>/dev/null | awk '{print $NF}')"; return; fi
  local fix=""
  if have pipx; then fix="pipx install copier"; elif have uv; then fix="uv tool install copier"; fi
  record copier warn "Copier no está instalado: hace falta para crear proyectos y para make kit-update" "$fix" "$([ -n "$fix" ] && echo bajo || echo manual)"
}

check_python3() {
  if have python3; then record python3 ok "$(python3 --version 2>&1)"
  else record python3 fail "python3 no está instalado: lo usan los hooks de los agentes (protección de .env), la línea de estado y la instalación del kit" "$(pkg_install python3)" medio; fi
}

check_markdownlint() {
  if have markdownlint-cli2; then record markdownlint ok "markdownlint-cli2 $(markdownlint-cli2 --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9.]+' | head -1)"; return; fi
  local fix="" risk=manual
  if have npm; then fix="npm install -g markdownlint-cli2"; risk=bajo; fi
  if [ "$KIT_REPO" = 1 ]; then
    record markdownlint fail "markdownlint-cli2 no está instalado: make test del kit lo necesita (lint-md)" "$fix" "$risk"
  else
    record markdownlint warn "markdownlint-cli2 no está instalado: make lint-md y make format-md no funcionarán (necesita Node)" "$fix" "$risk"
  fi
}

check_pre_commit() {
  [ -f "$ROOT/.pre-commit-config.yaml" ] || { record pre-commit info "Sin .pre-commit-config.yaml en este repositorio"; return; }
  if ! have pre-commit; then
    local fix=""
    if have pipx; then fix="pipx install pre-commit"; elif have uv; then fix="uv tool install pre-commit"; fi
    record pre-commit warn "pre-commit no está instalado: gitleaks no revisa los commits en busca de secretos" "$fix" "$([ -n "$fix" ] && echo bajo || echo manual)"
  elif [ ! -f "$(git -C "$ROOT" rev-parse --git-path hooks/pre-commit 2>/dev/null)" ] && [ -z "$(git -C "$ROOT" config core.hooksPath 2>/dev/null)" ]; then
    record pre-commit warn "pre-commit instalado pero no activado en este repositorio" "cd \"$ROOT\" && pre-commit install" bajo
  else
    record pre-commit ok "pre-commit activo (gitleaks y comprobaciones básicas en cada commit)"
  fi
}

check_pyyaml() {
  if have python3 && python3 -c "import yaml" >/dev/null 2>&1; then record pyyaml ok "PyYAML disponible"
  else record pyyaml fail "PyYAML no está instalado: lo necesitan los tests del kit (check-manifest)" "$(pkg_install python3-yaml)" medio; fi
}

check_pwsh() {
  if have pwsh; then record pwsh ok "PowerShell $(pwsh -NoProfile -Command '$PSVersionTable.PSVersion.ToString()' 2>/dev/null)"
  else record pwsh info "PowerShell (pwsh) no está instalado: make test no valida la sintaxis de los .ps1 (opcional)"; fi
}

check_disk_space() {
  local kb gb; kb="$(df -Pk "$ROOT" 2>/dev/null | awk 'NR==2{print $4}')"
  [ -z "$kb" ] && { record disk-space info "No se pudo medir el espacio libre"; return; }
  gb=$((kb / 1024 / 1024))
  if [ "$gb" -lt 10 ]; then record disk-space warn "Solo ${gb} GB libres; imágenes y volúmenes de Docker necesitan más" "" manual
  else record disk-space ok "${gb} GB libres"; fi
}

docker_is_podman_shim() {
  have docker || return 1
  local p; p="$(readlink -f "$(command -v docker)" 2>/dev/null)"
  case "$p" in *podman*) return 0 ;; esac
  docker --version 2>&1 | grep -qi podman && return 0
  return 1
}

check_docker_cli() {
  if have docker && ! docker_is_podman_shim; then record docker-cli ok "$(docker --version 2>/dev/null)"; return; fi
  have docker && return 0   # existe pero es el shim de Podman: lo explica docker-real
  case "$OS:$DISTRO" in
    linux:fedora) record docker-cli fail "Docker no está instalado" "$(fedora_docker_install)" medio ;;
    wsl:*) record docker-cli fail "Docker no está disponible en WSL. Instala Docker Desktop en Windows y activa la integración WSL para esta distro (Settings > Resources > WSL integration)" "" manual ;;
    macos:*) record docker-cli fail "Docker no está instalado. Instala Docker Desktop u OrbStack" "" manual ;;
    *) record docker-cli fail "Docker no está instalado. Sigue https://docs.docker.com/engine/install/" "" manual ;;
  esac
}

check_docker_real() {
  [ "$OS" = "linux" ] || return 0
  local conflicts=""
  if [ "$DISTRO" = "fedora" ] && have rpm; then
    rpm -q podman-docker >/dev/null 2>&1 && conflicts="$conflicts podman-docker"
    rpm -q moby-engine  >/dev/null 2>&1 && conflicts="$conflicts moby-engine"
  fi
  if docker_is_podman_shim || [ -n "$conflicts" ]; then
    local fix=""
    if [ "$DISTRO" = "fedora" ]; then
      fix="sudo dnf remove -y${conflicts:- podman-docker} && $(fedora_docker_install)"
    fi
    record docker-real fail "El comando docker es el shim de Podman o hay paquetes en conflicto (${conflicts# }). Podman puede seguir instalado; solo choca podman-docker y moby-engine con Docker CE" "$fix" alto
  elif have docker; then
    record docker-real ok "Docker Engine real (Podman, si está, convive sin conflicto)"
  fi
}

check_docker_daemon() {
  have docker || return 0
  docker_is_podman_shim && return 0
  local out; out="$(docker info 2>&1)"
  if [ $? -eq 0 ]; then record docker-daemon ok "El servicio Docker responde"; return; fi
  if echo "$out" | grep -qi "permission denied"; then
    record docker-daemon ok "El servicio Docker está activo (permisos: ver docker-permissions)"; return
  fi
  case "$OS" in
    wsl) record docker-daemon fail "Docker no responde. Arranca Docker Desktop en Windows" "" manual ;;
    macos) record docker-daemon fail "Docker no responde. Arranca Docker Desktop" "" manual ;;
    *) if have systemctl; then record docker-daemon fail "El servicio Docker no está activo" "sudo systemctl enable --now docker" medio
       else record docker-daemon fail "El servicio Docker no está activo" "" manual; fi ;;
  esac
}

check_docker_permissions() {
  [ "$OS" = "linux" ] || return 0
  have docker || return 0
  docker_is_podman_shim && return 0
  local out; out="$(docker info 2>&1)"
  if [ $? -eq 0 ]; then
    if echo "$out" | grep -qi rootless; then record docker-permissions ok "Docker en modo rootless"
    else record docker-permissions ok "Tu usuario puede usar Docker"; fi
    return
  fi
  if echo "$out" | grep -qi "permission denied"; then
    record docker-permissions fail "Tu usuario no tiene acceso a Docker. Opción A: grupo docker (equivale a root; requiere cerrar sesión). Opción B: modo rootless (dockerd-rootless-setuptool.sh install)" "sudo usermod -aG docker $USER" alto
  fi
}

check_compose_v2() {
  have docker || return 0
  docker_is_podman_shim && return 0
  if docker compose version >/dev/null 2>&1; then
    record compose-v2 ok "$(docker compose version 2>/dev/null | head -1)"
  else
    local fix=""; [ "$DISTRO" = "fedora" ] && fix="sudo dnf install -y docker-compose-plugin"
    record compose-v2 fail "Falta docker compose v2 (el antiguo docker-compose no sirve)" "$fix" "$([ -n "$fix" ] && echo medio || echo manual)"
  fi
}

port_owner() {   # nombre del proceso que escucha en el puerto, si se puede saber
  if have ss; then ss -Hltnp "sport = :$1" 2>/dev/null | grep -o 'users:(("[^"]*' | head -1 | sed 's/users:(("//'; fi
}
port_in_use() {
  if have ss; then [ -n "$(ss -Hltn "sport = :$1" 2>/dev/null)" ]; return; fi
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

check_ports_free() {
  local ports="${KIT_PORTS:-3306 8080 5173}" busy="" p owner
  for p in $ports; do
    if port_in_use "$p"; then
      owner="$(port_owner "$p")"
      busy="$busy $p${owner:+ ($owner)}"
    fi
  done
  if [ -z "$busy" ]; then record ports-free ok "Libres: $ports"
  else record ports-free warn "Puertos ocupados:$busy. Si es docker-proxy puede ser este mismo proyecto levantado; si no, cambia el puerto en .kit o para ese servicio" "" manual; fi
}

check_python_version() {
  if have python3; then
    local v; v="$(python3 --version 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)"
    record python-version ok "Python $v disponible"
  else
    record python-version fail "Python 3 no encontrado (necesario para lang-python)" "sudo apt install python3 (Debian/Ubuntu) o sudo dnf install python3 (Fedora)" manual
  fi
}

check_qt6() {
  if have python3 && python3 -c "import PyQt6" >/dev/null 2>&1; then record qt6 ok "PyQt6 disponible"
  elif have python3 && python3 -c "import PySide6" >/dev/null 2>&1; then record qt6 ok "PySide6 disponible"
  else record qt6 info "Ni PyQt6 ni PySide6 en el Python del sistema; normalmente van en el venv del proyecto (uv add pyqt6)"; fi
}

check_php() {
  if have php; then
    local v; v="$(php --version 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
    record php ok "PHP $v disponible"
  else
    record php fail "PHP no encontrado (necesario para lang-php)" "sudo apt install php (Debian/Ubuntu) o sudo dnf install php (Fedora)" manual
  fi
}

check_venv() {
  if have python3 && python3 -m venv --help >/dev/null 2>&1; then
    record venv ok "venv disponible"
  else
    record venv fail "venv no disponible (necesario para env-native)" "sudo apt install python3-venv (Debian/Ubuntu) o sudo dnf install python3-venv (Fedora)" manual
  fi
}

check_uv() {
  if have uv; then
    local v; v="$(uv --version | grep -oP '\d+\.\d+\.\d+')"
    record uv ok "uv $v disponible"
  else
    record uv info "uv no encontrado (opcional para env-native: https://github.com/astral-sh/uv)" ""
  fi
}

check_wsl_repo_location() {
  [ "$OS" = "wsl" ] || return 0
  case "$ROOT" in
    /mnt/[a-z]/*) record wsl-repo-location warn "El repo está en el disco de Windows ($ROOT): lento, sin recarga en caliente fiable y con problemas de permisos. Clónalo dentro de WSL, p. ej. ~/proyectos" "" manual ;;
    *) record wsl-repo-location ok "Repo dentro del sistema de ficheros de WSL" ;;
  esac
}

check_selinux_mounts() {
  [ "$OS" = "linux" ] || return 0
  have getenforce || return 0
  if [ "$(getenforce 2>/dev/null)" = "Enforcing" ]; then
    record selinux-mounts info "SELinux en enforcing: los bind mounts necesitan la opción :z (los ficheros generados por el kit ya la incluyen; revísalo en composes propios)"
  fi
}

check_claude_cli() {
  if have claude; then
    local v; v="$(claude --version 2>/dev/null | head -1)"
    case "$v" in *"Claude Code"*) ;; *) v="Claude Code $v" ;; esac
    record claude-cli ok "$v"
  else record claude-cli fail "Claude Code no está instalado (instalador oficial: https://code.claude.com/docs/en/setup)" "curl -fsSL https://claude.ai/install.sh | bash" medio; fi
}

check_anthropic_key() {
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then record anthropic-key ok "ANTHROPIC_API_KEY definida (valor oculto)"
  elif [ -d "$HOME/.claude" ]; then record anthropic-key info "Sin ANTHROPIC_API_KEY; se asume sesión iniciada en Claude Code"
  else record anthropic-key warn "Define ANTHROPIC_API_KEY en tu entorno de usuario (no en el .env del proyecto) o inicia sesión en Claude Code" "" manual; fi
}

check_scaleway_key() {
  if [ -n "${SCW_SECRET_KEY:-}" ]; then
    local url="sin SCW_BASE_URL se usa https://api.scaleway.ai/v1"
    [ -n "${SCW_BASE_URL:-}" ] && url="SCW_BASE_URL definida"
    record scaleway-key ok "SCW_SECRET_KEY definida (valor oculto); $url"
  else record scaleway-key warn "Falta SCW_SECRET_KEY. Defínela en tu entorno de usuario (SCW_BASE_URL es opcional: por defecto https://api.scaleway.ai/v1)" "" manual; fi
}

check_scaleway_models() {
  local wanted base
  wanted="$(sed -n 's/^ *scaleway: *\([^ #]*\).*/\1/p' "$ROOT/.kit/models.yaml" 2>/dev/null | sort -u | xargs)"
  [ -n "$wanted" ] || return 0
  if [ -z "${SCW_SECRET_KEY:-}" ]; then record scaleway-models info "Sin SCW_SECRET_KEY no se puede comprobar si existen: $wanted"; return; fi
  have curl && have python3 || { record scaleway-models info "Hace falta curl y python3 para comprobar los modelos de Scaleway"; return; }
  base="${SCW_BASE_URL:-https://api.scaleway.ai/v1}"
  local listing missing
  listing="$(curl -fsS -m 15 -H "Authorization: Bearer $SCW_SECRET_KEY" "${base%/}/models" 2>/dev/null)" || {
    record scaleway-models warn "No se pudo consultar ${base%/}/models (red, clave o URL). Modelos configurados: $wanted" "" manual; return; }
  missing="$(printf '%s' "$listing" | python3 -c 'import json,sys
ids={m.get("id") for m in json.load(sys.stdin).get("data",[])}
print(" ".join(w for w in sys.argv[1:] if w not in ids))' $wanted 2>/dev/null)"
  if [ -z "$missing" ]; then record scaleway-models ok "Modelos disponibles en Scaleway: $wanted"
  else record scaleway-models fail "Scaleway no ofrece: $missing. Revisa .kit/models.yaml (make kit-update ARGS=\"--data scw_architect_model=...\") y los ajustes de Cline/Continue" "" manual; fi
}

check_continue_secrets() {
  [ -d "$ROOT/.continue" ] || return 0
  local names name missing="" in_project=""
  names="$(grep -rhoE 'secrets\.[A-Za-z0-9_]+' "$ROOT/.continue" 2>/dev/null | sed 's/secrets\.//' | sort -u)"
  [ -n "$names" ] || { record continue-secrets ok "Los ficheros de Continue no usan secretos"; return; }
  for name in $names; do
    grep -qE "^${name}=" "$HOME/.continue/.env" 2>/dev/null || grep -qE "^${name}=" "$ROOT/.continue/.env" 2>/dev/null || missing="$missing $name"
    grep -qE "^${name}=" "$ROOT/.env" 2>/dev/null && in_project="$in_project $name"
  done
  if [ -n "$in_project" ]; then
    record continue-secrets warn "En el .env del proyecto:$in_project. Docker Compose lo carga y quedaría al alcance de los contenedores; muévelo a ~/.continue/.env" "" manual
  elif [ -n "$missing" ]; then
    record continue-secrets warn "Continue necesita:$missing. Añádelos a ~/.continue/.env (NOMBRE=valor; se lee desde la extensión, no desde tu shell)" "" manual
  else record continue-secrets ok "Secretos de Continue definidos en ~/.continue/.env (valores ocultos)"; fi
}

check_atlassian_token() {
  if [ -n "${ATLASSIAN_API_TOKEN:-}" ]; then record atlassian-token ok "ATLASSIAN_API_TOKEN definida (valor oculto)"
  else record atlassian-token warn "Falta ATLASSIAN_API_TOKEN. Para Bitbucket Cloud vía Rovo MCP, un admin debe habilitar la autenticación por token" "" manual; fi
}

check_vscode_cli() {
  if have code; then record vscode-cli ok "Comando code disponible"
  else record vscode-cli warn "No se encuentra el comando code (instala VS Code o añádelo al PATH)" "" manual; fi
}

has_extension() { code --list-extensions 2>/dev/null | grep -qix "$1"; }

check_ext_cline() {
  have code || return 0
  if has_extension saoudrizwan.claude-dev; then record ext-cline ok "Cline instalado"
  else record ext-cline warn "Cline no está instalado en VS Code" "code --install-extension saoudrizwan.claude-dev" bajo; fi
}

check_ext_continue() {
  have code || return 0
  if has_extension continue.continue; then record ext-continue ok "Continue instalado"
  else record ext-continue warn "Continue no está instalado en VS Code" "code --install-extension continue.continue" bajo; fi
}

cline_mcp_file() {
  local f
  for f in "$HOME/.cline/data/settings/cline_mcp_settings.json" \
           "$HOME/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json" \
           "$HOME/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json"; do
    [ -f "$f" ] && { echo "$f"; return; }
  done
}

check_cline_mcp_config() {
  local f frag="$ROOT/.kit/cline-mcp.json"; f="$(cline_mcp_file)"
  if [ -z "$f" ] && ! have code && ! have cline && [ ! -d "$HOME/.cline" ]; then
    record cline-mcp-config info "Cline no detectado (ni VS Code, ni CLI, ni ~/.cline); se comprobará cuando lo instales"; return
  fi
  if [ -z "$f" ]; then
    record cline-mcp-config warn "No hay configuración MCP de usuario de Cline. Abre Cline una vez y vuelve a ejecutar doctor" "" manual; return
  fi
  if [ ! -f "$frag" ]; then record cline-mcp-config ok "Configuración MCP de Cline presente"; return; fi
  if ! have jq; then record cline-mcp-config info "Instala jq para comprobar si .kit/cline-mcp.json está fusionado en $f"; return; fi
  local missing
  missing="$(jq -r --slurpfile u "$f" '(.mcpServers // {}) | keys[] as $k | select(($u[0].mcpServers // {}) | has($k) | not) | $k' "$frag" 2>/dev/null | tr '\n' ' ')"
  if [ -z "$missing" ]; then record cline-mcp-config ok "Servidores MCP del proyecto presentes en la configuración de Cline"
  else
    record cline-mcp-config warn "Faltan servidores MCP del proyecto en la configuración de Cline: $missing" \
      "cp '$f' '$f.bak' && jq -s '.[0] * .[1]' '$f' '$frag' > '$f.tmp' && mv '$f.tmp' '$f'" medio
  fi
}

check_phpstorm() {
  if have phpstorm || have phpstorm.sh || [ -x "$HOME/.local/share/JetBrains/Toolbox/scripts/phpstorm" ]; then
    record phpstorm ok "PhpStorm detectado"
  else record phpstorm info "PhpStorm no detectado en el PATH (opcional)"; fi
}

check_node() {
  if have node; then record node ok "Node $(node -v)"
  else record node fail "Node no está instalado. Recomendado: un gestor de versiones (fnm, nvm o mise) para respetar .nvmrc" "" manual; fi
}

check_firefox() {
  local url="https://www.mozilla.org/firefox/new/"
  if have firefox || have firefox-esr; then record firefox ok "Firefox detectado en el PATH"
  elif have flatpak && flatpak info org.mozilla.firefox >/dev/null 2>&1; then record firefox ok "Firefox (Flatpak) detectado"
  elif [ -d /Applications/Firefox.app ] || [ -d "$HOME/Applications/Firefox.app" ]; then record firefox ok "Firefox detectado en Applications"
  else record firefox warn "Firefox no detectado: make up (web-ext run) lo necesita; lint, test y build no. Descárgalo en $url" "" manual; fi
}

check_node_version() {
  have node || return 0
  local files f req cur
  files="$(find "$ROOT" -maxdepth 3 \( -name node_modules -o -name vendor -o -name .git \) -prune -o \( -name .nvmrc -o -name .node-version \) -print 2>/dev/null)"
  if [ -z "$files" ]; then record node-version info "Sin .nvmrc ni .node-version; el kit los generará"; return; fi
  cur="$(node -v | sed 's/^v//' | cut -d. -f1)"
  for f in $files; do
    req="$(tr -d ' v\r\n' < "$f" | cut -d. -f1)"
    case "$req" in
      ''|*[!0-9]*) record node-version info "${f#$ROOT/} pide '$(tr -d '\r\n' < "$f")'; no se compara" ;;
      "$cur") record node-version ok "${f#$ROOT/}: Node $req" ;;
      *) record node-version warn "${f#$ROOT/} pide Node $req y tienes $cur. Usa 'fnm use' o 'nvm use' en esa carpeta" "" manual ;;
    esac
  done
}

check_gcloud_cli() {
  if have gcloud; then record gcloud-cli ok "gcloud instalado"
  else record gcloud-cli warn "gcloud no está instalado: https://cloud.google.com/sdk/docs/install" "" manual; fi
}

check_gcloud_auth() {
  have gcloud || return 0
  if [ -n "$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null)" ]; then
    record gcloud-auth ok "Hay una cuenta activa en gcloud"
  else record gcloud-auth warn "gcloud sin cuenta activa. Ejecuta 'gcloud auth login' tú mismo (no un agente)" "" manual; fi
}

# -----------------------------------------------------------------------------
# Ejecución
# -----------------------------------------------------------------------------
for id in $CHECKS; do
  fn="check_$(echo "$id" | tr '-' '_')"
  if declare -F "$fn" >/dev/null; then "$fn"
  else record "$id" info "Check no implementado en este sistema"; fi
done
for m in $UNKNOWN_MODULES; do record "module:$m" warn "Módulo desconocido en .kit/modules.txt: $m"; done

N_OK=0; N_WARN=0; N_FAIL=0; N_INFO=0
for s in "${R_STATUS[@]}"; do
  case "$s" in ok) N_OK=$((N_OK+1));; warn) N_WARN=$((N_WARN+1));; fail) N_FAIL=$((N_FAIL+1));; *) N_INFO=$((N_INFO+1));; esac
done

json_escape() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' | awk 'BEGIN{ORS=""} NR>1{print "\\n"} {print}'; }

if [ "$JSON" = 1 ]; then
  printf '{"kit_doctor":"%s","os":"%s","distro":"%s","root":"%s","modules":[' "$KIT_VERSION" "$OS" "$DISTRO" "$(json_escape "$ROOT")"
  first=1; for m in $MODULES; do [ $first = 1 ] || printf ','; printf '"%s"' "$(json_escape "$m")"; first=0; done
  printf '],"results":['
  for i in "${!R_ID[@]}"; do
    [ "$i" = 0 ] || printf ','
    printf '{"id":"%s","status":"%s","message":"%s","fix":"%s","risk":"%s"}' \
      "$(json_escape "${R_ID[$i]}")" "${R_STATUS[$i]}" "$(json_escape "${R_MSG[$i]}")" "$(json_escape "${R_FIX[$i]}")" "${R_RISK[$i]}"
  done
  printf '],"summary":{"ok":%d,"warn":%d,"fail":%d,"info":%d}}\n' $N_OK $N_WARN $N_FAIL $N_INFO
else
  if [ -t 1 ]; then G=$'\e[32m'; Y=$'\e[33m'; RD=$'\e[31m'; B=$'\e[34m'; D=$'\e[2m'; N=$'\e[0m'; else G=; Y=; RD=; B=; D=; N=; fi
  echo "ai-kit doctor $KIT_VERSION · $OS ($DISTRO) · $ROOT"
  echo "Módulos: $MODULES"
  [ "$IN_DEVCONTAINER" = 1 ] && echo "(Dentro del devcontainer: Docker, WSL, puertos y VS Code se comprueban en el equipo con make doctor fuera del contenedor)"
  if [ -f "$ROOT/manifest/kit.yaml" ] && [ ! -f "$ROOT/.kit/modules.txt" ]; then
    if [ "$ALL" = 1 ]; then echo "(Repo del kit: con --all se comprueban todos los módulos, también los que tus proyectos no usan. Para un proyecto: ai-kit doctor <carpeta>)"
    else echo "(Repo del kit: núcleo y kit-dev, lo que necesita make test. Para un proyecto: ai-kit doctor <carpeta>)"; fi
  fi
  echo
  for i in "${!R_ID[@]}"; do
    case "${R_STATUS[$i]}" in
      ok) icon="${G}OK   ${N}" ;; warn) icon="${Y}AVISO${N}" ;; fail) icon="${RD}FALLO${N}" ;; *) icon="${B}INFO ${N}" ;;
    esac
    printf '%s  %-20s %s\n' "$icon" "${R_ID[$i]}" "${R_MSG[$i]}"
    if [ -n "${R_FIX[$i]}" ]; then printf '       %s→ arreglo (riesgo %s): %s%s\n' "$D" "${R_RISK[$i]}" "${R_FIX[$i]}" "$N"; fi
  done
  echo
  echo "Resumen: $N_OK OK · $N_WARN avisos · $N_FAIL fallos · $N_INFO informativos"
  [ "$FIX" = 0 ] && [ $((N_WARN + N_FAIL)) -gt 0 ] && echo "Ejecuta con --fix para aplicar los arreglos automáticos (pide confirmación en cada uno)."
fi

# -----------------------------------------------------------------------------
# Arreglos con confirmación
# -----------------------------------------------------------------------------
if [ "$FIX" = 1 ] && [ "$JSON" = 0 ]; then
  if [ ! -t 0 ]; then
    echo "Sin terminal interactiva: no se aplica ningún arreglo."
  else
    applied=0
    for i in "${!R_ID[@]}"; do
      case "${R_STATUS[$i]}" in warn|fail) ;; *) continue ;; esac
      cmd="${R_FIX[$i]}"; risk="${R_RISK[$i]}"
      [ -z "$cmd" ] || [ "$risk" = "manual" ] && continue
      echo
      echo "[${R_ID[$i]}] ${R_MSG[$i]}"
      echo "  Comando: $cmd"
      if [ "$risk" = "alto" ]; then
        printf '  Riesgo ALTO. Escribe "si" para ejecutarlo: '; read -r ans
        [ "$ans" = "si" ] || { echo "  Omitido."; continue; }
      else
        printf '  ¿Ejecutar? (riesgo %s) [s/N]: ' "$risk"; read -r ans
        case "$ans" in s|S|si|SI|y|Y) ;; *) echo "  Omitido."; continue ;; esac
      fi
      if bash -c "$cmd"; then echo "  Hecho."; applied=$((applied+1)); else echo "  El comando falló; revisa la salida."; fi
    done
    echo
    echo "$applied arreglo(s) aplicados. Vuelve a ejecutar doctor para comprobar el resultado."
  fi
fi

if [ "$STRICT" = 1 ] && [ "$N_FAIL" -gt 0 ]; then exit 1; fi
exit 0
