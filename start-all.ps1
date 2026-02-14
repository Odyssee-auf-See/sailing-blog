# Start both AIS Proxy Server and Web Server (PowerShell version)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Sailing Blog - Startup Script (PowerShell)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This will start:"
Write-Host "  1. AIS Proxy Server (port 3001)"
Write-Host "  2. Web Server (port 8000)"
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js not found" -ForegroundColor Red
    Write-Host "Install from: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Python is installed
try {
    $pythonVersion = python --version
    Write-Host "✓ Python $pythonVersion found" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python not found" -ForegroundColor Red
    Write-Host "Install from: https://www.python.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Starting AIS Proxy Server in new terminal..." -ForegroundColor Yellow
Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\server'; .\start-proxy.ps1"

Write-Host "Waiting 2 seconds for proxy to start..." -ForegroundColor Gray
Start-Sleep -Seconds 2

Write-Host "Starting Web Server in new terminal..." -ForegroundColor Yellow
Start-Process PowerShell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; python -m http.server 8000"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Servers starting in separate terminal windows" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Open your browser to: http://localhost:8000" -ForegroundColor Green
Write-Host "🔌 Proxy server: ws://localhost:3001" -ForegroundColor Green
Write-Host ""
Write-Host "Close the terminal windows to stop the servers" -ForegroundColor Gray
Write-Host ""
