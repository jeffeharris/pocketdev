import express from 'express';
import { vi } from 'vitest';
import { createTestDatabase } from './test-db.js';
import { TaskController } from '../../controllers/task.controller.js';
import createTaskRoutes from '../../routes/task.routes.js';

// Mock models
function createMockModels(db) {
  return {
    tasks: {
      findById: async (id) => {
        const task = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
        if (task && task.split_layout) {
          task.split_layout = JSON.parse(task.split_layout);
        }
        return task;
      },
      
      update: async (id, updates) => {
        const fields = [];
        const values = [];
        
        for (const [key, value] of Object.entries(updates)) {
          if (key === 'split_layout') {
            fields.push(`${key} = ?`);
            values.push(JSON.stringify(value));
          } else {
            fields.push(`${key} = ?`);
            values.push(value);
          }
        }
        
        values.push(id);
        await db.run(
          `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`,
          values
        );
        
        return await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
      },
      
      findByProjectId: async (projectId) => {
        return await db.all('SELECT * FROM tasks WHERE project_id = ?', [projectId]);
      },
      
      generateId: () => `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    },
    
    projects: {
      findById: async (id) => {
        return await db.get('SELECT * FROM projects WHERE id = ?', [id]);
      }
    }
  };
}

// Mock WebSocket event service
const createMockWsEventService = () => ({
  broadcastToTask: vi.fn((taskId, event) => {
    // Mock implementation
  })
});

/**
 * Create a test Express app with routes configured
 */
export async function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Create test database
  const db = await createTestDatabase();
  
  // Create mock models
  const models = createMockModels(db);
  
  // Create mock WebSocket service
  const wsEventService = createMockWsEventService();
  
  // Set up services using closure-based DI (matching production)
  const services = {
    db,
    models,
    wsEventService
  };
  
  // Service middleware using closure
  app.use((req, res, next) => {
    req.services = services;
    next();
  });
  
  // Mock GitHub auth middleware - skip authentication in tests
  app.use((req, res, next) => {
    req.githubToken = 'mock-token';
    next();
  });
  
  // Create and mount task routes
  const taskRoutes = createTaskRoutes(models, '/tmp/test-projects');
  app.use('/api/projects/:projectId/tasks', taskRoutes);
  
  // Error handler
  app.use((err, req, res, next) => {
    console.error('Test app error:', err);
    res.status(err.status || 500).json({ error: err.message });
  });
  
  return { app, db, models, wsEventService, services };
}

/**
 * Clean up test resources
 */
export async function cleanupTestApp(testContext) {
  if (testContext.db) {
    await testContext.db.close();
  }
}