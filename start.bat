@echo off
title Morning News TTS PWA Launcher

:: Move to the directory where this batch file is located
cd /d "%~dp0"

:: Auto install packages if node_modules is missing
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Running npm install...
    call npm install
)

:: Start Vite Development Server in a separate window
echo [INFO] Starting Vite local server...
start "Morning News TTS Server" cmd /c "npm run dev"

:: Safe waiting (3 seconds delay)
echo [INFO] Waiting for server initialization...
ping 127.0.0.1 -n 4 >nul

:: Open web browser
echo [INFO] Launching PWA in browser...
start http://localhost:5173/

echo.
echo ====================================================
echo   Startup completed. Keep the server terminal open!
echo ====================================================
echo.
pause
