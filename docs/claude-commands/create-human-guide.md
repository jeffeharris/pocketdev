# /create-human-guide

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


Generate documentation optimized for human developers. These guides focus on understanding, learning, and troubleshooting with clear explanations and examples.

## Usage

```
/create-human-guide <type> <topic> [--style tutorial|reference|quickstart]
```

## Parameters

- `<type>`: The type of guide to create
  - `implementation` - Building new features
  - `architecture` - System design documentation
  - `api` - API reference documentation
  - `troubleshooting` - Problem-solving guides
  - `quickstart` - Getting started quickly
  - `concepts` - Explaining complex ideas

- `<topic>`: The subject of the guide (e.g., "authentication-flow", "database-schema")

- `--style`: Documentation style (default: tutorial)
  - `tutorial` - Step-by-step learning approach
  - `reference` - Quick lookup format
  - `quickstart` - Minimal setup to get running

## Guide Structure

### 1. Overview
```markdown
## Overview

[2-3 sentences explaining what this guide covers and why it matters]

### What You'll Learn
- [Outcome 1]
- [Outcome 2]
- [Outcome 3]

### Prerequisites
- [ ] [Required knowledge/tool]
- [ ] [Access needed]
- [ ] [Environment setup]
```

### 2. Conceptual Introduction
```markdown
## Understanding [Topic]

[Brief explanation of core concepts with analogies if helpful]

### Key Terms
- **Term 1**: Definition
- **Term 2**: Definition

### Architecture Overview
[Simple diagram or ASCII art if applicable]
```

### 3. Step-by-Step Instructions
```markdown
## Implementation Steps

### 1. [First Major Step]

[Explain why this step is necessary]

```bash
# Command with inline comment
command --flag value  # This flag does X
```

**Expected output:**
```
Success message or example output
```

💡 **Tip**: [Helpful context or shortcut]

⚠️ **Common Issue**: [What might go wrong and how to fix it]
```

### 4. Examples
```markdown
## Examples

### Basic Usage
```javascript
// Simple example with comments
const result = doSomething({
  option1: 'value',  // Explain this option
  option2: true      // Explain this too
});
```

### Advanced Usage
[More complex example with explanation]

### Real-World Scenario
[Practical example from actual use case]
```

### 5. Troubleshooting
```markdown
## Troubleshooting

### Problem: [Common Issue]
**Symptoms:**
- [What user sees]
- [Error messages]

**Solution:**
1. [First thing to try]
2. [Second thing to try]
3. [When to seek help]

### Debug Checklist
- [ ] Check [common cause 1]
- [ ] Verify [common cause 2]
- [ ] Ensure [common cause 3]
```

### 6. Best Practices
```markdown
## Best Practices

### Do's
✅ [Recommended approach]
✅ [Good pattern]
✅ [Security consideration]

### Don'ts
❌ [Common mistake]
❌ [Anti-pattern]
❌ [Security risk]
```

### 7. Further Reading
```markdown
## Learn More

- [Internal Doc]: Link to related guide
- [External Resource]: Official documentation
- [Tutorial]: Deeper dive into specific aspect
- [Community]: Where to ask questions
```

## Style Guidelines

### 1. Clarity First
- Short paragraphs (3-4 sentences max)
- Active voice
- Concrete examples over abstract concepts

### 2. Visual Hierarchy
- Use headers to break up content
- Include diagrams where helpful
- Highlight important points with formatting

### 3. Progressive Disclosure
- Start simple, add complexity gradually
- Provide escape hatches ("Skip to advanced")
- Link to deeper content rather than inline

### 4. Empathy
- Acknowledge difficult parts
- Provide encouragement
- Explain the "why" not just the "how"

## Examples

```
/create-human-guide quickstart local-development
/create-human-guide architecture microservices-design --style reference
/create-human-guide troubleshooting performance-issues --style tutorial
/create-human-guide api rest-endpoints --style reference
```

## Quality Checklist

Before finalizing:
- [ ] Clear learning objectives stated
- [ ] Prerequisites explicitly listed
- [ ] Examples are runnable and tested
- [ ] Common errors addressed
- [ ] Next steps provided
- [ ] Tone is friendly and encouraging
- [ ] Technical accuracy verified

## Related Commands

- `/create-claude-guide` - For Claude-executable guides
- `/create-guide` - Original combined command (deprecated)