@echo off
echo ===================================
echo  NexusAI - Setup Script
echo ===================================
echo.

echo [1/4] Installing server dependencies...
cd /d "%~dp0server"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Server npm install failed!
    pause
    exit /b 1
)
echo Server dependencies installed successfully.
echo.

echo [2/4] Installing client dependencies...
cd /d "%~dp0client"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Client npm install failed!
    pause
    exit /b 1
)
echo Client dependencies installed successfully.
echo.

echo ===================================
echo  Setup Complete!
echo ===================================
echo.
echo To start the application:
echo   1. Open Terminal #1: cd server ^&^& npm start
echo   2. Open Terminal #2: cd client ^&^& npm run dev
echo.
echo Then open http://localhost:5173 in your browser.
echo.
pause
