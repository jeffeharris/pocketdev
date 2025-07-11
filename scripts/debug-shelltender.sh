#!/bin/bash

echo "=== Shelltender Debug Script ==="
echo "Running diagnostics to identify terminal session issues..."
echo

# 1. Check if containers are running
echo "1. Checking Docker containers..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(shelltender|frontend|backend)" || echo "No relevant containers found"
echo

# 2. Check Shelltender health
echo "2. Checking Shelltender health endpoint..."
curl -s http://localhost:8080/api/health | jq . || echo "Failed to reach Shelltender on port 8080"
echo

# 3. List active sessions
echo "3. Listing active sessions..."
curl -s http://localhost:8080/api/sessions | jq . || echo "Failed to list sessions"
echo

# 4. Test WebSocket connection directly
echo "4. Testing direct WebSocket connection..."
timeout 2 websocat ws://localhost:8080/ws -t <<< '{"type":"ping"}' 2>&1 | head -5 || echo "Direct WebSocket test failed (websocat not installed or connection failed)"
echo

# 5. Check Vite proxy
echo "5. Checking if frontend is running..."
curl -s http://localhost:5173/ > /dev/null && echo "Frontend is accessible on port 5173" || echo "Frontend not accessible"
echo

# 6. Check logs
echo "6. Recent Shelltender logs:"
docker logs shelltender --tail 20 2>&1 | grep -E "(WebSocket|WS|Error|connected|session)" || echo "No logs found"
echo

# 7. Test session creation via API
echo "7. Testing session creation via API..."
curl -X POST http://localhost:8080/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-session-'$(date +%s)'"}' \
  | jq . || echo "Failed to create session via API"
echo

# 8. Network connectivity between containers
echo "8. Checking container network..."
docker network ls | grep pocketdev-network || echo "pocketdev-network not found"
echo

# 9. Test from inside frontend container
echo "9. Testing connectivity from frontend container to shelltender..."
docker exec pocketdev-frontend sh -c "wget -qO- http://shelltender:8080/api/health" | jq . || echo "Frontend cannot reach Shelltender"
echo

echo "=== Diagnostics Complete ==="
echo
echo "Common issues to check:"
echo "1. Is shelltender container running? Check with: docker ps"
echo "2. Is port 8080 accessible? Check firewall/Docker settings"
echo "3. Are containers on the same network? They should be on 'pocketdev-network'"
echo "4. Check browser console for WebSocket errors (F12 > Console)"
echo "5. Check browser Network tab for WebSocket connections (F12 > Network > WS)"