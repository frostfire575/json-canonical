# Local optional minimum-runtime verification. Downloads stay inside the project.
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$toolsRoot = Join-Path $taskRoot '.tools'
$archiveName = 'node-v22.13.0-win-x64.zip'
$archivePath = Join-Path $toolsRoot $archiveName
$executable = Join-Path $toolsRoot 'node-v22.13.0-win-x64/node.exe'
New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath $executable)) {
    $checksums = (Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.13.0/SHASUMS256.txt').Content
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.13.0/$archiveName" -OutFile $archivePath
    $expected = ($checksums -split "`n" | Where-Object { $_.Trim().EndsWith("  $archiveName") }).Split(' ')[0]
    $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    if ($expected -ne $actual) { throw 'Node22 archive checksum mismatch' }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsRoot -Force
}
& $executable --version
$testFiles = @(Get-ChildItem -LiteralPath (Join-Path $taskRoot 'tests') -File | Where-Object { $_.Name -match '\.test\.(cjs|mjs)$' } | ForEach-Object FullName)
& $executable --test @testFiles
if ($LASTEXITCODE -ne 0) { throw 'Minimum-runtime tests failed' }
