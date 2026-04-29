# Verifies OffCKB devnet proxy RPC (same URL as docs: http://127.0.0.1:28114)
$uri = "http://127.0.0.1:28114"
$body = '{"id":1,"jsonrpc":"2.0","method":"get_tip_block_number","params":[]}'
try {
  $r = Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json" -Body $body -TimeoutSec 5
  if ($null -ne $r.result) {
    Write-Host "OK: CKB devnet RPC at $uri - tip block number:" $r.result
    exit 0
  }
  Write-Host "Unexpected response:" ($r | ConvertTo-Json -Compress)
  exit 1
} catch {
  Write-Host ('FAIL: Could not reach ' + $uri + '. Run: offckb node')
  Write-Host $_.Exception.Message
  exit 1
}
