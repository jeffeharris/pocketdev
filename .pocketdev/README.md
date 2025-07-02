# PocketDev Team Memory

This directory contains the collective memory of your AI development team. It stores learnings, optimizations, and patterns discovered during task execution.

## Structure

```
.pocketdev/
├── config.json              # Project configuration
├── engineers/               # Engineer-specific memories
│   ├── frontend/
│   │   ├── performance.yml  # Performance optimizations discovered
│   │   ├── failures.yml     # Failed approaches to avoid
│   │   └── patterns.yml     # Successful patterns to reuse
│   ├── backend/
│   └── devops/
└── project/
    ├── decisions.yml        # Architecture decisions made
    └── conventions.yml      # Discovered conventions
```

## How It Works

1. **Before Task**: Relevant memories are loaded into the engineer's context
2. **During Task**: Engineer applies learned optimizations and avoids known failures
3. **After Task**: New learnings are extracted and stored
4. **Over Time**: Engineers become more efficient and consistent

## Memory Format

All memory files use YAML format with timestamps and context:

```yaml
- learned: "2025-06-07"
  task_id: "abc123"
  finding: "Description of what was learned"
  context: "When/where this applies"
  impact: "measurable improvement"
```

This directory should be committed to version control so your AI team's knowledge persists and is shared across the team.