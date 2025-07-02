#!/bin/bash

echo "Testing PocketDev Simple Server GitHub Integration"
echo "================================================="

# Test 1: Health check
echo -e "\n1. Testing health endpoint..."
curl -s http://localhost:3001/health | jq '.'

# Test 2: Get config
echo -e "\n2. Testing config endpoint..."
curl -s http://localhost:3001/api/config | jq '.'

# Test 3: Validate token (should fail with test token)
echo -e "\n3. Testing token validation..."
curl -s -X POST http://localhost:3001/api/github/validate \
  -H "Content-Type: application/json" \
  -d '{"token": "test-token"}' | jq '.'

# Test 4: Try to submit task without config (should fail)
echo -e "\n4. Testing task submission without GitHub config..."
curl -s -X POST http://localhost:3001/api/task \
  -H "Content-Type: application/json" \
  -d '{"task": "test task"}' | jq '.'

echo -e "\nTests complete!"