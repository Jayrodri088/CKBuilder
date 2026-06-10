$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
. "$root\scripts\env.ps1"

Write-Host "`n--- check:debugger ---`n"
& "$root\scripts\check-debugger.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$debugger = Join-Path $root "..\simple-lock\tools\ckb-debugger\v1.1.1\ckb-debugger.exe"
$helloBin = Join-Path $root "build\release\hello-world"

Write-Host "`n--- build contracts ---`n"
& "$root\scripts\build.ps1" -Mode release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n--- hello-world via ckb-debugger ---`n"
& $debugger --bin $helloBin
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n--- cargo test (hello-world + simple-print-args) ---`n"
Remove-Item Env:RUSTFLAGS -ErrorAction SilentlyContinue
& cargo test --package tests -- --nocapture
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nALL PASS: rust-script-lab (Rust Quick Start) complete."
