@echo off
REM Start both AIS Proxy Server and Web Server
REM This opens two terminal windows to run the proxy and web server simultaneously

echo.
echo ============================================================
echo Sailing Blog - Startup Script
echo ============================================================
echo.
echo This will start:
echo   1. AIS Proxy Server (port 3001)
echo   2. Web Server (port 8000)
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

REM Check Python for web server
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python from: https://www.python.org/
    echo.
    pause
    exit /b 1
)

REM Start AIS Proxy Server in a new window
echo Starting AIS Proxy Server in a new window...
start "AIS Proxy Server" cmd /k "cd server && call start-proxy.bat"

REM Wait a moment for the proxy to start
timeout /t 2 /nobreak

REM Start Web Server in a new window
echo Starting Web Server in a new window...
start "Web Server - Sailing Blog" cmd /k "python -m http.server 8000"

echo.
echo ============================================================
echo Both servers are starting in separate terminal windows
echo ============================================================
echo.
echo Web Server: http://localhost:8000
echo AIS Proxy: ws://localhost:3001
echo.
echo To stop the servers, close the terminal windows or press Ctrl+C
echo.
pause
