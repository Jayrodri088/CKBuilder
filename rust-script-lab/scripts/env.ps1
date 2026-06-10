# MSYS2 mingw64 gcc is required by ckb-vm (ckb-testtool) on Windows.
$mingwBin = "C:\msys64\mingw64\bin"
if (Test-Path $mingwBin) {
  $sep = [IO.Path]::PathSeparator
  if (-not $env:PATH.Split($sep).Contains($mingwBin)) {
    $env:PATH = "$mingwBin$sep$env:PATH"
  }
}
