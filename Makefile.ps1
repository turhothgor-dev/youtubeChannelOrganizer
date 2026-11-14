# =============================================================================
# Makefile.ps1 - Equivalente PowerShell para Windows nativo
#
# Uso: .\Makefile.ps1 <objetivo> [args]
# Ejemplo: .\Makefile.ps1 doctor
#          .\Makefile.ps1 check-file FILE=backend/src/Health.php
#
# Este archivo se genera desde template/Makefile.ps1.jinja en proyectos nuevos.
# En Linux/macOS/WSL se usa Makefile.jinja (bash).
# =============================================================================

# Los objetivos y sus condiciones son los mismos que los de Makefile.jinja: la ayuda lista
# exactamente los que existen. No se reasignan variables automáticas ($input, $args).
param(
    [Parameter(Position=0)]
    [string]$Command = "",
    [string]$FILE = "",
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Rest = @()
)

$root = $PSScriptRoot
Set-Location $root
$kitDir = Join-Path $root ".kit"

# Acepta FILE=ruta y ARGS="..." al estilo de make, además de -FILE ruta.
$extra = @()
foreach ($a in $Rest) {
    if ($a -match '^FILE=(.*)$') { $FILE = $Matches[1] }
    elseif ($a -match '^ARGS=(.*)$') { $extra += @($Matches[1] -split '\s+' | Where-Object { $_ }) }
    else { $extra += $a }
}

function Stop-Make { param([string]$Message); Write-Host "  ERROR: $Message" -ForegroundColor Red; exit 1 }

