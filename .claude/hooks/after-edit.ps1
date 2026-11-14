# Hook after-edit de Claude Code para Windows (generado por ai-kit).
# Comprueba el fichero recién editado con `make check-file` (o `make.ps1 check-file`).
# Si falla, sale con código 2 y el error llega a Claude para que lo corrija.
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$input = [Console]::In.ReadToEnd()
$python = $null   # el primer intérprete que EJECUTA (el alias de la Microsoft Store sale con 49)
foreach ($c in @('python', 'py -3', 'python3')) {
    $parts = @($c -split ' '); $exe = $parts[0]; $pre = @($parts | Select-Object -Skip 1)
    if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { continue }
    & $exe @pre -c 'pass' *> $null
    if ($LASTEXITCODE -eq 0) { $python = $exe; $pyPre = $pre; break }
}
if (-not $python) { exit 0 }
# Extraer file_path del JSON de entrada
try {
    $data = $input | ConvertFrom-Json
    $file = $data.tool_input.file_path
} catch {
    exit 0
}
if (-not $file) { exit 0 }
# Calcular ruta relativa (sin distinguir mayúsculas de la letra de unidad ni el tipo de barra)
$rootStr = ([string]$root).TrimEnd('\', '/')
$fileN = $file -replace '\\', '/'
$rootN = $rootStr -replace '\\', '/'
if ($fileN.StartsWith("$rootN/", [System.StringComparison]::OrdinalIgnoreCase)) {
    $rel = $fileN.Substring($rootN.Length + 1)
} else {
    $rel = $file
}
# Ejecutar make check-file (si make existe) o make.ps1 check-file (Windows nativo)
$make = Get-Command make -ErrorAction SilentlyContinue
if ($make) {
    $out = & make -s -C $root check-file "FILE=$rel" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Output "make check-file falló para ${rel}:`n$out"
        exit 2
    }
} else {
    $makePs1 = Join-Path $root "Makefile.ps1"
    $kitCheck = Join-Path $root "scripts/check_file.py"
    $out = $null
    if ((Test-Path $kitCheck) -and -not (Test-Path (Join-Path $root ".kit/scripts"))) {
        # Repo del kit sin make
        $out = & $python @pyPre $kitCheck $rel 2>&1
    } elseif (Test-Path $makePs1) {
        # Windows nativo: Makefile.ps1
        $out = & $makePs1 check-file -FILE $rel 2>&1
    } else {
        [Console]::Error.WriteLine("AVISO: no hay make, scripts/check_file.py ni Makefile.ps1: no se comprueba $rel.")
        exit 0
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Output "check-file falló para ${rel}:`n$out"
        exit 2
    }
}
exit 0
