# Shelltender v0.5.0 - Revised Implementation Plan

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


## Current Situation

The `shelltender-unified.js` file is NOT using Shelltender properly. It's reimplementing everything manually with raw WebSocket, which explains why it's not working correctly.

## Revised Approach

### Option 1: Fix shelltender-unified.js (Recommended)
**Effort**: 2-3 hours
**Risk**: Low - we're simplifying by using the library correctly

1. **Create new implementation** that properly uses Shelltender v0.5.0
2. **Remove ~400 lines** of manual WebSocket handling
3. **Keep only** the Express API routes
4. **Test thoroughly** before replacing

### Option 2: Revert to shelltender-service.js + Updates
**Effort**: 1-2 hours  
**Risk**: Medium - need to ensure v0.5.0 compatibility

1. Use the working `shelltender-service.js` 
2. Update it for v0.5.0 single-port mode
3. Less code change but may miss v0.5.0 benefits

## New File List

### Files to Create/Replace
1. **`shelltender-server-v5.js`** (new, ~220 lines)
   - Proper Shelltender v0.5.0 implementation
   - Replaces the broken unified.js

### Files to Update
1. **`docker-compose.yml`** (4 lines)
   - Single port configuration
   
2. **`vite.config.ts`** (2 lines)  
   - Update proxy target
   
3. **`.env.example`** (2 lines)
   - Add PORT=8080 example
   
4. **`package.json`** (2 lines)
   - Update start script to use new file

### Files to Review/Update
1. **Frontend components** - Verify WebSocket path is `/ws`
2. **ShelltenderProvider** - Ensure it uses the right URL

## Implementation Steps

### Step 1: Create Proper Implementation
```javascript
// shelltender-server-v5.js - Correct usage of Shelltender v0.5.0
import { 
  SessionManager, 
  BufferManager, 
  SessionStore, 
  WebSocketServer  // This is the key - use Shelltender's WebSocketServer
} from '@shelltender/server';

// ... minimal setup code ...

// The magic line - let Shelltender handle everything
const wsServer = WebSocketServer.create(
  { server: httpServer, path: '/ws' },
  sessionManager,
  bufferManager
);
```

### Step 2: Test Locally
```bash
# Stop current broken implementation
npm run stop

# Update dependencies
cd simple/server
npm install @shelltender/server@^0.5.0

# Run new implementation
node shelltender-server-v5.js

# Test
curl http://localhost:8080/api/health
wscat -c ws://localhost:8080/ws
```

### Step 3: Update Configuration Files
- Single port in docker-compose.yml
- Update .env files
- Fix frontend proxy

### Step 4: Replace and Deploy
- Replace shelltender-unified.js with working version
- Update package.json scripts
- Restart services

## Why This Is Better

1. **Uses Library Properly**: No reinventing the wheel
2. **Less Code**: ~220 lines instead of 650
3. **More Reliable**: Library handles edge cases
4. **Easier to Maintain**: Updates come from library

## Comparison

| Aspect | Current (Broken) | New Implementation |
|--------|-----------------|-------------------|
| Lines of Code | 650 | ~220 |
| WebSocket Handling | Manual (broken) | Library (tested) |
| Maintenance | High | Low |
| Complexity | Very High | Low |
| Works | No | Yes |

## Decision Point

Should we:
1. **Create the new proper implementation** (recommended)
2. Try to fix the existing unified.js (not recommended - too much work)
3. Revert to old dual-port setup (works but outdated)

The proper implementation would be much simpler and actually use Shelltender as designed.