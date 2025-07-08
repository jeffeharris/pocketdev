# Shelltender v0.4.1 Upgrade Guide for Claude

This guide provides exact instructions for Claude to execute the Shelltender v0.4.1 upgrade autonomously. Every decision point has explicit criteria and exact code to implement.

## Pre-Upgrade Environment Check

Before starting the upgrade, Claude should verify:

```bash
# Check all prerequisites in parallel
pwd  # Should show /home/jeffh/projects/pocketdev/simple/frontend
git branch --show-current  # Note the current branch
git status --short  # Should be empty or only expected changes
grep "@shelltender/client" package.json | grep -o '"[^"]*"$'  # Should show "^0.3.0" or "^0.4.0"
ls -la src/components/terminal/  # Should show DirectTerminal.tsx and others
npm list @shelltender/client 2>/dev/null | grep @shelltender/client || echo "Not installed"
```

**Environment Checklist:**
- [ ] Current working directory is simple/frontend
- [ ] Note any uncommitted changes for later
- [ ] Current @shelltender/client version is 0.3.0 or 0.4.0
- [ ] DirectTerminal.tsx exists and has been read
- [ ] Node modules permissions are correct (not root-owned)

## Current Implementation Status

As of the last conversation:
- Using @shelltender/client v0.3.0 (attempting to upgrade to v0.4.0)
- Terminal component uses DirectTerminal.tsx wrapper
- Focus workarounds implemented but not working reliably
- Resize is "hit and miss" - sometimes works, sometimes doesn't
- Multiple terminals kept mounted but hidden with CSS

## Claude Tool Usage Pattern

Execute this upgrade using these specific tool patterns:

1. **Start with TodoWrite** - Create these 10 upgrade steps IMMEDIATELY:
   ```
   - Step 1: Check current implementation and version
   - Step 2: Update package.json to v0.4.1
   - Step 3: Install updated dependencies
   - Step 4: Update DirectTerminal component with new ref API
   - Step 5: Update TerminalPanel focus handling
   - Step 6: Update TaskWorkspace terminal integration
   - Step 7: Remove ShelltenderFrame and legacy code
   - Step 8: Test terminal focus functionality
   - Step 9: Test terminal resize functionality
   - Step 10: Commit changes with detailed message
   ```

   **Todo List Best Practices:**
   - Create the 10-step todo list immediately upon starting
   - Update status to "in_progress" BEFORE starting each step
   - Mark "completed" immediately after finishing
   - If a step fails, add a new todo for the fix before proceeding
   - Never batch todo updates - update immediately after each state change

2. **Use Read before Edit** - ALWAYS read files first:
   ```bash
   # Read all files that will be modified
   Read src/components/terminal/DirectTerminal.tsx
   Read src/components/terminal/TerminalPanel.tsx
   Read src/components/task/TaskWorkspace.tsx
   Read src/components/terminal/ShelltenderFrame.tsx
   Read package.json
   ```

3. **State tracking** - Initialize and maintain throughout:
   ```typescript
   // Claude: Initialize these at the start
   const upgradeState = {
     // Version Management
     CURRENT_VERSION: "",      // Set from package.json grep
     TARGET_VERSION: "0.4.1",  // Always v0.4.1 for this upgrade
     
     // Component Status
     COMPONENTS_TO_UPDATE: {
       "DirectTerminal": "pending",
       "TerminalPanel": "pending", 
       "TaskWorkspace": "pending",
       "ShelltenderFrame": "pending_removal"
     },
     
     // Test Results
     FOCUS_TEST: "not_tested",    // not_tested|working|failed
     RESIZE_TEST: "not_tested",   // not_tested|working|failed
     BUILD_STATUS: "not_run",     // not_run|success|failed
     
     // Issues Found
     TYPESCRIPT_ERRORS: [],
     IMPORT_ERRORS: [],
     RUNTIME_ERRORS: []
   };
   ```

## Claude Must NEVER

1. **NEVER use sudo for npm operations**
   - If permission denied, ask user to fix ownership

2. **NEVER skip reading files before editing**
   - Always use Read tool first, even if you think you know the content

3. **NEVER remove components before confirming they're unused**
   - Use Grep to find all imports before deletion

4. **NEVER commit if tests are failing**
   - Focus and resize must both work before committing

## When Claude Has Questions

### Decision Framework for Uncertainties

When encountering something not covered in this guide, follow this decision tree:

