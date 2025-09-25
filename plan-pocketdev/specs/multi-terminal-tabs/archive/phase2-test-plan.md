# Phase 2 Test Plan - Basic Tab UI

<!-- Document Metadata
Created: 2025-07-28
Modified: 2025-07-28
Status: ????
-->


## Test Environment Setup
1. Ensure all services are running: `make dev`
2. Open a project with at least one task
3. Navigate to a task workspace

## Test Cases

### 1. Initial Tab Creation ✅
- [ ] When opening a task with no terminals, first tab auto-creates
- [ ] Tab shows "Main" as default name
- [ ] Tab shows gray indicator (not-started state)
- [ ] Terminal connects and displays prompt

### 2. Adding New Tabs ✅
- [ ] Click plus button creates new tab
- [ ] New tab gets auto-numbered name (Tab 2, Tab 3, etc.)
- [ ] New tab becomes active immediately
- [ ] Each tab maintains independent terminal session

### 3. Tab Switching ✅
- [ ] Click on tab to switch between terminals
- [ ] Terminal content persists when switching away and back
- [ ] Active tab shows colored bottom border
- [ ] Only active terminal is visible

### 4. Tab Limit ✅
- [ ] Plus button disappears after 6 tabs
- [ ] Cannot create more than 6 tabs per task

### 5. State Indicators ✅
- [ ] Gray dot = no AI session (bash prompt)
- [ ] Blue dot = Claude idle
- [ ] Yellow dot = Claude working
- [ ] Purple dot = Claude waiting for input

### 6. Focus Management ✅
- [ ] Active terminal receives keyboard focus
- [ ] Focus transfers when switching tabs
- [ ] Focus returns after modal dialogs close

### 7. Persistence ✅
- [ ] Refresh page - tabs restore with same names
- [ ] Tab order preserved after refresh
- [ ] Active tab selection persists

## API Verification

### Create Terminal Session
```bash
curl -X POST http://localhost:3005/api/tasks/{taskId}/terminals \
  -H "Content-Type: application/json" \
  -d '{"tabName": "Test Tab", "aiAgent": "claude"}'
```

### Update Tab Name
```bash
curl -X PATCH http://localhost:3005/api/terminals/{dbSessionId}/tab \
  -H "Content-Type: application/json" \
  -d '{"tabName": "Renamed Tab"}'
```

## Known Issues / Next Steps
1. Tab renaming not yet implemented (double-click to rename)
2. Tab reordering not yet implemented (drag to reorder)
3. Close tab functionality not yet implemented
4. AI state not updating per-session yet (Phase 5)
5. Quick Claude launch not yet implemented (Phase 3)

## Visual Verification
- Tabs align properly with no visual glitches
- State colors match design (gray/blue/yellow/purple)
- Hover states work on inactive tabs
- Active tab indicator aligns with state color