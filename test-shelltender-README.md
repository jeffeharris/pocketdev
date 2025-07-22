# Shelltender Integration Test Tools

These test tools help debug the Shelltender integration and command execution issues.

## Test Tools

### 1. HTML Test Page (`test-shelltender-demo.html`)
A visual test interface that runs in the browser.

**How to use:**
1. Make sure PocketDev backend is running: `make dev`
2. Open the HTML file in a browser: `open test-shelltender-demo.html`
3. Use the buttons to test different operations:
   - Create Session
   - List Sessions
   - Execute Command
   - Launch Claude
   - Run Full Auto-Launch Sequence

### 2. Node.js Test Script (`test-shelltender-api.js`)
A command-line test script that runs all tests automatically.

**How to use:**
```bash
# Make sure backend is running first
make dev

# Run the test script
node test-shelltender-api.js
```

## What These Tests Do

1. **Session Creation**: Tests creating a new terminal session via the API
2. **Command Execution**: Tests sending commands to the terminal
3. **Claude Launch**: Tests the full auto-launch sequence:
   - Create session
   - Wait for terminal ready
   - Send newline to force prompt
   - Send claude command

## Debugging Steps

1. **Check if sessions are created**: 
   - Visit http://localhost:8080/admin to see Shelltender sessions
   - Look for sessions with IDs starting with "test-"

2. **Check if commands execute**:
   - Open the Shelltender UI and watch the terminal
   - Commands should appear when you run the tests

3. **Check console/logs**:
   - Browser console for the HTML test
   - Terminal output for the Node.js script
   - Backend logs: `make logs`

## Common Issues

1. **404 errors**: The endpoint might not exist or have a different path
2. **500 errors**: Backend might have an error - check logs
3. **No terminal output**: Commands might not be reaching Shelltender
4. **Claude doesn't start**: Timing issues or command format problems

## What Success Looks Like

When everything works correctly:
1. A new terminal session is created
2. The terminal shows a bash prompt
3. Commands appear in the terminal
4. Claude starts automatically and shows its welcome message