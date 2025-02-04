# Set error action preference
$ErrorActionPreference = "Stop"

# Create log function
function Write-Log {
    param($Message)
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'): $Message"
}

try {
    Write-Log "Starting Git operations..."

    # Set Git global config
    Write-Log "Configuring Git user info..."
    git config --global user.email "LIUXING23I@2025.com"
    git config --global user.name "2302284606"

    # Get current time for commit message
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
        
        Write-Log "Creating main branch tracking remote..."
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
        Write-Log "Pull failed, but continuing with push..."
    }

    # Add all files to staging area
    Write-Log "Adding files to staging area..."
    git add .
    if ($LASTEXITCODE -ne 0) { throw "Failed to add files" }

    # Commit changes
    Write-Log "Committing changes..."
    git commit -m $commit_message
    if ($LASTEXITCODE -ne 0) { throw "Failed to commit changes" }

    # Force push to remote repository
    Write-Log "Force pushing to GitHub..."
    git push -u origin main --force
    if ($LASTEXITCODE -ne 0) { throw "Failed to push to GitHub" }

    Write-Log "All operations completed successfully!"
}
catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Detailed error: $_" -ForegroundColor Red
}
finally {
    Write-Host "`nPress any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
} 