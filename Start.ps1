param([int]$Port = 8000)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
    throw 'Created .env. Fill TURSO_DATABASE_URL and TURSO_AUTH_TOKEN, then start again.'
}
if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe') -or -not (Test-Path -LiteralPath 'frontend\dist\index.html')) {
    & (Join-Path $PSScriptRoot 'Setup.ps1')
}
$EnvText = Get-Content -LiteralPath '.env' -Raw
if ($EnvText -notmatch '(?m)^TURSO_DATABASE_URL=\S+' -or $EnvText -notmatch '(?m)^TURSO_AUTH_TOKEN=\S+') {
    throw 'Fill TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env before starting.'
}
$OriginList = "http://127.0.0.1:$Port,http://localhost:$Port,http://localhost:5173,http://127.0.0.1:5173"
$env:APP_ORIGINS = $OriginList
& '.\.venv\Scripts\python.exe' -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
& '.\.venv\Scripts\python.exe' -m backend.seed
if ($LASTEXITCODE -ne 0) { throw 'Database initialization failed.' }
Write-Host "IT School: http://127.0.0.1:$Port" -ForegroundColor Cyan
Write-Host 'Press Ctrl+C to stop. Your data will be kept.'
& '.\.venv\Scripts\python.exe' -m uvicorn backend.main:app --host 127.0.0.1 --port $Port
