# Cedana Integration Guide for Claude - Terminal Session Persistence

This guide provides exact instructions for Claude to test and integrate Cedana for persistent terminal sessions across server reboots.

## Pre-Integration Analysis

Before starting, Claude should understand the goal:
- **Problem**: Terminal sessions die on server reboot, losing all state
- **Solution**: Use Cedana to checkpoint/restore shell processes
- **Success**: Terminal sessions survive reboots with full state preserved

## Prerequisites Check

Claude should verify these prerequisites before proceeding:

```bash
# Check system compatibility
uname -r  # Kernel should be 3.11+ (CRIU requirement)
lsb_release -a 2>/dev/null || cat /etc/os-release  # Check Linux distribution
docker --version  # Should be 20.10+
which systemctl  # Need systemd for daemon management

# Check current Shelltender setup
ps aux | grep -E "shelltender|node.*terminal" | grep -v grep
ls -la /app/data/shelltender-sessions/  # Current session storage
```

**Prerequisites Checklist:**
- [ ] Linux kernel 3.11 or higher
- [ ] Ubuntu 20.04+ or similar modern Linux
- [ ] Docker installed and running
- [ ] Shelltender service identified
- [ ] Write access to /app/data or similar persistent volume

## Claude Tool Usage Pattern

Execute this integration test using these specific patterns:

1. **Start with TodoWrite** - Create these 12 testing steps IMMEDIATELY:
   ```
   - Step 1: Install Cedana in test environment
   - Step 2: Verify CRIU kernel support
   - Step 3: Create test shell session
   - Step 4: Checkpoint the test session
   - Step 5: Verify checkpoint files created
   - Step 6: Kill the test session
   - Step 7: Restore from checkpoint
   - Step 8: Verify restored session state
   - Step 9: Test with Shelltender session
   - Step 10: Design integration architecture
   - Step 11: Create proof-of-concept code
   - Step 12: Document findings and recommendations
   ```

2. **State tracking** - Initialize and maintain throughout:
   ```typescript
   // Claude: Initialize these at the start
   const integrationState = {
     // Installation Status
     CEDANA_INSTALLED: false,
     CRIU_VERSION: "",
     KERNEL_COMPATIBLE: false,
     
     // Test Results
     SIMPLE_CHECKPOINT: "not_tested",  // not_tested|success|failed
     SIMPLE_RESTORE: "not_tested",
     SHELLTENDER_CHECKPOINT: "not_tested",
     SHELLTENDER_RESTORE: "not_tested",
     
     // Session Details
     TEST_SESSION_PID: null,
     CHECKPOINT_PATH: "",
     CHECKPOINT_SIZE_MB: 0,
     
     // Issues Found
     ERRORS: [],
     WARNINGS: [],
     LIMITATIONS: []
   };
   ```

## Step 1: Install Cedana

**Option A: Docker Installation (Preferred for Testing)**
```bash
# Create test directory
mkdir -p /tmp/cedana-test
cd /tmp/cedana-test

# Create Dockerfile for Cedana test environment
cat > Dockerfile.cedana << 'EOF'
FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    git \
    build-essential \
    pkg-config \
    libprotobuf-dev \
    libprotobuf-c-dev \
    protobuf-c-compiler \
    protobuf-compiler \
    python3-protobuf \
    python3-yaml \
    libbsd-dev \
    iproute2 \
    libnftables-dev \
    libcap-dev \
    libnet1-dev \
    libnl-3-dev \
    libnl-route-3-dev \
    libselinux-dev \
    libgnutls28-dev

# Install CRIU (dependency for Cedana)
RUN cd /tmp && \
    git clone https://github.com/checkpoint-restore/criu.git && \
    cd criu && \
    make && \
    make install

# Install Cedana
RUN cd /opt && \
    git clone https://github.com/cedana/cedana.git && \
    cd cedana && \
    # Build according to their instructions
    make

WORKDIR /opt/cedana
EOF

# Build test container
docker build -f Dockerfile.cedana -t cedana-test .
```

