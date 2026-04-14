param(
    [switch]$NoDocker,
    [switch]$NoInstall,
    [switch]$Web
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step {
    param([string]$Message)
    Write-Host "[start] $Message" -ForegroundColor Cyan
}

function Wait-BackendHealth {
    param(
        [string]$Url = "http://127.0.0.1:8000/health",
        [int]$TimeoutSeconds = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 4
            if ($response.status -eq "ok" -or $response.status -eq "degraded") {
                Write-Step "Backend health endpoint responded: $($response.status)"
                return
            }
        }
        catch {
            # backend is still starting
        }
        Start-Sleep -Seconds 2
    }

    throw "Backend did not become healthy within $TimeoutSeconds seconds."
}

Push-Location $scriptRoot
try {
    if (-not $NoInstall) {
        if (-not (Test-Path "node_modules")) {
            Write-Step "Installing npm dependencies..."
            npm install
        }
        else {
            Write-Step "node_modules already exists, skipping npm install."
        }
    }

    if (-not $NoDocker) {
        if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
            throw "Docker CLI is not available. Install Docker Desktop or run with -NoDocker."
        }

        Write-Step "Starting Docker services (detached)..."
        docker compose up -d

        Write-Step "Waiting for backend health..."
        Wait-BackendHealth
    }

    if ($Web) {
        Write-Step "Starting web dev server..."
        npm run dev
    }
    else {
        Write-Step "Starting desktop app (Electron + Vite)..."
        npm run desktop:dev
    }
}
finally {
    Pop-Location
}
