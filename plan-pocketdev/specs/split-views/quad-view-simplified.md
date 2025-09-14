# Quad View Implementation Plan (Simplified)

<!-- Document Metadata
Created: 2025-07-30
Modified: 2025-07-30
Status: ????
-->


## Performance ✅ Already Validated
- Tested with 2000 lines/minute across 4 terminals
- Performance is not a blocker

## Practical Implementation Approach

### 1. Data Model Extension
Current 2-way model can be extended simply:
```typescript
interface SplitLayoutConfig {
  mode: 'tab' | 'split-2' | 'split-4';
  orientation: 'horizontal' | 'vertical' | 'grid';  // Add 'grid'
  
  // Keep existing for backwards compatibility
  primaryTerminalId: string | null;
  secondaryTerminalId: string | null;
  
  // Add for quad view
  tertiaryTerminalId?: string | null;
  quaternaryTerminalId?: string | null;
  
  splitRatio: number;  // For 2-way
  verticalRatio?: number;  // For quad (horizontal split of each column)
}
```

### 2. Full Screen Mode for Quad View
Good idea! This simplifies many concerns:
- Removes sidebar competition for space
- Maximizes terminal real estate
- Clear visual mode distinction
- Easy escape back to normal view

### 3. Activation Conditions
```typescript
const canEnableQuadView = () => {
  return (
    terminals.length >= 4 &&
    window.innerWidth >= 1400 &&  // Reasonable minimum
    window.innerHeight >= 800 &&   // Need vertical space too
    !isMobile                      // Never on mobile
  );
};
```

### 4. Simple Grid Layout
Equal quadrants approach (no complex resizing):
```
┌─────────────┬─────────────┐
│      TL     │     TR      │
│             │             │
├─────────────┼─────────────┤
│      BL     │     BR      │
│             │             │
└─────────────┴─────────────┘
```

### 5. Focus Navigation
Simple clockwise pattern:
- Tab: Next terminal (TL → TR → BR → BL → TL)
- Shift+Tab: Previous terminal
- Arrow keys: Spatial navigation (optional enhancement)

### 6. Implementation Steps

#### Step 1: Add Grid Layout Mode
```tsx
// In SplitViewContainer
if (layout.mode === 'split-4') {
  return (
    <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
      {[primaryTerminal, secondaryTerminal, tertiaryTerminal, quaternaryTerminal].map((terminal, index) => (
        <div key={terminal?.dbSessionId} className="overflow-hidden">
          {terminal && <DirectTerminal ... />}
        </div>
      ))}
    </div>
  );
}
```

#### Step 2: Add Full Screen Toggle
```tsx
// New button in terminal controls
<button onClick={toggleFullScreen} title="Full screen quad view">
  <Maximize2 />
</button>
```

#### Step 3: Update Controls
- Add "Quad View" button (only shown when 4+ terminals available)
- Disable on small viewports
- Auto-exit quad if viewport shrinks

### 7. Simplified UX
- No resizing in quad mode (equal quadrants)
- Click to focus (current pattern works)
- Double-click to temporarily maximize a quadrant
- Esc to exit full screen mode

### 8. Quick Wins
1. Reuse all existing terminal management code
2. Grid CSS handles layout automatically
3. No complex resize logic needed
4. Full screen removes space constraints

## Migration Path
1. Ship 2-way split first
2. Add quad as experimental feature flag
3. Gather feedback from power users
4. Refine and ship to all

## Minimal Additional Complexity
- Just another layout mode
- CSS Grid does the heavy lifting
- No new resize handlers
- Focus management extends existing pattern

This is indeed not rocket science - just a grid of 4 terminals with sensible constraints!