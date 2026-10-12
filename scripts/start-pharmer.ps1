$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Stop-WithHelp([string]$message) {
    Write-Host "`n$message" -ForegroundColor Red
    exit 1
}

Write-Host "`nPharmer online setup" -ForegroundColor Cyan
Write-Host "First launch downloads app dependencies and local embedding/reranking models. The configured LLM provider and live evidence sources require internet access."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Stop-WithHelp "Docker was not found. Install Docker Desktop from https://www.docker.com/products/docker-desktop/ and start it, then double-click start-pharmer.bat again."
}
$backendEnv = Join-Path $root "backend\.env"
if (-not (Test-Path $backendEnv)) {
    $exampleEnv = Join-Path $root "backend\.env.example"
    if (Test-Path $exampleEnv) {
        Copy-Item $exampleEnv $backendEnv
        Write-Host "Created backend\.env from backend\.env.example" -ForegroundColor Green
    }
}
$provider = "ollama"
if (Test-Path $backendEnv) {
    $providerLine = Select-String -Path $backendEnv -Pattern '^\s*LLM_PROVIDER\s*=\s*(.+?)\s*$' | Select-Object -Last 1
    if ($providerLine) { $provider = $providerLine.Matches[0].Groups[1].Value.Trim('"', "'").ToLowerInvariant() }
}

docker compose version *> $null
if ($LASTEXITCODE -ne 0) { Stop-WithHelp "Docker Compose is unavailable. Update or reinstall Docker Desktop, then try again." }
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    $dockerDesktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
    if (Test-Path $dockerDesktop) {
        Write-Host "Starting Docker Desktop..."
        Start-Process -FilePath $dockerDesktop -WindowStyle Hidden
        $ready = $false
        for ($i = 0; $i -lt 60; $i++) {
            Start-Sleep -Seconds 2
            docker info *> $null
            if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        }
        if (-not $ready) { Stop-WithHelp "Docker Desktop did not become ready. Open Docker Desktop, wait until it says it is running, then try again." }
    } else {
        Stop-WithHelp "Docker is installed but not running. Open Docker Desktop, wait until it says it is running, then try again."
    }
}

