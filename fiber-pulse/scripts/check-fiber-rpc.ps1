$ErrorActionPreference = "Stop"
$url = if ($env:FIBER_RPC_URL) { $env:FIBER_RPC_URL } else { "http://127.0.0.1:8227" }

$body = @{
  jsonrpc = "2.0"
  id      = 1
  method  = "node_info"
  params  = @()
} | ConvertTo-Json -Compress

try {
  $res = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body -TimeoutSec 3
  if ($res.error) {
    Write-Host "Fiber RPC responded with error at $url"
    exit 1
  }
  Write-Host "OK: Fiber RPC reachable at $url"
  exit 0
} catch {
  Write-Host "SKIP/FAIL: Fiber RPC not reachable at $url (optional for Pulse mock mode)"
  exit 1
}
