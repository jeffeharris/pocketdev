#!/bin/bash

# Simple test runner for Claude streaming experiments
echo "🧪 Running Claude Code SDK Streaming Tests"
echo "=========================================="

# Check if claude is available
if ! command -v claude &> /dev/null; then
    echo "❌ Error: 'claude' command not found"
    echo "Please ensure Claude Code is installed and in PATH"
    exit 1
fi

# Check API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ Error: ANTHROPIC_API_KEY environment variable not set"
    exit 1
fi

echo "✅ Claude Code found in PATH"
echo "✅ API key configured"
echo ""

# Create experiments directory if it doesn't exist
mkdir -p experiments

# Run the basic streaming test
echo "1️⃣ Running basic streaming test..."
echo "-----------------------------------"
node experiments/test-claude-streaming.js

echo ""
echo "Test completed! Check the output above for streaming format analysis."
echo ""
echo "To run more tests:"
echo "  - Mode comparison: node experiments/test-claude-modes.js"
echo "  - Integration demo: node experiments/claude-stream-integration.js"