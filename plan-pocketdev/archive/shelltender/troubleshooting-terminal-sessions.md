# Troubleshooting Shelltender Terminal Sessions

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


## Quick Diagnostics

1. **Run the debug script**:
   ```bash
   cd /home/jeffh/projects/pocketdev/simple
   ./debug-shelltender.sh
   ```

2. **Test WebSocket directly in browser**:
   Open http://localhost:5173/test-websocket.html

## Common Issues and Solutions

### Issue 1: "WebSocket service not available" Error

**Symptom**: Terminal component shows this error and doesn't render.

**Root Cause**: Race condition in Shelltender v0.4.4 - the WebSocket service is initialized in a useEffect, but the Terminal component checks for it before the effect runs.

**Solution**:
```typescript
// Create a wrapper component that waits for the service
import React, { useEffect, useState } from 'react';
import { Terminal, useWebSocket } from '@shelltender/client';

const TerminalWrapper: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const { wsService, isConnected } = useWebSocket();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for wsService to be available
    if (wsService) {
      setIsReady(true);
    }
  }, [wsService]);

  if (!isReady) {
    return <div>Initializing terminal...</div>;
  }

  return <Terminal sessionId={sessionId} />;
};

// Use the wrapper instead of Terminal directly
export const MinimalTerminalTest = () => {
  return (
    <ShelltenderWSProvider config={{ url: '/shelltender-ws' }}>
      <ToastProvider>
        <TerminalWrapper sessionId="test-session" />
      </ToastProvider>
    </ShelltenderWSProvider>
  );
};
```

### Issue 2: WebSocket Connection Fails

**Symptom**: Browser console shows WebSocket connection errors.

**Diagnostics**:
1. Open browser DevTools (F12)
2. Go to Network tab → WS filter
3. Look for connection attempts to `/shelltender-ws`

**Common Causes**:

1. **Shelltender container not running**:
   ```bash
   docker ps | grep shelltender
   # If not running:
   docker-compose up -d shelltender
   ```

2. **Port 8080 not accessible**:
   ```bash
   curl http://localhost:8080/health
   # Should return JSON with status: "healthy"
   ```

3. **Vite proxy misconfigured**:
   Check `frontend/vite.config.ts`:
   ```typescript
   '/shelltender-ws': {
     target: 'ws://shelltender:8080',
     changeOrigin: true,
     ws: true,
     rewrite: (path) => path.replace(/^\/shelltender-ws/, ''),
   }
   ```

4. **Docker network issues**:
   ```bash
   # Containers must be on same network
   docker network inspect pocketdev-network
   ```

### Issue 3: Session Creates but No Output

**Symptom**: Terminal appears but remains blank, no prompt.

**Diagnostics**:
```bash
# Check Shelltender logs
docker logs shelltender --tail 50

# Look for PTY errors or session creation issues
```

**Solutions**:

1. **Check session is actually created**:
   ```bash
   curl http://localhost:8080/sessions
   ```

2. **Verify PTY permissions in container**:
   ```bash
   docker exec shelltender ls -la /dev/pts/
   ```

3. **Check if shell is available**:
   ```bash
   docker exec shelltender which bash
   ```

### Issue 4: Input Not Working

**Symptom**: Terminal displays output but doesn't accept keyboard input.

**Check**:
1. Terminal has focus (click on it)
2. No JavaScript errors in console
3. WebSocket messages are being sent (Network tab)

**Solution**:
```javascript
// Ensure terminal gets focus
useEffect(() => {
  if (terminalRef.current) {
    terminalRef.current.focus();
  }
}, []);
```

## Step-by-Step Verification

### 1. Verify Backend Setup
```bash
# Check all services are running
docker-compose ps

# Should show:
# shelltender     Up    0.0.0.0:8080->8080/tcp
# backend         Up    0.0.0.0:3005->3005/tcp  
# frontend        Up    0.0.0.0:5173->5173/tcp
```

### 2. Test WebSocket Directly
```bash
# Install websocat if needed
brew install websocat  # macOS
# or
sudo apt-get install websocat  # Linux

# Test connection
echo '{"type":"create","options":{"id":"cli-test"}}' | websocat ws://localhost:8080
```

### 3. Check Browser Connection
1. Open http://localhost:5173/test-websocket.html
2. Click "Test Proxy Connection"
3. Should see "WebSocket connected!"
4. Click "Create Session"
5. Should see session creation confirmation

### 4. Debug React Integration
Add logging to your component:
```typescript
const MinimalTerminalTest = () => {
  const terminalRef = useRef<TerminalHandle>(null);
  
  // Add debug logging
  useEffect(() => {
    console.log('Terminal ref:', terminalRef.current);
  }, []);

  return (
    <ShelltenderWSProvider 
      config={{ url: '/shelltender-ws' }}
    >
      <ToastProvider>
        <Terminal
          ref={terminalRef}
          sessionId="test-session"
          onSessionCreated={(id) => console.log('Session created:', id)}
          onError={(err) => console.error('Terminal error:', err)}
          debug={true} // Enable debug logging
        />
      </ToastProvider>
    </ShelltenderWSProvider>
  );
};
```

## Nuclear Options

If nothing else works:

### 1. Full Reset
```bash
# Stop everything
docker-compose down

# Clear volumes
docker volume prune

# Rebuild
docker-compose build --no-cache

# Start fresh
docker-compose up -d
```

### 2. Use Shelltender Standalone
```bash
# Test Shelltender without Docker
cd /home/jeffh/projects/shelltender
npm install
npm run dev

# In another terminal
cd apps/demo
npm run dev

# Open http://localhost:5173
```

### 3. Create Minimal Test
Create a new file `frontend/src/components/prototype/DirectWebSocketTest.tsx`:
```typescript
import { useEffect, useState } from 'react';

export const DirectWebSocketTest = () => {
  const [messages, setMessages] = useState<string[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const websocket = new WebSocket('ws://localhost:8080');
    
    websocket.onopen = () => {
      setMessages(prev => [...prev, 'Connected!']);
      websocket.send(JSON.stringify({
        type: 'create',
        options: { id: 'direct-test' }
      }));
    };

    websocket.onmessage = (event) => {
      setMessages(prev => [...prev, `Received: ${event.data}`]);
    };

    websocket.onerror = (error) => {
      setMessages(prev => [...prev, `Error: ${error}`]);
    };

    setWs(websocket);

    return () => websocket.close();
  }, []);

  return (
    <div style={{ background: '#000', color: '#fff', padding: '20px' }}>
      <h2>Direct WebSocket Test</h2>
      <pre>{messages.join('\n')}</pre>
    </div>
  );
};
```

This bypasses all Shelltender client code and tests raw WebSocket connectivity.

## Getting Help

If you're still stuck:
1. Run the debug script and share the output
2. Check browser console and share any errors
3. Share the Network tab WebSocket frames
4. Share `docker logs shelltender --tail 100`