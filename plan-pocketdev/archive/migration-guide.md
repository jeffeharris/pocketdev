# Migration Guide: From Monolith to Modular Architecture

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


This guide helps you migrate from the old monolithic `project-manager-db.js` to the new modular architecture.

## What Changed

### File Structure
- **Before**: Single 2000+ line `project-manager-db.js` file
- **After**: 20+ focused modules organized by responsibility

### Main Entry Point
- **Before**: `node project-manager-db.js`
- **After**: `node server.js`

### Docker Configuration
- **Before**: `CMD ["node", "project-manager-db.js"]`
- **After**: `CMD ["node", "server.js"]`

## Migration Steps

### 1. Update package.json scripts

```json
{
  "scripts": {
    "start": "node server.js",
    "start:old": "node project-manager-db.js",
    "dev": "nodemon server.js"
  }
}
```

### 2. Update Docker configurations

In your `docker-compose.yml`:

```yaml
command: >
  sh -c "cd /app/server && npm install && node server.js"
```

### 3. Environment Variables

No changes needed - all environment variables work the same:
- `PORT`
- `PROJECTS_DIR`
- `GITHUB_TOKEN`
- `SHELLTENDER_API_URL`
- `SHELLTENDER_WS_URL`

### 4. API Endpoints

All API endpoints remain the same. No frontend changes needed.

## Finding Code in the New Structure

### Where did my code go?

| Old Location (project-manager-db.js) | New Location |
|--------------------------------------|--------------|
| Project endpoints (lines 206-440) | `controllers/project.controller.js` |
| Task endpoints (lines 441-750) | `controllers/task.controller.js` |
| Git operations (lines 157-205) | `services/git.service.js` |
| Cleanup functions (lines 96-156) | `services/cleanup.service.js` |
| Settings management | `controllers/settings.controller.js` |
| Terminal/session endpoints | `controllers/terminal.controller.js` |
| Upload endpoints | `controllers/upload.controller.js` |
| Database initialization | `server.js` |
| Express app setup | `app.js` |
| Route definitions | `routes/*.js` |

### Common Tasks

#### Adding a New Endpoint

**Before**: Add to the massive project-manager-db.js file

**After**:
1. Add method to appropriate controller
2. Add route to appropriate route file
3. Test independently

#### Modifying Git Operations

**Before**: Search through project-manager-db.js for git commands

**After**: Look in `services/git.service.js`

#### Changing Database Schema

**Before**: Modify in project-manager-db.js initialization

**After**: 
1. Update `db/schema.sql`
2. Add migration in `server.js` if needed
3. Update relevant model in `db/models/`

## Custom Modifications

If you have custom modifications to `project-manager-db.js`:

### 1. Identify the Type of Modification

- **API Endpoint**: Move to appropriate controller
- **Business Logic**: Move to appropriate service
- **Database Query**: Move to appropriate model
- **Utility Function**: Move to services or create new utility module

### 2. Example Migration

If you added a custom endpoint in the old file:

```javascript
// OLD: In project-manager-db.js
app.get('/api/custom/myfeature', async (req, res) => {
  // custom logic here
});
```

**NEW**: 
1. Create or update a controller:
```javascript
// controllers/custom.controller.js
export async function myFeature(req, res, next) {
  try {
    // custom logic here
  } catch (error) {
    next(error);
  }
}
```

2. Add route:
```javascript
// routes/custom.routes.js
import { Router } from 'express';
import * as customController from '../controllers/custom.controller.js';

const router = Router();
router.get('/myfeature', customController.myFeature);
export default router;
```

3. Mount in routes/index.js:
```javascript
import customRoutes from './custom.routes.js';
router.use('/custom', customRoutes);
```

## Testing the Migration

1. **Start the new server**: `npm start`
2. **Test all endpoints**: Run your test suite or manually test
3. **Check logs**: Ensure no errors during startup
4. **Verify database**: Check that all data is accessible

## Rollback Plan

If you need to rollback:

1. The old `project-manager-db.js` is still available
2. Use `npm run start:old` to run the old version
3. Update Docker command back to use `project-manager-db.js`

## Benefits of Migration

1. **Easier Maintenance**: Find code by domain, not by scrolling
2. **Better Testing**: Test individual modules
3. **Cleaner Git History**: Changes are isolated to relevant files
4. **Team Collaboration**: Multiple developers can work without conflicts
5. **Performance**: Same performance, better code organization

## Troubleshooting

### "Cannot find module" errors
- Ensure you're running from the correct directory
- Check that all imports use `.js` extension for ES modules

### "Models not defined" errors
- Models are now in `req.app.locals.models`
- Ensure routes are mounted after database initialization

### Route not found (404) errors
- Check that routes are properly mounted in `routes/index.js`
- Verify the path matches the new routing structure

### Database connection errors
- Database initialization is now in `server.js`
- Check that `app.locals.models` is set before routes are mounted

## Need Help?

1. Check the [Server Architecture](../../docs/server-architecture.md) document
2. Compare old and new code side-by-side
3. Search for the function name in the new structure
4. Check git history for the refactoring commits