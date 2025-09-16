# Docker-in-Docker Hybrid Architecture for PocketDev Validation

<!-- Document Metadata
Created: 2025-07-01
Modified: 2025-07-11
Status: ????
-->


## Overview

This document describes the hybrid networking architecture for PocketDev's validation phase, combining nginx path-based routing with direct port access. This design enables both clean URLs for web applications and direct connectivity for services that require it.

## Architecture Decision

Based on our discussion, we chose **True Docker-in-Docker (DinD)** over sibling containers for these reasons:

1. **Better isolation** between worktrees
2. **Simpler networking model** for direct browser access
3. **Full control** over validation environment
4. **Easier cleanup** - kill shell container = cleanup everything
5. **Contained blast radius** - more secure than host Docker socket access

## Hybrid Port Strategy

### Overview
```
Browser → Host Docker → Shell Server Container → DinD Daemon → Validation Container
```

Each shell server container exposes:
- **Port 8080**: Nginx proxy for path-based routing
- **Ports 9001-9010**: Direct port access for special services

### Starting a Shell Server
```bash
# Each worktree gets its own shell server with DinD
docker run --privileged \
  -p 8080:8080 \              # Nginx proxy
  -p 9001-9010:9001-9010 \    # Direct ports
  -e WORKTREE_ID=abc123 \
  -e ANTHROPIC_API_KEY=$KEY \
  shell-server:latest
```

## URL Access Patterns

### 1. Path-Based Access (Via Nginx)
Perfect for standard web applications:
```
http://host/worktree-abc123/app     → Web application
http://host/worktree-abc123/api     → API endpoints  
http://host/worktree-abc123/docs    → Documentation
```

**Benefits:**
- Clean, predictable URLs
- No port conflicts between worktrees
- Easy to embed in iframes
- Works well with reverse proxies

### 2. Direct Port Access
Reserved for services that don't work well through HTTP proxies:
```
http://host:9001 → WebSocket connections
http://host:9002 → Hot Module Reload (Vite, Webpack)
http://host:9003 → Database connections (pgAdmin, phpMyAdmin)
http://host:9004 → gRPC services
http://host:9005 → Development servers with special protocols
```

**Benefits:**
- No protocol limitations
- Direct TCP/UDP access
- Better for streaming connections
- Debugging tools work properly

## Implementation Details

### Host Nginx Configuration
```nginx
server {
    listen 80;
    server_name _;
    
    # Route to shell servers by worktree ID
    location ~ ^/worktree-([^/]+)/(.*)$ {
        set $worktree $1;
        set $path $2;
        
        # Find the shell server for this worktree
        # In practice, you'd map worktree IDs to container names/IPs
        resolver 127.0.0.11 valid=30s;  # Docker's internal DNS
        set $upstream shell-server-$worktree;
        
        proxy_pass http://$upstream:8080/$path;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Worktree-ID $worktree;
    }
}

# WebSocket support
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

### Shell Server Internal Nginx
Inside each shell server container:
```nginx
server {
    listen 8080;
    
    # Route to validation containers by service name
    location /app/ {
        proxy_pass http://validation-web:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api/ {
        proxy_pass http://validation-api:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /db-admin/ {
        proxy_pass http://validation-db-admin:5050/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Shell Server Dockerfile
```dockerfile
FROM docker:dind

# Install nginx and other dependencies
RUN apk add --no-cache nginx nodejs npm git

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy shell server application
COPY . /app
WORKDIR /app

# Start script that runs both dockerd and the app
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080 9001-9010

ENTRYPOINT ["/start.sh"]
```

### Start Script (start.sh)
```bash
#!/bin/sh
# Start Docker daemon in background
dockerd &

# Wait for Docker to be ready
while ! docker info >/dev/null 2>&1; do
    sleep 1
done

# Start nginx
nginx

# Start the shell server application
node /app/server.js
```

## Validation Container Management

### Creating Validation Containers
Inside the shell server, validation containers use predictable names:
```javascript
async function deployValidationContainers(taskId) {
  const network = `validation-${taskId}`;
  
  // Create isolated network
  await docker.network.create(network);
  
  // Start web app container
  await docker.run({
    name: 'validation-web',
    image: 'node:18',
    network: network,
    env: {
      PORT: 3000,
      NODE_ENV: 'development'
    },
    cmd: ['npm', 'start'],
    workdir: '/app',
    volumes: [`${workspacePath}:/app`]
  });
  
  // Start API container
  await docker.run({
    name: 'validation-api',
    image: 'node:18',
    network: network,
    env: {
      PORT: 8080,
      DATABASE_URL: 'postgresql://...'
    },
    cmd: ['npm', 'run', 'server'],
    workdir: '/app',
    volumes: [`${workspacePath}:/app`]
  });
}
```

### Port Assignment Strategy
Direct ports (9001-9010) are assigned based on service type:
```javascript
const PORT_ASSIGNMENTS = {
  'websocket': 9001,
  'hmr': 9002,        // Hot module reload
  'database': 9003,
  'grpc': 9004,
  'custom1': 9005,
  'custom2': 9006,
  // 9007-9010 reserved for future use
};

function assignDirectPort(serviceType) {
  return PORT_ASSIGNMENTS[serviceType] || null;
}
```

## Benefits of This Approach

### 1. Clean URL Structure
- Frontend can use predictable iframe URLs: `/worktree-{id}/app`
- No port management in the UI
- Easy to understand and bookmark

### 2. Flexibility
- Standard web traffic goes through nginx
- Special services get direct ports
- Both access methods available simultaneously

### 3. Isolation
- Each worktree is completely isolated
- No port conflicts between worktrees
- Easy cleanup (just stop the shell server container)

### 4. Security
- DinD provides containment
- Nginx can add authentication/rate limiting
- Direct ports can be firewalled separately

## Future Enhancements

### SSL/TLS Support
Add SSL termination at host nginx:
```nginx
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_private_key /path/to/key.pem;
    
    # Same location blocks as above
}
```

### Automatic Port Discovery
Validation containers could register their port needs:
```javascript
// In validation container
const portConfig = {
  web: { internal: 3000, type: 'http' },
  websocket: { internal: 3001, type: 'websocket', needsDirect: true },
  hmr: { internal: 3002, type: 'hmr', needsDirect: true }
};

// Shell server assigns ports based on needs
```

### Dynamic Subdomains
Alternative approach using subdomains:
```
http://worktree-abc123.pocketdev.local/app
http://worktree-def456.pocketdev.local/app
```

## Summary

This hybrid architecture provides the best of both worlds:
1. **Clean URLs** for standard web applications via nginx
2. **Direct access** for services that need it via reserved ports
3. **Complete isolation** between different worktrees
4. **Simple management** - one shell server per worktree

The design scales well and can be enhanced with additional features as needed, while keeping the core validation workflow simple and reliable.