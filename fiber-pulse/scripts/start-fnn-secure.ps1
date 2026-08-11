param(
  [string]$CredentialPath = (Join-Path $PSScriptRoot "..\.secrets\fnn-password.clixml"),
  [string]$FnnPath = "D:\CKB\fiber-bin\fnn.exe",
  [string]$ConfigPath = "D:\CKB\fiber-node\config.yml",
  [string]$NodeDirectory = "D:\CKB\fiber-node"
)

$ErrorActionPreference = "Stop"
$resolvedCredential = [System.IO.Path]::GetFullPath($CredentialPath)

if (-not (Test-Path -LiteralPath $resolvedCredential)) {
  throw "Encrypted Fiber credential not found at $resolvedCredential"
}

$securePassword = Import-Clixml -LiteralPath $resolvedCredential
if ($securePassword -isnot [System.Security.SecureString]) {
  throw "Fiber credential file does not contain a Windows-protected SecureString"
}

$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $env:FIBER_SECRET_KEY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $process = Start-Process `
    -FilePath $FnnPath `
    -ArgumentList @("--config", $ConfigPath, "--dir", $NodeDirectory) `
    -WorkingDirectory $NodeDirectory `
    -RedirectStandardOutput (Join-Path $NodeDirectory "fnn-secure.out.log") `
    -RedirectStandardError (Join-Path $NodeDirectory "fnn-secure.err.log") `
    -WindowStyle Hidden `
    -PassThru
} finally {
  Remove-Item Env:FIBER_SECRET_KEY_PASSWORD -ErrorAction SilentlyContinue
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}

Start-Sleep -Seconds 3
if (-not (Get-Process -Id $process.Id -ErrorAction SilentlyContinue)) {
  throw "FNN exited during startup. Check D:\CKB\fiber-node\fnn-secure.err.log"
}

Write-Host "FNN started securely (PID $($process.Id))."
Write-Host "The password was decrypted only for the child process and removed from this shell."
