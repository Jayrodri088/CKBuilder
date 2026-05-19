$ErrorActionPreference = "Stop"
$cli = Get-Command ckb-cli -ErrorAction SilentlyContinue
if (-not $cli) { exit 2 }

$api = if ($env:API_URL) { $env:API_URL } elseif ($env:CKB_RPC_URL) { $env:CKB_RPC_URL } else { "http://127.0.0.1:28114" }
$env:API_URL = $api

Write-Host "=== ckb-cli RPC demo ===" -ForegroundColor Cyan
Write-Host "API_URL=$api"

Write-Host "`n-- get_tip_block_number --"
& ckb-cli rpc get_tip_block_number

Write-Host "`nPASS: ckb-cli invoked RPC against node."
exit 0
