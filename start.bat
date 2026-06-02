@echo off
REM Script to start Projet-Timeo with automatic browser opening
REM Usage: start.bat

setlocal enabledelayedexpansion

echo.
echo ===============================================
echo   Projet-Timeo Launcher
echo ===============================================
echo.

echo [1/3] Starting Docker Compose services...
docker compose up -d
if errorlevel 1 (
    echo Error: Failed to start Docker Compose
    pause
    exit /b 1
)

echo.
echo [2/3] Waiting for frontend to be ready (max 60 seconds)...

setlocal enabledelayedexpansion
set "attempt=0"
:wait_loop
set /a attempt=!attempt!+1

REM Try to reach the frontend
for /f %%A in ('curl -k -s -o /dev/null -w "%%{http_code}" https://localhost:5173 2^>nul') do (
    if "%%A"=="200" goto frontend_ready
)

if !attempt! geq 60 (
    echo Error: Frontend failed to start within timeout
    docker compose logs frontend --tail 20
    pause
    exit /b 1
)

timeout /t 1 /nobreak >nul
cls
echo [2/3] Waiting for frontend to be ready (max 60 seconds)
echo Attempt: !attempt!/60
goto wait_loop

:frontend_ready
echo.
echo Frontend is ready!
echo.
echo [3/3] Opening browser...
start https://localhost:5173

echo.
echo ===============================================
echo   Services Started Successfully!
echo ===============================================
echo.
echo Dashboard:  https://localhost:5173
echo API HTTPS:  https://localhost:3002
echo API HTTP:   http://localhost:3000
echo Database:   localhost:5432
echo.
echo To stop services, run: docker compose down
echo.
pause
