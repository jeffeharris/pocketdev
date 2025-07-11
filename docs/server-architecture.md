# Server Architecture Documentation

## Overview

The PocketDev server has been refactored from a monolithic 2000+ line file (`project-manager-db.js`) into a clean, modular architecture following the MVC pattern and SOLID principles.

## Architecture Principles

1. **Single Responsibility**: Each module has one clear purpose
2. **Separation of Concerns**: Controllers handle HTTP, services handle business logic
3. **Dependency Injection**: Dependencies are passed, not hard-coded
4. **Testability**: Each module can be unit tested independently
5. **Configuration Management**: Centralized configuration

## Directory Structure

```
simple/server/
├── server.js                    # Application entry point
├── app.js                       # Express application setup
├── config/
│   └── index.js                # Centralized configuration
├── controllers/                 # HTTP request/response handling
│   ├── project.controller.js   # Project CRUD operations
│   ├── task.controller.js      # Task management
│   ├── settings.controller.js  # Settings management
│   ├── monitoring.controller.js # AI monitoring endpoints
│   ├── terminal.controller.js  # Terminal session management
│   └── upload.controller.js    # File upload handling
├── services/                    # Business logic layer
│   ├── git.service.js          # Git command execution
│   ├── cleanup.service.js      # Resource cleanup operations
│   ├── merge.service.js        # Merge/rebase operations
│   └── worktree.service.js     # Git worktree management
├── routes/                      # Route definitions
│   ├── index.js                # Route factory & aggregator
│   ├── project.routes.js       # Project endpoints
│   ├── task.routes.js          # Task endpoints
│   ├── settings.routes.js      # Settings endpoints
│   ├── monitoring.routes.js    # Monitoring endpoints
│   ├── terminal.routes.js      # Terminal endpoints
│   └── upload.routes.js        # Upload endpoints
├── middleware/                  # Cross-cutting concerns
│   ├── error.middleware.js     # Global error handling
│   └── upload.middleware.js    # Multer configuration
└── db/                         # Database layer
    ├── index.js                # SQLite connection
    ├── schema.sql              # Database schema
    └── models/                 # Data access objects
        ├── index.js            # Model aggregator
        ├── project.js          # Project model
        ├── task.js             # Task model
        └── session.js          # Session model
```

## Module Responsibilities

### Core Files

#### `server.js`
- Application initialization
- Database setup and migrations
- Service initialization (Shelltender, AI monitoring)
- HTTP server creation
- Graceful shutdown handling

#### `app.js`
- Express application configuration
- Middleware setup (CORS, JSON parsing, static files)
- Route mounting (delegated to server.js)
- Error handler registration

#### `config/index.js`
- Centralized configuration management
- Environment variable handling
- Path configurations
- Default values

### Controllers

Controllers handle HTTP concerns: request validation, response formatting, and delegating to services.

#### `project.controller.js`
- Project CRUD operations
- GitHub integration
- Branch management

#### `task.controller.js`
- Task (worktree) creation and management
- Git operations on tasks
- Merge conflict detection
- Task deletion and archival

#### `settings.controller.js`
- GitHub token management
- System information
- Settings persistence

#### `monitoring.controller.js`
- AI session state tracking
- Notification management
- Session analytics

#### `terminal.controller.js`
- Terminal session creation
- Command execution
- Session listing and management

#### `upload.controller.js`
- Image upload handling
- File management for tasks

### Services

Services contain business logic and external integrations.

#### `git.service.js`
- Git command execution wrapper
- Credential management
- Branch operations
- Commit and diff utilities

#### `cleanup.service.js`
- Orphaned worktree detection
- Resource cleanup
- Archive operations

#### `merge.service.js`
- Merge operations
- Rebase operations
- Conflict detection and resolution

#### `worktree.service.js`
- Worktree creation and management
- Worktree status checking
- Claude prompt file creation

### Routes

Route modules define API endpoints and map them to controllers.

#### `routes/index.js`
- Route factory function
- Aggregates all route modules
- Handles dependency injection for task routes

### Middleware

#### `error.middleware.js`
- Global error handling
- Error response formatting
- 404 handling

#### `upload.middleware.js`
- Multer configuration
- File type validation
- Upload size limits

### Database Layer

#### `db/index.js`
- SQLite connection management
- Connection pooling
- Query execution

#### `db/models/*.js`
- Data access objects
- CRUD operations
- Complex queries
- Data validation

## Request Flow

1. **Request arrives** at Express server
2. **Middleware** processes request (CORS, body parsing)
3. **Router** matches URL pattern
4. **Controller** handles request:
   - Validates input
   - Calls service methods
   - Formats response
5. **Service** executes business logic:
   - Database operations via models
   - External API calls
   - File system operations
6. **Response** sent to client
7. **Error middleware** catches any errors

## Dependency Management

- **Controllers** depend on services and models (injected via `req.app.locals`)
- **Services** are stateless and can be instantiated per request
- **Models** depend on database connection
- **Routes** depend on controllers

## Configuration

All configuration is centralized in `config/index.js`:

```javascript
{
  port: 3005,
  projectsDir: '/projects',
  dbPath: '/data/pocketdev.db',
  githubToken: process.env.GITHUB_TOKEN,
  shelltenderApiUrl: 'http://localhost:8081',
  shelltenderWsUrl: 'ws://localhost:8080',
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    uploadsDir: '/data/uploads'
  }
}
```

## Error Handling

1. **Service layer** throws errors with descriptive messages
2. **Controllers** catch errors and pass to Express error handler
3. **Error middleware** formats error responses consistently
4. **Async errors** are caught automatically via error middleware

## Testing Strategy

Each layer can be tested independently:

1. **Unit tests** for services (mock dependencies)
2. **Integration tests** for controllers (test with real database)
3. **API tests** for routes (full stack testing)
4. **Model tests** for database operations

## Migration from Monolith

The refactoring preserved all functionality while improving:

1. **Maintainability**: Easy to find and modify features
2. **Testability**: Each module can be tested in isolation
3. **Scalability**: New features can be added without touching existing code
4. **Readability**: Clear separation of concerns
5. **Debugging**: Errors are easier to trace

## Adding New Features

To add a new feature:

1. Create a new controller in `controllers/`
2. Add business logic in `services/` if needed
3. Define routes in `routes/`
4. Add to route aggregator in `routes/index.js`
5. Create/update models if database changes needed
6. Add tests for each layer

## Performance Considerations

- **Database connections** are reused via connection pool
- **Services** are lightweight and stateless
- **File operations** use streaming where appropriate
- **Error handling** doesn't leak sensitive information

## Security

- **Input validation** in controllers
- **SQL injection prevention** via prepared statements
- **File upload restrictions** via middleware
- **API authentication** ready to be added
- **Error messages** don't expose internal details