# AuraMed One-Click PowerShell Launcher
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "                   STARTING AURAMED PLATFORM                    " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $rootDir

Write-Host "[1/4] Checking and clearing ports 8000 and 5173..." -ForegroundColor Yellow
$p8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($p8000) { Stop-Process -Id $p8000 -Force -ErrorAction SilentlyContinue }

$p5173 = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($p5173) { Stop-Process -Id $p5173 -Force -ErrorAction SilentlyContinue }

Write-Host "[2/4] Launching AuraMed Backend (FastAPI)..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$rootDir\backend`" && title AuraMed Backend (FastAPI) && color 0A && .venv\Scripts\python.exe tests\run_sqlite_server.py"

Write-Host "[3/4] Waiting 3 seconds for backend initialization..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "[4/4] Launching AuraMed Frontend (Vite)..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k", "cd /d `"$rootDir\frontend`" && title AuraMed Frontend (React) && color 0E && npm run dev"

Write-Host ""
Write-Host "Opening browser to http://localhost:5173..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "   AuraMed is now running!" -ForegroundColor Green
Write-Host "   - Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   - Backend:  http://127.0.0.1:8000" -ForegroundColor White
Write-Host "   - API Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Read-Host -Prompt "Press Enter to exit this launcher window"