**Option B: Direct Installation (If Running on Host)**
```bash
# Clone Cedana repository
git clone https://github.com/cedana/cedana.git /tmp/cedana
cd /tmp/cedana

# Check for installation script
if [ -f "install.sh" ]; then
    echo "Found install script"
    cat install.sh  # Review before running
else
    echo "Manual installation needed - check README"
    cat README.md | grep -A 20 -i "install"
fi
```

**Installation Decision Tree:**
```
Installation Method?
├─ Docker available? → Use Option A (isolated testing)
├─ Root access on host? → Use Option B (direct install)
└─ Neither? → STOP - "Need either Docker or root access for testing"
```

## Step 2: Verify CRIU Support

```bash
# Check kernel configuration
echo "=== Checking CRIU Kernel Support ==="

# Method 1: Check for CRIU
which criu && criu check || echo "CRIU not found or check failed"

# Method 2: Check kernel features manually
cat > /tmp/check_criu_kernel.sh << 'EOF'
#!/bin/bash
echo "Checking kernel features for CRIU..."

# Required kernel features
features=(
    "CONFIG_CHECKPOINT_RESTORE=y"
    "CONFIG_NAMESPACES=y"
    "CONFIG_UTS_NS=y"
    "CONFIG_IPC_NS=y"
    "CONFIG_PID_NS=y"
    "CONFIG_NET_NS=y"
)

missing=0
for feature in "${features[@]}"; do
    if grep -q "$feature" /boot/config-$(uname -r) 2>/dev/null; then
        echo "✓ $feature"
    else
        echo "✗ $feature (missing)"
        ((missing++))
    fi
done

if [ $missing -eq 0 ]; then
    echo "✅ Kernel appears CRIU-compatible"
else
    echo "⚠️  Missing $missing required features"
fi
EOF

bash /tmp/check_criu_kernel.sh
```

**CRIU Support Decision Tree:**
```
CRIU Check Result?
├─ "looks good" → Continue to Step 3
├─ "missing features" → Try Docker approach instead
├─ "criu: command not found" → Return to Step 1
└─ "permission denied" → Need root or try Docker
```

## Step 3: Create Test Shell Session

```bash
# Create a test shell with identifiable state
echo "=== Creating Test Shell Session ==="

# Start a new bash session with unique prompt
TEST_SESSION=$(bash -c 'echo $$; exec bash --rcfile <(echo "
PS1=\"CEDANA_TEST_\$\$ > \"
export CEDANA_TEST_VAR=\"checkpoint_test_123\"
cd /tmp
echo \"Test session PID: \$\$\"
echo \"Custom variable: \$CEDANA_TEST_VAR\"
# Keep session alive
while true; do sleep 1; done
")' &)

# Capture PID
TEST_PID=$!
echo "Started test session with PID: $TEST_PID"

# Verify session is running
sleep 2
ps -p $TEST_PID && echo "✅ Test session running" || echo "❌ Failed to start"

# Create some session state
echo "Creating session state..."
echo "test_data_$(date +%s)" > /tmp/cedana_test_file.txt
```

## Step 4: Checkpoint the Test Session

```bash
# Create checkpoint directory
CHECKPOINT_DIR="/tmp/cedana-checkpoints/test-$$"
mkdir -p "$CHECKPOINT_DIR"

echo "=== Attempting Checkpoint ==="

# Method 1: Using Cedana (if installed)
if command -v cedana &> /dev/null; then
    cedana checkpoint \
        --pid $TEST_PID \
        --name "test-session" \
        --dir "$CHECKPOINT_DIR" \
        2>&1 | tee /tmp/cedana-checkpoint.log
    CHECKPOINT_RESULT=$?
else
    echo "Cedana not found, trying CRIU directly..."
    
    # Method 2: Direct CRIU (fallback)
    sudo criu dump \
        -t $TEST_PID \
        -D "$CHECKPOINT_DIR" \
        --shell-job \
        --tcp-established \
        -vvv \
        2>&1 | tee /tmp/criu-checkpoint.log
    CHECKPOINT_RESULT=$?
fi

# Check results
if [ $CHECKPOINT_RESULT -eq 0 ]; then
    echo "✅ Checkpoint successful"
    ls -la "$CHECKPOINT_DIR"
    du -sh "$CHECKPOINT_DIR"
else
    echo "❌ Checkpoint failed"
    echo "Check logs at: /tmp/*-checkpoint.log"
fi
```

