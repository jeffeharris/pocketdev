# Future Enhancement: Split Views for Multi-Terminal Sessions

<!-- Document Metadata
Created: 2025-07-28
Modified: 2025-07-28
Status: ????
-->


## Vision

Enable developers to view multiple terminal sessions simultaneously within a single task, similar to tmux or VS Code's split terminal functionality.

## Proposed Features

### 1. Basic Split Layouts
- **Horizontal Split**: Two terminals stacked vertically
- **Vertical Split**: Two terminals side by side  
- **Quad View**: Four equal terminals in a 2x2 grid
- **Custom Layouts**: User-defined split configurations

### 2. Cross-Project Sessions
- Ability to add terminal sessions from other projects/tasks
- "Pin" a reference terminal while working in another
- Compare implementations across projects
- Share context between related tasks

### 3. Picture-in-Picture (PiP)
- Float one terminal over another
- Monitoring mode for long-running processes
- Adjustable size and position
- Toggle between PiP and full view

## Technical Considerations

### UI Architecture
```typescript
interface SplitLayout {
  type: 'single' | 'horizontal' | 'vertical' | 'quad' | 'custom';
  panels: PanelConfig[];
}

interface PanelConfig {
  sessionId: string;
  projectId?: string; // for cross-project
  size: { width: string; height: string };
  position: { x: number; y: number };
}
```

### Implementation Challenges

1. **Terminal Focus Management**
   - Multiple xterm.js instances need careful focus handling
   - Keyboard shortcuts must route to active terminal
   - Click-to-focus vs follow-mouse considerations

2. **Performance**
   - Rendering 4+ terminals simultaneously
   - WebSocket connection management
   - Memory usage with multiple PTY processes

3. **Cross-Project Complexity**
   - Different git repositories
   - Separate worktree contexts
   - Permission boundaries
   - State synchronization

4. **Responsive Design**
   - **Mobile**: Splits disabled entirely - tabs only
   - **Tablet**: Horizontal split only (maybe)
   - **Desktop**: Full split functionality
   - Auto-collapse to tabs when viewport shrinks

## Incremental Implementation Path

### Phase 1: Simple Split View (Within Task)
- Add split button to tab bar
- Support horizontal/vertical split only
- Both terminals from same task
- Basic resize divider

### Phase 2: Advanced Layouts
- Quad view option
- Customizable split ratios
- Save/restore layouts
- Keyboard shortcuts for split management

### Phase 3: Cross-Project Support
- "Import terminal from task" feature
- Handle different working directories
- Secure session isolation
- Visual indicators for project boundaries

### Phase 4: Picture-in-Picture
- Floating terminal windows
- Drag to reposition
- Minimize to corner
- Full-screen toggle

## User Experience Considerations

### Visual Design
```
┌─────────────────────────────────────┐
│ [Tab 1] [Tab 2] [Tab 3] [+] [⊞][⊟] │ <- Split controls
├─────────────────┬───────────────────┤
│                 │                   │
│   Terminal 1    │   Terminal 2      │
│   (Active)      │                   │
│                 │                   │
├─────────────────┼───────────────────┤
│                 │                   │
│   Terminal 3    │   Terminal 4      │
│                 │                   │
└─────────────────┴───────────────────┘
```

### Interaction Patterns
- Drag borders to resize
- Double-click border to equalize
- Ctrl+Shift+Arrow to move focus
- Right-click for split options

## Benefits

1. **Parallel Monitoring**: Watch tests while coding
2. **Reference Implementation**: Keep example visible
3. **Multi-Agent Coordination**: See multiple AIs working
4. **Cross-Project Learning**: Compare approaches

## Mobile Considerations

### Why No Splits on Mobile

1. **Keyboard Space**: Virtual keyboard takes 40-50% of screen
2. **Terminal Readability**: Split terminals would be too small
3. **Touch Targets**: Difficult to select correct terminal
4. **Context Switching**: Tabs are more natural on mobile
5. **Performance**: Multiple active terminals drain battery

### Mobile-First Tab Experience
- Swipe gestures to switch tabs
- Compact tab indicators
- Full-screen terminal per tab
- Quick tab switcher overlay

## Risks & Mitigation

1. **Complexity Overload**
   - Start with simple 2-panel split
   - Hide advanced features behind menu

2. **Performance Issues**
   - Lazy render inactive terminals
   - Throttle updates for unfocused panels

3. **User Confusion**
   - Clear visual boundaries
   - Prominent project indicators
   - Focus highlighting

## Recommendation

Implement after multi-tab support is stable and well-tested. Start with simple two-panel splits within a single task. Gauge user interest before investing in cross-project or PiP features.

Priority: **Medium** - Nice to have but not essential for multi-session workflow.