```
Uncertain Situation
├─ Is it a safety/destructive operation?
│  └─ YES → ALWAYS ASK (e.g., force push, delete files, npm publish)
├─ Does it match a known pattern with different names/paths?
│  └─ YES → Apply the pattern and note the adaptation
├─ Are there multiple valid approaches?
│  └─ YES → Choose the most conservative option and document why
├─ Is it a new error not in the guide?
│  └─ YES → Try standard recovery, then ask if that fails
└─ Is core functionality at risk?
   └─ YES → STOP and ask before proceeding
```

### What to Ask the User

When you need to ask for guidance, provide:

1. **Context** - What step you're on
2. **Specific Issue** - Exact error or uncertainty
3. **What You've Tried** - Any attempts made
4. **Options** - 2-3 possible approaches
5. **Recommendation** - Your suggested approach

**Template for Asking Questions:**
```
I'm on Step [X]: [Step name]

I encountered: [specific issue/uncertainty]

What I know:
- [Relevant fact 1]
- [Relevant fact 2]

Possible approaches:
1. [Option 1] - [pros/cons]
2. [Option 2] - [pros/cons]
3. Ask for different approach

I recommend Option [X] because [reasoning].

How would you like me to proceed?
```

### Common Uncertainty Scenarios

**Scenario: File structure is different**
```typescript
if (expectedFile !== foundFile) {
  // Try common variations
  const variations = [
    expectedFile.replace('components', 'src/components'),
    expectedFile.replace('.tsx', '.ts'),
    expectedFile.replace('terminal/', 'terminals/')
  ];
  
  // If found in variation, proceed with note
  // If not found, ask: "Expected [file] but found [structure]. Should I proceed with [found file]?"
}
```

**Scenario: Import has different name**
```typescript
// Expected: import { TerminalHandle } from '@shelltender/client'
// Found: import { TerminalRef } from '@shelltender/client'

// Response: "Found TerminalRef instead of TerminalHandle. This appears to be the same interface with a different name. Proceeding with TerminalRef."
```

**Scenario: Additional required props**
```typescript
// If Terminal component requires unexpected props
"The Terminal component requires a 'workspace' prop that wasn't in the guide. 
Looking at the types, it appears to expect: workspace: string
I'll use the worktreePath value we already have. Is this correct?"
```

**Scenario: Test results ambiguous**
```typescript
if (testResult === "sometimes works") {
  return `Focus works intermittently (3 out of 5 attempts succeeded).
  
  This could indicate:
  1. Timing issue - need longer delay
  2. Race condition - terminal not fully initialized
  3. Event handling issue - focus stolen by other component
  
  Should I:
  A) Increase the setTimeout delay to 200ms
  B) Add additional logging to diagnose
  C) Proceed as partially working
  
  Recommendation: Try option A first as it's least invasive.`;
}
```

### Information to Always Include When Stuck

1. **Current terminal output** - Last 10-20 relevant lines
2. **File being edited** - Full path and section
3. **Exact error message** - Not paraphrased
4. **What the guide says** - Quote the relevant section
5. **How reality differs** - Specific discrepancy

### When NOT to Ask

**Proceed without asking when:**
- Making non-destructive changes (adding console.log)
- Following established patterns with minor adaptations
- Error has a clear fix in the guide
- Change is easily reversible
- You're gathering more information

**Example of adapting without asking:**
```
"The guide mentions 'DirectTerminalHandle' but the actual export is 'DirectTerminalRef'. 
These appear to be the same interface. Proceeding with the actual export name."
```

## Step 1: Check Current Implementation

```bash
# Get current version and implementation details
echo "=== Current Shelltender Version ==="
grep "@shelltender/client" package.json | grep -o '"[^"]*"$' | tr -d '"'

echo -e "\n=== DirectTerminal Implementation ==="
grep -A 5 "useImperativeHandle\|Terminal component doesn't expose\|terminalRef" src/components/terminal/DirectTerminal.tsx || echo "No ref implementation found"

echo -e "\n=== Focus Workarounds ==="
grep -r "postMessage.*focus\|querySelector.*terminal\|contentWindow" src/components/terminal/ || echo "No focus workarounds found"

echo -e "\n=== Component Imports ==="
grep -r "from.*ShelltenderFrame\|from.*DirectTerminal" src/components/ | grep -v "\.tsx:" | sort -u
```

**Decision Tree:**
- If version < 0.4.0 → Proceed with upgrade
- If version = 0.4.0 → Only need 0.4.1 for focus() method
- If version = 0.4.1 → Skip to testing steps

## Step 2: Update package.json

```typescript
// Use MultiEdit to update version
// File: /home/jeffh/projects/pocketdev/simple/frontend/package.json
// Change: "@shelltender/client": "^0.3.0" → "@shelltender/client": "^0.4.1"
```

## Step 3: Install Dependencies

```bash
# Check node_modules ownership first
ls -ld node_modules 2>/dev/null | awk '{print $3, $4}'

