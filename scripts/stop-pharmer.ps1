$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker was not found. Install Docker Desktop to stop the Pharmer containers." -ForegroundColor Red
    exit 1
}
docker compose down
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Pharmer is stopped. Your local index and model downloads are kept. Ollama is left running." -ForegroundColor Green
