# Quad View Layout Modes Design

## Overview

Quad view will support 3 layout modes with **equal-sized terminals** in each mode. No complex resizing - just clean, predictable layouts.

## Layout Modes

### 1. Standard Mode (With Sidebar & Header)
```
┌─────────────┬─────────────────────────────┐
│             │          Header             │
│   Sidebar   ├─────────────┬───────────────┤
│             │    Term 1   │    Term 2     │
│             ├─────────────┼───────────────┤
│             │    Term 3   │    Term 4     │
└─────────────┴─────────────┴───────────────┘
```
- Maintains normal app navigation
- Good for monitoring while navigating
- Minimum viewport: 1600x900px

### 2. Focus Mode (Header Only, No Sidebar)
```
┌───────────────────────────────────────────┐
│                 Header                    │
├─────────────────────┬─────────────────────┤
│       Term 1        │       Term 2        │
├─────────────────────┼─────────────────────┤
│       Term 3        │       Term 4        │
└─────────────────────┴─────────────────────┘
```
- More terminal space
- Header keeps context visible
- Minimum viewport: 1400x800px

### 3. Full Screen Mode (Terminals Only)
```
┌─────────────────────┬─────────────────────┐
│                     │                     │
│       Term 1        │       Term 2        │
│                     │                     │
├─────────────────────┼─────────────────────┤
│                     │                     │
│       Term 3        │       Term 4        │
│                     │                     │
└─────────────────────┴─────────────────────┘
```
- Maximum terminal real estate
- Escape or F11 to exit
- Minimum viewport: 1200x700px

## Implementation Details

### Data Model
```typescript
interface SplitLayoutConfig {
  mode: 'tab' | 'split-2' | 'split-4';
  
  // For split-4 only
  quadLayout?: 'standard' | 'focus' | 'fullscreen';
  
  // Existing fields for 2-way compatibility
  orientation: 'horizontal' | 'vertical';
  primaryTerminalId: string | null;
  secondaryTerminalId: string | null;
  splitRatio: number;
  
  // Additional for quad
  tertiaryTerminalId?: string | null;
  quaternaryTerminalId?: string | null;
}
```

### UI Controls

Leverage the existing terminal header controls:

```typescript
// Existing controls in terminal header (upper right)
<div className="flex gap-2">
  {/* Existing split view toggle - extend for quad */}
  <Button 
    onClick={cycleSplitMode} 
    title="Cycle split view (Alt+D)"
  >
    {getSplitIcon()} {/* Changes based on current mode */}
  </Button>
  
  {/* Existing sidebar toggle - already works! */}
  <Button 
    onClick={toggleSidebar}
    title="Toggle sidebar"
  >
    <SidebarIcon />
  </Button>
  
  {/* Existing fullscreen toggle - extend for true fullscreen */}
  <Button 
    onClick={toggleFullscreen}
    title="Toggle fullscreen"
  >
    <MaximizeIcon />
  </Button>
</div>
```

The split view button cycles through modes:
- Single (tab view)
- 2-way horizontal
- 2-way vertical  
- 4-way grid (if 4+ terminals available)

The existing sidebar and fullscreen buttons already provide the layout variations!

### Layout Implementation
```tsx
// TaskWorkspace.tsx modifications
const renderLayout = () => {
  if (layout.mode === 'split-4') {
    const quadContent = (
      <div className="grid grid-cols-2 grid-rows-2 h-full gap-1 bg-gray-900">
        <TerminalPane terminal={primaryTerminal} position="tl" />
        <TerminalPane terminal={secondaryTerminal} position="tr" />
        <TerminalPane terminal={tertiaryTerminal} position="bl" />
        <TerminalPane terminal={quaternaryTerminal} position="br" />
      </div>
    );
    
    switch (layout.quadLayout) {
      case 'fullscreen':
        return (
          <div className="fixed inset-0 z-50 bg-black">
            {quadContent}
            <button 
              className="absolute top-4 right-4 text-white/50 hover:text-white"
              onClick={exitFullscreen}
            >
              <X /> ESC
            </button>
          </div>
        );
        
      case 'focus':
        return (
          <div className="h-screen flex flex-col">
            <Header />
            {quadContent}
          </div>
        );
        
      case 'standard':
      default:
        return (
          <div className="flex h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
              <Header />
              {quadContent}
            </div>
          </div>
        );
    }
  }
  
  // Existing 2-way and tab logic...
};
```

### How It Works

1. **Split Mode Cycling** (Alt+D or button click):
   ```
   Tab → 2-Horizontal → 2-Vertical → 4-Grid → Tab
   ```

2. **Layout Variations** (using existing buttons):
   - **Sidebar Toggle**: Hide/show sidebar in any mode
   - **Fullscreen Toggle**: Enter/exit fullscreen in any mode

3. **Result**: 3 quad layouts without new shortcuts:
   - Quad + Sidebar + Header (default)
   - Quad + Header only (sidebar hidden)
   - Quad fullscreen (both hidden)

### Implementation Details

```typescript
// Extend existing cycleSplitMode function
const cycleSplitMode = () => {
  const modes = ['tab', 'split-2-h', 'split-2-v'];
  
  // Add quad if enough terminals
  if (terminals.length >= 4 && viewportSupportsQuad()) {
    modes.push('split-4');
  }
  
  const currentIndex = modes.indexOf(layout.mode);
  const nextIndex = (currentIndex + 1) % modes.length;
  setLayoutMode(modes[nextIndex]);
};

// Split icon changes based on mode
const getSplitIcon = () => {
  switch (layout.mode) {
    case 'tab': return <TabIcon />;
    case 'split-2-h': return <SplitHorizontalIcon />;
    case 'split-2-v': return <SplitVerticalIcon />;
    case 'split-4': return <Grid2x2Icon />;
  }
};
```

## Benefits of This Approach

1. **Predictable Layouts** - Users know exactly what they'll get
2. **No Resize Complexity** - Equal splits always
3. **Progressive Enhancement** - Start with standard, upgrade to focus/fullscreen as needed
4. **Context Preservation** - Standard mode keeps navigation available
5. **Quick Switching** - Keyboard shortcuts for each mode

## Viewport Handling

```typescript
const getAvailableQuadModes = () => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  const modes = [];
  
  if (width >= 1200 && height >= 700) {
    modes.push('fullscreen');
  }
  if (width >= 1400 && height >= 800) {
    modes.push('focus');
  }
  if (width >= 1600 && height >= 900) {
    modes.push('standard');
  }
  
  return modes;
};

// Auto-downgrade if viewport shrinks
useEffect(() => {
  const available = getAvailableQuadModes();
  if (layout.quadLayout && !available.includes(layout.quadLayout)) {
    // Downgrade to best available or exit quad
    if (available.length > 0) {
      setQuadLayout(available[0]);
    } else {
      setMode('split-2'); // Fall back to 2-way
    }
  }
}, [viewport]);
```

## Focus Management

Each terminal gets a position identifier:
- `tl` - Top Left
- `tr` - Top Right  
- `bl` - Bottom Left
- `br` - Bottom Right

Navigation follows reading order: TL → TR → BL → BR

## Migration Path

1. Ship 2-way split first (current work)
2. Add quad standard mode (test with sidebar)
3. Add focus mode (validate space gains)
4. Add full screen mode (maximum flexibility)
5. Gather feedback and refine

## Summary

This approach gives users exactly 3 predictable quad layouts:
- **Standard**: Normal app with 4 terminals
- **Focus**: More space without sidebar
- **Full Screen**: Maximum terminal space

No complex resizing, no confusion - just clean, equal splits that work.