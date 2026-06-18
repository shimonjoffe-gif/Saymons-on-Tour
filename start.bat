@echo off
echo Запуск backend...
start "Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 3 /nobreak >nul

echo Запуск frontend...
start "Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 3 /nobreak >nul

echo Запуск ngrok (публичный URL для телефона)...
start "ngrok" cmd /k "cd /d "%~dp0" && ngrok http 5173"

timeout /t 4 /nobreak >nul
start http://localhost:5173
