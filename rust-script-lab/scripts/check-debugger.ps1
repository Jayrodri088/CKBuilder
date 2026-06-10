$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$debugger = Join-Path $root "..\simple-lock\tools\ckb-debugger\v1.1.1\ckb-debugger.exe"

if (-not (Test-Path $debugger)) {
  Write-Error "ckb-debugger not found at $debugger (install via simple-lock/tools or set CKB_DEBUGGER_BIN)"
  exit 1
}

Write-Host "OK: ckb-debugger at $debugger"
exit 0
