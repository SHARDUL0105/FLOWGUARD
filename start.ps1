# FLOWGUARD Windows Startup Script
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  FLOWGUARD: Predictive Reliability Platform" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan

$Root = $PSScriptRoot
Set-Location $Root

# Virtual environment discovery
$VenvPython = ""
if (Test-Path "$Root\.venv\Scripts\python.exe") {
    $VenvPython = "$Root\.venv\Scripts\python.exe"
} elseif (Test-Path "$Root\backend\.venv\Scripts\python.exe") {
    $VenvPython = "$Root\backend\.venv\Scripts\python.exe"
} else {
    $VenvPython = "python"
}

$env:PYTHONPATH = $Root

# Check fixtures
if (-not (Test-Path "$Root\fixtures\topology.json")) {
    Write-Host "[*] Pre-generating simulation fixtures..." -ForegroundColor Yellow
    & $VenvPython "$Root\scripts\record_fixtures.py"
}

# Global process IDs for cleanup
$global:BackendProc = $null
$global:Frontend3000Proc = $null
$global:Frontend4000Proc = $null
$global:DockerComposeProc = $null

# Cleanup function
function Cleanup {
    Write-Host "`n[*] Stopping all services..." -ForegroundColor Yellow
    $procs = @($global:BackendProc, $global:Frontend3000Proc, $global:Frontend4000Proc, $global:DockerComposeProc)
    foreach ($proc in $procs) {
        if ($proc -and -not $proc.HasExited) {
            try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch {}
        }
    }
    # Stop docker containers
    docker-compose -f "$Root\docker-compose.audit.yml" down -ErrorAction SilentlyContinue
    Write-Host "[+] FLOWGUARD stopped cleanly." -ForegroundColor Cyan
}

# Handle Ctrl+C
try {
    [System.Console]::CancelKeyPress += {
        Cleanup
        exit 0
    }
} catch {
    # Ignore if not supported in this host
}

# 1. Start Backend on port 8000
Write-Host "[*] Starting Backend on http://localhost:8000 (Swagger: http://localhost:8000/docs)" -ForegroundColor Green
$global:BackendProc = Start-Process -FilePath $VenvPython -ArgumentList "-m uvicorn backend.app.main:app --port 8000 --reload" -WorkingDirectory $Root -PassThru

Start-Sleep -Seconds 2

# 2. Start Frontend on port 3000 (App)
Write-Host "[*] Starting Frontend on http://localhost:3000" -ForegroundColor Green
$global:Frontend3000Proc = Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev" -WorkingDirectory "$Root\frontend" -PassThru

Start-Sleep -Seconds 3

# 3. Start Frontend on port 4000 (Admin) - uses dedicated dev:admin script
Write-Host "[*] Starting Frontend (Admin) on http://localhost:4000" -ForegroundColor Green
$global:Frontend4000Proc = Start-Process -FilePath "cmd" -ArgumentList "/c npm run dev:admin" -WorkingDirectory "$Root\frontend" -PassThru

Start-Sleep -Seconds 2

# 4. Start Docker Compose for Audit Log (Redis + Audit-Log + API + Frontend)
Write-Host "[*] Starting Docker Audit Stack (Redis, Audit-Log, API, Frontend)..." -ForegroundColor Green
$global:DockerComposeProc = Start-Process -FilePath "docker-compose" -ArgumentList "-f docker-compose.audit.yml up --build" -WorkingDirectory $Root -PassThru

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "  FLOWGUARD RUNNING" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Backend API:      http://localhost:8000" -ForegroundColor White
Write-Host "  Swagger Docs:     http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Frontend (App):   http://localhost:3000" -ForegroundColor White
Write-Host "  Frontend (Admin): http://localhost:4000" -ForegroundColor White
Write-Host "  Audit Log:        http://localhost:8080" -ForegroundColor White
Write-Host "  Redis:            localhost:6379" -ForegroundColor White
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor Yellow

# Wait loop
try {
    while ($true) {
        Start-Sleep -Seconds 5
        # Check if backend died
        if ($global:BackendProc -and $global:BackendProc.HasExited) {
            throw "Backend process exited unexpectedly"
        }
    }
} catch {
    Cleanup
    exit 1
}