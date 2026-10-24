$ErrorActionPreference = "SilentlyContinue"
Set-Location -Path $PSScriptRoot
$backendOk = $false
try {
    $res = Invoke-RestMethod -Uri "http://localhost:8550/api/v1/health" -TimeoutSec 1
    if ($res.status -eq "ok") { $backendOk = $true }
} catch {}

if (-not $backendOk) {
    Write-Host "Starting CoolSolve backend..." -ForegroundColor Cyan
    $bin = @(
        "$PSScriptRoot\build\Release\coolsolve.exe",
        "C:\Program Files\CoolSolve-Canary\coolsolve.exe",
        "C:\Program Files\CoolSolve\coolsolve.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($bin) {
        Start-Process -FilePath $bin -ArgumentList "--gui", "8550", "--no-browser" -WindowStyle Hidden
        Start-Sleep -Milliseconds 1200
    } else {
        Write-Warning "coolsolve.exe not found on disk."
    }
} else {
    Write-Host "CoolSolve backend active on port 8550." -ForegroundColor Green
}
Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
$env:CI = "true"
Start-Process -FilePath "node" -ArgumentList "node_modules\vite\bin\vite.js", "--host", "127.0.0.1", "--port", "5173", "--strictPort" -WorkingDirectory "$PSScriptRoot\gui" -RedirectStandardOutput "$env:TEMP\coolsolve_vite.log" -RedirectStandardError "$env:TEMP\coolsolve_vite_err.log" -WindowStyle Hidden
for ($i = 0; $i -lt 20; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:5173" -UseBasicParsing -TimeoutSec 1
        if ($resp.StatusCode -eq 200) { break }
    } catch {}
    Start-Sleep -Milliseconds 250
}
$edge = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

$profile = Join-Path $env:TEMP "coolsolve_desktop_profile"

if ($edge) {
    Write-Host "Opening standalone window via $edge..." -ForegroundColor Cyan
    Start-Process -FilePath $edge -ArgumentList "--app=http://127.0.0.1:5173", "--window-size=1400,880", "--user-data-dir=`"$profile`"", "--no-first-run", "--no-default-browser-check"
} else {
    Start-Process "http://127.0.0.1:5173"
}
