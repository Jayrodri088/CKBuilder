param(
  [ValidateSet("release", "debug")]
  [string]$Mode = "release"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root
. "$root\scripts\env.ps1"

$buildDir = Join-Path $root "build\$Mode"
if (Test-Path $buildDir) {
  Remove-Item -Recurse -Force $buildDir
}
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

$env:RUSTFLAGS = '-C target-feature=+zba,+zbb,+zbc,+zbs,-a -C debug-assertions'

$releaseFlag = if ($Mode -eq "release") { "--release" } else { "" }
$contracts = @("hello-world", "simple-print-args")

foreach ($name in $contracts) {
  Write-Host "Building contract: $name"
  $cargoArgs = @("build", "-p", $name, "--target=riscv64imac-unknown-none-elf")
  if ($releaseFlag) { $cargoArgs += $releaseFlag }
  & cargo @cargoArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $src = Join-Path $root "target\riscv64imac-unknown-none-elf\$Mode\$name"
  if (-not (Test-Path $src)) {
    throw "Missing built binary: $src"
  }
  Copy-Item $src (Join-Path $buildDir $name)
  Copy-Item $src (Join-Path $buildDir "$name.debug")
}

Write-Host "Built contracts in $buildDir"
