#\!/bin/bash

# Test script to verify split layout behavior
echo "Testing split layout CSS and transitions..."

# Check if containers are running
if \! docker ps | grep -q pocketdev-frontend; then
    echo "Starting development environment..."
    make dev &
    sleep 10
fi

echo "Development environment ready."
echo "Please test the following scenarios:"
echo ""
echo "1. Open a task with terminals"
echo "2. Press Alt+D to switch to vertical split (should appear instantly at 50/50)"
echo "3. Press Alt+D again to switch to horizontal split"
echo "   - Check if divider appears at bottom and animates up"
echo "   - Check if it reaches 50% position"
echo "4. Drag the divider to resize (should be smooth)"
echo "5. Double-click divider to reset to 50/50"
echo "6. Refresh the page and check if horizontal split appears correctly"
echo ""
echo "Frontend URL: http://localhost:5173"
