# =============================================================================
# format-md.ps1 - Formatea archivos Markdown con markdownlint-cli2
#
# Uso: .\format-md.ps1
#
# Este script se genera desde template/format-md.ps1.jinja en proyectos nuevos.
# Equivalente a `make format-md` para Windows nativo.
# =============================================================================

$ErrorActionPreference = "Stop"

# Buscar markdownlint-cli2
$markdownlint = Get-Command markdownlint-cli2 -ErrorAction SilentlyContinue

if (-not $markdownlint) {
    Write-Host "ERROR: markdownlint-cli2 no está instalado." -ForegroundColor Red
    Write-Host "Instálalo con:" -ForegroundColor Yellow
    Write-Host "  npm install -g markdownlint-cli2" -ForegroundColor White
    Write-Host ""
    Write-Host "O con Python:" -ForegroundColor Yellow
    Write-Host "  pip install markdownlint-cli2" -ForegroundColor White
    exit 1
}

Write-Host "  INFO: Formateando Markdown..." -ForegroundColor Cyan

# Ejecutar markdownlint-cli2 --fix
& markdownlint-cli2 --fix "**/*.md" "#node_modules" "#.git"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  OK: Markdown formateado correctamente." -ForegroundColor Green
} else {
    Write-Host "  ERROR: markdownlint-cli2 falló (código $LASTEXITCODE)." -ForegroundColor Red
    exit $LASTEXITCODE
}