**Checkpoint Error Handling:**
```typescript
const handleCheckpointError = (error: string) => {
  if (error.includes("Permission denied")) {
    return "Need root access. Try: sudo criu dump ...";
  }
  if (error.includes("not supported")) {
    return "Kernel missing features. Use Docker test environment.";
  }
  if (error.includes("Can't freeze task")) {
    return "Process has children or threads. Try --tree option.";
  }
  if (error.includes("TCP")) {
    return "TCP connections present. Add --tcp-established flag.";
  }
  return "Unknown error. Check full log for details.";
};
```

## Step 5: Verify Checkpoint Files

```bash
echo "=== Verifying Checkpoint ==="

# Check checkpoint contents
if [ -d "$CHECKPOINT_DIR" ]; then
    echo "Checkpoint files:"
    find "$CHECKPOINT_DIR" -type f -name "*.img" | while read img; do
        echo "  - $(basename $img) ($(stat -c%s $img | numfmt --to=iec-i --suffix=B))"
    done
    
    # Check core files
    for required in "core-$TEST_PID.img" "pagemap-$TEST_PID.img" "mm-$TEST_PID.img"; do
        if [ -f "$CHECKPOINT_DIR/$required" ]; then
            echo "✓ Found $required"
        else
            echo "✗ Missing $required"
        fi
    done
    
    # Total size
    echo "Total checkpoint size: $(du -sh $CHECKPOINT_DIR | cut -f1)"
else
    echo "❌ Checkpoint directory not found"
fi
```

## Step 6: Kill Test Session

```bash
echo "=== Terminating Original Session ==="

# Kill the test session
if ps -p $TEST_PID > /dev/null; then
    kill -9 $TEST_PID
    sleep 1
    ps -p $TEST_PID && echo "⚠️  Failed to kill" || echo "✅ Session terminated"
else
    echo "⚠️  Session already dead"
fi

# Verify file still exists (to prove restore works)
ls -la /tmp/cedana_test_file.txt 2>/dev/null || echo "Note: Test file missing"
```

## Step 7: Restore from Checkpoint

```bash
echo "=== Attempting Restore ==="

# Method 1: Using Cedana
if command -v cedana &> /dev/null; then
    cedana restore \
        --name "test-session" \
        --dir "$CHECKPOINT_DIR" \
        2>&1 | tee /tmp/cedana-restore.log
    RESTORE_RESULT=$?
else
    # Method 2: Direct CRIU
    cd /tmp  # Important: restore in same directory
    sudo criu restore \
        -D "$CHECKPOINT_DIR" \
        --shell-job \
        --tcp-established \
        -d \
        -vvv \
        2>&1 | tee /tmp/criu-restore.log
    RESTORE_RESULT=$?
fi

# Check results
if [ $RESTORE_RESULT -eq 0 ]; then
    echo "✅ Restore command successful"
    
    # Try to find restored process
    sleep 2
    RESTORED_PID=$(ps aux | grep "CEDANA_TEST_" | grep -v grep | awk '{print $2}' | head -1)
    if [ -n "$RESTORED_PID" ]; then
        echo "✅ Found restored process: PID $RESTORED_PID"
        ps -fp $RESTORED_PID
    else
        echo "⚠️  Cannot find restored process"
    fi
else
    echo "❌ Restore failed"
    tail -20 /tmp/*-restore.log
fi
```

## Step 8: Verify Restored State

```bash
echo "=== Verifying Restored Session ==="

if [ -n "$RESTORED_PID" ]; then
    # Check process details
    echo "Process info:"
    ps -fp $RESTORED_PID
    
    # Check environment
    echo -e "\nEnvironment check:"
    sudo cat /proc/$RESTORED_PID/environ | tr '\0' '\n' | grep CEDANA_TEST_VAR || echo "⚠️  Custom var not found"
    
    # Check working directory
    echo -e "\nWorking directory:"
    sudo readlink /proc/$RESTORED_PID/cwd
    
    # Check if test file still accessible
    echo -e "\nTest file check:"
    ls -la /tmp/cedana_test_file.txt 2>/dev/null && echo "✅ Test file accessible" || echo "❌ Test file missing"
    
    # Attempt interaction (if possible)
    echo -e "\nAttempting to send command:"
    echo "echo 'Restored successfully!'" > /proc/$RESTORED_PID/fd/0 2>/dev/null || echo "Note: Cannot send input (expected)"
else
    echo "❌ No restored process found to verify"
fi
```

