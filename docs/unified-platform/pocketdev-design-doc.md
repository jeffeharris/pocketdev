### Task Creation Component (Project Page)
```typescript
interface TaskCreationForm {
  title: string;
  description: string;
  branch: string;
  branchPrefix?: string;
  engineerId: string;
}

const TaskCreationModal = ({ projectId, onTaskCreated }) => {
  const [branchPrefix, setBranchPrefix] = useState('');
  
  return (
    <div className="space-y-4">
      <input 
        type="text" 
        placeholder="Task title (e.g., Add user authentication)"
        className="w-full px-3 py-2 border rounded"
      />
      
      <textarea 
        placeholder="Task description..."
        className="w-full px-3 py-2 border rounded h-32"
      />
      
      <div className="flex gap-2">
        <select 
          value={branchPrefix} 
          onChange={(e) => setBranchPrefix(e.target.value)}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">No prefix</option>
          <option value="feature/">feature/</option>
          <option value="fix/">fix/</option>
          <option value="chore/">chore/</option>
        </select>
        
        <input 
          type="text" 
          placeholder="Branch name"
          className="flex-1 px-3 py-2 border rounded"
        />
      </div>
      
      <button className="px-4 py-2 bg-blue-600 text-white rounded">
        Create Task
      </button>
    </div>
  );
};
```# PocketDev Task Workspace - Implementation Design Document

## Overview

This document describes the implementation requirements for the PocketDev Task Workspace interface, building upon the existing "simple" implementation. The interface enables users to manage AI-assisted development workflows through a generate/validate/merge cycle with human-in-the-loop oversight.

## Current System Context

### Existing Implementation (simple directory)
- **Backend**: Node.js server at `local-backend/` (port 3001)
- **Frontend**: React + TypeScript + Vite at `web/` (port 5173)
- **Terminal**: Shelltender integration via iframe
- **Container Management**: Docker-in-Docker for AI engineers
- **Git Integration**: Isolated worktrees per task

### Key Files to Understand
- `web/src/App.tsx` - Main app with routing and dashboard
- `web/src/components/TaskView.tsx` - Current basic task view (to be replaced)
- `local-backend/container-routes.js` - Container orchestration API
- `local-backend/project-routes.js` - Project configuration API

## Design Requirements

### Core Workflow
1. **Generate Phase**: Human assigns task → AI works in Shelltender terminal
2. **Validate Phase**: Human reviews work → Deploys containers for testing
3. **Merge Phase**: Human approves → Creates PR and merges

### Key Design Decisions Based on Discussion
- Terminal (Shelltender) is the primary interface during generation
- Validation requires Docker container deployment with preview
- Git controls integrated into workflow, not separate section
- Support for 2-10 concurrent tasks with easy switching
- Lens comparison slider for validate/merge phase transition
- Tasks created from project page with branch name and friendly title
- Validation containers timeout after 10 minutes (configurable)
- Merge conflicts handled via GitHub or advanced Shelltender session

## Component Architecture

### 1. TaskWorkspace Component (Replaces TaskView)

```typescript
interface TaskWorkspaceProps {
  taskId: string;
}

interface TaskWorkspaceState {
  // Core state
  activeTaskId: string;
  tasks: ExtendedTask[];
  sidebarCollapsed: boolean;
  
  // Phase management
  validationMode: boolean;
  activePhase: 'validate' | 'merge';
  splitRatio: number; // Terminal/validation split
  
  // Git state
  gitStatus: {
    clean: boolean;
    ahead: number;
    behind: number;
    filesChanged: number;
  };
  
  // Validation state
  services: Service[];
  previewUrl: string;
  containerLogs: string[];
  
  // Merge state
  selectedFile: ChangedFile | null;
  prDescription: string;
}
```