# If owned by root, STOP and ask user to fix:
# "node_modules is owned by root. Please run: sudo chown -R $(whoami):$(whoami) node_modules"

# If ownership is correct or node_modules doesn't exist:
rm -rf node_modules package-lock.json
npm install

# Verify installation
npm list @shelltender/client | grep @shelltender/client
```

**NPM Install Decision Tree:**
```
npm install → Error?
  ├─ EACCES → "Permission denied. Please fix: sudo chown -R $(whoami) ."
  ├─ ERESOLVE → "Dependency conflict. Try: npm install --legacy-peer-deps"
  ├─ Network → Retry with: "npm install --verbose"
  └─ Success → Continue to Step 4
```

## Step 4: Update DirectTerminal Component

**EXACT CODE TO IMPLEMENT:**

```typescript
// File: /home/jeffh/projects/pocketdev/simple/frontend/src/components/terminal/DirectTerminal.tsx
// This is the COMPLETE updated component - replace the entire file

import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal, TerminalHandle, WebSocketProvider } from '@shelltender/client';

export type DirectTerminalHandle = {
  focus: () => void;
  fit: () => void;
};

interface DirectTerminalProps {
  taskId: string;
  sessionId?: string;
  className?: string;
  worktreePath?: string;
  isVisible?: boolean;
}

const DirectTerminalComponent = forwardRef<DirectTerminalHandle, DirectTerminalProps>(({ 
  taskId, 
  sessionId,
  className = '',
  worktreePath,
  isVisible = true
}, ref) => {
  const terminalSessionId = sessionId || `task-${taskId}`;
  const terminalRef = useRef<TerminalHandle>(null);

  // Expose both focus and fit methods to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      console.log('[DirectTerminal] Focus called for task:', taskId);
      if (terminalRef.current?.focus) {
        terminalRef.current.focus();
      } else {
        console.warn('[DirectTerminal] Terminal ref not available for focus');
      }
    },
    fit: () => {
      console.log('[DirectTerminal] Fit called for task:', taskId);
      if (terminalRef.current?.fit) {
        terminalRef.current.fit();
      } else {
        console.warn('[DirectTerminal] Terminal ref not available for fit');
      }
    }
  }), [taskId]);

  // Auto-fit when becoming visible
  useEffect(() => {
    if (isVisible && terminalRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        console.log('[DirectTerminal] Auto-fitting terminal for task:', taskId);
        terminalRef.current?.fit();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isVisible, taskId]);

  // Configure WebSocket URL to use our proxy
  const websocketUrl = window.location.protocol === 'https:' 
    ? `wss://${window.location.host}/shelltender-ws`
    : `ws://${window.location.host}/shelltender-ws`;

  console.log('[DirectTerminal] Rendering terminal for task:', taskId, 'sessionId:', terminalSessionId);

  return (
    <div className={`w-full h-full overflow-hidden ${className}`} style={{ display: isVisible ? 'block' : 'none' }}>
      <WebSocketProvider config={{ url: websocketUrl }}>
        <Terminal
          ref={terminalRef}
          sessionId={terminalSessionId}
          onSessionCreated={(newSessionId: string) => {
            console.log('[DirectTerminal] Session created:', newSessionId);
            // Auto-focus new terminals
            setTimeout(() => {
              terminalRef.current?.focus();
            }, 100);
          }}
          // New v0.4.0+ customization options
          fontSize={14}
          fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, Monaco, monospace"
          theme={{ 
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#ffffff',
            selection: '#3a3d41'
          }}
          padding={{ left: 12, right: 4 }}
          cursorStyle="block"
          cursorBlink={true}
          scrollback={10000}
          // Enable debug mode in development
          debug={process.env.NODE_ENV === 'development'}
        />
      </WebSocketProvider>
    </div>
  );
});

DirectTerminalComponent.displayName = 'DirectTerminal';

export const DirectTerminal = DirectTerminalComponent;
```

**TypeScript Error Handling:**
```typescript
// If TerminalHandle import fails:
if (error.includes("TerminalHandle")) {
  // Try alternative import
  return "Change import to: import { Terminal, WebSocketProvider } from '@shelltender/client';\n" +
         "And type terminalRef as: useRef<any>(null)";
}

