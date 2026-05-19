param(
  [Parameter(Position = 0)]
  [string]$Command = "tip",
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Rest
)
$root = $PSScriptRoot
Set-Location $root

if ($Command -eq "rust") {
  $rustArgs = @("run", "--manifest-path", "rust/Cargo.toml", "--") + $Rest
  & cargo @rustArgs
  exit $LASTEXITCODE
}

& pnpm run $Command @Rest
exit $LASTEXITCODE
