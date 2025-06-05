# Simple optimized build using wails build  
Write-Host "🚀 Building Lightning Explorer with optimizations using Wails..." -ForegroundColor Green
wails build -ldflags="-s -w" -trimpath 