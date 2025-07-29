#!/bin/bash

# Test script for split layout API endpoints

BASE_URL="http://localhost:3005/api"

echo "Testing Split Layout API Endpoints"
echo "=================================="

# First, let's get the list of projects
echo -e "\n1. Getting projects..."
PROJECTS=$(curl -s "$BASE_URL/projects")
echo "Projects response: $PROJECTS"

# Extract first project ID (assumes jq is not available, using simple grep)
PROJECT_ID=$(echo "$PROJECTS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Using Project ID: $PROJECT_ID"

if [ -z "$PROJECT_ID" ]; then
    echo "No projects found. Please create a project first."
    exit 1
fi

# Get tasks for this project
echo -e "\n2. Getting tasks for project $PROJECT_ID..."
TASKS=$(curl -s "$BASE_URL/projects/$PROJECT_ID/tasks")
echo "Tasks response (first 200 chars): ${TASKS:0:200}..."

# Extract first task ID
TASK_ID=$(echo "$TASKS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Using Task ID: $TASK_ID"

if [ -z "$TASK_ID" ]; then
    echo "No tasks found. Please create a task first."
    exit 1
fi

# Test GET split layout (should return default)
echo -e "\n3. GET split layout for task $TASK_ID..."
LAYOUT=$(curl -s "$BASE_URL/projects/$PROJECT_ID/tasks/$TASK_ID/split-layout")
echo "Current layout: $LAYOUT"

# Test PUT split layout
echo -e "\n4. PUT split layout for task $TASK_ID..."
NEW_LAYOUT='{
  "mode": "split",
  "orientation": "horizontal",
  "primaryTerminalId": "term-1",
  "secondaryTerminalId": "term-2",
  "splitRatio": 0.6
}'
UPDATE_RESULT=$(curl -s -X PUT \
  -H "Content-Type: application/json" \
  -d "$NEW_LAYOUT" \
  "$BASE_URL/projects/$PROJECT_ID/tasks/$TASK_ID/split-layout")
echo "Update result: $UPDATE_RESULT"

# Verify the update
echo -e "\n5. GET split layout again to verify update..."
UPDATED_LAYOUT=$(curl -s "$BASE_URL/projects/$PROJECT_ID/tasks/$TASK_ID/split-layout")
echo "Updated layout: $UPDATED_LAYOUT"

# Test invalid split ratio
echo -e "\n6. Testing invalid split ratio..."
INVALID_LAYOUT='{
  "mode": "split",
  "splitRatio": 1.5
}'
INVALID_RESULT=$(curl -s -X PUT \
  -H "Content-Type: application/json" \
  -d "$INVALID_LAYOUT" \
  "$BASE_URL/projects/$PROJECT_ID/tasks/$TASK_ID/split-layout")
echo "Invalid ratio result: $INVALID_RESULT"

# Test invalid mode
echo -e "\n7. Testing invalid mode..."
INVALID_MODE='{
  "mode": "invalid-mode"
}'
INVALID_MODE_RESULT=$(curl -s -X PUT \
  -H "Content-Type: application/json" \
  -d "$INVALID_MODE" \
  "$BASE_URL/projects/$PROJECT_ID/tasks/$TASK_ID/split-layout")
echo "Invalid mode result: $INVALID_MODE_RESULT"

echo -e "\n=================================="
echo "Split Layout API Tests Complete"