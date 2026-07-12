@echo off
title Morning News TTS PWA Launcher
echo ====================================================
echo   Morning News TTS PWA 로컬 서버를 실행합니다...
echo ====================================================
echo.

:: package.json이 있는 현재 디렉터리로 이동
cd /d "%~dp0"

:: Vite 개발 서버를 백그라운드 창에서 실행
start "Morning News TTS Server" cmd /c "npm run dev"

echo 서버 초기화를 대기 중입니다 (3초)...
timeout /t 3 /nobreak >nul

echo 브라우저에서 PWA 앱을 엽니다...
start http://localhost:5173/

echo.
echo ====================================================
echo   실행이 완료되었습니다.
echo   서버 터미널 창을 유지해야 앱이 정상 작동합니다.
echo ====================================================
echo.
pause
