# RaipurOne - start everything.
#
#   .\start.ps1          backend + dashboard + Telegram bot
#   .\start.ps1 -Stop    stop all three
#   .\start.ps1 -Phone   also arm the USB tunnel for the worker APK
#
# Each service opens in its own PowerShell window so its logs stay readable and closing
# one does not take the others down. Ports are freed first: a half-dead uvicorn holding
# 8000 is the usual reason a "restart" silently keeps serving the old code.

param(
    [switch]$Stop,
    [switch]$Phone
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

function Stop-Port($port, $label) {
    $owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($owner in $owners) {
        try { Stop-Process -Id $owner.OwningProcess -Force -ErrorAction Stop } catch {}
        Write-Host "  stopped $label (port $port)" -ForegroundColor DarkGray
    }
}

function Stop-All {
    Write-Host "Stopping RaipurOne..." -ForegroundColor Yellow
    Stop-Port 8000 'backend'
    Stop-Port 3000 'dashboard'

    # The bot holds no port; it is identified by its module name on the command line.
    Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
        Where-Object { $_.CommandLine -match 'app\.telegram_bot' } |
        ForEach-Object {
            try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {}
            Write-Host "  stopped telegram bot" -ForegroundColor DarkGray
        }

    # Left behind by a killed bot, and it refuses to start again while it is there.
    Remove-Item "$Root\backend\.telegram-bot.lock" -Force -ErrorAction SilentlyContinue
    Write-Host "All stopped." -ForegroundColor Green
}

if ($Stop) { Stop-All; return }

Stop-All
Start-Sleep -Seconds 1

Write-Host "`nStarting RaipurOne..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$Root\backend'; Write-Host 'BACKEND API - http://localhost:8000' -ForegroundColor Cyan; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
)

Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$Root\dashboard-frontend'; Write-Host 'DASHBOARD - http://localhost:3000' -ForegroundColor Cyan; npm start"
)

# The bot must come up after the API: it verifies the Supabase schema on startup and
# exits if that check fails, and giving the API a head start keeps the logs readable.
Start-Sleep -Seconds 6

# AI_SERVICE_URL is set here, in the bot's window only, and deliberately not in .env.
# The bot and the API both classify; each loading its own copy puts two ~1.1 GB models
# in memory, which exhausts this 6 GB machine's commit limit and makes *both* silently
# fall back to rule-based. Pointed at the API, the bot keeps one copy in the system.
# It must stay blank for the API process, or the API becomes a remote client of itself.
Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$Root\backend'; `$env:AI_SERVICE_URL = 'http://localhost:8000'; Write-Host 'TELEGRAM BOT - @RaipurOneV2Bot' -ForegroundColor Cyan; python -m app.telegram_bot"
)

if ($Phone) {
    if (Test-Path $Adb) {
        & $Adb reverse tcp:8000 tcp:8000 | Out-Null
        Write-Host "`nUSB tunnel armed - in the app use server address http://localhost:8000" -ForegroundColor Green
    } else {
        Write-Host "`nadb not found at $Adb - skipping the USB tunnel." -ForegroundColor Yellow
    }
}

Write-Host @"

  Dashboard     http://localhost:3000
  Worker page   http://localhost:8000/worker
  API docs      http://localhost:8000/docs

  Dashboard takes about a minute to compile the first time.
  Stop everything with:  .\start.ps1 -Stop

"@ -ForegroundColor Cyan
