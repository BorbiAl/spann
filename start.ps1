param(
    [ValidateSet("desktop", "web")]
    [string]$Mode = "desktop",

    [switch]$NoInstall,
    [switch]$NoBackend,
    [switch]$UseDockerBackend,
    [switch]$NoWait
)

$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-Step {
    param([string]$Message)
    Write-Host "[start] $Message" -ForegroundColor Cyan
}

function Require-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' not found. $Hint"
    }
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
            $topStatus = $null
            $nestedStatus = $null

            if ($null -ne $response.PSObject.Properties["status"]) {
                $topStatus = [string]$response.status
            }
            if ($null -ne $response.PSObject.Properties["data"] -and $null -ne $response.data) {
                if ($null -ne $response.data.PSObject.Properties["status"]) {
                    $nestedStatus = [string]$response.data.status
                }
            }

            $status = if ($topStatus) { $topStatus } else { $nestedStatus }

            if ($status -eq "ok" -or $status -eq "degraded") {
                Write-Step "Backend health endpoint responded: $status"
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
    Require-Command -Name "npm" -Hint "Install Node.js and ensure npm is in PATH."

    if (-not $NoInstall) {
        if (-not (Test-Path "node_modules")) {
            Write-Step "Installing npm dependencies..."
            npm install
        }
        else {
            Write-Step "node_modules already exists, skipping npm install."
        }
    }

    if (-not $NoBackend) {
        if ($UseDockerBackend) {
            Require-Command -Name "docker" -Hint "Install Docker Desktop or run without -UseDockerBackend."
            Write-Step "Starting backend with Docker Compose..."
            docker compose up -d
        }
        else {
            Write-Step "Starting local backend in a new PowerShell window (npm run backend)..."
            Start-Process -FilePath "powershell" -ArgumentList @(
                "-NoExit",
                "-Command",
                "$host.UI.RawUI.WindowTitle = 'spann-backend'; Set-Location '$scriptRoot'; npm run backend"
            ) | Out-Null
        }

        if (-not $NoWait) {
            Write-Step "Waiting for backend health at http://127.0.0.1:8000/health ..."
            try {
                Wait-BackendHealth
            }
            catch {
                Write-Warning "Backend health check failed: $($_.Exception.Message)"
                Write-Warning "Continuing startup so UI can still open. Use -NoBackend if you only want UI."
            }
        }
    }

    if ($Mode -eq "web") {
        Write-Step "Starting web dev server (npm run dev)..."
        npm run dev
    }
    else {
        Write-Step "Starting desktop app (npm run desktop:dev)..."
        npm run desktop:dev
    }
}
finally {
    Pop-Location
}
