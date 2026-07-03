@echo off
echo Starting NexusAI...
echo.

echo [1/2] Starting Express server on port 3001...
start "NexusAI Server" cmd /k "cd /d "%~dp0server" && npm start"

timeout /t 3 /nobreak > nul

echo [2/2] Starting Vite dev server on port 5173...
start "NexusAI Client" cmd /k "cd /d "%~dp0client" && npm run dev"

echo.
echo Both servers are starting. Open http://localhost:5173
echo.
