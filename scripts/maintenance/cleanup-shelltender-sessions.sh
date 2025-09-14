#!/bin/bash

echo "🧹 Cleaning up orphaned Shelltender sessions..."
echo ""

# Get all Shelltender sessions
SESSIONS=$(curl -s http://localhost:8080/api/sessions | jq -r '.[].id')
SESSION_COUNT=$(echo "$SESSIONS" | wc -l)

echo "Found $SESSION_COUNT sessions in Shelltender"
echo ""

# Check each session against the database
ORPHANED_COUNT=0
for session_id in $SESSIONS; do
  # Check if session exists in database
  EXISTS=$(docker exec backend sh -c "cd /app && grep -q '$session_id' data/pocketdev.db && echo 'yes' || echo 'no'" 2>/dev/null)
  
  if [ "$EXISTS" != "yes" ]; then
    echo "❌ Orphaned session: $session_id"
    # Terminate the session
    curl -s -X DELETE "http://localhost:8080/api/sessions/$session_id" > /dev/null
    if [ $? -eq 0 ]; then
      echo "   ✅ Terminated"
    else
      echo "   ⚠️  Failed to terminate"
    fi
    ((ORPHANED_COUNT++))
  fi
done

echo ""
if [ $ORPHANED_COUNT -eq 0 ]; then
  echo "✅ No orphaned sessions found!"
else
  echo "🗑️  Cleaned up $ORPHANED_COUNT orphaned sessions"
fi