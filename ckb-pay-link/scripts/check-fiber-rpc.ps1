$ErrorActionPreference = "Stop"
$url = if ($env:FIBER_RPC_URL) { $env:FIBER_RPC_URL } else { "http://127.0.0.1:8227" }

$body = '{"id":1,"jsonrpc":"2.0","method":"node_info","params":[]}'
try {
  $res = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body -TimeoutSec 8
  if ($res.error) {
    Write-Host "FAIL: $($res.error.message)" -ForegroundColor Red
    exit 1
  }
  Write-Host "OK: Fiber RPC at $url" -ForegroundColor Green
  if ($res.result.pubkey) {
    $pk = $res.result.pubkey
    $short = if ($pk.Length -gt 24) { $pk.Substring(0, 24) + "..." } else { $pk }
    Write-Host "     pubkey: $short" -ForegroundColor Gray
  }
  exit 0
} catch {
  Write-Host "FAIL: Cannot reach Fiber RPC at $url" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Yellow
  Write-Host "Hint: start a Fiber node (JSON-RPC, default port 8227)" -ForegroundColor Yellow
  exit 1
}
