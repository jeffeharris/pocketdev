# Technical Debt - PocketDev Simple Server

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-23
Status: ????
-->


## Overview
This document tracks technical debt in the PocketDev Simple Server project. Items are prioritized by severity and impact on security, performance, and maintainability.

## Critical Issues 🚨

### 1. Security Vulnerabilities (XSS)
**File:** `frontend/project-page.html`
**Issue:** User input (task names, branch names) is inserted directly into HTML without escaping
**Impact:** Allows malicious users to inject scripts and steal user data
**Example:**
```javascript
// Line 421-426: Unescaped HTML injection
container.innerHTML = tasks.map(task => `
  <div class="task-item ${currentTask?.id === task.id ? 'selected' : ''}" 
       data-task-id="${task.id}">
    <div class="task-name">${task.name}</div>  // XSS vulnerability
    <div class="task-branch">${task.branch}</div>  // XSS vulnerability
  </div>
`).join('');
```
**Solution:** Implement HTML escaping function for all user-generated content

### 2. Memory Leaks
**File:** `frontend/project-page.html`
**Issue:** 
- Iframes aren't properly cleaned up when removed
- Event listeners accumulate on each render
- The `allTerminalIframes` Map grows without bounds
**Impact:** Browser memory usage grows over time, eventually causing crashes
**Solution:** 
- Clear iframe src before removal
- Remove event listeners before re-adding
- Implement proper cleanup in delete operations

### 3. No Input Validation
**File:** `frontend/project-page.html`
**Issue:** API responses and user inputs aren't validated or sanitized
**Impact:** Potential for injection attacks and application crashes
**Solution:** Implement input validation layer for all API responses and user inputs

## Major Issues ⚠️

### 4. Code Organization
**File:** `frontend/project-page.html`
**Issue:** 
- 650+ lines of JavaScript in a single script block
- All variables in global scope
- No separation of concerns (UI, API, state management mixed)
**Impact:** Difficult to maintain, test, and debug
**Solution:** Refactor into modules using ES6 modules or module pattern

### 5. Error Handling
**File:** `frontend/project-page.html`
**Issue:**
- Inconsistent error handling across functions
- Technical error messages shown to users
- No retry mechanisms for network failures
**Example:**
```javascript
alert('Failed to load project');  // Poor UX
```
**Solution:** Implement proper error handling with user-friendly messages and retry logic

### 6. Performance Issues
**File:** `frontend/project-page.html`
**Issue:**
- All terminal iframes created upfront instead of lazy-loaded
- Full DOM re-renders instead of targeted updates
- No debouncing on user actions
- Large DOM trees without virtualization
**Impact:** Slow page loads and sluggish UI, especially with many tasks
**Solution:** 
- Implement lazy loading for iframes
- Use targeted DOM updates
- Add debouncing for user inputs
- Consider virtual scrolling for large task lists

## Medium Priority Issues 📋

### 7. No Type Safety
**Issue:** Pure JavaScript without TypeScript or JSDoc
**Impact:** Runtime errors that could be caught at development time
**Solution:** Add TypeScript or comprehensive JSDoc comments

### 8. Hard-coded Values
**Issue:** Magic numbers and strings throughout the code
**Example:**
```javascript
const API_BASE = `http://${window.location.hostname}:3005/api`;
setTimeout(() => selectTask(result.task.id), 100);  // Magic number
```
**Solution:** Create configuration object with named constants

### 9. Missing CSRF Protection
**Issue:** API calls lack CSRF tokens
**Impact:** Vulnerable to cross-site request forgery attacks
**Solution:** Implement CSRF token generation and validation

### 10. No Build Process
**Issue:** No minification, bundling, or transpilation
**Impact:** Larger file sizes, no modern JavaScript features
**Solution:** Implement webpack or similar build tool

## Code Examples for Fixes

### HTML Escaping Function
```javascript
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
```

### Proper Iframe Cleanup
```javascript
function cleanupTerminal(taskId) {
  const iframe = allTerminalIframes.get(taskId);
  if (iframe) {
    // Remove event listeners if any
    iframe.src = 'about:blank';  // Clear src first
    iframe.remove();
    allTerminalIframes.delete(taskId);
  }
}
```

### Event Listener Management
```javascript
let taskClickListeners = new WeakMap();

