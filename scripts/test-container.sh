#!/bin/bash

# Test script for containerized AI developers

API_URL="http://localhost:3001"

echo "🧪 Testing PocketDev Containerized AI Developers"
echo "================================================"

# Function to pretty print JSON
pretty_json() {
    echo "$1" | jq '.' 2>/dev/null || echo "$1"
}

# Check if server is running
echo -n "1. Checking if backend is running... "
if curl -s "$API_URL/api/debug" > /dev/null; then
    echo "✅"
else
    echo "❌"
    echo "   Please start the backend: cd local-backend && npm run dev"
    exit 1
fi

# Check Docker
echo -n "2. Checking Docker... "
if docker --version > /dev/null 2>&1; then
    echo "✅"
else
    echo "❌"
    echo "   Please install Docker"
    exit 1
fi

# Build image
echo "3. Building Docker image..."
response=$(curl -s -X POST "$API_URL/api/container/build-image")
echo "   Response: $(pretty_json "$response")"

# List engineers
echo -e "\n4. Available containerized engineers:"
engineers=$(curl -s "$API_URL/api/container/engineers")
echo "$engineers" | jq -r '.[] | "   - \(.id): \(.name) (\(.role)) - Status: \(.status)"'

# Simple test task
echo -e "\n5. Assigning a test task..."
echo "   This will create a simple Hello World file in a test repository"

task_payload='{
  "engineerId": "frontend-1",
  "repository": {
    "url": "https://github.com/octocat/Hello-World.git",
    "branch": "master"
  },
  "description": "Create a new file called hello-ai.js that exports a function returning Hello from AI",
  "acceptanceCriteria": [
    "File exports a function named greetFromAI",
    "Function returns the string Hello from AI Developer",
    "Include a comment with the current date"
  ],
  "testFramework": "jest",
  "model": "claude-3-5-sonnet-latest"
}'

echo "   Sending task..."
task_response=$(curl -s -X POST "$API_URL/api/container/assign-task" \
  -H "Content-Type: application/json" \
  -d "$task_payload")

if echo "$task_response" | jq -e '.success' > /dev/null 2>&1; then
    echo "   ✅ Task assigned successfully!"
    task_id=$(echo "$task_response" | jq -r '.task.id')
    echo "   Task ID: $task_id"
    
    # Poll for status
    echo -e "\n6. Monitoring task progress..."
    for i in {1..30}; do
        sleep 2
        engineer_status=$(curl -s "$API_URL/api/container/engineers/frontend-1")
        status=$(echo "$engineer_status" | jq -r '.status')
        current_task=$(echo "$engineer_status" | jq -r '.currentTaskDetails.status // "unknown"')
        
        echo -n "   Attempt $i/30: Engineer=$status, Task=$current_task"
        
        if [ "$status" == "idle" ] && [ "$current_task" == "unknown" ]; then
            echo " ✅ Complete!"
            break
        else
            echo " ⏳"
        fi
    done
    
    # Get final task details
    echo -e "\n7. Task Results:"
    task_details=$(curl -s "$API_URL/api/container/tasks/$task_id")
    
    if [ -n "$task_details" ]; then
        echo "   Status: $(echo "$task_details" | jq -r '.status')"
        echo "   Session ID: $(echo "$task_details" | jq -r '.sessionId // "N/A"')"
        echo "   PR URL: $(echo "$task_details" | jq -r '.prUrl // "N/A"')"
        echo "   Duration: $(echo "$task_details" | jq -r '.result.duration // 0')s"
        echo "   Cost: $$(echo "$task_details" | jq -r '.result.cost_usd // 0')"
        
        if [ "$(echo "$task_details" | jq -r '.status')" == "completed" ]; then
            echo -e "\n✅ Test completed successfully!"
        else
            echo -e "\n❌ Task failed. Check logs for details."
        fi
    fi
else
    echo "   ❌ Failed to assign task"
    echo "   Error: $(echo "$task_response" | jq -r '.error // "Unknown error"')"
    echo -e "\n   Make sure:"
    echo "   - ANTHROPIC_API_KEY is set in local-backend/.env"
    echo "   - Docker is running"
    echo "   - The backend server is running"
fi

echo -e "\n================================================"
echo "Next steps:"
echo "1. Try with your own repository"
echo "2. Check the PR link if the task succeeded"
echo "3. Monitor container logs: docker logs \$(docker ps -a -q -n 1)"
echo "4. View engineer history: curl $API_URL/api/container/engineers/frontend-1/history"