## Step 9: Test with Shelltender Session

```bash
echo "=== Testing with Real Shelltender Session ==="

# Find a Shelltender session
SHELL_PID=$(ps aux | grep -E "bash.*task-" | grep -v grep | awk '{print $2}' | head -1)

if [ -n "$SHELL_PID" ]; then
    echo "Found Shelltender shell: PID $SHELL_PID"
    
    # Create checkpoint
    SHELL_CHECKPOINT="/tmp/cedana-checkpoints/shelltender-$SHELL_PID"
    mkdir -p "$SHELL_CHECKPOINT"
    
    # Attempt checkpoint (may need adjustments)
    if command -v criu &> /dev/null; then
        sudo criu dump \
            -t $SHELL_PID \
            -D "$SHELL_CHECKPOINT" \
            --shell-job \
            --ext-unix-sk \
            --tcp-established \
            --file-locks \
            -vvv \
            2>&1 | tee /tmp/shelltender-checkpoint.log
            
        if [ $? -eq 0 ]; then
            echo "✅ Shelltender checkpoint created"
            du -sh "$SHELL_CHECKPOINT"
        else
            echo "❌ Shelltender checkpoint failed"
            echo "Common issues:"
            echo "  - External unix sockets (WebSocket connections)"
            echo "  - File locks from node processes"
            echo "  - PTY/TTY complexity"
        fi
    fi
else
    echo "⚠️  No Shelltender session found"
    echo "Start a terminal in PocketDev first"
fi
```

## Step 10: Integration Architecture Design

Based on test results, Claude should create this architecture:

```typescript
// File: /tmp/cedana-integration-design.ts

interface CedanaIntegration {
  // Checkpoint Strategy
  checkpointStrategy: {
    trigger: "periodic" | "beforeShutdown" | "onDemand";
    interval?: number;  // if periodic, in seconds
    storage: {
      path: "/app/data/cedana-checkpoints";
      maxCheckpoints: 3;  // per session
      compression: boolean;
    };
  };

  // Session Identification
  sessionMapping: {
    // Map Shelltender session ID to process PID
    method: "pidfile" | "processTable" | "socketTracking";
    storage: "sqlite" | "json";
  };

  // Restore Strategy
  restoreStrategy: {
    automatic: boolean;
    onStartup: boolean;
    fallbackBehavior: "createNew" | "showError" | "promptUser";
  };

  // Limitations Found
  limitations: string[];
  
  // Recommended Approach
  recommendation: "full" | "hybrid" | "alternative";
}

// Example implementation based on test results
const proposedIntegration: CedanaIntegration = {
  checkpointStrategy: {
    trigger: "periodic",
    interval: 300,  // 5 minutes
    storage: {
      path: "/app/data/cedana-checkpoints",
      maxCheckpoints: 3,
      compression: true
    }
  },
  sessionMapping: {
    method: "pidfile",
    storage: "sqlite"
  },
  restoreStrategy: {
    automatic: true,
    onStartup: true,
    fallbackBehavior: "createNew"
  },
  limitations: [
    // Fill based on test results
  ],
  recommendation: "hybrid"  // Determine from tests
};
```

## Step 11: Create Proof of Concept

