# BUG-019: WebSocket Event System Needs Deep Module Design

<!-- Document Metadata
Created: 2025-08-03
Modified: 2025-08-03
Status: ????
-->


## Summary
The WebSocket event service exposes 10 nearly identical public methods for what is essentially a single responsibility: broadcasting messages. This creates a shallow module that violates Ousterhout's deep module principle.

## Current State
- **File**: `/backend/services/websocket-events.js`
- **Problem**: 10 public methods (sendAIStateUpdate, sendTaskStateChange, etc.) that are thin wrappers
- **Impact**: High cognitive load, large API surface for simple broadcasting

## Evidence
```javascript
// Current shallow interface - 10 methods doing the same thing:
sendAIStateUpdate(taskId, state)
sendTaskStateChange(taskId, oldState, newState)
sendTerminalCreated(taskId, sessionId)
sendTaskGitStatusUpdate(taskId, gitStatus)
// ... 6 more similar methods

// Each is just:
if (!this.wss) return;
this.wss.clients.forEach(client => {
  if (client.readyState === 1) { // Leaking WebSocket internals!
    client.send(JSON.stringify({ type, data }));
  }
});
```

## Problems Identified
1. **Shallow module**: 10 methods for 1 operation
2. **Leaky abstraction**: WebSocket readyState exposed
3. **Singleton pattern**: Creates artificial initialization errors
4. **Mixed abstraction levels**: Low-level WebSocket with high-level business events
5. **Inconsistent timestamps**: Only some methods add timestamps

## Proposed Solution
Create a deep module with simple interface:

```javascript
class WebSocketEventService {
  // Single public method hides all complexity
  broadcast(channel: string, eventType: string, data: any): void {
    // Handle initialization internally
    // Hide WebSocket details
    // Add consistent metadata
    // Queue if not connected
  }
}

// Usage becomes simple:
eventService.broadcast('task:123', 'state_changed', { 
  from: 'idle', 
  to: 'working' 
});
```

## Implementation Steps
1. Create deep broadcast module with single public method
2. Extract event type constants/enum
3. Internalize channel naming conventions
4. Add message queuing for disconnected state
5. Remove singleton pattern, use dependency injection
6. Hide all WebSocket implementation details

## Benefits
- **Simple interface**: 1 method instead of 10
- **Hidden complexity**: WebSocket details invisible to callers
- **Extensible**: New event types without changing service
- **Testable**: Easy to mock single method
- **Resilient**: Queuing handles connection issues

## Priority: High
This service is used throughout the backend for all real-time updates. Its shallow interface creates unnecessary cognitive load and coupling.

## Estimated Effort: 1-2 days

## Related
- Similar to api.ts having 44 methods (BUG-011)
- Part of the shallow module pattern throughout codebase
- Affects real-time features critical to UX

## Filed: 2025-08-01