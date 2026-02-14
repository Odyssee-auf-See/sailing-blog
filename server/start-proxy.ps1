# Start AIS Proxy Server (PowerShell version)
# This script starts the Node.js proxy server that relays aisstream.io data to your frontend

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Starting AIS Proxy Server..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from: https://nodejs.org/" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm dependencies are installed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm dependencies (this may take a moment)..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

Write-Host ""
Write-Host "Proxy server starting on ws://localhost:3001" -ForegroundColor Green
Write-Host ""
Write-Host "Frontend will connect to: ws://localhost:3001"
Write-Host "Health check: http://localhost:3001/health"
Write-Host ""
Write-Host "Press Ctrl+C to stop the server"
Write-Host ""

node ais-proxy.js