function Invoke-Cmd {
    param([string]$Exe, [string[]]$CmdArgs = @())
    if (-not (Get-Command $Exe -ErrorAction SilentlyContinue)) { Stop-Make "No se encuentra '$Exe' en el PATH." }
    & $Exe @CmdArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Invoke-Python {
    param([string]$ScriptName, [string[]]$ScriptArgs = @())
    $py = $null; $pre = @()   # el primer intérprete que EJECUTA (el alias de la Microsoft Store sale con 49)
    foreach ($c in @('python', 'py -3', 'python3')) {
        $parts = @($c -split ' '); $exe = $parts[0]; $cand = @($parts | Select-Object -Skip 1)
        if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { continue }
        & $exe @cand -c 'pass' *> $null
        if ($LASTEXITCODE -eq 0) { $py = $exe; $pre = $cand; break }
    }
    if (-not $py) { Stop-Make "Python no encontrado. Instala Python 3.10+ desde python.org" }
    $full = Join-Path (Join-Path $kitDir "scripts") $ScriptName
    if (-not (Test-Path $full)) { Stop-Make "Script no encontrado: $full" }
    & $py @pre $full @ScriptArgs
    exit $LASTEXITCODE
}

function Get-GitStatus { return @(& git status --porcelain | Where-Object { $_ }) }


$targets = New-Object System.Collections.ArrayList
function Add-Target { param([string]$Name, [string]$Desc); [void]$script:targets.Add(@($Name, $Desc)) }

Add-Target 'help' 'Muestra los objetivos disponibles'
Add-Target 'doctor' 'Comprueba los prerrequisitos de la máquina'
Add-Target 'ai-sync' 'Regenera los ficheros de las herramientas de IA desde ai/skills'
Add-Target 'ai-models' 'Muestra qué modelo usa cada rol y cómo configurarlo en cada herramienta'
Add-Target 'kit-update' 'Actualiza a la última versión de ai-kit y deja los cambios en su propio commit'

Add-Target 'setup' 'Instala dependencias'
Add-Target 'up' 'Levanta los servicios'
Add-Target 'down' 'Para los servicios'
Add-Target 'logs' 'Logs de los servicios'
Add-Target 'test' 'Todos los tests'
Add-Target 'test-affected' 'Tests de lo cambiado'
Add-Target 'lint' 'Comprobaciones estáticas'
Add-Target 'format' 'Formato'
Add-Target 'typecheck' 'Comprobación de tipos'
Add-Target 'check-file' 'Comprueba un fichero: .\Makefile.ps1 check-file FILE=ruta'


function Show-Help {
    Write-Host ""
    Write-Host "Makefile.ps1 - objetivos disponibles (uso: .\Makefile.ps1 <objetivo>)" -ForegroundColor Green
    foreach ($t in $targets) { Write-Host ("  {0,-15} {1}" -f $t[0], $t[1]) }
    Write-Host ""
}

function Invoke-Target {
    param([string]$Name)
    switch ($Name) {
        'help' { Show-Help }
        'doctor' {
            $doctorPs1 = Join-Path $kitDir "doctor/doctor.ps1"
            if (-not (Test-Path $doctorPs1)) { Stop-Make "doctor.ps1 no encontrado en $doctorPs1" }
            & $doctorPs1
            exit $LASTEXITCODE
        }
        'ai-sync' { Invoke-Python "ai_sync.py" }
        'ai-models' {
            $modelsFile = Join-Path $kitDir "ai-models.txt"
            if (-not (Test-Path $modelsFile)) { Stop-Make "ai-models.txt no encontrado" }
            Get-Content $modelsFile -Encoding UTF8
        }
        'kit-update' {
            if (Test-Path (Join-Path $kitDir "adopt.json")) {
                if (-not (Get-Command 'ai-kit' -ErrorAction SilentlyContinue)) {
                    Stop-Make "Este proyecto se adoptó con 'ai-kit adopt --team': actualízalo con 'ai-kit adopt --team .' (instala ai-kit y ponlo en el PATH)"
                }
                Invoke-Cmd 'ai-kit' (@('adopt', '--team', '.') + $extra)
                exit 0
            }
            if ((Get-GitStatus).Count -gt 0) {
                Stop-Make "Haz commit de tus cambios antes de actualizar el kit (los del kit van en un commit aparte)"
            }
            Invoke-Cmd 'copier' (@('update', '--trust', '-a', '.kit/.copier-answers.yml') + $extra)
            $changes = Get-GitStatus
            if ($changes.Count -eq 0) { Write-Host "El kit ya estaba al día."; exit 0 }
            $conflicts = @()
            foreach ($line in $changes) {
                $f = $line.Substring(3).Trim('"')
                if ((Test-Path -LiteralPath $f -PathType Leaf) -and (Select-String -LiteralPath $f -Pattern '^(<<<<<<<|>>>>>>>) ' -Quiet)) { $conflicts += $f }
            }
            $conflicts += @(Get-ChildItem -Path . -Recurse -Filter '*.rej' -File -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -notmatch '[\\/]\.git[\\/]' } | ForEach-Object { $_.FullName })
            if ($conflicts.Count -gt 0) {
                Write-Host "Conflictos en:"
                $conflicts | ForEach-Object { Write-Host $_ }
                Stop-Make "Resuélvelos y haz commit: git add -A; git commit -m 'chore: actualizar ai-kit'"
            }
            $ver = ''; $inKit = $false
            foreach ($l in (Get-Content (Join-Path $kitDir 'manifest/kit.yaml') -Encoding UTF8)) {
                if ($l -match '^kit:') { $inKit = $true; continue }
                if ($inKit -and $l -match '^\S') { $inKit = $false }
                if ($inKit -and $l -match '^  version:\s*(\S+)') { $ver = $Matches[1]; break }
            }
            Invoke-Cmd 'git' @('add', '-A')
            Invoke-Cmd 'git' @('commit', '-q', '-m', "chore: actualizar ai-kit a v$ver")
            Write-Host "Commit creado: chore: actualizar ai-kit a v$ver (revísalo con git show --stat)"
        }

        # Preset genérico: sustituye cada TODO por el comando real del proyecto.
        'setup' { Write-Host "TODO: define 'setup' en Makefile.ps1 (y en el Makefile)" }
        'up' { Write-Host "TODO: define 'up' en Makefile.ps1 (y en el Makefile)" }
        'down' { Write-Host "TODO: define 'down' en Makefile.ps1 (y en el Makefile)" }
        'logs' { Write-Host "TODO: define 'logs' en Makefile.ps1 (y en el Makefile)" }
        'test' { Write-Host "TODO: define 'test' en Makefile.ps1 (y en el Makefile)" }
        'test-affected' { Invoke-Target 'test' }
        'lint' { Write-Host "TODO: define 'lint' en Makefile.ps1 (y en el Makefile)" }
        'format' { Write-Host "TODO: define 'format' en Makefile.ps1 (y en el Makefile)" }
        'typecheck' { Write-Host "TODO: define 'typecheck' en Makefile.ps1 (y en el Makefile)" }
        'check-file' { }   # igual que el Makefile: sin comprobaciones en el preset genérico

        default {
            Write-Host "  ERROR: Objetivo '$Name' no encontrado." -ForegroundColor Red
            Write-Host "  Usa .\Makefile.ps1 help para ver los objetivos disponibles." -ForegroundColor Yellow
            exit 1
        }
    }
}

if ($Command -eq "") { Show-Help; exit 0 }
Invoke-Target $Command
exit 0

