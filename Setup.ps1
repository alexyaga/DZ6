param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
    Write-Host 'Created .env from .env.example. Add your Turso credentials before continuing.' -ForegroundColor Yellow
}

function Check-Exit([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step failed (exit $LASTEXITCODE)." }
}

if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
    $PythonCommand = Get-Command python -ErrorAction SilentlyContinue
    if (-not $PythonCommand) { throw 'Install Python 3.12+ and enable Add Python to PATH.' }
    & $PythonCommand.Source -m venv .venv
    Check-Exit 'Create Python environment'
}
& '.\.venv\Scripts\python.exe' -m pip install -r backend/requirements.lock.txt
Check-Exit 'Install Python dependencies'

if (-not $SkipBuild) {
    $PackageManager = Get-Command pnpm -ErrorAction SilentlyContinue
    $UseNpm = $false
    if (-not $PackageManager) {
        $PackageManager = Get-Command npm.cmd -ErrorAction SilentlyContinue
        $UseNpm = [bool]$PackageManager
    }
    if ($PackageManager) {
        Push-Location -LiteralPath 'frontend'
        try {
            if ($UseNpm) { & $PackageManager.Source install }
            else { & $PackageManager.Source install --frozen-lockfile }
            Check-Exit 'Install frontend dependencies'
            & $PackageManager.Source run build
            Check-Exit 'Build frontend'
        } finally { Pop-Location }
    } else {
        # Codex desktop includes a Node runtime and pnpm even when npm is not on PATH.
        $RuntimePath = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
        $NodePath = Join-Path $RuntimePath 'node\bin\node.exe'
        $PnpmPath = Join-Path $RuntimePath 'node\node_modules\pnpm\bin\pnpm.mjs'
        if (-not (Test-Path -LiteralPath $PnpmPath)) { throw 'Install Node.js 22 LTS (including npm) or pnpm.' }
        $env:PATH = (Split-Path $NodePath) + ';' + $env:PATH
        & $NodePath $PnpmPath --dir frontend install --frozen-lockfile
        Check-Exit 'Install frontend dependencies'
        & $NodePath $PnpmPath --dir frontend run build
        Check-Exit 'Build frontend'
    }
}
 $EnvText = Get-Content -LiteralPath '.env' -Raw
if ($EnvText -notmatch '(?m)^TURSO_DATABASE_URL=\S+' -or $EnvText -notmatch '(?m)^TURSO_AUTH_TOKEN=\S+') {
    throw 'Fill TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env, then run Setup.ps1 again.'
}
& '.\.venv\Scripts\python.exe' -m alembic upgrade head
Check-Exit 'Migrate database'
& '.\.venv\Scripts\python.exe' -m backend.seed
Check-Exit 'Seed demonstration data'
Write-Host 'Setup complete. Run: powershell -ExecutionPolicy Bypass -File .\Start.ps1' -ForegroundColor Green
