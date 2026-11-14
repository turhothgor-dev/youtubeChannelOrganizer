<#
=============================================================================
 ai-kit doctor · Windows (PowerShell 5.1+ / 7+)

 Comprueba los prerrequisitos de Windows (WSL2, Docker Desktop, Git, VS Code,
 extensiones, claves) para los módulos activos. Si el repo está dentro de WSL
 (\\wsl.localhost\... o \\wsl$\...), delega en doctor.sh dentro de esa distro.

 Uso:
   .\doctor\doctor.ps1                         módulos de .kit\modules.txt
   .\doctor\doctor.ps1 -Modules devcontainer,adapter-cline
   .\doctor\doctor.ps1 -All
   .\doctor\doctor.ps1 -Fix                    ofrece arreglos con confirmación
   .\doctor\doctor.ps1 -Json                   salida JSON (para agentes)
   .\doctor\doctor.ps1 -Strict                 código 1 si hay fallos (CI)
   .\doctor\doctor.ps1 -NoDelegate             no delegar en WSL

 Por defecto el código de salida es 0: nada es bloqueante.
 Nunca muestra el valor de un secreto.
=============================================================================
#>
[CmdletBinding()]
param(
  [switch]$Fix,
  [switch]$Json,
  [switch]$Strict,
  [switch]$All,
  [switch]$NoDelegate,
  [string]$Modules = ""
)

$ErrorActionPreference = "Continue"
# Versión única del kit: se lee del manifiesto que acompaña a doctor
$KitManifest = if ($env:KIT_MANIFEST) { $env:KIT_MANIFEST } else { Join-Path $PSScriptRoot "..\manifest\kit.yaml" }
$KitVersion = "desconocida"
if (Test-Path $KitManifest) {
  $inKit = $false
  foreach ($line in Get-Content $KitManifest) {
    if ($line -match '^kit:') { $inKit = $true; continue }
    if ($inKit -and $line -match '^\S') { break }
    if ($inKit -and $line -match '^  version:\s*"?([^"\s]+)"?') { $KitVersion = $Matches[1]; break }
  }
}
$env:WSL_UTF8 = "1"   # salida de wsl.exe en UTF-8

