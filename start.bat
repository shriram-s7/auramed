@echo off
title AuraMed Launcher
color 0B
cls

echo ================================================================
echo                    STARTING AURAMED PLATFORM
echo ================================================================
echo.

cd /d "%~dp0"

echo [1/4] Checking and clearing ports 8000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo [2/4] Launching AuraMed Backend (FastAPI and ML Models)...
start "AuraMed Backend" cmd /k "cd /d "%~dp0backend" && title AuraMed Backend (FastAPI) && color 0A && .venv\Scripts\python.exe tests\run_sqlite_server.py"

echo [3/4] Waiting 3 seconds for backend initialization...
ping -n 4 127.0.0.1 >nul

echo [4/4] Launching AuraMed Frontend (Vite and React)...
start "AuraMed Frontend" cmd /k "cd /d "%~dp0frontend" && title AuraMed Frontend (React) && color 0E && npm run dev"

echo.
echo Opening browser to http://localhost:5173...
ping -n 3 127.0.0.1 >nul
start http://localhost:5173

echo.
echo ================================================================
echo    AuraMed is now running!
echo    - Frontend: http://localhost:5173
echo    - Backend:  http://127.0.0.1:8000
echo    - API Docs: http://127.0.0.1:8000/docs
echo ================================================================
echo.
echo You can close this window at any time. 
echo To stop AuraMed, close the Backend and Frontend command windows.
echo.
pause
