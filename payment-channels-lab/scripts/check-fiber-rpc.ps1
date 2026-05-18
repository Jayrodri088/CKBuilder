$ErrorActionPreference = "Stop"
$url = if ($env:FIBER_RPC_URL) { $env:FIBER_RPC_URL } else { "http://127.0.0.1:8227" }

$body = '{"id":1,"jsonrpc":"2.0","method":"node_info","params":[]}'
try {
  $res = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body -TimeoutSec 5
  if ($res.error) {
    Write-Host "FAIL: $($res.error.message)" -ForegroundColor Red
    exit 1
  }
  Write-Host "OK: Fiber RPC at $url" -ForegroundColor Green
  if ($res.result.pubkey) {
    Write-Host "     pubkey: $($res.result.pubkey.Substring(0, [Math]::Min(24, $res.result.pubkey.Length)))..." -ForegroundColor Gray
  }
} catch {
  Write-Host "FAIL: Cannot reach Fiber RPC at $url" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Yellow
  exit 1
}
