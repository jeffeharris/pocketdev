# Frontend Service Infrastructure

<!-- Document Metadata
Created: 2025-08-03
Modified: 2025-08-03
Status: ????
-->


This directory contains the service layer infrastructure for the PocketDev frontend, implementing the **Deep Modules** pattern from John Ousterhout's "A Philosophy of Software Design".

## 🎯 Design Goals

1. **Simple Interfaces**: Each service exposes 5-10 public methods maximum
2. **Hidden Complexity**: Implementation details are encapsulated
3. **Clear Abstractions**: Components don't need to know how services work
4. **Session ID Normalization**: Solve the multiple session ID types problem
5. **TypeScript-First**: Strong typing throughout the service layer

## 📁 File Structure

```
services/
├── README.md                 # This file
├── index.ts                  # Public API exports
├── types.ts                  # TypeScript interfaces and types
├── base.service.ts           # Abstract base class for all services
├── service-provider.tsx      # React Context for dependency injection
├── session-adapter.ts        # Session ID normalization layer
├── example.service.ts        # Example implementation patterns
├── usage-examples.tsx        # React component usage examples
└── api.ts                   # Legacy API (to be migrated)
```

## 🚀 Quick Start

### 1. Service Provider Setup

The `ServiceProvider` is already wired up in `App.tsx`:

```tsx
import { ServiceProvider } from './services';

function App() {
  return (
    <ServiceProvider>
      {/* Your app content */}
    </ServiceProvider>
  );
}
```

### 2. Using Services in Components

```tsx
import { useService } from '../services';
import type { Project } from '../types/project';

function ProjectList() {
  const projectService = useService('project');
  
  useEffect(() => {
    async function loadProjects() {
      const projects = await projectService.getAll();
      setProjects(projects);
    }
    loadProjects();
  }, [projectService]);
  
  // ...rest of component
}
```

### 3. Session ID Management

```tsx
import { useSessionAdapter } from '../services';

function TerminalTabs({ taskId }: { taskId: string }) {
  const sessionAdapter = useSessionAdapter();
  
  // Register sessions from API
  const normalizedIds = sessionAdapter.registerSessions(terminalSessions);
  
  // Use normalized IDs throughout component
  const activeSessionId = normalizedIds[0];
  
  // Convert for API calls when needed
  const dbSessionId = sessionAdapter.getDbSessionId(activeSessionId);
}
```

## 🏗️ Architecture Patterns

### BaseService Class

All domain services extend `BaseService`:

```typescript
export class ProjectService extends BaseService implements IProjectService {
  constructor(config: ServiceConfig = {}) {
    super(config);
  }
  
  // Simple public interface
  async getAll(): Promise<Project[]> {
    if (this.isMockEnabled) {
      return this.mockData;
    }
    return this.get<Project[]>('/projects');
  }
  
  // Complex implementation details hidden
  private mapBackendProject(data: any): Project {
    // Mapping logic here
  }
}
```

### Session Adapter Pattern

Solves the session ID complexity:

```typescript
// Before: Components deal with multiple ID types
sessionId: "task-123-abc"           // Shelltender ID  
dbSessionId: "sess_456def"          // Database ID
shelltenderSessionId: "task-123-abc" // Explicit Shelltender ID

// After: Components use one normalized ID
const normalizedId = sessionAdapter.normalize(anyIdType);
// normalizedId: "session-456def"
```

### Service Registration

Services are registered in `service-provider.tsx`:

```typescript
const serviceRegistry: ServiceRegistry = {
  project: new ProjectService(serviceConfig),
  task: new TaskService(serviceConfig),
  git: new GitService(serviceConfig),
  // ... other services
  sessionAdapter: sessionAdapter,
};
```

## 🔧 Implementation Guidelines

### Creating a New Service

1. **Extend BaseService**:
```typescript
export class MyService extends BaseService implements IMyService {
  constructor(config: ServiceConfig = {}) {
    super(config);
  }
}
```

2. **Keep Interface Simple** (max 10 public methods):
```typescript
interface IMyService {
  getAll(): Promise<Item[]>;
  getById(id: string): Promise<Item>;
  create(data: CreateDTO): Promise<Item>;
  update(id: string, data: UpdateDTO): Promise<Item>;
  delete(id: string): Promise<void>;
  // ... max 5 more methods
}
```

