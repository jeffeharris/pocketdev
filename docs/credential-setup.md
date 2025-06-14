# Credential Setup for PocketDev

This document explains how to configure Git credentials for container-based AI engineers.

## The Problem

Container-based AI engineers need Git credentials to:
- Clone private repositories
- Push changes to GitHub
- Create pull requests

## Solution Overview

PocketDev supports multiple ways to provide credentials:

### Method 1: Via the Settings Page (Recommended)

1. Go to the Settings page in the web UI
2. Enter your GitHub Personal Access Token
3. Click "Validate" to verify the token
4. Select your repository
5. Click "Save Configuration"

The credentials will be:
- Stored in browser localStorage for the UI
- Passed to the backend when needed
- Used by container engineers for Git operations

### Method 2: Environment Variables

Set environment variables before starting the backend:

```bash
export GITHUB_PERSONAL_USERNAME="your-github-username"
export GITHUB_PERSONAL_TOKEN="your-github-token"
npm run dev
```

Or use our helper script:
```bash
source ./scripts/set-credentials.sh
```

### Method 3: Direct API Calls

When assigning tasks via the API, include credentials:

```json
{
  "engineerId": "backend-1",
  "repository": "https://github.com/user/repo.git",
  "description": "Task description",
  "gitUsername": "your-username",
  "gitToken": "your-token"
}
```

## How It Works

1. **Frontend Storage**: The Settings page stores credentials in localStorage
2. **Backend Storage**: Credentials can be stored in-memory on the backend
3. **Container Usage**: Credentials are passed as environment variables to Docker containers

## Security Notes

- Credentials are never logged or displayed in plain text
- Tokens are only stored in memory or localStorage
- Each container gets credentials only for its specific task
- Credentials are not persisted to disk by default

## Troubleshooting

### "No credentials available" Error

This means the backend couldn't find credentials. Check:

1. **Settings Configuration**: Ensure you've saved credentials in Settings
2. **Environment Variables**: Check if `GITHUB_PERSONAL_USERNAME` and `GITHUB_PERSONAL_TOKEN` are set
3. **API Request**: If using the API directly, ensure you're passing `gitUsername` and `gitToken`

### Testing Credentials

You can test if credentials are working:

```bash
# Check if environment variables are set
echo $GITHUB_PERSONAL_USERNAME
echo $GITHUB_PERSONAL_TOKEN | head -c 10  # Show first 10 chars only

# Test API endpoint
curl http://localhost:3001/api/project/credentials
```

## Creating a GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Select scopes:
   - `repo` (full control of private repositories)
   - `workflow` (if you need to update GitHub Actions)
4. Generate and copy the token immediately (it won't be shown again)

## Best Practices

1. Use tokens with minimal required permissions
2. Rotate tokens regularly
3. Never commit tokens to version control
4. Use different tokens for different projects/environments