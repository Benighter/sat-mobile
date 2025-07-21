# SSH GitHub Connection Setup Guide

## Problem Description

When trying to push code to GitHub using SSH, encountered the following issues:

1. **Connection Reset Error**: `Connection reset by 20.87.245.4 port 443`
2. **Email Privacy Restrictions**: `GH007: Your push would publish a private email address`
3. **SSH Authentication Failures**: Unable to authenticate with GitHub via SSH

## Root Causes

### 1. SSH Configuration Issues
- SSH config was using `ssh.github.com` on port 443
- Connection was being reset during key exchange
- Network/firewall blocking the connection

### 2. Email Privacy Settings
- Git was configured with personal email (`bennet.nkolele1998@gmail.com`)
- GitHub privacy settings prevent pushing commits with private emails
- Need to use GitHub's noreply email format

## Solution Steps

### Step 1: Fix SSH Configuration

**Problem**: SSH connection failing on port 443
**Solution**: Update SSH config to use standard GitHub SSH settings

```bash
# Location: ~/.ssh/config
Host github.com
  HostName github.com
  Port 22
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
```

**PowerShell command to create config:**
```powershell
@"
Host github.com
  HostName github.com
  Port 22
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
"@ | Out-File -FilePath ~/.ssh/config -Encoding ASCII
```

### Step 2: Test SSH Connection

```bash
ssh -T git@github.com
```

**Expected successful output:**
```
Hi [username]! You've successfully authenticated, but GitHub does not provide shell access.
```

### Step 3: Configure Git Email

**Problem**: Using private email address
**Solution**: Use GitHub noreply email

```bash
# Set GitHub noreply email (format: [user-id]+[username]@users.noreply.github.com)
git config user.email "111303968+Benighter@users.noreply.github.com"
git config user.name "Benighter"
```

### Step 4: Fix Existing Commits

If you have commits with the wrong email, amend the last commit:

```bash
git commit --amend --reset-author --no-edit
```

### Step 5: Add SSH Remote and Push

```bash
# Add SSH remote
git remote add [remote-name] git@github.com:[username]/[repository].git

# Push to the new remote
git push [remote-name] main
```

## Verification Commands

### Check SSH Connection
```bash
ssh -T git@github.com
```

### Check Git Configuration
```bash
git config user.email
git config user.name
```

### Check Remotes
```bash
git remote -v
```

### Test Push
```bash
git push [remote-name] [branch-name]
```

## Common Issues and Troubleshooting

### Issue 1: "Connection reset" error
- **Cause**: Port 443 blocked or SSH config using wrong hostname
- **Solution**: Use port 22 and `github.com` as hostname

### Issue 2: "GH007: Your push would publish a private email address"
- **Cause**: Git configured with personal email
- **Solution**: Use GitHub noreply email format

### Issue 3: SSH key not found
- **Cause**: SSH key not properly configured or missing
- **Solution**: 
  ```bash
  # Check if key exists
  ls ~/.ssh/
  
  # Generate new key if needed
  ssh-keygen -t ed25519 -C "your-email@example.com"
  
  # Add to SSH agent
  ssh-add ~/.ssh/id_ed25519
  ```

### Issue 4: Permission denied
- **Cause**: SSH key not added to GitHub account
- **Solution**: 
  1. Copy public key: `cat ~/.ssh/id_ed25519.pub`
  2. Add to GitHub: Settings → SSH and GPG keys → New SSH key

## Best Practices

1. **Always use SSH for private repositories** - More secure than HTTPS with tokens
2. **Use GitHub noreply email** - Protects your privacy
3. **Test SSH connection** before pushing
4. **Keep SSH config simple** - Use standard ports and hostnames
5. **Backup SSH keys** - Store them securely

## Quick Reference Commands

```bash
# Test SSH
ssh -T git@github.com

# Set correct email
git config user.email "[user-id]+[username]@users.noreply.github.com"

# Add SSH remote
git remote add origin git@github.com:[username]/[repo].git

# Push with SSH
git push origin main
```

## File Locations

- **SSH Config**: `~/.ssh/config` (Windows: `C:\Users\[username]\.ssh\config`)
- **SSH Keys**: `~/.ssh/id_ed25519` and `~/.ssh/id_ed25519.pub`
- **Git Config**: `.git/config` (local) or `~/.gitconfig` (global)

---

**Note**: Replace placeholders like `[username]`, `[repository]`, `[user-id]` with your actual values.
