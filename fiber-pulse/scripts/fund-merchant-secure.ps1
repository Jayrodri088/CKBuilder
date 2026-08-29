param(
  [Parameter(Mandatory = $true)]
  [string]$Address,
  [ValidateRange(0.00000001, 300)]
  [decimal]$Amount = 200,
  [switch]$Broadcast,
  [string]$CredentialPath,
  [string]$KeyPath = "D:\CKB\fiber-node\ckb\key",
  [string]$RpcUrl = "https://testnet.ckb.dev/"
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($CredentialPath)) {
  $CredentialPath = Join-Path $PSScriptRoot "..\.secrets\fnn-password.clixml"
}
$resolvedCredential = [System.IO.Path]::GetFullPath($CredentialPath)

if (-not (Test-Path -LiteralPath $resolvedCredential)) {
  throw "Encrypted Fiber credential not found at $resolvedCredential"
}
if (-not (Test-Path -LiteralPath $KeyPath)) {
  throw "Encrypted Fiber key not found at $KeyPath"
}

$securePassword = Import-Clixml -LiteralPath $resolvedCredential
if ($securePassword -isnot [System.Security.SecureString]) {
  throw "Fiber credential file does not contain a Windows-protected SecureString"
}

$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:FIBER_SECRET_KEY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $arguments = @(
    (Join-Path $PSScriptRoot "fund-fiber-merchant.mjs"),
    "--to", $Address,
    "--amount", $Amount.ToString([Globalization.CultureInfo]::InvariantCulture),
    "--key", $KeyPath,
    "--rpc", $RpcUrl
  )
  if ($Broadcast) {
    $arguments += "--broadcast"
  }

  & node @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Merchant funding command failed with exit code $LASTEXITCODE"
  }
} finally {
  Remove-Item Env:FIBER_SECRET_KEY_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
