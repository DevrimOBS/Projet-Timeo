# Script to start Projet-Timeo with automatic browser opening
# Usage: .\start.ps1

Write-Host "[*] Starting Projet-Timeo..." -ForegroundColor Green
Write-Host ""

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Change to the script directory
Push-Location $scriptDir

try {
    # Start Docker Compose
    Write-Host "[1/3] Starting Docker Compose services..." -ForegroundColor Cyan
    docker compose up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Failed to start Docker Compose" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "[2/3] Waiting for frontend to be ready..." -ForegroundColor Cyan
    
    # Wait for frontend to be ready (max 60 seconds)
    $maxAttempts = 60
    $attempt = 0
    $frontendReady = $false
    
    while ($attempt -lt $maxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri http://localhost:5173 -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $frontendReady = $true
                break
            }
        }
        catch {
            # Frontend not ready yet
        }
        
        $attempt++
        Start-Sleep -Seconds 1
        Write-Host -NoNewline "."
    }
    
    Write-Host ""
    
    if ($frontendReady) {
        Write-Host "[OK] Frontend is ready!" -ForegroundColor Green
        Write-Host ""
        Write-Host "[3/3] Opening browser..." -ForegroundColor Cyan
        
        # Open browser
        Start-Process "http://localhost:5173"
        
        Write-Host ""
        Write-Host "[INFO] Dashboard:      http://localhost:5173" -ForegroundColor Green
        Write-Host "[INFO] API:            http://localhost:3000" -ForegroundColor Green
        Write-Host "[INFO] Database:       localhost:5432" -ForegroundColor Green
        Write-Host ""
        Write-Host "[INFO] Press Ctrl+C to stop services..." -ForegroundColor Yellow
        
        # Keep the terminal open
        while ($true) {
            Start-Sleep -Seconds 1
        }
    }
    else {
        Write-Host "[X] Frontend failed to start within timeout" -ForegroundColor Red
        Write-Host ""
        Write-Host "[INFO] Checking logs..." -ForegroundColor Yellow
        docker compose logs frontend --tail 20
        exit 1
    }
}
finally {
    Pop-Location
}
