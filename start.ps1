Write-Host "Запуск Saymons on Tour..." -ForegroundColor Cyan

# Backend
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd 'C:\YandexDisk\Обучение\Вайб_кодинг\Saymons on Tour\backend'; Write-Host 'BACKEND' -ForegroundColor Green; npm run dev"
) -WindowStyle Normal

Start-Sleep 2

# Frontend
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd 'C:\YandexDisk\Обучение\Вайб_кодинг\Saymons on Tour\frontend'; Write-Host 'FRONTEND' -ForegroundColor Blue; npm run dev"
) -WindowStyle Normal

Start-Sleep 4
Start-Process "http://localhost:5173"
