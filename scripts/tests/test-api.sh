#!/bin/bash

# Test script for PocketDev API endpoints
# This tests both existing and new endpoints

API_URL="http://localhost:3005/api"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Testing PocketDev API Endpoints${NC}"
echo "================================"

# Test health
echo -e "\n${YELLOW}1. Health Check${NC}"
curl -s $API_URL/health | jq . || echo -e "${RED}Backend not running!${NC}"

# Get projects
echo -e "\n${YELLOW}2. Projects${NC}"
PROJECTS=$(curl -s $API_URL/projects)
echo "$PROJECTS" | jq . || echo -e "${RED}Failed to get projects${NC}"

# Get first project ID
PROJECT_ID=$(echo "$PROJECTS" | jq -r '.[0].id' 2>/dev/null)

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "null" ]; then
    echo -e "${RED}No projects found. Please create a project first.${NC}"
    exit 1
fi

echo -e "\n${GREEN}Using Project ID: $PROJECT_ID${NC}"

# Get tasks
echo -e "\n${YELLOW}3. Tasks for Project${NC}"
TASKS=$(curl -s $API_URL/projects/$PROJECT_ID/tasks)
echo "$TASKS" | jq . || echo -e "${RED}Failed to get tasks${NC}"

# Get first task ID
TASK_ID=$(echo "$TASKS" | jq -r '.[0].id' 2>/dev/null)

if [ -z "$TASK_ID" ] || [ "$TASK_ID" = "null" ]; then
    echo -e "${RED}No tasks found. Please create a task first.${NC}"
    exit 1
fi

echo -e "\n${GREEN}Using Task ID: $TASK_ID${NC}"

# Test new endpoints
echo -e "\n${YELLOW}4. Git Status (New Endpoint)${NC}"
curl -s $API_URL/projects/$PROJECT_ID/tasks/$TASK_ID/git/status | jq . || echo -e "${RED}Git status endpoint failed${NC}"

echo -e "\n${YELLOW}5. Changed Files (New Endpoint)${NC}"
curl -s $API_URL/projects/$PROJECT_ID/tasks/$TASK_ID/files/changed | jq . || echo -e "${RED}Changed files endpoint failed${NC}"

echo -e "\n${YELLOW}6. Check Conflicts (New Endpoint)${NC}"
curl -s $API_URL/projects/$PROJECT_ID/tasks/$TASK_ID/git/check-conflicts | jq . || echo -e "${RED}Check conflicts endpoint failed${NC}"

echo -e "\n${YELLOW}7. Container Services (Placeholder)${NC}"
curl -s $API_URL/projects/$PROJECT_ID/tasks/$TASK_ID/services | jq . || echo -e "${RED}Services endpoint failed${NC}"

echo -e "\n${GREEN}✅ API Test Complete${NC}"