### 2. Main Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ Header (Project context, task switcher, notifications)  │
├─────────────────┬───────────────────────────────────────┤
│                 │                                       │
│    Sidebar      │         Terminal Area                │
│                 │    ┌─────────────────────┐           │
│ - Current Task  │    │  Shelltender iframe │           │
│ - Git Status    │    ├─────────────────────┤           │
│ - All Tasks     │    │ Validation/Merge    │           │
│                 │    │ (Toggle with lens)   │           │
│                 │    └─────────────────────┘           │
└─────────────────┴───────────────────────────────────────┘
```

### 3. Component Breakdown

#### Header Component
```typescript
interface HeaderProps {
  project: Project;
  tasks: ExtendedTask[];
  activeTaskId: string;
  onTaskSwitch: (taskId: string) => void;
  pendingValidations: number;
}
```

Features:
- Project name with repository link
- Task switcher dropdown with status indicators
- Notification bell showing validation-ready count
- Task Actions menu (Mark Complete, Archive, Delete)

Task Display Format:
```typescript
// Show task title prominently with git branch as secondary info
<div className="flex items-center gap-2">
  <h2 className="text-xl font-semibold">{task.title}</h2>
  <div className="flex items-center gap-1 text-sm text-gray-500">
    <GitBranch className="w-3 h-3" />
    <span className="font-mono">{task.branch}</span>
  </div>
</div>
```

#### Sidebar Component
```typescript
interface SidebarProps {
  currentTask: ExtendedTask;
  gitStatus: GitStatus;
  allTasks: ExtendedTask[];
  onTaskSelect: (task: ExtendedTask) => void;
  collapsed: boolean;
}
```

Sections:
1. **Current Task Details**
   - Title, description, engineer assignment
   - Worktree and branch info
   - Phase and status indicators

2. **Repository Status**
   - Visual git status (clean/dirty, ahead/behind)
   - Git action buttons (View Changes, Git Log, Compare)

3. **All Tasks List**
   - Scrollable list with phase/status indicators
   - Attention indicators for validation-ready tasks

#### Terminal Component
```typescript
interface TerminalProps {
  task: ExtendedTask;
  onToggleValidation: () => void;
  validationMode: boolean;
}
```

Features:
- Shelltender iframe integration
- Session tabs (Planning, Implementation, Testing)
- Terminal controls (refresh, new tab, maximize)
- Validation mode toggle

#### ValidationPanel Component
```typescript
interface ValidationPanelProps {
  taskId: string;
  services: Service[];
  onDeploy: () => void;
  onServiceAction: (service: Service, action: string) => void;
}
```

Layout:
- **Left**: Deploy controls, service cards
- **Center**: Live preview iframe
- **Right**: Container logs terminal

Container Timeout Configuration:
```typescript
// Initial implementation - environment variable
const VALIDATION_CONTAINER_TIMEOUT = process.env.VALIDATION_CONTAINER_TIMEOUT_MINUTES || 10;
// TODO: Move to tenant settings in walk phase