if ($provider -eq "gemini") {
    $hasKey = $false
    if (Test-Path $backendEnv) {
        $keyLine = Select-String -Path $backendEnv -Pattern '^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$' | Select-Object -Last 1
        if ($keyLine -and $keyLine.Matches[0].Groups[1].Value.Trim() -ne "" -and -not $keyLine.Matches[0].Groups[1].Value.StartsWith("AIzaSy...")) {
            $hasKey = $true
        }
    }
    if (-not $hasKey) {
        Write-Host "`n=== Google Gemini Setup ===" -ForegroundColor Cyan
        Write-Host "You need a free Google Gemini API key to run Pharmind."
        Write-Host "Get one for free at: https://aistudio.google.com/app/apikey`n" -ForegroundColor Yellow
        $keyInput = Read-Host "Paste your Google Gemini API key"
        if ($keyInput -and $keyInput.Trim() -ne "") {
            $keyInput = $keyInput.Trim()
            $envContent = if (Test-Path $backendEnv) { Get-Content $backendEnv -Raw } else { "" }
            if ($envContent -match "GEMINI_API_KEY=") {
                $envContent = $envContent -replace "GEMINI_API_KEY=.*", "GEMINI_API_KEY=$keyInput"
            } else {
                $envContent += "`nGEMINI_API_KEY=$keyInput"
            }
            Set-Content -Path $backendEnv -Value $envContent -NoNewline
            Write-Host "Gemini API key saved to backend\.env" -ForegroundColor Green
        } else {
            Stop-WithHelp "No API key was provided. Get a free key at https://aistudio.google.com/app/apikey and run start-pharmer.bat again."
        }
    }
} elseif ($provider -eq "ollama") {
    if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
        Write-Host "`nOllama is not installed on this computer." -ForegroundColor Yellow
        Write-Host "You can use Google Gemini instead (free, fast, no heavy downloads needed)." -ForegroundColor Cyan
        Write-Host "Get your free API key at: https://aistudio.google.com/app/apikey`n" -ForegroundColor Yellow
        $keyInput = Read-Host "Paste your Google Gemini API key (or press Enter to cancel)"
        if ($keyInput -and $keyInput.Trim() -ne "") {
            $keyInput = $keyInput.Trim()
            $envContent = if (Test-Path $backendEnv) { Get-Content $backendEnv -Raw } else { "" }
            if ($envContent -match "LLM_PROVIDER=") {
                $envContent = $envContent -replace "LLM_PROVIDER=.*", "LLM_PROVIDER=gemini"
            } else {
                $envContent += "`nLLM_PROVIDER=gemini"
            }
            if ($envContent -match "GEMINI_API_KEY=") {
                $envContent = $envContent -replace "GEMINI_API_KEY=.*", "GEMINI_API_KEY=$keyInput"
            } else {
                $envContent += "`nGEMINI_API_KEY=$keyInput"
            }
            Set-Content -Path $backendEnv -Value $envContent -NoNewline
            $provider = "gemini"
            Write-Host "Configured LLM_PROVIDER=gemini and saved your API key to backend\.env!" -ForegroundColor Green
        } else {
            Stop-WithHelp "To run Pharmind, either install Ollama (https://ollama.com) or enter a Google Gemini API key."
        }
    } else {
        $model = if ($env:OLLAMA_MODEL) { $env:OLLAMA_MODEL } else { "qwen2.5:3b" }
        $env:OLLAMA_MODEL = $model
        $ollamaReady = $false
        try { Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 | Out-Null; $ollamaReady = $true } catch {}
        if (-not $ollamaReady) {
            Write-Host "Starting the local Ollama service..."
            Start-Process -FilePath (Get-Command ollama).Source -ArgumentList "serve" -WindowStyle Hidden
            for ($i = 0; $i -lt 30; $i++) {
                Start-Sleep -Seconds 2
                try { Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 | Out-Null; $ollamaReady = $true; break } catch {}
            }
        }
        if (-not $ollamaReady) { Stop-WithHelp "Ollama did not start. Open Ollama from the Start menu and try again." }

        $installedModels = ollama list 2>$null | Out-String
        if ($installedModels -notmatch [regex]::Escape($model)) {
            Write-Host "Downloading the local chat model $model (one time)..." -ForegroundColor Yellow
            ollama pull $model
            if ($LASTEXITCODE -ne 0) { Stop-WithHelp "Model download failed. Check your internet connection and available disk space, then try again." }
        }
    }
}

Write-Host "Building and starting the local Pharmer app..."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Stop-WithHelp "The app could not build or start. Check Docker Desktop and disk space, then run this launcher again." }

$apiReady = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    try { $health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 3; $apiReady = $true; break } catch {}
}
if (-not $apiReady) { Stop-WithHelp "The local API is still starting or failed. Run stop-pharmer.bat, then try again. If it repeats, share the Docker Desktop logs with the project maintainer." }

if ([int]$health.chunk_count -eq 0) {
    Write-Host "Preparing a small Aspirin research demo index (one time)..." -ForegroundColor Yellow
    docker compose exec -T backend python -m ingest.run_ingest --quickstart
    if ($LASTEXITCODE -ne 0) { Stop-WithHelp "Evidence setup failed. Check your internet connection and rerun this launcher; completed data remains cached." }
}

Write-Host "Warming local embedding and reranking models (first launch only)..."
docker compose exec -T backend python -c "from rag.embeddings import get_embedding_model; get_embedding_model(); from rag.reranker import get_reranker; get_reranker()"
if ($LASTEXITCODE -ne 0) { Stop-WithHelp "A local model could not be downloaded or loaded. Check your internet connection and disk space, then try again." }

Write-Host "`nPharmer is ready at http://localhost:3000" -ForegroundColor Green
Write-Host "The first index is a small Aspirin demo. Use the full ingestion workflow in the README for the broader starter set."
Start-Process "http://localhost:3000"
