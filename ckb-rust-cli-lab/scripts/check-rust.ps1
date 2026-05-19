$ErrorActionPreference = "Stop"

$mingwGcc = "C:\msys64\mingw64\bin\gcc.exe"
if (-not (Test-Path $mingwGcc)) {
  Write-Host "FAIL: $mingwGcc not found (ckb-vm needs mingw gcc on Windows)." -ForegroundColor Red
  Write-Host "Install: winget install -e --id MSYS2.MSYS2" -ForegroundColor Yellow
  Write-Host "Then in MSYS2: pacman -S --noconfirm mingw-w64-x86_64-gcc" -ForegroundColor Yellow
  exit 1
}

$tc = rustup show active-toolchain 2>&1
if ($tc -notmatch "msvc") {
  Write-Host "WARN: default toolchain is not MSVC. Run: rustup default stable-x86_64-pc-windows-msvc" -ForegroundColor Yellow
}

Write-Host "OK: gcc at $mingwGcc" -ForegroundColor Green
Write-Host "OK: rust toolchain: $tc" -ForegroundColor Green
Write-Host "Add to user PATH (once): C:\msys64\mingw64\bin"
exit 0