// Auto-stop containers after timeout
useEffect(() => {
  if (containersRunning) {
    const timeout = setTimeout(() => {
      stopContainers();
      toast.info(`Containers stopped after ${VALIDATION_CONTAINER_TIMEOUT} minutes`);
    }, VALIDATION_CONTAINER_TIMEOUT * 60 * 1000);
    
    return () => clearTimeout(timeout);
  }
}, [containersRunning]);
```

Debug Mode for Failed Containers:
```typescript
{containerError && (
  <div className="mt-4 space-y-3">
    <div className="bg-red-50 border border-red-200 rounded p-3">
      <h4 className="font-medium text-red-900">Container Deployment Failed</h4>
      <pre className="mt-2 text-sm text-red-800 overflow-x-auto">
        {containerLogs}
      </pre>
    </div>
    
    <button onClick={() => launchDebugShell(task.containerId)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded">
      <Terminal className="w-4 h-4" />
      Debug Container Shell
    </button>
  </div>
)}
```

#### MergePanel Component
```typescript
interface MergePanelProps {
  task: ExtendedTask;
  changedFiles: ChangedFile[];
  onCreatePR: (description: string) => void;
  onMerge: () => void;
}
```

Layout:
- **Left**: PR controls, file list with changes
- **Right**: Diff viewer for selected file

Merge Conflict Handling:
```typescript
// When conflicts detected
const ConflictResolution = ({ task, baseBranch }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const gitCommands = `git fetch origin
git checkout ${task.branch}
git merge origin/${baseBranch}
# Resolve conflicts in your editor
git add .
git commit
git push`;

  return (
    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
      <h4 className="flex items-center gap-2 font-medium">
        <AlertTriangle className="w-5 h-5 text-yellow-600" />
        Merge Conflicts Detected
      </h4>
      
      <div className="mt-4 space-y-3">
        {/* Option 1: Copy git commands */}
        <div>
          <button onClick={() => copyToClipboard(gitCommands)} 
                  className="flex items-center gap-2 px-3 py-2 bg-white border rounded">
            <Copy className="w-4 h-4" />
            Copy Git Commands
          </button>
          <pre className="mt-2 bg-gray-900 text-gray-100 p-3 rounded text-sm overflow-x-auto">
            {gitCommands}
          </pre>
        </div>
        
        {/* Option 2: Open in GitHub */}
        <button onClick={() => window.open(task.prUrl)} 
                className="flex items-center gap-2 px-3 py-2 bg-white border rounded">
          <ExternalLink className="w-4 h-4" />
          View in GitHub
        </button>
        
        {/* Option 3: Advanced - Resolve in Shelltender */}
        <button onClick={() => launchConflictResolution(task.id)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-900 text-white rounded">
          <Terminal className="w-4 h-4" />
          Resolve in Terminal (Advanced)
        </button>
      </div>
    </div>
  );
};
```

### 4. Phase Transition Implementation

#### Lens Comparison Slider
```typescript
const LensSlider: React.FC<{
  activePhase: 'validate' | 'merge';
  onPhaseChange: (phase: 'validate' | 'merge') => void;
}> = ({ activePhase, onPhaseChange }) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  return (
    <div className="relative h-full overflow-hidden">
      {/* Base layer - Always visible */}
      <div className="absolute inset-0">
        <MergePanel />
      </div>
      
      {/* Sliding layer with clip-path */}
      <div 
        className="absolute inset-0 transition-clip-path duration-700"
        style={{
          clipPath: activePhase === 'validate' 
            ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' // Full
            : 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)'    // Hidden
        }}
      >
        <ValidationPanel />
      </div>
      
      {/* Edge toggle */}
      <button
        className="absolute top-1/2 -translate-y-1/2 z-50"
        style={{
          left: activePhase === 'validate' ? '0' : 'auto',
          right: activePhase === 'merge' ? '0' : 'auto'
        }}
        onClick={() => onPhaseChange(activePhase === 'validate' ? 'merge' : 'validate')}
      >
        <div className="bg-white border-2 px-1 py-8 shadow-lg">
          <span className="text-xs font-medium vertical-text">
            {activePhase === 'validate' ? 'MERGE' : 'VALIDATE'}
          </span>
        </div>
      </button>
    </div>
  );
};
```

## API Integration

### Existing Endpoints to Use

#### Task Management
```typescript
// From current implementation
GET    /api/container/engineers        // List container engineers
POST   /api/container/assign-task      // Assign new task
GET    /api/container/tasks/:id        // Get task details
GET    /api/container/tasks/:id/result // Get task result
GET    /api/container/tasks/:id/progress/stream // SSE progress
```

#### Project Configuration
```typescript
// From project-routes.js
GET    /api/project/config             // Get active project
POST   /api/project/config             // Update project config
POST   /api/project/initialize         // Initialize .pocketdev
```

### New Endpoints Needed

#### Task Creation (from project page)
```typescript
POST   /api/project/:projectId/tasks   // Create new task
// Body: {
//   title: string;
//   description: string;
//   branch: string;
//   branchPrefix?: 'feature/' | 'fix/' | 'chore/';
//   engineerId: string;
// }
```

#### Validation Phase
```typescript
POST   /api/tasks/:id/deploy           // Deploy validation containers
DELETE /api/tasks/:id/containers       // Stop containers
GET    /api/tasks/:id/services         // List running services
GET    /api/tasks/:id/preview-url      // Get preview URL
GET    /api/tasks/:id/container-logs   // Get container logs for debugging
POST   /api/tasks/:id/debug-shell      // Launch debug shell in container
```

#### Git Operations
```typescript
GET    /api/tasks/:id/git/status       // Git status for worktree
GET    /api/tasks/:id/git/diff/:file   // Get file diff
POST   /api/tasks/:id/git/merge        // Merge to base branch
GET    /api/tasks/:id/files/changed    // List changed files
POST   /api/tasks/:id/git/check-conflicts // Check for merge conflicts
```

#### Merge Phase
```typescript
POST   /api/tasks/:id/pr/create        // Create GitHub PR
POST   /api/tasks/:id/pr/merge         // Merge PR
GET    /api/tasks/:id/pr/status        // Check PR status
POST   /api/tasks/:id/conflict-session  // Launch Shelltender session for conflict resolution
```

### WebSocket/SSE Connections

```typescript
// Existing progress monitoring
const progressStream = new EventSource(
  `/api/container/tasks/${taskId}/progress/stream`
);

