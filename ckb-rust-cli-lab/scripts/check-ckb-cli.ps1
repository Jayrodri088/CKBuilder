$ErrorActionPreference = "Stop"
$cli = Get-Command ckb-cli -ErrorAction SilentlyContinue
if (-not $cli) {
  Write-Host "WARN: ckb-cli not found on PATH." -ForegroundColor Yellow
  Write-Host "Install: git clone https://github.com/nervosnetwork/ckb-cli.git && cargo install --path . -f --locked"
  Write-Host "Docs: https://docs.nervos.org/docs/sdk-and-devtool/ckb-cli"
  exit 2
}
Write-Host "OK: ckb-cli at $($cli.Source)" -ForegroundColor Green
& ckb-cli --version
exit 0
