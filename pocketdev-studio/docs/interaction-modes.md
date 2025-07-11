# Claude Code Interaction Modes for PocketDev

## When to Use Each Mode

### 🚀 Non-Interactive Mode (`claude -p`)
**Best for:**
- Quick, well-defined tasks
- CI/CD automation
- Tasks you trust Claude to complete autonomously
- When you're busy and just want results

**Examples:**
```bash
claude -p "Fix the lint errors in user.js"
claude -p "Add error handling to the payment API"
claude -p "Write unit tests for auth.service.ts"
```

**Mobile UX:** One-tap task assignment → Get notification when done

### 🎮 Interactive Mode (`claude code`)
**Best for:**
- Complex refactoring where you want to guide decisions
- Exploring different approaches
- Learning/teaching scenarios
- When you enjoy the collaboration

**Examples:**
- "Let's redesign the database schema together"
- "Help me debug this performance issue"
- "Walk me through refactoring this legacy code"

**Mobile UX:** Real-time chat interface with approval prompts

### 📊 Streaming Mode (`--output-format streaming-json`)
**Best for:**
- Long-running tasks where you want progress updates
- Monitoring what Claude is doing
- Tasks that might need intervention

**Examples:**
```bash
claude -p "Migrate the entire codebase to TypeScript" --output-format streaming-json
```

**Mobile UX:** Progress bar with live updates

## Mobile App UI Concept

```
┌─────────────────────────┐
│  Choose Task Mode:      │
│                         │
│  ⚡ Quick Task          │
│  (Non-interactive)      │
│  "I trust you, Claude"  │
│                         │
│  🤝 Guided Task         │
│  (Interactive)          │
│  "Let's work together"  │
│                         │
│  📈 Long Task           │
│  (Streaming)            │
│  "Show me progress"     │
└─────────────────────────┘
```

## Decision Tree

```
Is the task clear and simple?
├── Yes → Non-interactive mode
└── No
    │
    Do you want to guide/steer?
    ├── Yes → Interactive mode
    └── No
        │
        Is it a long task?
        ├── Yes → Streaming mode
        └── No → Non-interactive mode
```

## Implementation in Mobile App

```typescript
// User selects mode when assigning task
interface TaskAssignment {
  engineerId: string;
  task: string;
  mode: 'quick' | 'guided' | 'streaming';
  allowedTools?: string[];
}

// Quick mode (non-interactive)
async function assignQuickTask(task: string) {
  return await api.post('/assign-task', {
    mode: 'non-interactive',
    prompt: task,
    allowedTools: ['read', 'edit', 'write']
  });
}

// Guided mode (interactive)
async function startGuidedSession(task: string) {
  const session = await api.post('/start-session', {
    mode: 'interactive',
    initialPrompt: task
  });
  
  // Open chat interface
  navigation.navigate('InteractiveChat', { sessionId: session.id });
}

// Streaming mode
async function assignLongTask(task: string) {
  const stream = await api.post('/stream-task', {
    mode: 'streaming',
    prompt: task
  });
  
  // Show progress view
  navigation.navigate('TaskProgress', { streamId: stream.id });
}
```