function Have([string]$cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

# -----------------------------------------------------------------------------
# Raíz del repo y delegación en WSL
# -----------------------------------------------------------------------------
$Root = (Get-Location).Path
if (Have git) {
  $top = git rev-parse --show-toplevel 2>$null
  if ($LASTEXITCODE -eq 0 -and $top) { $Root = $top }
}

$wslMatch = [regex]::Match($Root, '^(?:\\\\|//)(?:wsl\.localhost|wsl\$)[\\/]([^\\/]+)[\\/]?(.*)$', 'IgnoreCase')
if ($wslMatch.Success -and -not $NoDelegate) {
  $distro = $wslMatch.Groups[1].Value
  $linuxPath = "/" + ($wslMatch.Groups[2].Value -replace '\\', '/')
  $argsList = @()
  if ($Fix)    { $argsList += "--fix" }
  if ($Json)   { $argsList += "--json" }
  if ($Strict) { $argsList += "--strict" }
  if ($All)    { $argsList += "--all" }
  if ($Modules) { $argsList += "--modules"; $argsList += $Modules }
  if (-not $Json) { Write-Host "Repo dentro de WSL ($distro): ejecutando doctor.sh allí..." }
  & wsl.exe -d $distro --cd $linuxPath -- bash ./doctor/doctor.sh @argsList
  exit $LASTEXITCODE
}

# -----------------------------------------------------------------------------
# Módulos → checks (alineado con manifest/kit.yaml; versión Windows)
# -----------------------------------------------------------------------------
$AllModules = @("core","kit-dev","adapter-claude-code","adapter-cline","adapter-continue","adapter-phpstorm","compose-base","devcontainer","ci-bitbucket","ci-github","mcp-atlassian","mcp-docs","mcp-db-local","mcp-playwright","gcloud-fixtures","subagents","provider-scaleway","preset-php-mysql-react","lang-python","lang-node","lang-php","frontend-react","frontend-qt6","svc-mysql","env-devcontainer","env-docker-only","env-native")

$ModuleChecks = @{
  "core"                   = @("git","git-line-endings","copier","python3","markdownlint","pre-commit","disk-space")
  "kit-dev"                = @("pyyaml","markdownlint","pwsh")   # solo en el repo del kit (se añade solo)
  "adapter-claude-code"    = @("claude-cli","anthropic-key")
  "adapter-cline"          = @("vscode-cli","ext-cline","cline-mcp-config","cline-hooks-windows")
  "adapter-continue"       = @("vscode-cli","ext-continue","continue-secrets")
  "adapter-phpstorm"       = @("phpstorm")
  "compose-base"           = @("wsl2","docker-cli","docker-desktop-wsl","compose-v2")
  "devcontainer"           = @("wsl2","docker-cli","docker-desktop-wsl","compose-v2","wsl-repo-location","ports-free")
  "mcp-atlassian"          = @("atlassian-token")
  "mcp-docs"               = @("node")
  "mcp-playwright"         = @("node")
  "mcp-db-local"           = @("wsl2","docker-cli","docker-desktop-wsl","compose-v2")
  "gcloud-fixtures"        = @("gcloud-cli","gcloud-auth")
  "provider-scaleway"      = @("scaleway-key","scaleway-models")
  "preset-php-mysql-react" = @("wsl2","docker-cli","docker-desktop-wsl","compose-v2","node","node-version","ports-free")
  "ci-bitbucket" = @(); "ci-github" = @(); "subagents" = @()
  # Nuevos módulos modulares
  "lang-python"            = @("python-version")
  "lang-node"              = @("node")
  "lang-php"               = @("php")
  "frontend-react"         = @("node","node-version")
  "frontend-qt6"           = @("qt6","venv","uv")
  "svc-mysql"              = @("wsl2","docker-cli","docker-desktop-wsl","compose-v2")
  "env-devcontainer"       = @("wsl2","docker-cli","docker-desktop-wsl","compose-v2","ports-free")
  "env-docker-only"        = @("wsl2","docker-cli","docker-desktop-wsl","compose-v2")
  "env-native"             = @("venv","uv")
}

$active = @("core")
if ($All) { $active = $AllModules }
elseif ($Modules) { $active += ($Modules -split ',') | ForEach-Object { $_.Trim() } | Where-Object { $_ } }
elseif (Test-Path (Join-Path $Root ".kit\modules.txt")) {
  $active += Get-Content (Join-Path $Root ".kit\modules.txt") | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith("#") }
}
# En el repo del propio kit, también lo que hace falta para desarrollarlo (make test)
$KitRepo = (Test-Path (Join-Path $Root "manifest\kit.yaml")) -and (Test-Path (Join-Path $Root "copier.yml")) -and -not (Test-Path (Join-Path $Root ".kit\modules.txt"))
if ($KitRepo -and ($active -notcontains "kit-dev")) { $active += "kit-dev" }
$active = $active | Select-Object -Unique

$Checks = New-Object System.Collections.Generic.List[string]
$Unknown = @()
foreach ($m in $active) {
  if (-not $ModuleChecks.ContainsKey($m)) { $Unknown += $m; continue }
  foreach ($c in $ModuleChecks[$m]) { if (-not $Checks.Contains($c)) { $Checks.Add($c) } }
}

# -----------------------------------------------------------------------------
# Resultados
# -----------------------------------------------------------------------------
$Results = New-Object System.Collections.Generic.List[object]
function Record([string]$id, [string]$status, [string]$msg, [string]$fix = "", [string]$risk = "") {
  $Results.Add([pscustomobject]@{ id = $id; status = $status; message = $msg; fix = $fix; risk = $risk })
}

function Get-WslDistros {
  if (-not (Have wsl.exe)) { return @() }
  $out = & wsl.exe -l -v 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $out) { return @() }
  $list = @()
  foreach ($line in ($out | Select-Object -Skip 1)) {
    $clean = ($line -replace "`0", "").Trim()
    if (-not $clean) { continue }
    $isDefault = $clean.StartsWith("*")
    $parts = ($clean.TrimStart('*').Trim()) -split '\s+'
    if ($parts.Count -ge 3) {
      $list += [pscustomobject]@{ Name = $parts[0]; State = $parts[1]; Version = $parts[$parts.Count - 1]; Default = $isDefault }
    }
  }
  return $list
}

# -----------------------------------------------------------------------------
# Checks
# -----------------------------------------------------------------------------
function Check-git {
  if (Have git) { Record "git" "ok" ((git --version) -join " ") }
  else { Record "git" "fail" "Git no está instalado" "winget install --id Git.Git -e" "medio" }
}

function Check-git-line-endings {
  if (-not (Have git)) { return }
  $v = git config --global core.autocrlf 2>$null
  if ($v -eq "true") {
    Record "git-line-endings" "warn" "core.autocrlf=true convierte a CRLF y rompe scripts y hooks en WSL/contenedores" "git config --global core.autocrlf input" "bajo"
  } else { Record "git-line-endings" "ok" ("core.autocrlf=" + $(if ($v) { $v } else { "sin definir" })) }
}

