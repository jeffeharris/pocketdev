#!/bin/bash

# Cleanup script for archived tasks - can be run as a cron job
# Usage: ./cleanup-archived.sh [days] [--execute]
# Default: dry run for items older than 30 days

DAYS_OLD=${1:-30}
EXECUTE=false

# Check for --execute flag
if [[ "$2" == "--execute" ]] || [[ "$1" == "--execute" ]]; then
    EXECUTE=true
fi

API_URL="http://localhost:3005/api"

echo "🧹 PocketDev Archive Cleanup"
echo "==========================="
echo ""
echo "Checking for archived items older than $DAYS_OLD days..."
echo ""

# First, get list of archived items
ARCHIVED=$(curl -s "$API_URL/archived" 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ Error: Could not connect to API. Is the project manager running?"
    exit 1
fi

# Parse the response
TOTAL_ITEMS=$(echo "$ARCHIVED" | jq '.archived | length')
TOTAL_SIZE=$(echo "$ARCHIVED" | jq '.totalSize')

if [ "$TOTAL_ITEMS" -eq 0 ]; then
    echo "✅ No archived items found. Nothing to clean up!"
    exit 0
fi

echo "📊 Archive Status:"
echo "  - Total archived items: $TOTAL_ITEMS"
echo "  - Total size: $(numfmt --to=iec-i --suffix=B $TOTAL_SIZE 2>/dev/null || echo "$TOTAL_SIZE bytes")"
echo ""

# Show items that would be cleaned
OLD_ITEMS=$(echo "$ARCHIVED" | jq --arg days "$DAYS_OLD" '.archived[] | select(.daysOld >= ($days | tonumber))')

if [ -z "$OLD_ITEMS" ]; then
    echo "✅ No items older than $DAYS_OLD days. Nothing to clean up!"
    exit 0
fi

echo "Items older than $DAYS_OLD days:"
echo "$OLD_ITEMS" | jq -r '. | "  - \(.path | split("/") | last) (archived \(.daysOld) days ago, \(.size) bytes)"'
echo ""

# Perform cleanup
if [ "$EXECUTE" = true ]; then
    echo "🗑️  Executing cleanup..."
    
    RESULT=$(curl -s -X POST "$API_URL/cleanup" \
        -H "Content-Type: application/json" \
        -d "{\"daysOld\": $DAYS_OLD, \"dryRun\": false}")
    
    CLEANED=$(echo "$RESULT" | jq '.cleaned')
    FREED=$(echo "$RESULT" | jq '.totalFreed')
    
    echo ""
    echo "✅ Cleanup complete!"
    echo "  - Items removed: $CLEANED"
    echo "  - Space freed: $(numfmt --to=iec-i --suffix=B $FREED 2>/dev/null || echo "$FREED bytes")"
else
    echo "🔍 DRY RUN - No files will be deleted"
    
    RESULT=$(curl -s -X POST "$API_URL/cleanup" \
        -H "Content-Type: application/json" \
        -d "{\"daysOld\": $DAYS_OLD, \"dryRun\": true}")
    
    WOULD_CLEAN=$(echo "$RESULT" | jq '.cleaned')
    WOULD_FREE=$(echo "$RESULT" | jq '.totalFreed')
    
    echo ""
    echo "Would clean:"
    echo "  - Items: $WOULD_CLEAN"
    echo "  - Space: $(numfmt --to=iec-i --suffix=B $WOULD_FREE 2>/dev/null || echo "$WOULD_FREE bytes")"
    echo ""
    echo "To execute cleanup, run: $0 $DAYS_OLD --execute"
fi

echo ""
echo "💡 Tip: Add this to crontab for automatic cleanup:"
echo "   0 2 * * * $PWD/$0 30 --execute >> /var/log/pocketdev-cleanup.log 2>&1"