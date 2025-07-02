# Demo Environment Setup

## For a Successful Demo

### Option 1: Mock Success Mode
Create a "demo mode" that simulates successful task completion:

```javascript
// In container-orchestrator.js
if (process.env.DEMO_MODE === 'true') {
  // Return mock successful result after progress simulation
}
```

### Option 2: Use Test Credentials
Set up test credentials that won't cost money but will show the flow:

```bash
# .env.demo
ANTHROPIC_API_KEY=sk-ant-demo-key-for-testing
GITHUB_USERNAME=demo-user
GITHUB_TOKEN=demo-token
DEMO_MODE=true
```

### Option 3: Live Demo with Real Credentials
If you have credits available:
1. Use a simple, fast task (like adding a comment)
2. Use a small public repo
3. Set low token limits

## Demo Scenarios

### Scenario 1: "The Confused Developer"
Show common mistakes:
- Typo in repository URL
- Vague task description
- Missing credentials

### Scenario 2: "The Prepared Manager"
Show successful flow:
- Valid GitHub repo
- Clear task with acceptance criteria
- Proper credentials

### Scenario 3: "The Recovery"
Show resilience:
- Task fails partway
- Supervisor suggests fixes
- Recovery options available

## Quick Demo Data

### Good Repository URLs:
- `https://github.com/octocat/Hello-World` (small, public)
- `https://github.com/facebook/react` (recognizable)

### Good Task Descriptions:
1. "Add a footer component that displays the current year and copyright notice"
2. "Create a dark mode toggle button in the header"
3. "Add unit tests for the Calculator component"

### Good Acceptance Criteria:
- "Component renders without errors"
- "Current year updates automatically"
- "Styling matches existing design system"
- "Includes proper TypeScript types"