function Check-copier {
  if (Have copier) { Record "copier" "ok" ("Copier " + ((copier --version 2>$null) -split ' ')[-1]); return }
  $fix = ""; if (Have pipx) { $fix = "pipx install copier" } elseif (Have uv) { $fix = "uv tool install copier" }
  $risk = "manual"; if ($fix) { $risk = "bajo" }
  Record "copier" "warn" "Copier no está instalado: hace falta para crear proyectos y para make kit-update" $fix $risk
}

function Get-Python {
  foreach ($c in @("python3","python","py")) {
    if (Have $c) {
      $v = & $c --version 2>&1
      if ($LASTEXITCODE -eq 0 -and "$v" -match 'Python 3') { return $c }   # descarta el alias de Microsoft Store
    }
  }
  return $null
}

function Check-python3 {
  $py = Get-Python
  if ($py) { Record "python3" "ok" ((& $py --version 2>&1) + " ($py)") }
  else { Record "python3" "fail" "Python 3 no está instalado: lo usan los hooks de los agentes (protección de .env), la línea de estado y la instalación del kit" "winget install --id Python.Python.3.12 -e" "medio" }
}

function Check-markdownlint {
  if (Have markdownlint-cli2) { Record "markdownlint" "ok" "markdownlint-cli2 disponible"; return }
  $fix = ""; $risk = "manual"
  if (Have npm) { $fix = "npm install -g markdownlint-cli2"; $risk = "bajo" }
  if ($KitRepo) { Record "markdownlint" "fail" "markdownlint-cli2 no está instalado: make test del kit lo necesita (lint-md)" $fix $risk }
  else { Record "markdownlint" "warn" "markdownlint-cli2 no está instalado: lint-md y format-md no funcionarán (necesita Node)" $fix $risk }
}