// Container logs streaming
const logsStream = new EventSource(
  `/api/tasks/${taskId}/logs/stream`
);

// Git file watching
const gitStream = new EventSource(
  `/api/tasks/${taskId}/git/watch`
);
```

## Docker-in-Docker Configuration (To Be Implemented)

### Hybrid Port Strategy
As discussed, we'll use a hybrid approach combining nginx routing with reserved direct ports:

```yaml
# Docker run command for shell server (future DinD implementation)
docker run --privileged \
  -p 8080:8080 \          # Nginx proxy for web traffic
  -p 9001-9010:9001-9010  # Direct ports for special cases
  -e WORKTREE_ID=${taskId} \
  shell-server:latest
```

### URL Structure
```
# Web applications (via nginx)
http://host/worktree-{taskId}/app/
http://host/worktree-{taskId}/api/

# Direct access when needed (WebSockets, dev servers, databases)
http://host:9001  # WebSocket connections
http://host:9002  # Hot module reloading
http://host:9003  # Database connections
```

### Nginx Routing Strategy
```nginx
# Host nginx configuration (to be implemented)
server {
    listen 80;
    
    # Route to shell servers by worktree ID
    location ~ ^/worktree-([^/]+)/(.*)$ {
        set $worktree $1;
        set $path $2;
        
        # Proxy to shell server's nginx
        proxy_pass http://shell-server-$worktree:8080/$path;
        proxy_set_header Host $host;
        proxy_set_header X-Worktree-ID $worktree;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

### Implementation Notes
- DinD is not yet implemented in the current system
- This configuration provides the target architecture
- Direct ports (9001-9010) reserved for services that don't work well through HTTP proxy
- Nginx handles most web traffic for clean URLs
- Each worktree gets its own isolated environment
- Port assignments are automatic with future ability for user override

## State Management

### Task Context
```typescript
// Use React Context for task state
const TaskContext = createContext<{
  tasks: ExtendedTask[];
  activeTask: ExtendedTask | null;
  switchTask: (taskId: string) => void;
  updateTaskStatus: (taskId: string, update: Partial<ExtendedTask>) => void;
}>();

// Local storage for UI preferences
const UIPreferences = {
  sidebarCollapsed: localStorage.getItem('sidebar-collapsed') === 'true',
  splitRatio: parseInt(localStorage.getItem('split-ratio') || '60'),
  defaultPhase: localStorage.getItem('default-phase') || 'validate'
};
```

## Styling Implementation

### Tailwind Classes
```css
/* Key component classes */
.task-workspace: "h-screen bg-gray-50 flex flex-col"
.sidebar: "w-80 bg-white border-r border-gray-200 flex flex-col"
.terminal-area: "flex-1 flex flex-col bg-gray-900"
.validation-panel: "bg-white border-t border-gray-200"
.merge-panel: "bg-white"

/* Status colors */
.phase-generate: "text-blue-600 bg-blue-50"
.phase-validate: "text-purple-600 bg-purple-50"
.phase-merge: "text-green-600 bg-green-50"
.status-error: "text-red-600 bg-red-50"
.status-ready: "text-yellow-600 bg-yellow-50"

/* Animations */
.transition-clip-path: "transition-[clip-path] duration-700 ease-in-out"
.pulse-attention: "animate-pulse"
```

### Component-Specific Styles
```css
/* Vertical text for edge toggles */
.vertical-text {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

/* Terminal styling */
.terminal-container {
  @apply bg-gray-900 text-gray-100 font-mono text-sm;
}

/* Diff viewer */
.diff-addition {
  @apply bg-green-50 text-green-800 border-l-4 border-green-300;
}
.diff-deletion {
  @apply bg-red-50 text-red-800 border-l-4 border-red-300;
}
```

## Implementation Steps

### Phase 1: Core Layout (Week 1)
1. Create TaskWorkspace component structure
2. Set up basic task management and switching
3. Add Shelltender iframe integration
4. Implement task switching in header

### Phase 2: Validation Interface (Week 2)
1. Create ValidationPanel with service cards
2. Implement container deployment API calls
3. Add preview iframe with proper routing
4. Set up container log streaming

### Phase 3: Merge Interface (Week 3)
1. Create MergePanel with file list
2. Integrate GitDiffViewer component
3. Add PR creation/merge functionality
4. Implement file selection and diff display

### Phase 4: Polish & Transitions (Week 4)
1. Implement lens comparison slider
2. Add all animations and transitions
3. Implement keyboard shortcuts
4. Add error handling and loading states

## Testing Strategy

### Component Testing
```typescript
// Example test for task switching
describe('TaskWorkspace', () => {
  it('should switch tasks and update UI', async () => {
    const { getByText, getByTestId } = render(<TaskWorkspace taskId="123" />);
    
    // Open task switcher
    fireEvent.click(getByTestId('task-switcher'));
    
    // Select different task
    fireEvent.click(getByText('#456 Backend API'));
    
    // Verify UI updates
    expect(getByTestId('current-task-title')).toHaveTextContent('Backend API');
    expect(getByTestId('shelltender-iframe')).toHaveAttribute('src', expect.stringContaining('456'));
  });
});
```

### Integration Testing
- Test full generate → validate → merge workflow
- Verify container lifecycle management
- Test git operations and PR creation
- Validate real-time updates via SSE

## Performance Considerations

1. **Iframe Management**: Shelltender iframes should be preserved when switching tasks
2. **Log Buffering**: Batch container log updates to prevent excessive re-renders
3. **Lazy Loading**: Load validation/merge panels only when first accessed
4. **State Persistence**: Save UI state to localStorage for quick restoration

## Security Considerations

1. **Iframe Sandboxing**: Apply appropriate sandbox attributes to Shelltender
2. **Container Isolation**: Each worktree runs in isolated Docker container
3. **Credential Management**: GitHub tokens stored securely in backend
4. **CORS Configuration**: Proper headers for preview URLs and API calls

---

This design document provides a complete blueprint for implementing the Task Workspace based on the existing simple implementation and the refined UI concepts discussed. The focus is on supporting the human-in-the-loop workflow while maintaining clean, modular code that can be extended as the platform evolves.