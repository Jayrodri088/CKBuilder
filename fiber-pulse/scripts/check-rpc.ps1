$ErrorActionPreference = "Stop"
$uri = if ($env:CKB_RPC_URL) { $env:CKB_RPC_URL } else { "http://127.0.0.1:28114" }
$body = '{"id":1,"jsonrpc":"2.0","method":"get_tip_header","params":[]}'
try {
  $res = Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json" -Body $body -TimeoutSec 5
  Write-Host "OK: CKB RPC at $uri tip: $($res.result.number)"
  exit 0
} catch {
  Write-Host "FAIL: Could not reach $uri. Run: offckb node"
  exit 1
}
