# Split Views: Risk Analysis & Viability Testing Plan

## Critical Risks Identified

### 1. 🔴 **Performance Collapse with Multiple xterm.js Instances**
**Risk**: Running 4 concurrent xterm.js instances with active output streams could cause:
- Browser tab freezing
- Excessive memory usage (>1GB)
- CPU throttling
- Degraded user experience

**Impact**: CRITICAL - Feature becomes unusable

### 2. 🔴 **WebSocket Connection Limits**
**Risk**: Each terminal has its own WebSocket connection to Shelltender
- Browser connection limits (6-8 per domain)
- Server resource exhaustion
- Network bandwidth saturation with 4 active AI sessions

**Impact**: CRITICAL - System architecture limitation

### 3. 🟡 **Complex State Synchronization**
**Risk**: Managing focus, scroll position, and buffer state across multiple terminals
- Race conditions between terminals
- Lost output during view switches
- Cursor position corruption

**Impact**: HIGH - Poor user experience

### 4. 🟡 **Browser Memory Leaks**
**Risk**: Improper terminal disposal leading to:
- Retained DOM nodes
- WebSocket connections not closing
- Event listener accumulation
- Growing memory usage over time

**Impact**: HIGH - Requires browser restart

### 5. 🟡 **Resize Performance**
**Risk**: Dragging dividers with 4 active terminals could cause:
- Janky resize animations
- Layout thrashing
- Delayed terminal reflow

**Impact**: MEDIUM - Frustrating interaction

## Viability Testing Plan

### Phase 0: Quick Spike (2-3 days)

**Goal**: Prove or disprove core technical feasibility before any production code

#### Test 1: xterm.js Stress Test
```typescript
// Create minimal test harness
const StressTest = () => {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  
  // Test scenarios:
  // 1. Create 4 xterm instances
  // 2. Stream 1000 lines/second to each
  // 3. Measure: FPS, memory usage, CPU usage
  // 4. Test resize performance
  // 5. Test rapid create/destroy cycles
};
```

**Success Criteria**:
- Maintains 30+ FPS with 4 terminals active
- Memory usage <500MB for 4 terminals
- No memory leaks after 100 create/destroy cycles
- Resize maintains 24+ FPS

**Fail Fast**: If this fails, consider alternatives:
- Server-side rendering with canvas streaming
- Single terminal with virtual splitting
- Different terminal library

#### Test 2: WebSocket Scaling Test
```javascript
// Backend test script
async function testWebSocketLimits() {
  // 1. Spin up 4 Shelltender sessions
  // 2. Connect WebSocket to each
  // 3. Stream concurrent output
  // 4. Measure: connection stability, message latency, bandwidth
}
```

**Success Criteria**:
- All 4 connections stable for 10 minutes
- Message latency <100ms per terminal
- Total bandwidth <1MB/s for typical AI output

**Fail Fast**: If this fails:
- Investigate WebSocket multiplexing
- Consider SSE for read-only streams
- Implement connection pooling

#### Test 3: Layout Performance Prototype
```typescript
// Minimal split view implementation
const SplitViewPrototype = () => {
  // Use CSS Grid with 4 divs
  // Each div contains a minimal terminal
  // Implement resize with mouse drag
  // Measure performance during resize
};
```

**Success Criteria**:
- Smooth resize at 60FPS with empty terminals
- Acceptable resize (24+ FPS) with active content
- Layout calculations <16ms

### Phase 1: Proof of Concept (3-4 days)

**Only proceed if Phase 0 passes all tests**

#### POC Goals:
1. Implement basic 2-way split with real terminals
2. Connect to actual Shelltender sessions
3. Test with real AI workloads
4. Measure real-world performance

#### Key Metrics to Track:
```typescript
interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  cpuUsage: number;
  renderTime: number;
  websocketLatency: number;
  messageQueueDepth: number;
}
```

#### Test Scenarios:
1. **AI Code Generation**: 2 Claudes writing code simultaneously
2. **Build Output**: Running `npm install` in 2 terminals
3. **Long Running**: 30-minute test with periodic output
4. **Rapid Switching**: Toggle between views 100 times

### Decision Gate Criteria

**✅ Proceed with Full Implementation if:**
- All Phase 0 tests pass
- POC shows acceptable performance with 2 terminals
- No architectural blockers discovered
- Memory usage stays under control

**⚠️ Pivot to Alternative Approach if:**
- xterm.js can't handle multiple instances
- WebSocket limits are hit
- Performance is borderline (needs optimization first)

**❌ Abandon Feature if:**
- Browser fundamentally can't handle the load
- Would require major architecture changes
- Performance is unacceptably poor

## Alternative Approaches (If Needed)

### Plan B: Virtual Terminal Splitting
- Single xterm.js instance
- Virtual viewports into shared buffer
- Custom rendering for split appearance
- **Pros**: Better performance
- **Cons**: Complex implementation

### Plan C: Sequential Terminal Display
- Only render active terminal
- Quick switch between terminals
- Show static preview for inactive
- **Pros**: Guaranteed performance
- **Cons**: Not true split view

### Plan D: Server-Side Rendering
- Render terminals on server
- Stream as images/canvas
- **Pros**: Consistent performance
- **Cons**: Major architecture change

## Implementation Recommendations

1. **Start with Phase 0 immediately** - 2-3 days to know if viable
2. **Create isolated test environment** - Don't pollute main codebase
3. **Set hard performance budgets** - Don't compromise on UX
4. **Document all findings** - Future reference
5. **Have Plan B ready** - Virtual splitting most promising

## Risk Mitigation Strategies

### For Performance Issues:
- Implement aggressive lazy loading
- Use OffscreenCanvas API if available
- Terminal output throttling
- Virtualized scrollback

### For WebSocket Limits:
- Implement connection multiplexing
- Use SharedWorker for connections
- Queue messages during peak load

### For Memory Leaks:
- Strict terminal lifecycle management
- WeakMap for terminal references
- Automated memory profiling in tests

## Go/No-Go Decision Tree

```
Start Phase 0 Tests
├── xterm.js Stress Test
│   ├── PASS → Continue
│   └── FAIL → Try Alternative Terminal Lib
│       ├── PASS → Continue with new lib
│       └── FAIL → Consider Plan B/C/D
├── WebSocket Scaling Test
│   ├── PASS → Continue
│   └── FAIL → Design multiplexing solution
│       ├── Solvable → Continue
│       └── Not Solvable → Abort feature
└── Layout Performance Test
    ├── PASS → Proceed to Phase 1 POC
    └── FAIL → Optimize or consider Plan B
```

## Timeline

- **Days 1-3**: Phase 0 Testing
- **Day 4**: Go/No-Go Decision
- **Days 5-8**: POC (if proceeding)
- **Day 9**: Final Implementation Decision

## Budget

**Maximum time investment before decision**: 9 days
- If not clearly viable by day 9, abort
- Prevents sunk cost fallacy
- Ensures we fail fast if needed