@echo off
title Morning News TTS PWA Launcher
echo ====================================================
echo   Morning News TTS PWA 로컬 서버를 실행합니다...
echo ====================================================
echo.

:: package.json이 있는 현재 디렉터리로 이동
cd /d "%~dp0"

:: node_modules 폴더가 없는 경우 자동으로 패키지 설치 진행
if not exist "node_modules\" (
    echo [안내] node_modules 폴더를 찾을 수 없어 의존성 패키지를 설치합니다...
    call npm install
)

:: Vite 개발 서버를 실행 (에러 발생 시 터미널이 닫히지 않고 대기하도록 /k 옵션 적용)
echo 서버를 시작하는 중입니다...
start "Morning News TTS Server" cmd /k "npm run dev"

:: 안전한 대기 처리 (ping을 활용한 3초 지연)
echo 서버 초기화를 대기 중입니다...
ping 127.0.0.1 -n 4 >nul

echo 브라우저에서 PWA 앱을 엽니다...
start http://localhost:5173/

echo.
echo ====================================================
echo   실행 시도가 완료되었습니다.
echo   - 브라우저가 열리지 않았다면 잠시 후 새로고침(F5)을 하십시오.
echo   - 에러가 발생했다면 새로 열린 터미널 창의 메시지를 확인해 주세요.
echo ====================================================
echo.
pause