3. **Hide Implementation**:
```typescript
export class MyService extends BaseService {
  // Public interface
  async getAll(): Promise<Item[]> {
    const data = await this.get<any[]>('/items');
    return this.mapItems(data);
  }
  
  // Private implementation
  private mapItems(data: any[]): Item[] {
    return data.map(item => this.mapItem(item));
  }
  
  private mapItem(data: any): Item {
    // Complex mapping logic hidden here
  }
}
```

4. **Add Mock Support**:
```typescript
export class MyService extends BaseService {
  private mockData: Item[] = [];
  
  constructor(config: ServiceConfig = {}) {
    super(config);
    if (this.isMockEnabled) {
      this.initializeMockData();
    }
  }
  
  async getAll(): Promise<Item[]> {
    if (this.isMockEnabled) {
      return this.mockData;
    }
    return this.get<Item[]>('/items');
  }
  
  protected initializeMockData(): void {
    this.mockData = [/* mock data */];
  }
}
```

5. **Register in ServiceProvider**:
```typescript
// In service-provider.tsx
const serviceRegistry: ServiceRegistry = {
  // ... existing services
  my: new MyService(serviceConfig),
};
```

6. **Add Type Interface**:
```typescript
// In types.ts
export interface IServiceRegistry {
  // ... existing services
  my: IMyService;
}
```

### Error Handling

The service layer provides structured error handling:

```typescript
import { ServiceError, ValidationError, NotFoundError } from '../services';

try {
  const result = await service.doSomething();
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
  } else if (error instanceof NotFoundError) {
    // Handle not found errors
  } else if (error instanceof ServiceError) {
    // Handle other service errors
  }
}
```

## 🔄 Migration Strategy

### From Current API

Current pattern:
```typescript
import { api } from '../services/api';

// 49 methods on single class
const projects = await api.getProjects();
const tasks = await api.getTasks(projectId);
const gitStatus = await api.getGitStatus(projectId, taskId);
```

New pattern:
```typescript
import { useService } from '../services';

const projectService = useService('project');
const taskService = useService('task');
const gitService = useService('git');

// Clean, focused interfaces
const projects = await projectService.getAll();
const tasks = await taskService.getAll(projectId);
const gitStatus = await gitService.getStatus(projectId, taskId);
```

### Migration Steps

1. **Keep Legacy API**: The old `api.ts` remains for compatibility
2. **Extract Services Gradually**: Create new services one domain at a time
3. **Update Components**: Migrate components to use new services
4. **Remove Legacy**: Once all components migrated, remove old API

## 🧪 Testing

### Service Testing

```typescript
import { MyService } from '../my.service';

describe('MyService', () => {
  let service: MyService;
  
  beforeEach(() => {
    service = new MyService({ mockEnabled: true });
  });
  
  it('should get all items', async () => {
    const items = await service.getAll();
    expect(items).toHaveLength(2);
  });
});
```

### Component Testing with Services

```typescript
import { render } from '@testing-library/react';
import { ServiceProvider } from '../services';
import { MyComponent } from './MyComponent';

test('renders with services', () => {
  render(
    <ServiceProvider config={{ mockEnabled: true }}>
      <MyComponent />
    </ServiceProvider>
  );
});
```

## 📊 Service Metrics

Each service automatically tracks:
- Request counts
- Error rates  
- Response times
- Last request/error timestamps

Access via:
```typescript
const config = useServiceConfig();
console.log('Mock mode:', config.mockEnabled);
```

## 🎯 Next Steps

1. **Implement Domain Services**: Create `ProjectService`, `TaskService`, etc.
2. **Migrate Components**: Update existing components to use new services
3. **Add Caching**: Implement intelligent caching for performance
4. **Add Offline Support**: Handle network failures gracefully
5. **Service Workers**: Background sync and caching

## 📖 References

- [A Philosophy of Software Design](https://web.stanford.edu/~ouster/cgi-bin/book.php) - John Ousterhout
- [Deep Modules Pattern](../../../plan-pocketdev/steering/developer-guidance.md)
- [PocketDev Architecture](../../../CLAUDE.md)