# Frontend Modernization Plan for Simple Server

## Current State Analysis
- **Simple Frontend**: Plain HTML/CSS/JS files with inline styles
- **No Build System**: Direct HTML files served statically  
- **No Component Architecture**: Everything in single HTML files
- **Backend**: Node.js/Express with SQLite and Shelltender integration

## Technology Stack Decision
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for utility-first styling
- **CSS Modules** for component-specific styles
- **Lucide React** for consistent icons (matching the prototype)

## Project Structure
```
simple/frontend/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Layout.tsx
│   │   ├── task/
│   │   │   ├── TaskWorkspace.tsx
│   │   │   ├── TaskList.tsx
│   │   │   ├── TaskListItem.tsx
│   │   │   ├── TaskStatus.tsx
│   │   │   └── TaskSwitcher.tsx
│   │   ├── terminal/
│   │   │   ├── TerminalPanel.tsx
│   │   │   ├── TerminalTabs.tsx
│   │   │   └── ShelltenderFrame.tsx
│   │   ├── validation/
│   │   │   ├── ValidationPanel.tsx
│   │   │   ├── ServiceCard.tsx
│   │   │   ├── PreviewFrame.tsx
│   │   │   └── ContainerLogs.tsx
│   │   ├── merge/
│   │   │   ├── MergePanel.tsx
│   │   │   ├── FileList.tsx
│   │   │   ├── DiffViewer.tsx
│   │   │   └── ConflictResolver.tsx
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── ErrorBoundary.tsx
│   ├── hooks/
│   │   ├── useTask.ts
│   │   ├── useWebSocket.ts
│   │   ├── useLocalStorage.ts
│   │   └── usePhaseTransition.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── websocket.ts
│   │   └── mockData.ts
│   ├── styles/
│   │   ├── globals.css
│   │   └── components/
│   │       ├── TaskWorkspace.module.css
│   │       └── Transitions.module.css
│   ├── types/
│   │   ├── task.ts
│   │   ├── git.ts
│   │   └── container.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   └── constants.ts
│   ├── pages/
│   │   ├── Projects.tsx
│   │   ├── ProjectDetail.tsx
│   │   └── TaskWorkspace.tsx
│   ├── App.tsx
│   └── main.tsx
├── public/
│   └── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── .env.example
```

## Component Architecture

### Core Components

#### 1. TaskWorkspace
Main container component that:
- Manages state for active task, phase, and UI preferences
- Handles WebSocket connections for real-time updates
- Coordinates between sub-panels

#### 2. LensSlider
Phase transition component that:
- Uses CSS clip-path for smooth animations
- Manages validate/merge panel switching
- Preserves state during transitions

#### 3. ShelltenderFrame
Terminal integration that:
- Wraps iframe with proper sandbox attributes
- Manages session and tab switching
- Provides terminal control actions

#### 4. ServiceManager
Container orchestration UI that:
- Displays service cards with status indicators
- Shows port assignments
- Provides container lifecycle controls

## Data Flow & State Management

### Task Context
```typescript
const TaskContext = React.createContext<{
  tasks: Task[]
  activeTask: Task | null
  switchTask: (id: string) => void
  updateTask: (id: string, updates: Partial<Task>) => void
}>()
```

### Real-time Updates
```typescript
const useTaskUpdates = (taskId: string) => {
  const [status, setStatus] = useState<TaskStatus>()
  
  useEffect(() => {
    const ws = new WebSocket(`/api/tasks/${taskId}/ws`)
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      setStatus(update.status)
    }
    return () => ws.close()
  }, [taskId])
  
  return status
}
```

## Styling Strategy
- **Global styles**: Tailwind utilities for layout and common patterns
- **Component styles**: CSS Modules for complex animations
- **Theme**: CSS variables for colors, spacing, and typography
- **Responsive**: Mobile-first approach with breakpoints

## API Integration

### Service Layer
```typescript
class TaskAPI {
  async getTasks(projectId: string): Promise<Task[]>
  async createTask(task: CreateTaskDTO): Promise<Task>
  async deployContainers(taskId: string): Promise<DeploymentResult>
  async getGitStatus(taskId: string): Promise<GitStatus>
  async createPR(taskId: string, description: string): Promise<PR>
}
```

### Progressive Enhancement
- Start with existing endpoints
- Add feature flags for unavailable APIs
- Graceful degradation when backends aren't ready
- Mock data for development

## Implementation Steps

### Phase 1: Foundation (Day 1-2)
1. ✅ Initialize React/Vite/TypeScript project
2. Set up Tailwind CSS and CSS Modules
3. Create base folder structure
4. Configure TypeScript types

### Phase 2: Core Components (Day 3-5)
1. Port TaskWorkspace prototype component
2. Create reusable components from prototype
3. Implement basic routing
4. Set up API service with mock data

### Phase 3: Integration (Day 6-8)
1. Connect to existing backend endpoints
2. Implement WebSocket connections
3. Add real-time updates
4. Handle error states

### Phase 4: Polish (Day 9-10)
1. Implement animations and transitions
2. Add loading states
3. Optimize performance
4. Write component tests

## Migration Strategy
1. New React app runs alongside existing HTML files
2. Gradually replace HTML pages with React routes
3. Maintain backward compatibility
4. Update nginx/server configuration when ready

## Development Guidelines
- Component-driven development
- TypeScript for type safety
- ESLint and Prettier for consistency
- Jest and React Testing Library for tests
- Storybook for component documentation (optional)

## Success Criteria
- Modern, maintainable codebase
- No god files or inline styles
- Excellent developer experience
- Progressive enhancement ready
- Easy to extend with new features