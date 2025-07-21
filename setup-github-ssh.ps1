# GitHub SSH Setup Script for Benighter Account
# Run this script to ensure SSH is properly configured for GitHub

Write-Host "Setting up GitHub SSH configuration..." -ForegroundColor Green

# 1. Ensure SSH directory exists
$sshDir = "$env:USERPROFILE\.ssh"
if (!(Test-Path $sshDir)) {
    New-Item -ItemType Directory -Path $sshDir -Force
    Write-Host "Created SSH directory: $sshDir" -ForegroundColor Yellow
}

# 2. Create SSH config with proper settings
$sshConfig = @"
Host github.com-mehlo
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_mehlo
  IdentitiesOnly yes

# GitHub SSH Configuration - Permanent Setup for Benighter
Host github.com
  HostName github.com
  Port 22
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
  AddKeysToAgent yes
  ServerAliveInterval 60
  ServerAliveCountMax 10

# Fallback configuration for GitHub (if main fails)
Host github-fallback
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
"@

$configPath = "$sshDir\config"
$sshConfig | Out-File -FilePath $configPath -Encoding ASCII -Force
Write-Host "SSH config created/updated at: $configPath" -ForegroundColor Green

# 3. Set global Git configuration
Write-Host "Setting global Git configuration..." -ForegroundColor Green
git config --global user.name "Benighter"
git config --global user.email "111303968+Benighter@users.noreply.github.com"
git config --global credential.username "Benighter"

# 4. Test SSH connection
Write-Host "Testing SSH connection to GitHub..." -ForegroundColor Green
$sshTest = ssh -T git@github.com 2>&1
if ($sshTest -match "Hi Benighter!") {
    Write-Host "✅ SSH connection successful!" -ForegroundColor Green
    Write-Host $sshTest -ForegroundColor Cyan
} else {
    Write-Host "❌ SSH connection failed. Output:" -ForegroundColor Red
    Write-Host $sshTest -ForegroundColor Red
}

# 5. Display current Git configuration
Write-Host "`nCurrent Git Configuration:" -ForegroundColor Yellow
git config --global --list | Select-String "user\.|credential\.username"

# 6. Display SSH key information
Write-Host "`nSSH Key Information:" -ForegroundColor Yellow
if (Test-Path "$sshDir\id_ed25519.pub") {
    Write-Host "Public key content:" -ForegroundColor Cyan
    Get-Content "$sshDir\id_ed25519.pub"
} else {
    Write-Host "❌ SSH key not found at $sshDir\id_ed25519.pub" -ForegroundColor Red
    Write-Host "Generate a new key with: ssh-keygen -t ed25519 -C 'your-email@example.com'" -ForegroundColor Yellow
}

# 7. Display remotes for current repository (if in a git repo)
if (Test-Path ".git") {
    Write-Host "`nCurrent Git Remotes:" -ForegroundColor Yellow
    git remote -v
}

Write-Host "`n✅ GitHub SSH setup complete!" -ForegroundColor Green
Write-Host "You can now use: git push benighter main" -ForegroundColor Cyan
