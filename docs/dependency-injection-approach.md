# Dependency Injection Approach - Closure-Based DI

## Overview

After attempting a ServiceRegistry pattern (which was over-engineered for a hobby project), we implemented a simple closure-based dependency injection approach that eliminates all `app.locals` usage without adding unnecessary complexity.

## The Problem with app.locals

The Express `app.locals` pattern creates global state that:
- Makes testing difficult (must mock entire app context)
- Creates hidden dependencies 
- Violates information hiding principles
- Makes it unclear what each module needs
- Leads to "spooky action at a distance" bugs

## The Solution: Closure-Based DI

Instead of storing services in `app.locals`, we:
1. Initialize all services in the `start()` function scope
2. Use JavaScript closures to capture the services
3. Inject via middleware into `req.services`
4. Pass dependencies explicitly to route creators

## Implementation

### Before (Global State)
```javascript
// server.js
app.locals.models = models;
app.locals.services = services;
app.locals.github = github;
// ... 24 total assignments

// In routes/controllers
const github = req.app.locals.github;
const service = req.app.locals.services.TaskService;
```

### After (Closure-Based DI)
```javascript
// server.js
async function start() {
  // Services in closure scope
  const { models, services, eventEmitterService } = await initializeDatabase();
  
  // Middleware captures services via closure
  app.use((req, res, next) => {
    req.services = services;  // Direct reference, no app.locals
    next();
  });
  
  // Pass dependencies explicitly
  const routes = createRoutes(models, config.projectsDir);
  app.use('/api', routes);
}

// In routes/controllers  
const github = req.services.github;
const taskService = req.services.TaskService;
```

## Benefits

1. **Zero Global State**: No `app.locals` anywhere (0 assignments, down from 24)
2. **Simple**: No new abstractions or patterns to learn
3. **Explicit Dependencies**: `createRoutes(models, projectsDir)` shows what's needed
4. **Testable**: Easy to mock services in tests
5. **Type-Safe**: TypeScript can infer types from closure
6. **Performant**: No lookup overhead, direct references

## Why Not ServiceRegistry?

A ServiceRegistry was attempted but removed because:
- Added 193 lines for what closures handle in 10 lines
- Introduced unnecessary abstraction for a hobby project
- Required learning a new pattern
- Added complexity without proportional benefit

## Guidelines

1. **Keep services in function scope**: Don't pollute module or global scope
2. **Use closures for middleware**: Let JavaScript's natural scoping work for you
3. **Pass explicitly to route creators**: Make dependencies visible
4. **No backward compatibility**: This is a hobby project - clean breaks are fine

## Migration Checklist

When removing `app.locals` from existing code:

- [x] Move service initialization into `start()` function
- [x] Create middleware with closure over services
- [x] Update all `req.app.locals.*` to `req.services.*`
- [x] Update route creators to accept explicit parameters
- [x] Remove all `app.locals` assignments
- [x] Test that services are accessible in controllers

## Result

The entire dependency injection system is now just:
```javascript
// Capture in closure
const services = await initializeServices();

// Inject via middleware
app.use((req, res, next) => {
  req.services = services;
  next();
});
```

Simple, clean, effective - perfect for a hobby project!