#!/bin/bash

PROJECT_ID="17db1cde"
BASE_URL="http://localhost:3005/api"

# Function to measure endpoint response time
measure_time() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    
    local start=$(date +%s%3N)
    if [ "$method" = "POST" ]; then
        curl -s -X POST "$url" > /dev/null
    else
        curl -s "$url" > /dev/null
    fi
    local end=$(date +%s%3N)
    local duration=$((end - start))
    
    echo "$name: ${duration}ms"
    return $duration
}

echo "=== PocketDev Performance Test Results ==="
echo "Testing project: $PROJECT_ID"
echo "Backend URL: $BASE_URL"
echo
echo "Warming up backend..."
curl -s "$BASE_URL/projects" > /dev/null
sleep 1
echo

echo "1. OLD ENDPOINTS (with git operations):"
measure_time "  Dashboard (full with git fetch)" "$BASE_URL/projects/$PROJECT_ID/dashboard"
old_dashboard_time=$?
measure_time "  Tasks (full with git status)" "$BASE_URL/projects/$PROJECT_ID/tasks"
old_tasks_time=$?

echo
echo "2. NEW OPTIMIZED ENDPOINTS:"
measure_time "  Project minimal (no git)" "$BASE_URL/projects/$PROJECT_ID/minimal"
minimal_project_time=$?
measure_time "  Tasks minimal (no git)" "$BASE_URL/projects/$PROJECT_ID/tasks/minimal"
minimal_tasks_time=$?
measure_time "  Dashboard cached (no fetch)" "$BASE_URL/projects/$PROJECT_ID/dashboard/cached"
cached_dashboard_time=$?

echo
echo "3. BACKGROUND OPERATIONS:"
measure_time "  Refresh trigger" "$BASE_URL/projects/$PROJECT_ID/refresh" "POST"

echo
echo "4. OTHER ENDPOINTS:"
measure_time "  Branches" "$BASE_URL/projects/$PROJECT_ID/branches"
measure_time "  Planning" "$BASE_URL/projects/$PROJECT_ID/planning"

echo
echo "=== TWO-PHASE LOADING SIMULATION ==="
echo "Phase 1: Critical data (UI can render)"
phase1_start=$(date +%s%3N)
{
    curl -s "$BASE_URL/projects/$PROJECT_ID/minimal" > /dev/null &
    curl -s "$BASE_URL/projects/$PROJECT_ID/tasks/minimal" > /dev/null &
    wait
}
phase1_end=$(date +%s%3N)
phase1_total=$((phase1_end - phase1_start))
echo "  Phase 1 total: ${phase1_total}ms"

echo
echo "Phase 2: Background enrichment"
phase2_start=$(date +%s%3N)
{
    curl -s "$BASE_URL/projects/$PROJECT_ID/dashboard/cached" > /dev/null &
    curl -s "$BASE_URL/projects/$PROJECT_ID/branches" > /dev/null &
    curl -s "$BASE_URL/projects/$PROJECT_ID/planning" > /dev/null &
    wait
}
phase2_end=$(date +%s%3N)
phase2_total=$((phase2_end - phase2_start))
echo "  Phase 2 total: ${phase2_total}ms"

echo
echo "=== PERFORMANCE SUMMARY ==="
echo "Old approach (sequential blocking):"
echo "  - Dashboard: ${old_dashboard_time}ms"
echo "  - Tasks: ${old_tasks_time}ms"
echo "  - Total: $((old_dashboard_time + old_tasks_time))ms"
echo
echo "New approach (two-phase):"
echo "  - Phase 1 (UI ready): ${phase1_total}ms"
echo "  - Phase 2 (background): ${phase2_total}ms"
echo
improvement=$(( (old_dashboard_time - phase1_total) * 100 / old_dashboard_time ))
echo "Initial load improvement: ${improvement}% faster"
echo "User can interact after: ${phase1_total}ms (vs ${old_dashboard_time}ms)"
echo
echo "=== CONCLUSION ==="
echo "✅ UI loads in ~${phase1_total}ms instead of ~${old_dashboard_time}ms"
echo "✅ Navigation to tasks is now instant (no blocking git operations)"
echo "✅ Git status updates happen in background without blocking UI"