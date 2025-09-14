# Split View Viability Tests

<!-- Document Metadata
Created: 2025-07-29
Modified: 2025-07-29
Status: ????
-->


This directory contains the Phase 0 viability tests for the split views feature.

## Running the Tests

### 1. Frontend Tests (Browser-based)

Start the development server:
```bash
make dev
```

Then navigate to: http://localhost:5173/test/split-view-viability

#### Test 1: xterm.js Stress Test
- Click "Start Stress Test" to create 4 terminals
- Adjust output rate slider to test different loads (default: 1000 lines/sec)
- Monitor FPS and memory usage
- Run "Create/Destroy Test" to check for memory leaks

**Success Criteria:**
- ✅ Maintains 30+ FPS with 4 terminals active
- ✅ Memory usage <500MB for 4 terminals
- ✅ No memory leaks after 100 create/destroy cycles
- ✅ Resize maintains 24+ FPS

#### Test 3: Layout Performance Test
- Select different split modes (Single, Horizontal, Vertical, Quad)
- Click "Initialize Terminals" to create terminals
- Drag the dividers to test resize performance
- Monitor FPS during resize operations

**Success Criteria:**
- ✅ Smooth resize at 60FPS with empty terminals
- ✅ Acceptable resize (24+ FPS) with active content
- ✅ Layout calculations <16ms

### 2. Backend Test (WebSocket Scaling)

Make sure Shelltender is running, then:

```bash
cd backend
node src/tests/websocket-scaling-test.js
```

This will:
- Create 4 concurrent Shelltender sessions
- Connect WebSocket to each
- Stream data for 10 minutes
- Report on stability, latency, and bandwidth

**Success Criteria:**
- ✅ All 4 connections stable for 10 minutes
- ✅ Message latency <100ms per terminal
- ✅ Total bandwidth <1MB/s for typical AI output

## Interpreting Results

### Go Decision ✅
If all tests pass, proceed with:
1. Phase 1: Basic 2-way splits implementation
2. Phase 2: Quad view extension

### Pivot Decision ⚠️
If tests show borderline performance:
1. Consider virtual terminal splitting (Plan B)
2. Implement aggressive optimizations first
3. Re-test after optimizations

### No-Go Decision ❌
If tests fail significantly:
1. Document specific failure points
2. Consider server-side rendering approach
3. Re-evaluate feature necessity

## Test Results Log

Please record your test results here:

### Test Run: [DATE]
**Environment:** [Browser, OS, Hardware specs]

**xterm.js Stress Test:**
- FPS with 4 terminals: ___
- Peak memory usage: ___ MB
- Create/destroy cycles: ___/100 passed
- Notes: 

**WebSocket Scaling Test:**
- Connection stability: ___/4 stable
- Average latency: ___ ms
- Peak bandwidth: ___ MB/s
- Notes:

**Layout Performance:**
- Empty terminal resize FPS: ___
- Active terminal resize FPS: ___
- Layout calculation time: ___ ms
- Notes:

**Overall Decision:** [GO / PIVOT / NO-GO]
**Reasoning:**