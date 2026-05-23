$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "=== CKB Pay Link demo ===" -ForegroundColor Cyan

pnpm run sync:deployment
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm run preflight
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Manual steps:" -ForegroundColor Yellow
Write-Host "  1. pnpm run dev"
Write-Host "  2. Create tab -> Generate secret -> copy payer link"
Write-Host "  3. Fund the lock address (>= amount CKB) from devnet faucet"
Write-Host "  4. Claim tab -> same preimage -> receiver address -> Claim"
Write-Host ""
Write-Host "DONE: preflight passed; open UI to finish demo." -ForegroundColor Green
