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

Write-Host "[*] Starting Backend on http://localhost:8000 (Swagger: http://localhost:8000/docs)" -ForegroundColor Green
$BackendProc = Start-Process -FilePath $VenvPython -ArgumentList "-m uvicorn backend.app.main:app --port 8000 --reload" -WorkingDirectory $Root -PassThru

Start-Sleep -Seconds 2

Write-Host "[*] Starting Frontend on http://localhost:3000" -ForegroundColor Green
Set-Location "$Root\frontend"

try {
    npm run dev
} finally {
    Write-Host "`n[*] Stopping backend..." -ForegroundColor Yellow
    if ($BackendProc -and -not $BackendProc.HasExited) {
        Stop-Process -Id $BackendProc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[+] FLOWGUARD stopped cleanly." -ForegroundColor Cyan
}
