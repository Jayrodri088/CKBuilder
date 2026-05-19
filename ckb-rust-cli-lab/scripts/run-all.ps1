$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "=== CKB Rust SDK + ckb-cli lab ===" -ForegroundColor Cyan

& "$PSScriptRoot\check-rpc.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-Path "node_modules")) {
  Write-Host "`n--- pnpm install ---"
  pnpm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "`n--- capabilities (docs map) ---"
pnpm run capabilities
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n--- RPC: tip (Node / CCC parity with Rust CkbRpcClient) ---"
pnpm run tip
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n--- RPC: block 0 ---"
pnpm run block
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n--- gen-address (testnet) ---"
pnpm run gen-address
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n--- parse-address (tutorial sample) ---"
pnpm run parse-address -- ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqf7v2xsyj0p8szesqrwqapvvygpc8hzg9sku954v
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n--- compare Node RPC vs ckb-cli ---"
pnpm run compare:rpc
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n--- optional: Rust SDK (cargo in rust/) ---"
$mingwBin = "C:\msys64\mingw64\bin"
if (Test-Path $mingwBin) {
  $env:Path = "$mingwBin;" + $env:Path
}
$cargo = Get-Command cargo -ErrorAction SilentlyContinue
if ($cargo) {
  cargo run --manifest-path rust/Cargo.toml --quiet -- tip 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "OK: Rust ckb-sdk track built and connected." -ForegroundColor Green
  } else {
    Write-Host "SKIP: Rust build failed (Windows: use MSVC + clang, or WSL). Run: pnpm run rust:build" -ForegroundColor Yellow
  }
} else {
  Write-Host "SKIP: cargo not on PATH" -ForegroundColor Yellow
}

& "$PSScriptRoot\check-ckb-cli.ps1"
$cliCode = $LASTEXITCODE
if ($cliCode -eq 0) {
  & "$PSScriptRoot\demo-ckb-cli-rpc.ps1"
} else {
  Write-Host "`nSKIP: ckb-cli demos (install per docs.nervos.org/sdk-and-devtool/ckb-cli)" -ForegroundColor Yellow
}

Write-Host "`nDONE: primary Node track complete." -ForegroundColor Green