```typescript
// File: /tmp/shelltender-cedana-poc.js

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class CedanaSessionManager {
  constructor(config) {
    this.checkpointDir = config.checkpointDir || '/app/data/cedana-checkpoints';
    this.sessionMap = new Map();
  }

  async checkpointSession(sessionId, pid) {
    const checkpointPath = path.join(this.checkpointDir, sessionId);
    await fs.mkdir(checkpointPath, { recursive: true });

    return new Promise((resolve, reject) => {
      const cmd = `criu dump -t ${pid} -D ${checkpointPath} --shell-job --tcp-established -v`;
      
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`Checkpoint failed for ${sessionId}:`, stderr);
          reject(error);
        } else {
          console.log(`Checkpoint successful for ${sessionId}`);
          this.sessionMap.set(sessionId, { pid, checkpointPath });
          resolve(checkpointPath);
        }
      });
    });
  }

  async restoreSession(sessionId) {
    const session = this.sessionMap.get(sessionId);
    if (!session) {
      throw new Error(`No checkpoint found for session ${sessionId}`);
    }

    return new Promise((resolve, reject) => {
      const cmd = `criu restore -D ${session.checkpointPath} --shell-job --tcp-established -d -v`;
      
      exec(cmd, { cwd: '/tmp' }, (error, stdout, stderr) => {
        if (error) {
          console.error(`Restore failed for ${sessionId}:`, stderr);
          reject(error);
        } else {
          console.log(`Restore successful for ${sessionId}`);
          // Find new PID and update map
          // This is simplified - real implementation needs PID discovery
          resolve({ sessionId, status: 'restored' });
        }
      });
    });
  }

  async listCheckpoints() {
    const checkpoints = [];
    const dirs = await fs.readdir(this.checkpointDir);
    
    for (const dir of dirs) {
      const stats = await fs.stat(path.join(this.checkpointDir, dir));
      if (stats.isDirectory()) {
        checkpoints.push({
          sessionId: dir,
          created: stats.mtime,
          size: await this.getDirectorySize(path.join(this.checkpointDir, dir))
        });
      }
    }
    
    return checkpoints;
  }

  async getDirectorySize(dirPath) {
    // Implementation to calculate directory size
    return "N/A";  // Placeholder
  }
}

// Integration with Shelltender
class ShelltenderCedanaIntegration {
  constructor() {
    this.cedana = new CedanaSessionManager({
      checkpointDir: '/app/data/cedana-checkpoints'
    });
    this.checkpointInterval = null;
  }

  async startPeriodicCheckpoints(intervalSeconds = 300) {
    this.checkpointInterval = setInterval(async () => {
      try {
        const sessions = await this.getActiveSessions();
        for (const session of sessions) {
          if (session.pid) {
            await this.cedana.checkpointSession(session.id, session.pid);
          }
        }
      } catch (error) {
        console.error('Periodic checkpoint failed:', error);
      }
    }, intervalSeconds * 1000);
  }

  async getActiveSessions() {
    // This would integrate with Shelltender's session management
    // Placeholder implementation
    return [];
  }

  async beforeShutdown() {
    console.log('Creating final checkpoints before shutdown...');
    const sessions = await this.getActiveSessions();
    const results = await Promise.allSettled(
      sessions.map(s => this.cedana.checkpointSession(s.id, s.pid))
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`Checkpointed ${successful}/${sessions.length} sessions`);
  }

  async onStartup() {
    console.log('Checking for sessions to restore...');
    const checkpoints = await this.cedana.listCheckpoints();
    
    for (const checkpoint of checkpoints) {
      try {
        await this.cedana.restoreSession(checkpoint.sessionId);
        console.log(`Restored session: ${checkpoint.sessionId}`);
      } catch (error) {
        console.error(`Failed to restore ${checkpoint.sessionId}:`, error);
      }
    }
  }
}

// Export for testing
module.exports = { CedanaSessionManager, ShelltenderCedanaIntegration };
```

## Step 12: Document Findings

