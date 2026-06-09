$ErrorActionPreference = "Stop"
$uri = if ($env:CKB_RPC_URL) { $env:CKB_RPC_URL } else { "http://127.0.0.1:28114" }
$body = '{"id":1,"jsonrpc":"2.0","method":"get_tip_block_number","params":[]}'
try {
  $r = Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json" -Body $body -TimeoutSec 8
  if ($null -ne $r.result) {
    Write-Host "OK: CKB RPC at $uri tip:" $r.result -ForegroundColor Green
    exit 0
  }
  exit 1
} catch {
  Write-Host "FAIL: cannot reach $uri" -ForegroundColor Red
  exit 1
}
