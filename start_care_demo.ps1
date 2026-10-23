param([int]$BackendPort = 8010, [int]$FrontendPort = 5175, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$careRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$carePython = Join-Path $careRoot 'backend\.venv\Scripts\python.exe'
$careVite = Join-Path $careRoot 'frontend\node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $carePython)) { throw 'Backend environment missing: backend\.venv. See README.md for setup.' }
if (-not (Test-Path -LiteralPath $careVite)) { throw 'Frontend dependencies missing. Run npm install in the frontend folder first.' }
$careNode = (Get-Command node.exe -ErrorAction Stop).Source
$careLogs = Join-Path $careRoot 'tmp\care-demo'
New-Item -ItemType Directory -Force -Path $careLogs | Out-Null
function Get-CareListener([int]$Port, [string]$ExpectedScript) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $listener) { return $false }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
    $command = [string]$process.CommandLine
    $matchesRoot = $command.IndexOf($careRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0
    # Older launchers passed Vite a relative script path. Match its served source
    # against this checkout before reusing that existing local preview.
    if (-not $matchesRoot -and $ExpectedScript -eq 'vite' -and $command -match 'vite') {
        try {
            $source = (Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/src/App.jsx" -TimeoutSec 3).Content
            $mapping = [regex]::Match($source, 'sourceMappingURL=data:application/json;base64,([A-Za-z0-9+/=]+)')
            if ($mapping.Success) {
                $map = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($mapping.Groups[1].Value)) | ConvertFrom-Json
                $localSource = [IO.File]::ReadAllText((Join-Path $careRoot 'frontend\src\App.jsx'))
                $matchesRoot = @($map.sourcesContent | Where-Object { $_ -ceq $localSource }).Count -gt 0
            }
        } catch { $matchesRoot = $false }
    }
    if (-not $matchesRoot -or $command.IndexOf($ExpectedScript, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
        throw "Port $Port is occupied by another application or checkout. Close that application or choose different ports. Nothing was stopped."
    }
    return $true
}
$backendRunning = Get-CareListener $BackendPort 'run_care_demo.py'
$frontendRunning = Get-CareListener $FrontendPort 'vite'
$careKeys = @('CARE_DEMO_PORT','CORS_ORIGINS','VITE_API_BASE_URL','VITE_PROXY_TARGET')
$carePrevious = @{}
foreach ($careKey in $careKeys) { $carePrevious[$careKey] = [Environment]::GetEnvironmentVariable($careKey, 'Process') }
try {
    $env:CARE_DEMO_PORT = "$BackendPort"
    $env:CORS_ORIGINS = "http://127.0.0.1:$FrontendPort,http://localhost:$FrontendPort"
    $env:VITE_API_BASE_URL = "http://127.0.0.1:$BackendPort/api"
    $env:VITE_PROXY_TARGET = "http://127.0.0.1:$BackendPort"
    if (-not $backendRunning) {
        Write-Host 'Starting AuraMed backend...'
        Start-Process -FilePath $carePython -ArgumentList 'run_care_demo.py' -WorkingDirectory (Join-Path $careRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $careLogs 'backend.log') -RedirectStandardError (Join-Path $careLogs 'backend-error.log')
    }
    if (-not $frontendRunning) {
        Write-Host 'Starting AuraMed dashboard...'
        Start-Process -FilePath $careNode -ArgumentList "`"$careVite`"", '--host', '127.0.0.1', '--port', "$FrontendPort", '--strictPort' -WorkingDirectory (Join-Path $careRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $careLogs 'frontend.log') -RedirectStandardError (Join-Path $careLogs 'frontend-error.log')
    }
} finally {
    foreach ($careKey in $careKeys) { [Environment]::SetEnvironmentVariable($careKey, $carePrevious[$careKey], 'Process') }
}
$careUrl = "http://127.0.0.1:$FrontendPort"
Write-Host 'Waiting for the dashboard and backend (up to 90 seconds)...'
$careDeadline = (Get-Date).AddSeconds(90)
$careReady = $false
while ((Get-Date) -lt $careDeadline) {
    try {
        $null = Invoke-WebRequest -UseBasicParsing -Uri "$careUrl/login" -TimeoutSec 2
        $null = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$BackendPort/openapi.json" -TimeoutSec 2
        $careReady = $true
        break
    } catch { Start-Sleep -Milliseconds 750 }
}
if (-not $careReady) { throw "Startup did not finish. Check logs in $careLogs. Run this launcher again after fixing the reported error." }
Write-Host "Ready: $careUrl/login" -ForegroundColor Green
Write-Host 'Doctor: care.demo@auramed.example / CareDemo@2026'
Write-Host 'Patient: care.patient1@example.invalid / PatientDemo@2026'
Write-Host 'Synthetic demonstration database. Message preview only; no external sends.'
if (-not $NoBrowser) { Start-Process "$careUrl/login" }