```markdown
# Cedana Integration Test Results

## Executive Summary
[Claude fills this based on test results]

## Test Results

### Basic Shell Checkpoint/Restore
- **Result**: [SUCCESS/PARTIAL/FAILED]
- **Details**: [What worked, what didn't]
- **Performance**: Checkpoint time: Xs, Size: XMB, Restore time: Xs

### Shelltender Session Test
- **Result**: [SUCCESS/PARTIAL/FAILED]
- **Challenges**: 
  - [ ] WebSocket connections
  - [ ] Node.js process tree
  - [ ] PTY handling
  - [ ] File descriptors

## Technical Findings

### Kernel Requirements
- Required features: [List what's actually needed]
- Current kernel: [Version and compatibility]

### Storage Requirements
- Per session checkpoint size: ~XMB
- With 50 active sessions: ~XGB
- Recommended storage: XGB with rotation

### Performance Impact
- Checkpoint duration: X-X seconds
- CPU usage during checkpoint: X%
- Restore duration: X-X seconds

## Integration Challenges

1. **WebSocket Connections**
   - Problem: [Description]
   - Solution: [Proposed approach]

2. **Process Trees**
   - Problem: [Description]
   - Solution: [Proposed approach]

3. **File Descriptors**
   - Problem: [Description]
   - Solution: [Proposed approach]

## Recommendation

Based on testing, Claude recommends:

### Option A: Full Integration (If all tests passed)
- Implement CedanaSessionManager
- Add periodic checkpoints (5 min intervals)
- Enable restore on startup
- Estimated effort: X days

### Option B: Hybrid Approach (If partial success)
- Use Cedana for shell state only
- Recreate WebSocket connections
- Restore working directory and environment
- Estimated effort: X days

### Option C: Alternative Solution (If tests failed)
- Use tmux/screen for session persistence
- Implement custom state saving (cwd, env, history)
- Lighter weight but less complete
- Estimated effort: X days

## Next Steps
1. [Specific action items based on results]
2. [Required infrastructure changes]
3. [Testing plan for production]
```

## Error Recovery Procedures

### If Checkpoint Fails
```bash
# Diagnose with verbose output
sudo criu dump -t $PID -D /tmp/test-checkpoint --shell-job -vvvv -o dump.log

# Common fixes:
# 1. Add --tcp-established for network connections
# 2. Add --ext-unix-sk for unix sockets
# 3. Add --file-locks if locks present
# 4. Use --leave-running to not kill process
```

### If Restore Fails
```bash
# Check restore log
cat /tmp/test-checkpoint/restore.log

# Common issues:
# - "pid already exists" → Original not killed
# - "can't open files" → Wrong working directory
# - "unix socket error" → Need socket cleanup
```

## Quick Decision Matrix for Claude

```typescript
const makeDecision = (testResults) => {
  if (testResults.simpleCheckpoint === "success" && 
      testResults.simpleRestore === "success") {
    if (testResults.shelltenderCheckpoint === "success") {
      return "PROCEED with full integration";
    } else {
      return "PROCEED with hybrid approach - handle WebSockets separately";
    }
  } else if (testResults.kernelCompatible === false) {
    return "STOP - Use alternative approach (tmux/screen)";
  } else {
    return "DEBUG - Check logs and try Docker environment";
  }
};
```

## Communication Templates

### When Tests Succeed
```
✅ Cedana integration test successful!

I successfully:
- Checkpointed a test shell session (XMB in Xs)
- Killed the original process
- Restored the session with full state
- [Shelltender specific results]

This means we can implement persistent terminals that survive reboots.

Recommendation: [Full/Hybrid/Alternative] integration
Estimated storage: XGB for 50 active sessions
Performance impact: Minimal (X% CPU during checkpoint)

Shall I proceed with creating the integration code?
```

### When Tests Fail
```
⚠️ Cedana integration test encountered issues:

Test results:
- Basic checkpoint: [PASS/FAIL]
- Basic restore: [PASS/FAIL]  
- Shelltender compatibility: [PASS/FAIL]

Main challenge: [Specific issue]

This appears to be due to [diagnosis].

Alternatives:
1. Try Docker-based testing environment
2. Use lighter-weight approach (tmux/screen)
3. Implement custom state persistence

Which approach would you prefer?
```

## Quick Test Commands

```bash
# One-line compatibility check
criu check 2>&1 | grep -q "looks good" && echo "✅ CRIU ready" || echo "❌ CRIU not ready"

# Quick checkpoint test
bash -c 'echo $$; sleep 1000' & PID=$!; sleep 1; sudo criu dump -t $PID -D /tmp/quick-test --leave-running && echo "✅ Checkpoint works" || echo "❌ Checkpoint failed"

# Check Shelltender processes
ps aux | grep -E "node.*shelltender|bash.*task-" | grep -v grep | wc -l | xargs -I {} echo "{} Shelltender processes found"

# Estimate checkpoint sizes
for pid in $(ps aux | grep bash | grep -v grep | awk '{print $2}'); do 
  echo -n "PID $pid: "
  sudo ls -la /proc/$pid/maps 2>/dev/null | wc -l | xargs -I {} echo "{} memory mappings"
done
```