import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp, cleanupTestApp } from '../utils/test-app.js';
import { seedTestData } from '../utils/test-db.js';

describe('Task Split Layout API', () => {
  let testContext;
  let app;
  let db;
  let models;
  let wsEventService;
  let testData;

  beforeEach(async () => {
    testContext = await createTestApp();
    app = testContext.app;
    db = testContext.db;
    models = testContext.models;
    wsEventService = testContext.wsEventService;
    
    // Seed test data
    testData = await seedTestData(db);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanupTestApp(testContext);
  });

  describe('GET /api/projects/:projectId/tasks/:taskId/split-layout', () => {
    it('should return default layout for task without custom layout', async () => {
      const response = await request(app)
        .get(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .expect(200);

      expect(response.body).toEqual({
        mode: 'tab',
        orientation: 'horizontal',
        primaryTerminalId: null,
        secondaryTerminalId: null,
        splitRatio: 0.5
      });
    });

    it('should return custom layout if set', async () => {
      // Set custom layout
      const customLayout = {
        mode: 'split',
        orientation: 'vertical',
        primaryTerminalId: 'term-1',
        secondaryTerminalId: 'term-2',
        splitRatio: 0.7
      };

      await db.run(
        'UPDATE tasks SET split_layout = ? WHERE id = ?',
        [JSON.stringify(customLayout), testData.taskId]
      );

      const response = await request(app)
        .get(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .expect(200);

      expect(response.body).toEqual(customLayout);
    });

    it('should return 404 if task not found', async () => {
      const response = await request(app)
        .get(`/api/projects/${testData.projectId}/tasks/non-existent-task/split-layout`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Task not found');
    });

    it('should return 404 if task belongs to different project', async () => {
      // Create another project and task
      await db.run(
        `INSERT INTO projects (id, name, repo_url, local_path, base_branch, created_at) 
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        ['other-project', 'Other Project', 'https://github.com/test/other', '/tmp/other', 'main']
      );

      const response = await request(app)
        .get(`/api/projects/other-project/tasks/${testData.taskId}/split-layout`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Task not found in this project');
    });
  });

  describe('PUT /api/projects/:projectId/tasks/:taskId/split-layout', () => {
    it('should update split layout successfully', async () => {
      const newLayout = {
        mode: 'split',
        orientation: 'horizontal',
        primaryTerminalId: 'term-1',
        secondaryTerminalId: 'term-2',
        splitRatio: 0.6
      };

      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(newLayout)
        .expect(200);

      expect(response.body).toEqual(newLayout);

      // Verify database update
      const task = await db.get('SELECT split_layout FROM tasks WHERE id = ?', [testData.taskId]);
      expect(JSON.parse(task.split_layout)).toEqual(newLayout);

      // Verify WebSocket broadcast
      expect(wsEventService.broadcastToTask).toHaveBeenCalledWith(
        testData.taskId,
        {
          type: 'split-layout-changed',
          data: { splitLayout: newLayout }
        }
      );
    });

    it('should accept minimal layout update', async () => {
      const minimalLayout = {
        mode: 'tab'
      };

      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(minimalLayout)
        .expect(200);

      expect(response.body).toEqual(minimalLayout);
    });

    it('should validate mode values', async () => {
      const invalidLayout = {
        mode: 'invalid-mode'
      };

      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(invalidLayout)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid mode. Must be "tab" or "split"');
    });

    it('should validate orientation values', async () => {
      const invalidLayout = {
        orientation: 'diagonal'
      };

      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(invalidLayout)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid orientation. Must be "horizontal" or "vertical"');
    });

    it('should validate split ratio range', async () => {
      // Test ratio too low
      let response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send({ splitRatio: 0.05 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid splitRatio. Must be between 0.1 and 0.9');

      // Test ratio too high
      response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send({ splitRatio: 0.95 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid splitRatio. Must be between 0.1 and 0.9');

      // Test invalid ratio value
      response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send({ splitRatio: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid splitRatio. Must be between 0.1 and 0.9');
    });

    it('should accept edge case split ratios', async () => {
      // Test minimum valid ratio
      let response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send({ splitRatio: 0.1 })
        .expect(200);

      expect(response.body.splitRatio).toBe(0.1);

      // Test maximum valid ratio
      response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send({ splitRatio: 0.9 })
        .expect(200);

      expect(response.body.splitRatio).toBe(0.9);
    });

    it('should return 404 if task not found', async () => {
      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/non-existent-task/split-layout`)
        .send({ mode: 'split' })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Task not found');
    });

    it('should return 404 if task belongs to different project', async () => {
      // Create another project
      await db.run(
        `INSERT INTO projects (id, name, repo_url, local_path, base_branch, created_at) 
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        ['other-project', 'Other Project', 'https://github.com/test/other', '/tmp/other', 'main']
      );

      const response = await request(app)
        .put(`/api/projects/other-project/tasks/${testData.taskId}/split-layout`)
        .send({ mode: 'split' })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Task not found in this project');
    });

    it('should handle complex layout updates', async () => {
      const complexLayout = {
        mode: 'split',
        orientation: 'vertical',
        primaryTerminalId: 'terminal-abc-123',
        secondaryTerminalId: 'terminal-def-456',
        splitRatio: 0.75,
        // Additional properties should be preserved
        customProperty: 'should-be-saved'
      };

      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(complexLayout)
        .expect(200);

      expect(response.body).toEqual(complexLayout);

      // Verify all properties are saved
      const task = await db.get('SELECT split_layout FROM tasks WHERE id = ?', [testData.taskId]);
      expect(JSON.parse(task.split_layout)).toEqual(complexLayout);
    });

    it('should convert string split ratio to number', async () => {
      const layoutWithStringRatio = {
        splitRatio: '0.5'
      };

      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(layoutWithStringRatio)
        .expect(200);

      expect(response.body.splitRatio).toBe(0.5);
      expect(typeof response.body.splitRatio).toBe('number');
    });

    it('should handle concurrent updates correctly', async () => {
      const layout1 = { mode: 'split', splitRatio: 0.4 };
      const layout2 = { mode: 'tab', splitRatio: 0.6 };

      // Send two updates concurrently
      const [response1, response2] = await Promise.all([
        request(app)
          .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
          .send(layout1),
        request(app)
          .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
          .send(layout2)
      ]);

      // Both should succeed
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);

      // The database should have one of the layouts (race condition is acceptable)
      const task = await db.get('SELECT split_layout FROM tasks WHERE id = ?', [testData.taskId]);
      const savedLayout = JSON.parse(task.split_layout);
      expect([layout1, layout2]).toContainEqual(savedLayout);
    });

    it('should not broadcast WebSocket event if wsEventService is not available', async () => {
      // Remove wsEventService
      app.locals.wsEventService = null;

      const newLayout = { mode: 'split' };

      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(newLayout)
        .expect(200);

      expect(response.body).toEqual(newLayout);
      // Should not throw error even without wsEventService
    });
  });

  describe('Database interaction tests', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      const originalGet = db.get;
      db.get = vi.fn().mockRejectedValue(new Error('Database connection lost'));

      const response = await request(app)
        .get(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .expect(500);

      expect(response.body).toHaveProperty('error');

      // Restore
      db.get = originalGet;
    });

    it('should handle JSON parsing errors for corrupted data', async () => {
      // Insert corrupted JSON
      await db.run(
        'UPDATE tasks SET split_layout = ? WHERE id = ?',
        ['{"invalid json', testData.taskId]
      );

      // The controller should handle this gracefully
      const response = await request(app)
        .get(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('WebSocket broadcasting tests', () => {
    it('should broadcast correct event structure', async () => {
      const layout = {
        mode: 'split',
        orientation: 'horizontal',
        splitRatio: 0.5
      };

      await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(layout)
        .expect(200);

      expect(wsEventService.broadcastToTask).toHaveBeenCalledTimes(1);
      const [taskId, event] = wsEventService.broadcastToTask.mock.calls[0];
      
      expect(taskId).toBe(testData.taskId);
      expect(event).toEqual({
        type: 'split-layout-changed',
        data: {
          splitLayout: layout
        }
      });
    });

    it('should include all layout properties in broadcast', async () => {
      const fullLayout = {
        mode: 'split',
        orientation: 'vertical',
        primaryTerminalId: 'term-1',
        secondaryTerminalId: 'term-2',
        splitRatio: 0.3
      };

      await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(fullLayout)
        .expect(200);

      const [, event] = wsEventService.broadcastToTask.mock.calls[0];
      expect(event.data.splitLayout).toEqual(fullLayout);
    });
  });
});