# Docker Permissions Guide

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


## Overview

This document explains the Docker permissions challenges encountered during PocketDev development and the solutions implemented.

## The Problem

When using Docker with bind mounts, permission mismatches between the host and container users can prevent the container from writing to mounted directories. This commonly occurs when:

1. Docker creates volumes as root
2. The container runs as a non-root user (e.g., `pocketdev`)
3. Bind mounts inherit host filesystem permissions

## Key Concepts

### User IDs (UID) and Group IDs (GID)
- Docker doesn't care about usernames, only UIDs/GIDs
- First user on most Linux systems: UID 1000
- macOS users start at UID 501
- Container user must match host user UID to write to bind mounts

### Volume Types
1. **Bind Mounts** (`./data:/app/data`)
   - Use host filesystem permissions
   - Good for development (direct file access)
   - Permission issues common

2. **Named Volumes** (`volume-name:/app/data`)
   - Docker manages permissions
   - Better for production
   - No direct host access

## Solutions Implemented

### 1. Standard Docker Pattern
```dockerfile
# Create data directories with correct ownership in Dockerfile
RUN mkdir -p /data/projects /data/shelltender-sessions && \
    chown -R pocketdev:pocketdev /data
```

### 2. Volume Configuration
```yaml
# docker-compose.yml
volumes:
  # Code - mounted read-only
  - ./server:/app/server:ro
  
  # Data - named volume (Docker manages permissions)
  - pocketdev-data:/data
```

### 3. Entrypoint Script
```bash
#!/bin/bash
# docker-entrypoint.sh

# Clean up bloated .gitconfig if it exists
GITCONFIG="$HOME/.gitconfig"
if [ -f "$GITCONFIG" ]; then
    SIZE=$(stat -c%s "$GITCONFIG" 2>/dev/null || stat -f%z "$GITCONFIG" 2>/dev/null || echo 0)
    if [ "$SIZE" -gt 102400 ]; then  # 100KB
        echo "Warning: .gitconfig is ${SIZE} bytes, cleaning up..."
        rm -f "$GITCONFIG"
    fi
fi

# Execute the original command
exec "$@"
```

## Best Practices

### For Development
1. Use bind mounts for code (read-only)
2. Use named volumes for data
3. Document UID requirements

### For Production
1. Always use named volumes
2. Never run containers as root
3. Create directories in Dockerfile

### Common Patterns

#### Wrong Approach
```yaml
# Don't mix host paths with container user expectations
volumes:
  - ./projects:/home/pocketdev/projects  # Will have host permissions
```

#### Right Approach
```yaml
# Separate code from data
volumes:
  - ./server:/app/server:ro     # Code (read-only)
  - app-data:/data              # Data (Docker-managed)
```

## Troubleshooting

### Check Permissions
```bash
# Inside container
docker exec container-name ls -la /data

# Check user
docker exec container-name whoami
docker exec container-name id
```

### Fix Permission Issues

#### Option 1: Fix on Host (Development)
```bash
# One-time fix
sudo chown -R $(id -u):$(id -g) ./data
```

#### Option 2: Use Correct Volume Type
```yaml
# Switch from bind mount to named volume
volumes:
  # - ./data:/data  # Remove this
  - data-volume:/data  # Use this
```

## Lessons Learned

1. **Build Optimization**: Don't `chown` directories that will be replaced by volume mounts
2. **Data Persistence**: Keep user data in Docker-managed volumes
3. **Code Access**: Mount source code read-only to prevent accidental modifications
4. **Documentation**: Always document permission requirements for other developers

## Real-World Example

For a detailed case study of these issues and their resolution, see [Session Summary - July 5, 2025](./session-summary-2025-07-05.md), which documents:
- Actual permission issues encountered during PocketDev development
- Step-by-step troubleshooting process
- Database recovery from git worktrees
- Performance optimizations achieved

## References
- [Session Summary - July 5, 2025](./session-summary-2025-07-05.md) - Real-world troubleshooting session
- [Docker Volume Documentation](https://docs.docker.com/storage/volumes/)
- [Docker User Namespace](https://docs.docker.com/engine/security/userns-remap/)
- [Best Practices for Writing Dockerfiles](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)