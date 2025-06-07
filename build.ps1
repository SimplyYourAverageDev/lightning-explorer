# —— Mini‐profile release build ——
Write-Host "🚀 Building Lightning Explorer with optimizations using Wails..." -ForegroundColor Green
$env:GOOS = "windows"
$env:GOARCH = "amd64"
$env:CGO_ENABLED = "0"
wails build `
  -tags prod `
  -ldflags="-s -w -buildid=" `
  -trimpath `
  -o lightning_explorer.exe 