// If debug prop error:
if (error.includes("debug")) {
  return "Remove the debug prop - it may not be available in this version";
}
```

## Step 5: Update TerminalPanel Component

**Find and update the focus handling code:**

```typescript
// File: src/components/terminal/TerminalPanel.tsx
// Find the selectTask or task selection handler

// LOOK FOR patterns like:
// - setSelectedTask(task)
// - setTimeout with focus
// - terminalRef.current?.focus

// REPLACE WITH:
const selectTask = useCallback((task: Task) => {
  setSelectedTask(task);
  
  // Use the new v0.4.1 API for focus and fit
  setTimeout(() => {
    const ref = terminalRefs.current.get(task.id);
    if (ref?.current) {
      ref.current.fit();    // Ensure proper sizing
      ref.current.focus();  // Focus the terminal
      console.log('[TerminalPanel] Focused terminal for task:', task.id);
    }
  }, 100);
}, []);

// Also update any useEffect that handles task changes:
useEffect(() => {
  if (selectedTask && terminalRefs.current.has(selectedTask.id)) {
    const ref = terminalRefs.current.get(selectedTask.id);
    setTimeout(() => {
      ref?.current?.fit();
      ref?.current?.focus();
    }, 100);
  }
}, [selectedTask?.id]);
```

## Step 6: Update TaskWorkspace Component

**Find and update terminal focus triggers:**

```typescript
// File: src/components/task/TaskWorkspace.tsx
// LOOK FOR: activeTab === 'terminal' or similar tab switching logic