function attachTaskListeners(container) {
  // Remove old listeners
  container.querySelectorAll('.task-item').forEach(el => {
    const oldListener = taskClickListeners.get(el);
    if (oldListener) {
      el.removeEventListener('click', oldListener);
    }
    
    // Add new listener
    const newListener = function() {
      const taskId = this.getAttribute('data-task-id');
      selectTask(taskId);
    };
    el.addEventListener('click', newListener);
    taskClickListeners.set(el, newListener);
  });
}
```

## Recommended Action Plan

1. **Immediate (Security Critical)**
   - [ ] Fix XSS vulnerabilities by adding HTML escaping
   - [ ] Add input validation for all user inputs
   - [ ] Implement CSRF protection

2. **Short Term (1-2 weeks)**
   - [ ] Fix memory leaks in iframe management
   - [ ] Add proper error handling with user-friendly messages
   - [ ] Implement event listener cleanup

3. **Medium Term (1 month)**
   - [ ] Refactor code into modules
   - [ ] Add build process with minification
   - [ ] Implement lazy loading for iframes

4. **Long Term (2-3 months)**
   - [ ] Add TypeScript or comprehensive JSDoc
   - [ ] Implement comprehensive testing
   - [ ] Add performance monitoring

## Notes
- The multitasking feature with persistent iframes is innovative but needs proper memory management
- Consider using a frontend framework (React/Vue) for better state management
- The backend API also needs security review (not covered in this document)

## Session Management Tech Debt (Added 2025-07-23)

### 1. Massive Session Accumulation
**Files:** `backend/controllers/terminal.controller.js`, `frontend/src/components/terminal/TerminalPanel.tsx`
**Issue:** Old implementation created new Shelltender sessions with timestamp-based IDs on every tab creation
**Impact:** 
- Task 3d36b64f accumulated 68 terminal sessions
- 80+ active Shelltender sessions across the system
- Resource waste and potential memory issues
**Status:** Fixed in current branch with stable session IDs

### 2. ESLint Configuration Issues
**Files:** Various frontend files
**Issue:** 
- Multiple ESLint rule definitions not found (unicorn/prefer-includes, jsx-a11y/anchor-has-content, etc.)
- Vite deps folder being linted
- TypeScript any types scattered throughout
**Impact:** Inconsistent code quality checks
**Solution:** Update ESLint config, exclude .vite folder, fix TypeScript types

### 3. Inconsistent Session ID Usage
**Files:** Frontend terminal components
**Issue:** Mix of sessionId, dbSessionId, and shelltenderSessionId throughout codebase
**Impact:** Confusion about which ID to use where
**Status:** Partially fixed - now using dbSessionId as primary identifier

### 4. Missing Error Handling
**Files:** `frontend/src/components/terminal/TerminalPanel.tsx`
**Issue:** handleSessionStatus has TODOs for user notifications on errors
**Impact:** Users don't know when sessions fail
**Solution:** Implement proper toast notifications for session errors

### 5. Duplicate Session ID Fields
**Files:** `backend/db/schema.sql`, `backend/db/models/session.js`
**Issue:** Both session_id and shelltender_session_id columns storing same value
**Impact:** Data redundancy and confusion
**Solution:** Consolidate to single session_id column

## Notification System Tech Debt (Added 2025-07-23)

### 1. No User Notification System
**Files:** `frontend/src/components/terminal/TerminalPanel.tsx`
**Issue:** Session disconnections/reconnections only log to console
**Impact:** Users unaware of connection issues
**Solution:** Integrate react-toastify or similar notification library

### 2. Missing Connection Status Indicators
**Files:** `frontend/src/components/terminal/TerminalTabs.tsx`
**Issue:** No visual indicator for session connection state
**Impact:** Users can't tell if terminal is connected or not
**Solution:** Add connection status icon/color to tabs

### 3. Basic Reconnection Logic
**Files:** `frontend/src/components/terminal/TerminalPanel.tsx`
**Issue:** Reconnection just forces re-render, no actual session recovery
**Impact:** May not properly restore lost sessions
**Solution:** Implement proper session recovery with backend coordination