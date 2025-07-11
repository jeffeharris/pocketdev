# Shelltender v0.5.0 Upgrade Guide

> **Target Audience**: Claude AI executing upgrade
> **Version**: v0.4.x → v0.5.0
> **Estimated Time**: 30-45 minutes
> **Risk Level**: Medium (breaking changes)

## Claude Must NEVER

- ❌ Modify `node_modules` directly
- ❌ Delete the database or existing sessions
- ❌ Change port configurations without explicit user approval
- ❌ Skip the backup step
- ❌ Assume single-port mode if user has custom networking

## Pre-Upgrade Checklist

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[
  {"id": "1", "content": "Verify current Shelltender version", "status": "pending", "priority": "high"},
  {"id": "2", "content": "Backup critical files", "status": "pending", "priority": "high"},
  {"id": "3", "content": "Check for custom WebSocket implementations", "status": "pending", "priority": "high"},
  {"id": "4", "content": "Identify port configuration", "status": "pending", "priority": "high"},
  {"id": "5", "content": "Update Shelltender packages", "status": "pending", "priority": "high"},
  {"id": "6", "content": "Update server configuration", "status": "pending", "priority": "medium"},
  {"id": "7", "content": "Update frontend WebSocket connections", "status": "pending", "priority": "medium"},
  {"id": "8", "content": "Update Docker/deployment configs", "status": "pending", "priority": "medium"},
  {"id": "9", "content": "Test the upgrade", "status": "pending", "priority": "high"},
  {"id": "10", "content": "Document any issues", "status": "pending", "priority": "low"}
]