// UPDATE useEffect for tab changes:
useEffect(() => {
  if (activeTab === 'terminal' && terminalRef.current) {
    // Small delay to ensure terminal is visible
    const timer = setTimeout(() => {
      console.log('[TaskWorkspace] Focusing terminal for task:', task.id);
      terminalRef.current?.fit();
      terminalRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }
}, [activeTab, task.id]);

// Also ensure DirectTerminal is imported:
// import { DirectTerminal } from '../terminal/DirectTerminal';
// NOT from ShelltenderFrame
```

## Step 7: Remove Legacy Components

**Pre-removal Safety Check:**
```bash
# Check all imports of ShelltenderFrame
echo "=== Checking ShelltenderFrame usage ==="
grep -r "ShelltenderFrame" src/ --include="*.tsx" --include="*.ts" | grep -v "ShelltenderFrame\.tsx"

# If no results (safe to remove):
rm -f src/components/terminal/ShelltenderFrame.tsx

# Check for any postMessage workarounds
echo -e "\n=== Checking for postMessage workarounds ==="
grep -r "postMessage.*focus" src/ || echo "No postMessage workarounds found"

# Remove legacy terminal HTML if it exists
if [ -f "shelltender-terminal.html" ]; then
  echo "Removing legacy shelltender-terminal.html"
  rm -f shelltender-terminal.html
fi
```

**Import Update Decision Tree:**
```
Found "from './ShelltenderFrame'" → Replace with "from './DirectTerminal'"
Found "from '../terminal/ShelltenderFrame'" → Replace with "from '../terminal/DirectTerminal'"
Found "<ShelltenderFrame" → Replace with "<DirectTerminal"
Found "ShelltenderFrameHandle" → Replace with "DirectTerminalHandle"
```

## Step 8: Build and Type Check

```bash
# Run TypeScript type checking
echo "=== Running TypeScript Check ==="
npm run type-check || npx tsc --noEmit

# Run build
echo -e "\n=== Running Build ==="
npm run build

# Check for specific errors
echo -e "\n=== Checking for Import Errors ==="
grep -E "Cannot find module|Module not found" build.log 2>/dev/null || echo "No import errors"
```

**Build Error Responses:**
```typescript
// Common errors and fixes
const buildErrorFixes = {
  "Cannot find module '@shelltender/client'": 
    "Run: npm install @shelltender/client@^0.4.1",
    
  "Property 'focus' does not exist": 
    "Ensure TerminalHandle is imported: import { TerminalHandle } from '@shelltender/client'",
    
  "Type 'MutableRefObject<any>' is not assignable":
    "Change ref type to: useRef<TerminalHandle>(null)",
    
  "No overload matches this call":
    "Remove any props that don't exist in v0.4.1 (like 'debug' if not supported)"
};
```

## Step 9: Manual Testing Protocol

**Claude Testing Instructions:**

```typescript
// Create a test results object to track
const testResults = {
  focusTest: {
    steps: [
      "1. Open browser DevTools Console",
      "2. Create or select a task",
      "3. Switch away from terminal tab",
      "4. Switch back to terminal tab",
      "5. Check console for '[DirectTerminal] Focus called'",
      "6. Type immediately - characters should appear"
    ],
    result: "", // "PASS" or "FAIL: reason"
    logs: []
  },
  resizeTest: {
    steps: [
      "1. Open terminal for a task",
      "2. Resize browser window smaller",
      "3. Terminal should adjust width automatically",
      "4. Resize browser window larger", 
      "5. Terminal should expand to fill space",
      "6. No scrollbars should appear"
    ],
    result: "", // "PASS" or "FAIL: reason"
    logs: []
  },
  multiTaskTest: {
    steps: [
      "1. Create two different tasks",
      "2. Open terminal for Task 1",
      "3. Type 'echo task1'",
      "4. Switch to Task 2",
      "5. Type 'echo task2'",
      "6. Switch back to Task 1",
      "7. Verify Task 1 terminal has focus and shows 'task1'"
    ],
    result: "", // "PASS" or "FAIL: reason"
    logs: []
  }
};

// Report results
console.log("TERMINAL UPGRADE TEST RESULTS:");
console.log("Focus Test:", testResults.focusTest.result);
console.log("Resize Test:", testResults.resizeTest.result);
console.log("Multi-Task Test:", testResults.multiTaskTest.result);
```

**Test Failure Decision Tree:**
```
Focus Test Failed?
├─ No console logs → Check if ref is properly connected
├─ Logs show but no focus → v0.4.1 may not be installed correctly
└─ Focus works intermittently → Increase setTimeout delay to 200ms

Resize Test Failed?
├─ No resize at all → Check if fit() method exists on ref
├─ Resize delayed → Normal, ResizeObserver has built-in debouncing
└─ Scrollbars appear → Container CSS may need overflow: hidden

Multi-Task Failed?
├─ Sessions mixed → Check sessionId uniqueness
├─ Focus not switching → Refs may not be properly mapped
└─ Content lost → Ensure terminals stay mounted (display: none)
```

## Step 10: Commit Changes

**Pre-commit Checklist:**
- [ ] All components updated and building
- [ ] No TypeScript errors
- [ ] Focus test passing
- [ ] Resize test passing
- [ ] ShelltenderFrame removed
- [ ] No console errors in browser

```bash
# Stage changes
git add -A

# Review changes
git status
git diff --staged --stat

# Commit with comprehensive message
git commit -m "feat: Upgrade to @shelltender/client v0.4.1 with native focus/resize support

- Updated DirectTerminal to use new TerminalHandle ref API
- Implemented proper focus() and fit() methods from v0.4.1
- Updated TerminalPanel and TaskWorkspace to use new API
- Removed ShelltenderFrame component and iframe workarounds
- Added terminal customization options (theme, font, padding)
- Auto-focus on new terminal creation
- Auto-fit when terminal becomes visible

Breaking changes: None - drop-in replacement with better performance

Testing notes:
- Terminal focus now works immediately when switching tasks
- Window resize automatically adjusts terminal size
- No more 'hit and miss' resize behavior

Fixes #[issue-number] - Terminal focus and resize issues

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Rollback Procedures

If upgrade fails at any stage:

### After npm install but before code changes:
```bash
# Revert package.json
git checkout -- package.json
rm -rf node_modules package-lock.json
npm install
```

### After code changes but before commit:
```bash
# Revert all changes
git checkout -- .
git clean -fd
```

### After commit but before push:
```bash
# Soft reset to keep changes but uncommit
git reset --soft HEAD~1

# Or hard reset to discard everything
git reset --hard HEAD~1
```

## Edge Cases and Workarounds

### Known Variations

1. **TypeScript strictness variations**
   - Some projects may have stricter TS configs
   - If `TerminalHandle` type errors occur, try: `useRef<any>(null)` with a note
   - Document any type assertions needed

2. **WebSocket URL variations**
   - Guide assumes `/shelltender-ws` proxy path
   - Check vite.config.ts for actual proxy configuration
   - Adapt if different but note the change

3. **Custom theme systems**
   - Some projects have theme contexts
   - Adapt the theme prop to use existing system
   - Example: `theme={useTheme().terminal}` instead of hardcoded

4. **Monorepo considerations**
   - Path might be `apps/frontend` instead of `simple/frontend`
   - Package might be in workspace root
   - Adapt paths but maintain same operations

### Recovery Procedures for Common Issues

**If focus still doesn't work after upgrade:**
```typescript
// Add diagnostic logging
const debugFocus = () => {
  console.log('Terminal ref exists:', !!terminalRef.current);
  console.log('Focus method exists:', !!terminalRef.current?.focus);
  console.log('Terminal visible:', isVisible);
  console.log('Parent container:', terminalRef.current?.closest('.terminal-container'));
};

// Hypothesis: "Focus might be called before terminal is ready"
// Test: Add longer delay or retry mechanism
```

**If resize works but shows scrollbars:**
```css
/* Add to parent container */
.terminal-container {
  overflow: hidden !important;
  position: relative;
}

/* Ensure terminal fills container */
.xterm-screen {
  width: 100% !important;
  height: 100% !important;
}
```

## Success Criteria Checklist

Claude should verify ALL items before declaring success:

```typescript
const successCriteria = {
  installation: {
    check: "npm list @shelltender/client | grep 0.4.1",
    expected: "@shelltender/client@0.4.1"
  },
  imports: {
    check: "grep -r 'from.*ShelltenderFrame' src/ || echo 'PASS'",
    expected: "PASS"
  },
  typescript: {
    check: "npm run type-check 2>&1 | grep -E 'error|Error' || echo 'PASS'",
    expected: "PASS"
  },
  build: {
    check: "npm run build 2>&1 | grep -E 'failed|Failed' || echo 'PASS'",
    expected: "PASS"
  },
  focusLogs: {
    check: "Manual test - see console for 'Focus called'",
    expected: "Logs appear when switching tasks"
  },
  resizeBehavior: {
    check: "Manual test - resize window",
    expected: "Terminal adjusts automatically"
  }
};

// Final verification command
Object.entries(successCriteria).forEach(([test, config]) => {
  console.log(`${test}: ${config.check}`);
  // Execute and compare with expected
});
```

## Communication Templates for Claude

### Starting the upgrade:
```
I'll upgrade your Shelltender client to v0.4.1 to fix the focus and resize issues. Let me start by checking your current setup.

[Run environment checks]

Current status:
- Version: [current version]
- Components using terminals: [list]
- Legacy code found: [yes/no]

I'll now proceed with the upgrade following these steps:
[List the 10 steps]
```

### When the guide doesn't match reality:
```
I notice a discrepancy from the upgrade guide:

Guide expects: [what guide says]
Actual found: [what you found]

This appears to be [your analysis].

I'll proceed by [your approach] because [reasoning].
```

### When encountering errors:
```
I encountered an issue during [step name]:

Error: [exact error message]

This appears to be [diagnosis]. 

To fix this, I recommend:
[Specific action]

Shall I proceed with this fix?
```

### On successful completion:
```
✅ Shelltender v0.4.1 upgrade completed successfully!

Changes made:
- Updated from v[old] to v0.4.1
- Replaced [X] components with new ref API
- Removed [Y] legacy workarounds
- Added terminal customization

Test results:
- Focus: ✅ Working immediately on task switch
- Resize: ✅ Automatic adjustment with window
- Multi-task: ✅ Proper session isolation

The terminal should now:
1. Focus immediately when switching tasks
2. Resize automatically with the window
3. No more "hit and miss" behavior

Try switching between tasks - you should be able to type immediately!
```

## Quick Reference Commands

```bash
# One-line upgrade status check
echo "Version: $(grep '@shelltender/client' package.json | grep -o '"[^"]*"$'), DirectTerminal: $(grep -c 'TerminalHandle' src/components/terminal/DirectTerminal.tsx 2>/dev/null || echo 0), Legacy: $(find src -name 'ShelltenderFrame.tsx' 2>/dev/null | wc -l)"

# Quick test command
echo -e "1. Switch tasks\n2. Check focus in console\n3. Resize window\n4. Check terminal adjusts" > test-steps.txt && cat test-steps.txt

# Check for edge cases not in guide
find . -name "*.tsx" -newer package.json | head -5  # Recently modified files
git log --oneline -5 --grep="terminal\|focus\|resize"  # Recent related commits
grep -r "FIXME\|HACK\|WARNING" src/components/terminal/  # Known issues

# Verify all imports updated
find src -name "*.tsx" -exec grep -l "ShelltenderFrame\|DirectTerminal" {} \; | xargs grep -h "from.*terminal" | sort -u

# Check for any remaining TODOs or workarounds
grep -r "TODO.*focus\|WORKAROUND\|postMessage" src/components/terminal/ || echo "No workarounds found"
```