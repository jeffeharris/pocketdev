# Docker Security Improvements

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


**Last Updated**: 2025-07-09

## Overview

This document describes the security improvements implemented in the PocketDev Docker setup. The new secure configuration addresses permission issues, removes root requirements, and implements proper secrets management.

## Key Improvements

### 1. UID/GID Mapping

The secure setup automatically maps container users to match the host user's UID/GID:

- **Automatic Detection**: The `start-secure.sh` script detects the host user's UID/GID
- **Dynamic Mapping**: The entrypoint script creates/updates the container user to match
- **No Permission Issues**: Files created in containers have correct ownership on the host

Example:
```bash
# Host user: jeffh (UID=1001, GID=1001)
$ ./scripts/start-secure.sh
# Containers run as pocketdev user with UID=1001, GID=1001
```

### 2. Privilege Management

- **Root-less Operation**: Services run as non-root users after initial setup
- **Privilege Dropping**: Entrypoint uses `gosu` to drop privileges after setup
- **Capability Restrictions**: Only necessary capabilities (CHOWN, SETUID, SETGID) are allowed

### 3. Secrets Management

Instead of environment variables, sensitive data uses Docker secrets:

```yaml
secrets:
  anthropic_api_key:
    environment: ANTHROPIC_API_KEY
```

Services read secrets from files:
```bash
# Instead of: ANTHROPIC_API_KEY=xxx
# Now: ANTHROPIC_API_KEY_FILE=/run/secrets/anthropic_api_key
```

### 4. Git Safe Directory Handling

- **Local Configuration**: Git safe.directory is set per-repository, not globally
- **Automatic Detection**: Only configures directories that actually need it
- **No Security Bypass**: Doesn't use wildcard `*` for safe.directory

### 5. Docker Socket Alternative

The secure setup removes Docker socket mounting. Options for container management:

1. **Docker API over TCP** (with TLS)
2. **Docker Context** (remote Docker daemon)
3. **Rootless Docker** (user namespace)
4. **Podman** (daemonless alternative)

## Migration Guide

### Step 1: Create .env file
```bash
cp .env.example .env
# Edit .env with your actual keys
```

### Step 2: Build secure images
```bash
./scripts/start-secure.sh --build
```

### Step 3: Test the secure setup
```bash
# Stop current services
docker-compose down

# Start secure services
./scripts/start-secure.sh
```

### Step 4: Verify permissions
```bash
# Create a file from container
docker exec shelltender-secure touch /projects/test.txt

# Check ownership on host
ls -la projects/test.txt
# Should show your user, not root
```

## Security Best Practices

1. **Regular Updates**: Keep base images updated
   ```bash
   docker pull node:22-slim
   docker build -f Dockerfile.base-secure -t pocketdev/base-secure:latest .
   ```

2. **Secrets Rotation**: Regularly rotate API keys and tokens

3. **Network Isolation**: Use custom networks for service communication

4. **Resource Limits**: Add resource constraints to prevent DoS
   ```yaml
   deploy:
     resources:
       limits:
         cpus: '2'
         memory: 2G
   ```

5. **Security Scanning**: Scan images for vulnerabilities
   ```bash
   docker scout cves pocketdev/base-secure:latest
   ```

## Rollback Plan

If issues occur, rollback to the original setup:

```bash
# Stop secure services
docker-compose -f docker-compose-secure.yml down

# Start original services
docker-compose up -d
```

## Next Steps

1. **Docker-in-Docker (DinD)**: Implement secure DinD for AI development environments
2. **Rootless Mode**: Consider migrating to rootless Docker
3. **Policy Enforcement**: Add OPA (Open Policy Agent) for policy-based security
4. **Audit Logging**: Implement comprehensive audit logging

## Docker Socket Alternatives (Detailed)

Since we removed Docker socket mounting, here are the alternatives:

### Option 1: Docker Remote API with TLS
```bash
# On host, expose Docker API with TLS
dockerd \
  --tlsverify \
  --tlscacert=ca.pem \
  --tlscert=server-cert.pem \
  --tlskey=server-key.pem \
  -H=0.0.0.0:2376
```

### Option 2: SSH-based Docker Context
```bash
# In container, use Docker over SSH
docker context create remote --docker "host=ssh://user@docker-host"
docker context use remote
```

### Option 3: Podman with REST API
```bash
# Podman doesn't require a daemon
podman system service --time=0 tcp:0.0.0.0:8080
```

### Option 4: Kubernetes Jobs API
For container orchestration, use Kubernetes Jobs instead of direct Docker access.

## Monitoring

Monitor security events:

```bash
# Check for privilege escalation attempts
docker events --filter event=exec_create --filter event=exec_start

# Monitor file access
docker exec shelltender-secure ls -la /proc/self/fd/
```