function Check-pre-commit {
  if (-not (Test-Path (Join-Path $Root ".pre-commit-config.yaml"))) { Record "pre-commit" "info" "Sin .pre-commit-config.yaml en este repositorio"; return }
  if (-not (Have pre-commit)) {
    $fix = ""; if (Have pipx) { $fix = "pipx install pre-commit" } elseif (Have uv) { $fix = "uv tool install pre-commit" }
    $risk = "manual"; if ($fix) { $risk = "bajo" }
    Record "pre-commit" "warn" "pre-commit no está instalado: gitleaks no revisa los commits en busca de secretos" $fix $risk
    return
  }
  $hook = git -C $Root rev-parse --git-path hooks/pre-commit 2>$null
  $hooksPath = git -C $Root config core.hooksPath 2>$null
  if (-not $hooksPath -and -not ($hook -and (Test-Path (Join-Path $Root $hook)))) {
    Record "pre-commit" "warn" "pre-commit instalado pero no activado en este repositorio" "cd `"$Root`"; pre-commit install" "bajo"
  } else { Record "pre-commit" "ok" "pre-commit activo (gitleaks y comprobaciones básicas en cada commit)" }
}

function Check-pyyaml {
  $py = Get-Python
  if ($py) { & $py -c "import yaml" 2>$null | Out-Null }
  if ($py -and $LASTEXITCODE -eq 0) { Record "pyyaml" "ok" "PyYAML disponible" }
  else { Record "pyyaml" "fail" "PyYAML no está instalado: lo necesitan los tests del kit (check-manifest)" "python -m pip install --user pyyaml" "bajo" }
}

function Check-pwsh {
  if (Have pwsh) { Record "pwsh" "ok" ("PowerShell " + (pwsh -NoProfile -Command '$PSVersionTable.PSVersion.ToString()' 2>$null)) }
  else { Record "pwsh" "info" "PowerShell 7 (pwsh) no está instalado: make test no valida la sintaxis de los .ps1 (opcional)" "winget install --id Microsoft.PowerShell -e" "bajo" }
}

function Check-disk-space {
  try {
    $drive = (Get-Item $Root).PSDrive
    $gb = [math]::Floor($drive.Free / 1GB)
    if ($gb -lt 10) { Record "disk-space" "warn" "Solo $gb GB libres en $($drive.Name):" "" "manual" }
    else { Record "disk-space" "ok" "$gb GB libres en $($drive.Name):" }
  } catch { Record "disk-space" "info" "No se pudo medir el espacio libre" }
}

function Check-wsl2 {
  if (-not (Have wsl.exe)) {
    Record "wsl2" "fail" "WSL no está instalado. Ejecuta 'wsl --install' en una consola de administrador y reinicia" "" "manual"; return
  }
  $d = Get-WslDistros
  if (-not $d -or $d.Count -eq 0) {
    Record "wsl2" "fail" "WSL sin distribuciones. Ejecuta 'wsl --install -d Ubuntu' y reinicia si lo pide" "" "manual"; return
  }
  $user = $d | Where-Object { $_.Name -notmatch '^docker-desktop' }
  $v1 = $user | Where-Object { $_.Version -eq "1" }
  if ($v1) {
    $names = ($v1 | ForEach-Object { $_.Name }) -join ", "
    Record "wsl2" "warn" "Distros en WSL1: $names. Docker y devcontainers necesitan WSL2" ("wsl --set-version " + $v1[0].Name + " 2") "medio"
  } elseif (-not $user) {
    Record "wsl2" "warn" "Solo existen las distros internas de Docker Desktop. Instala una distro de trabajo: 'wsl --install -d Ubuntu'" "" "manual"
  } else {
    Record "wsl2" "ok" ("WSL2 con: " + (($user | ForEach-Object { $_.Name }) -join ", "))
  }
}

function Check-docker-cli {
  if (Have docker) { Record "docker-cli" "ok" ((docker --version) -join " ") }
  else { Record "docker-cli" "fail" "Docker Desktop no está instalado" "winget install --id Docker.DockerDesktop -e" "medio" }
}

function Check-docker-desktop-wsl {
  if (-not (Have docker)) { return }
  docker info *> $null
  if ($LASTEXITCODE -ne 0) { Record "docker-desktop-wsl" "fail" "Docker no responde. Arranca Docker Desktop" "" "manual"; return }
  $d = Get-WslDistros | Where-Object { $_.Name -notmatch '^docker-desktop' -and $_.Version -eq "2" }
  if (-not $d) { Record "docker-desktop-wsl" "info" "Docker Desktop activo; sin distro WSL2 de trabajo que comprobar"; return }
  $target = $d | Where-Object { $_.Default } | Select-Object -First 1
  if (-not $target) { $target = $d | Select-Object -First 1 }
  & wsl.exe -d $target.Name -- sh -c "command -v docker >/dev/null" 2>$null
  if ($LASTEXITCODE -eq 0) { Record "docker-desktop-wsl" "ok" "Docker disponible dentro de WSL ($($target.Name))" }
  else { Record "docker-desktop-wsl" "warn" "Docker no está disponible en $($target.Name). Activa la integración: Docker Desktop > Settings > Resources > WSL integration" "" "manual" }
}

function Check-compose-v2 {
  if (-not (Have docker)) { return }
  $v = docker compose version 2>$null
  if ($LASTEXITCODE -eq 0) { Record "compose-v2" "ok" (($v | Select-Object -First 1) -join " ") }
  else { Record "compose-v2" "fail" "Falta docker compose v2; actualiza Docker Desktop" "" "manual" }
}

function Check-wsl-repo-location {
  Record "wsl-repo-location" "warn" "El repo está en el disco de Windows ($Root). Para devcontainers clónalo dentro de WSL (p. ej. \\wsl.localhost\Ubuntu\home\<usuario>\proyectos) y ábrelo desde allí: más rápido, recarga en caliente fiable y hooks funcionando" "" "manual"
}

function Check-ports-free {
  $ports = @(3306, 8080, 5173)
  if ($env:KIT_PORTS) { $ports = $env:KIT_PORTS -split '\s+' | Where-Object { $_ } | ForEach-Object { [int]$_ } }
  if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) { Record "ports-free" "info" "No se pueden comprobar puertos en este sistema"; return }
  $busy = @()
  foreach ($p in $ports) {
    $conn = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
      $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
      $busy += ("$p" + $(if ($proc) { " (" + $proc.ProcessName + ")" } else { "" }))
    }
  }
  if ($busy.Count -eq 0) { Record "ports-free" "ok" ("Libres: " + ($ports -join " ")) }
  else { Record "ports-free" "warn" ("Puertos ocupados: " + ($busy -join ", ") + ". Si es com.docker.backend puede ser este mismo proyecto levantado") "" "manual" }
}

function Check-python-version {
  $py = Get-Python
  if ($py) {
    $v = (& $py --version 2>&1 | Out-String | Select-String '\d+\.\d+(\.\d+)?' | Select-Object -First 1 | ForEach-Object { $_.Matches[0].Value })
    Record "python-version" "ok" "Python $v disponible"
  }
  else {
    Record "python-version" "fail" "Python 3 no encontrado (necesario para lang-python)" "Install Python 3 from python.org or winget" "manual"
  }
}

function Check-qt6 {
  $py = @("python3","python","py") | Where-Object { Have $_ } | Select-Object -First 1
  $lib = $null
  if ($py) {
    foreach ($m in @("PyQt6","PySide6")) {
      & $py -c "import $m" 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { $lib = $m; break }
    }
  }
  if ($lib) { Record "qt6" "ok" "$lib disponible" }
  else { Record "qt6" "info" "Ni PyQt6 ni PySide6 en el Python del sistema; normalmente van en el venv del proyecto (uv add pyqt6)" }
}

function Check-php {
  if (Have php) {
    $first = (php --version 2>&1 | Select-Object -First 1) -join " "
    $v = ([regex]::Match("$first", '\d+\.\d+\.\d+')).Value
    Record "php" "ok" "PHP $v disponible"
  }
  else {
    Record "php" "fail" "PHP no encontrado (necesario para lang-php)" "Install PHP via winget or chocolatey" "manual"
  }
}

function Check-venv {
  if (Have python3) {
    try {
      python3 -m venv --help >$null 2>&1
      Record "venv" "ok" "venv disponible"
    }
    catch {
      Record "venv" "fail" "venv no disponible (necesario para env-native)" "Install python3-venv package" "manual"
    }
  }
  else {
    Record "venv" "fail" "Python 3 no encontrado (necesario para venv)" "" "manual"
  }
}

function Check-uv {
  if (Have uv) {
    $v = uv --version 2>&1 | Select-String '\d+\.\d+\.\d+' | ForEach-Object { $_.Matches[0].Value }
    Record "uv" "ok" "uv $v disponible"
  }
  else {
    Record "uv" "info" "uv no encontrado (opcional para env-native: https://github.com/astral-sh/uv)" ""
  }
}

function Check-claude-cli {
  if (Have claude) {
    $v = ((claude --version 2>$null | Select-Object -First 1) -join " ")
    if ($v -notmatch 'Claude Code') { $v = "Claude Code $v" }
    Record "claude-cli" "ok" $v
  }
  else { Record "claude-cli" "fail" "Claude Code no está instalado (instalador oficial: https://code.claude.com/docs/en/setup); también puedes instalarlo dentro de WSL" "irm https://claude.ai/install.ps1 | iex" "medio" }
}

function Check-anthropic-key {
  if ($env:ANTHROPIC_API_KEY) { Record "anthropic-key" "ok" "ANTHROPIC_API_KEY definida (valor oculto)" }
  elseif (Test-Path (Join-Path $HOME ".claude")) { Record "anthropic-key" "info" "Sin ANTHROPIC_API_KEY; se asume sesión iniciada en Claude Code" }
  else { Record "anthropic-key" "warn" "Define ANTHROPIC_API_KEY como variable de entorno de usuario (no en el .env del proyecto) o inicia sesión en Claude Code" "" "manual" }
}

# Valor de una variable: del proceso o, si falta, de las variables de usuario de Windows
# (un VS Code o una terminal abiertos antes de definirla no la ven). Nunca se muestra.
function Get-EnvValue([string]$name) {
  $v = [Environment]::GetEnvironmentVariable($name, "Process")
  if (-not $v) { $v = [Environment]::GetEnvironmentVariable($name, "User") }
  return $v
}

function Check-scaleway-key {
  if (Get-EnvValue "SCW_SECRET_KEY") {
    $where = if ($env:SCW_SECRET_KEY) { "" } else { " (solo como variable de usuario: reinicia VS Code o la terminal para que la vean los procesos)" }
    $url = if (Get-EnvValue "SCW_BASE_URL") { "SCW_BASE_URL definida" } else { "sin SCW_BASE_URL se usa https://api.scaleway.ai/v1" }
    Record "scaleway-key" "ok" "SCW_SECRET_KEY definida (valor oculto)$where; $url"
  }
  else { Record "scaleway-key" "warn" "Falta SCW_SECRET_KEY. Defínela como variable de entorno de usuario (SCW_BASE_URL es opcional: por defecto https://api.scaleway.ai/v1)" "" "manual" }
}

function Check-scaleway-models {
  $file = Join-Path $Root ".kit\models.yaml"
  if (-not (Test-Path $file)) { return }
  $wanted = @(Select-String -Path $file -Pattern '^\s*scaleway:\s*([^\s#]+)' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique)
  if ($wanted.Count -eq 0) { return }
  $scwKey = Get-EnvValue "SCW_SECRET_KEY"
  if (-not $scwKey) { Record "scaleway-models" "info" ("Sin SCW_SECRET_KEY no se puede comprobar si existen: " + ($wanted -join " ")); return }
  $scwUrl = Get-EnvValue "SCW_BASE_URL"
  $base = if ($scwUrl) { $scwUrl.TrimEnd('/') } else { "https://api.scaleway.ai/v1" }
  try {
    $resp = Invoke-RestMethod -Uri "$base/models" -Headers @{ Authorization = "Bearer $scwKey" } -TimeoutSec 15
    $ids = @($resp.data | ForEach-Object { $_.id })
    $missing = @($wanted | Where-Object { $ids -notcontains $_ })
    if ($missing.Count -eq 0) { Record "scaleway-models" "ok" ("Modelos disponibles en Scaleway: " + ($wanted -join " ")) }
    else { Record "scaleway-models" "fail" ("Scaleway no ofrece: " + ($missing -join " ") + ". Revisa .kit\models.yaml y los ajustes de Cline/Continue") "" "manual" }
  } catch { Record "scaleway-models" "warn" ("No se pudo consultar $base/models (red, clave o URL). Modelos configurados: " + ($wanted -join " ")) "" "manual" }
}

function Check-continue-secrets {
  $dir = Join-Path $Root ".continue"
  if (-not (Test-Path $dir)) { return }
  $names = @(Get-ChildItem $dir -Recurse -File -ErrorAction SilentlyContinue | Select-String -Pattern 'secrets\.([A-Za-z0-9_]+)' -AllMatches |
            ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
  if ($names.Count -eq 0) { Record "continue-secrets" "ok" "Los ficheros de Continue no usan secretos"; return }
  $userEnv = Join-Path $HOME ".continue\.env"; $projEnv = Join-Path $Root ".env"
  $defined = { param($f, $n) (Test-Path $f) -and (Select-String -Path $f -Pattern "^$n=" -Quiet) }
  $inProject = @($names | Where-Object { & $defined $projEnv $_ })
  $missing = @($names | Where-Object { -not (& $defined $userEnv $_) })
  if ($inProject.Count -gt 0) { Record "continue-secrets" "warn" ("En el .env del proyecto: " + ($inProject -join " ") + ". Muévelo a ~/.continue/.env") "" "manual" }
  elseif ($missing.Count -gt 0) { Record "continue-secrets" "warn" ("Continue necesita: " + ($missing -join " ") + ". Añádelos a ~/.continue/.env") "" "manual" }
  else { Record "continue-secrets" "ok" "Secretos de Continue definidos en ~/.continue/.env (valores ocultos)" }
}

function Check-atlassian-token {
  if ($env:ATLASSIAN_API_TOKEN) { Record "atlassian-token" "ok" "ATLASSIAN_API_TOKEN definida (valor oculto)" }
  else { Record "atlassian-token" "warn" "Falta ATLASSIAN_API_TOKEN. Para Bitbucket Cloud vía Rovo MCP, un admin debe habilitar la autenticación por token" "" "manual" }
}

function Check-vscode-cli {
  if (Have code) { Record "vscode-cli" "ok" "Comando code disponible" }
  else { Record "vscode-cli" "warn" "No se encuentra el comando code" "winget install --id Microsoft.VisualStudioCode -e" "medio" }
}

function Test-Extension([string]$id) {
  $list = code --list-extensions 2>$null
  return [bool]($list | Where-Object { $_ -ieq $id })
}

function Check-ext-cline {
  if (-not (Have code)) { return }
  if (Test-Extension "saoudrizwan.claude-dev") { Record "ext-cline" "ok" "Cline instalado" }
  else { Record "ext-cline" "warn" "Cline no está instalado en VS Code" "code --install-extension saoudrizwan.claude-dev" "bajo" }
}

function Check-ext-continue {
  if (-not (Have code)) { return }
  if (Test-Extension "continue.continue") { Record "ext-continue" "ok" "Continue instalado" }
  else { Record "ext-continue" "warn" "Continue no está instalado en VS Code" "code --install-extension continue.continue" "bajo" }
}

function Check-cline-mcp-config {
  $candidates = @(
    (Join-Path $HOME ".cline\data\settings\cline_mcp_settings.json")
  )
  if ($env:APPDATA) { $candidates += (Join-Path $env:APPDATA "Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json") }
  $f = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (-not $f -and -not (Have code) -and -not (Have cline) -and -not (Test-Path (Join-Path $HOME ".cline"))) {
    Record "cline-mcp-config" "info" "Cline no detectado (ni VS Code, ni CLI, ni .cline); se comprobará cuando lo instales"; return
  }
  if (-not $f) { Record "cline-mcp-config" "warn" "No hay configuración MCP de usuario de Cline. Abre Cline una vez y vuelve a ejecutar doctor" "" "manual"; return }
  $frag = Join-Path $Root ".kit\cline-mcp.json"
  if (-not (Test-Path $frag)) { Record "cline-mcp-config" "ok" "Configuración MCP de Cline presente"; return }
  try {
    $user = Get-Content $f -Raw | ConvertFrom-Json
    $proj = Get-Content $frag -Raw | ConvertFrom-Json
    $have = @(); if ($user.mcpServers) { $have = $user.mcpServers.PSObject.Properties.Name }
    $missing = @(); if ($proj.mcpServers) { $missing = $proj.mcpServers.PSObject.Properties.Name | Where-Object { $have -notcontains $_ } }
    if ($missing.Count -eq 0) { Record "cline-mcp-config" "ok" "Servidores MCP del proyecto presentes en la configuración de Cline" }
    else { Record "cline-mcp-config" "warn" ("Faltan servidores MCP del proyecto en Cline: " + ($missing -join ", ") + ". Fusiona .kit\cline-mcp.json en $f (haz copia antes)") "" "manual" }
  } catch { Record "cline-mcp-config" "info" "No se pudo leer la configuración MCP de Cline" }
}

function Check-cline-hooks-windows {
  Record "cline-hooks-windows" "info" "Los hooks de Cline se ejecutan en Windows nativo (probado con Cline 4.1.26). Limitaciones: no hay límite de fallos seguidos (success siempre es true) y, con modelo desconocido, no se comprueba el rol de arquitecto; ver PLAN.md"
}

function Check-phpstorm {
  $found = (Have phpstorm) -or (Have phpstorm64) -or (Test-Path (Join-Path $env:LOCALAPPDATA "JetBrains\Toolbox\scripts\phpstorm.cmd")) -or (Test-Path "$env:ProgramFiles\JetBrains\PhpStorm*")
  if ($found) { Record "phpstorm" "ok" "PhpStorm detectado" } else { Record "phpstorm" "info" "PhpStorm no detectado (opcional)" }
}

function Check-node {
  if (Have node) { Record "node" "ok" ("Node " + (node -v)) }
  else { Record "node" "fail" "Node no está instalado. Recomendado un gestor de versiones (fnm) para respetar .nvmrc" "winget install --id Schniz.fnm -e" "medio" }
}

function Check-node-version {
  if (-not (Have node)) { return }
  $files = Get-ChildItem -Path $Root -Recurse -Depth 3 -Force -Include ".nvmrc", ".node-version" -ErrorAction SilentlyContinue |
           Where-Object { $_.FullName -notmatch '\\(node_modules|vendor|\.git)\\' }
  if (-not $files) { Record "node-version" "info" "Sin .nvmrc ni .node-version; el kit los generará"; return }
  $cur = ((node -v) -replace '^v', '').Split('.')[0]
  foreach ($f in $files) {
    $raw = (Get-Content $f.FullName -Raw).Trim()
    $req = ($raw -replace '^v', '').Split('.')[0]
    $rel = $f.FullName.Substring($Root.Length).TrimStart('\', '/')
    if ($req -notmatch '^\d+$') { Record "node-version" "info" "$rel pide '$raw'; no se compara" }
    elseif ($req -eq $cur) { Record "node-version" "ok" "${rel}: Node $req" }
    else { Record "node-version" "warn" "$rel pide Node $req y tienes $cur. Usa 'fnm use' en esa carpeta" "" "manual" }
  }
}

function Check-gcloud-cli {
  if (Have gcloud) { Record "gcloud-cli" "ok" "gcloud instalado" }
  else { Record "gcloud-cli" "warn" "gcloud no está instalado" "winget install --id Google.CloudSDK -e" "medio" }
}

function Check-gcloud-auth {
  if (-not (Have gcloud)) { return }
  $acc = gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>$null
  if ($acc) { Record "gcloud-auth" "ok" "Hay una cuenta activa en gcloud" }
  else { Record "gcloud-auth" "warn" "gcloud sin cuenta activa. Ejecuta 'gcloud auth login' tú mismo (no un agente)" "" "manual" }
}

# -----------------------------------------------------------------------------
# Ejecución
# -----------------------------------------------------------------------------
# Aquí solo se llega con el repo en disco de Windows o con -NoDelegate
foreach ($c in $Checks) {
  if ($c -eq "wsl-repo-location" -and ($NoDelegate -and $wslMatch.Success)) { continue }
  $fn = "Check-$c"
  if (Get-Command $fn -ErrorAction SilentlyContinue) { & $fn }
  else { Record $c "info" "Check no aplicable en Windows nativo (se comprueba en WSL con doctor.sh)" }
}
foreach ($m in $Unknown) { Record "module:$m" "warn" "Módulo desconocido: $m" }

$sum = [ordered]@{
  ok   = @($Results | Where-Object { $_.status -eq "ok" }).Count
  warn = @($Results | Where-Object { $_.status -eq "warn" }).Count
  fail = @($Results | Where-Object { $_.status -eq "fail" }).Count
  info = @($Results | Where-Object { $_.status -eq "info" }).Count
}

if ($Json) {
  [ordered]@{
    kit_doctor = $KitVersion; os = "windows"; distro = "windows"; root = $Root
    modules = @($active); results = $Results.ToArray(); summary = $sum
  } | ConvertTo-Json -Depth 5 -Compress
} else {
  Write-Host "ai-kit doctor $KitVersion · windows · $Root"
  Write-Host ("Módulos: " + ($active -join " "))
  if ((Test-Path (Join-Path $Root "manifest\kit.yaml")) -and -not (Test-Path (Join-Path $Root ".kit\modules.txt"))) {
    if ($All) { Write-Host "(Repo del kit: con -All se comprueban todos los módulos, también los que tus proyectos no usan. Para un proyecto: ai-kit doctor <carpeta>)" }
    else { Write-Host "(Repo del kit: núcleo y kit-dev, lo que necesita make test. Para un proyecto: ai-kit doctor <carpeta>)" }
  }
  Write-Host ""
  foreach ($r in $Results) {
    switch ($r.status) {
      "ok"   { $label = "OK   "; $color = "Green" }
      "warn" { $label = "AVISO"; $color = "Yellow" }
      "fail" { $label = "FALLO"; $color = "Red" }
      default { $label = "INFO "; $color = "Cyan" }
    }
    Write-Host -NoNewline $label -ForegroundColor $color
    Write-Host ("  {0,-20} {1}" -f $r.id, $r.message)
    if ($r.fix) { Write-Host ("       → arreglo (riesgo {0}): {1}" -f $r.risk, $r.fix) -ForegroundColor DarkGray }
  }
  Write-Host ""
  Write-Host ("Resumen: {0} OK · {1} avisos · {2} fallos · {3} informativos" -f $sum.ok, $sum.warn, $sum.fail, $sum.info)
  if (-not $Fix -and ($sum.warn + $sum.fail) -gt 0) { Write-Host "Ejecuta con -Fix para aplicar los arreglos automáticos (pide confirmación en cada uno)." }
}

# -----------------------------------------------------------------------------
# Arreglos con confirmación
# -----------------------------------------------------------------------------
if ($Fix -and -not $Json) {
  if (-not [Environment]::UserInteractive) { Write-Host "Sin consola interactiva: no se aplica ningún arreglo." }
  else {
    $applied = 0
    foreach ($r in $Results) {
      if ($r.status -notin @("warn", "fail")) { continue }
      if (-not $r.fix -or $r.risk -eq "manual") { continue }
      Write-Host ""
      Write-Host "[$($r.id)] $($r.message)"
      Write-Host "  Comando: $($r.fix)"
      if ($r.risk -eq "alto") {
        $ans = Read-Host '  Riesgo ALTO. Escribe "si" para ejecutarlo'
        if ($ans -ne "si") { Write-Host "  Omitido."; continue }
      } else {
        $ans = Read-Host "  ¿Ejecutar? (riesgo $($r.risk)) [s/N]"
        if ($ans -notmatch '^(s|si|y|yes)$') { Write-Host "  Omitido."; continue }
      }
      try {
        Invoke-Expression $r.fix
        if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) { Write-Host "  Hecho."; $applied++ } else { Write-Host "  El comando falló; revisa la salida." }
      } catch { Write-Host "  El comando falló: $_" }
    }
    Write-Host ""
    Write-Host "$applied arreglo(s) aplicados. Vuelve a ejecutar doctor para comprobar el resultado."
  }
}

if ($Strict -and $sum.fail -gt 0) { exit 1 }
exit 0
