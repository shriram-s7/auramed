@echo off
setlocal
title AuraMed - Start Project
cd /d "%~dp0"
echo Starting AuraMed from %~dp0
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_care_demo.ps1" %*
if errorlevel 1 (
  echo.
  echo AuraMed could not start. See the error above.
  echo Logs: %~dp0tmp\care-demo
  pause
  exit /b 1
)
echo.
echo The project is running. You can close this window.
pause
