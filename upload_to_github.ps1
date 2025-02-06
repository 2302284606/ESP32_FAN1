# UTF-8 with BOM
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Set error action preference
$ErrorActionPreference = "Stop"

# Create log function
function Write-Log {
    param($Message)
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'): $Message"
}

try {
    # Get script directory
    $scriptPath = $PSScriptRoot
    Write-Log "Script directory: $scriptPath"
    
    # Change to script directory
    Set-Location $scriptPath
    Write-Log "Changed to working directory: $scriptPath"
    
    # List files to upload
    Write-Log "Files and directories to upload:"
    Get-ChildItem -Path $scriptPath -Recurse -Force | ForEach-Object {
        Write-Log "- $($_.FullName.Substring($scriptPath.Length + 1))"
    }

    # Git configuration
    Write-Log "Configuring Git..."
    git config --global user.email "LIUXING23I@2025.com"
    git config --global user.name "2302284606"

    # Get timestamp for commit message
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commit_message = "Auto update at $timestamp"

    # Check if it's a Git repository
    if (-not (Test-Path ".git")) {
        Write-Log "Initializing Git repository..."
        git init
        if ($LASTEXITCODE -ne 0) { throw "Failed to initialize Git" }
        
        Write-Log "Adding remote repository..."
        git remote add origin https://github.com/2302284606/ESP32_FAN1.git
        if ($LASTEXITCODE -ne 0) { throw "Failed to add remote repository" }
        
        Write-Log "Fetching remote repository..."
        git fetch origin
        if ($LASTEXITCODE -ne 0) { throw "Failed to fetch from remote" }
        
        Write-Log "Creating main branch..."
        git checkout -b main origin/main
        if ($LASTEXITCODE -ne 0) {
            Write-Log "Remote main branch not found, creating new main branch..."
            git checkout -b main
        }
    }

    # Pull latest changes
    Write-Log "Pulling latest changes..."
    git pull origin main --allow-unrelated-histories
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Pull failed, but continuing..."
    }

    # Add all files
    Write-Log "Adding files..."
    git add .
    if ($LASTEXITCODE -ne 0) { throw "Failed to add files" }

    # Commit changes
    Write-Log "Committing changes..."
    git commit -m $commit_message
    if ($LASTEXITCODE -ne 0) { throw "Failed to commit changes" }

    # Push to GitHub
    Write-Log "Pushing to GitHub..."
    git push -u origin main --force
    if ($LASTEXITCODE -ne 0) { throw "Failed to push to GitHub" }

    Write-Log "All operations completed!"
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Detailed error: $_" -ForegroundColor Red
}
finally {
    Write-Host "`nPress any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} 