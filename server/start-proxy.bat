@echo off
REM Start AIS Proxy Server
REM This script starts the Node.js proxy server that relays aisstream.io data to your frontend

echo.
echo ============================================================
echo Starting AIS Proxy Server...
echo ============================================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check if npm dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies (this may take a moment)...
    call npm install
    if errorlevel 1 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Start the proxy server
echo Proxy server starting on ws://localhost:3001
echo.
echo Frontend will connect to: ws://localhost:3001
echo Health check: http://localhost:3001/health
echo.
echo Press Ctrl+C to stop the server
echo.

node ais-proxy.js
