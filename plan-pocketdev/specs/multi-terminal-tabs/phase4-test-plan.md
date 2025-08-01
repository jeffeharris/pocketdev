# Phase 4 Test Plan - Advanced Session Launcher

## Overview
This test plan verifies the Advanced Session Launcher functionality that allows users to configure AI sessions with specific agents, working directories, and initial prompts.

## Test Environment
- Frontend running on http://localhost:5173
- Backend API on http://localhost:3005
- Shelltender on http://localhost:8080

## Test Cases

### TC1: Right-Click to Open Advanced Launcher
**Steps:**
1. Open a task
2. Right-click the plus button in the tab bar
3. Verify the SessionLauncher modal appears

**Expected:**
- Modal opens with session configuration options
- Shows AI agent dropdown, tab name, working directory, and prompt fields
- Template dropdown defaults to "Custom"

### TC2: Basic Session Launch with Custom Settings
**Steps:**
1. Right-click plus button to open launcher
2. Select "Aider" from AI agent dropdown
3. Enter "Feature Work" as tab name
4. Enter "src/components" as working directory
5. Enter "Help me refactor the user authentication flow" as initial prompt
6. Click "Launch Session"

**Expected:**
- New tab created with name "Feature Work"
- Terminal changes to src/components directory
- Aider launches with the provided prompt
- Yellow indicator shows during launch

### TC3: Launch Without Prompt
**Steps:**
1. Right-click plus button
2. Select "Gemini" as AI agent
3. Enter only tab name "Analysis"
4. Leave prompt empty
5. Click "Launch Session"

**Expected:**
- New tab "Analysis" created
- Gemini launches without a prompt
- Terminal stays in task root directory

### TC4: Testing Template
**Steps:**
1. Right-click plus button
2. Select "Testing" from template dropdown
3. Verify the preset prompt appears (read-only)
4. Click "Launch Session"

**Expected:**
- New tab created
- Claude launches with testing-focused prompt
- AI introduces itself as a test engineer

### TC5: Merge Resolution Template
**Steps:**
1. Right-click plus button
2. Select "Merge Resolution" template
3. Click "Launch Session"

**Expected:**
- Tab created with appropriate name
- Claude launches with merge conflict resolution prompt
- AI ready to help with git conflicts

### TC6: Planning Preset (Multiple Tabs)
**Steps:**
1. Right-click plus button
2. Select "Planning Preset" template
3. Notice the yellow info text about 3 tabs
4. Click "Launch 3 Tabs"

**Expected:**
- Three tabs created: "Requirements", "Design", "Tasks"
- Each tab launches Claude with its specific prompt
- Tabs created with slight delay between them
- Each AI session has appropriate context

### TC7: Working Directory Navigation
**Steps:**
1. Right-click plus button
2. Enter "backend/controllers" as working directory
3. Enter "Backend Debug" as tab name
4. Launch session

**Expected:**
- Terminal changes to backend/controllers
- Verify with `pwd` command
- AI launches in the correct directory

### TC8: Cancel Operation
**Steps:**
1. Right-click plus button
2. Fill in some fields
3. Click "Cancel" or press Escape

**Expected:**
- Modal closes
- No new tab created
- No changes to existing tabs

### TC9: Maximum Tabs Limit
**Steps:**
1. Create tabs until you have 6 total
2. Verify plus button is hidden
3. Close one tab
4. Verify plus button reappears

**Expected:**
- Cannot exceed 6 tabs
- UI properly shows/hides add button

### TC10: Special Characters in Prompt
**Steps:**
1. Right-click plus button
2. Enter prompt with special characters: `Analyze the "user's" data & escape $PATH variables`
3. Launch session

**Expected:**
- Prompt properly escaped
- AI receives the full prompt without shell interpretation issues
- No command injection possible

## Error Cases

### EC1: Invalid Working Directory
**Steps:**
1. Enter non-existent path like "foo/bar/baz"
2. Launch session

**Expected:**
- Terminal shows error when trying to change directory
- AI still launches in task root
- Tab remains functional

### EC2: Network Error During Launch
**Steps:**
1. Open launcher
2. Disconnect network/stop backend
3. Try to launch

**Expected:**
- Error message displayed
- Modal remains open for retry
- No broken tab created

## Performance Tests

### PT1: Rapid Multi-Tab Creation
**Steps:**
1. Use Planning Preset to create 3 tabs
2. Immediately create another single tab
3. Monitor all launches

**Expected:**
- All tabs created successfully
- No race conditions
- Each session independent

### PT2: Large Initial Prompt
**Steps:**
1. Enter a very long multi-line prompt (500+ characters)
2. Launch session

**Expected:**
- Prompt sent correctly
- No truncation
- AI receives full context

## Integration Tests

### IT1: Session Persistence Check
**Steps:**
1. Create advanced session with custom settings
2. Check database for correct fields
3. Refresh page
4. Verify tab name persists

**Expected:**
- Database stores: tab_name, ai_agent, initial_prompt metadata
- Tab restoration shows correct name (even if broken currently)

### IT2: WebSocket Command Execution
**Steps:**
1. Monitor browser console
2. Launch session with working directory
3. Watch WebSocket messages

**Expected:**
- See cd command sent via WebSocket
- See AI launch command sent
- Proper command sequencing

## Regression Tests

### RT1: Quick Launch Still Works
**Steps:**
1. Left-click plus button (don't right-click)
2. Verify Claude auto-launches

**Expected:**
- Same behavior as Phase 3
- No regression in quick launch
- Claude starts automatically

### RT2: Tab Switching During Launch
**Steps:**
1. Start advanced launch
2. While launching, switch to another tab
3. Switch back

**Expected:**
- Launch continues in background
- No errors or duplicates
- Terminal content preserved

## Known Issues to Note
- Tab persistence after refresh is broken (existing issue)
- Some AI agents (Codex, Gemini) may not be installed
- Working directory paths are relative to task root

## Success Criteria
- All basic test cases pass
- No regression in existing functionality
- Error cases handled gracefully
- UI remains responsive during launches