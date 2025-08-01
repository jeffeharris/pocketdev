import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp, cleanupTestApp } from '../utils/test-app.js';
import { seedTestData } from '../utils/test-db.js';

describe('Task Split Layout API - Edge Cases and Error Scenarios', () => {
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

  describe('Input validation edge cases', () => {
    it('should handle empty body in PUT request', async () => {
      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send({})
        .expect(200);

      // Empty body should be accepted and saved
      expect(response.body).toEqual({});
    });

    it('should handle null values in layout properties', async () => {
      const layoutWithNulls = {
        mode: 'split',
        primaryTerminalId: null,
        secondaryTerminalId: null,
        splitRatio: null
      };

      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(layoutWithNulls)
        .expect(200);

      expect(response.body).toEqual(layoutWithNulls);
    });

    it('should handle very long terminal IDs', async () => {
      const longId = 'a'.repeat(1000);
      const layout = {
        mode: 'split',
        primaryTerminalId: longId,
        secondaryTerminalId: longId + '-2'
      };

      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(layout)
        .expect(200);

      expect(response.body.primaryTerminalId).toBe(longId);
      expect(response.body.secondaryTerminalId).toBe(longId + '-2');
    });

    it('should handle unicode characters in terminal IDs', async () => {
      const layout = {
        primaryTerminalId: '终端-🚀-één',
        secondaryTerminalId: 'टर्मिनल-2'
      };

      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(layout)
        .expect(200);

      expect(response.body).toEqual(layout);
    });

    it('should handle boundary split ratio values with precision', async () => {
      // Test various precision levels
      const testCases = [
        0.1000000001,  // Just above minimum
        0.8999999999,  // Just below maximum
        0.123456789,   // High precision
        0.5            // Exact value
      ];

      for (const ratio of testCases) {
        const response = await request(app)
          .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
          .send({ splitRatio: ratio })
          .expect(200);

        expect(response.body.splitRatio).toBeCloseTo(ratio, 10);
      }
    });

    it('should reject negative split ratio', async () => {
      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send({ splitRatio: -0.5 })
        .expect(400);

      expect(response.body.error).toContain('Invalid splitRatio');
    });

    it('should reject split ratio greater than 1', async () => {
      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send({ splitRatio: 1.5 })
        .expect(400);

      expect(response.body.error).toContain('Invalid splitRatio');
    });

    it('should handle arrays and objects as invalid values', async () => {
      // Test array as mode
      let response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send({ mode: ['tab', 'split'] })
        .expect(400);

      expect(response.body.error).toContain('Invalid mode');

      // Test object as orientation
      response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send({ orientation: { type: 'horizontal' } })
        .expect(400);

      expect(response.body.error).toContain('Invalid orientation');
    });
  });

  describe('HTTP method and header tests', () => {
    it('should reject POST method on GET endpoint', async () => {
      await request(app)
        .post(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .expect(404);
    });

    it('should reject PATCH method on PUT endpoint', async () => {
      await request(app)
        .patch(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send({ mode: 'split' })
        .expect(404);
    });

    it('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .set('Content-Type', '')
        .send('{"mode": "split"}')
        .expect(200);

      // Express should still parse it correctly
      expect(response.body.mode).toBe('split');
    });

    it('should handle text/plain content type', async () => {
      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .set('Content-Type', 'text/plain')
        .send(JSON.stringify({ mode: 'split' }))
        .expect(200);

      expect(response.body.mode).toBe('split');
    });
  });

  describe('Concurrent access and race conditions', () => {
    it('should handle rapid sequential updates', async () => {
      const updates = [];
      for (let i = 0; i < 10; i++) {
        updates.push(
          request(app)
            .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
            .send({ splitRatio: (i + 1) / 10 })
        );
      }

      const responses = await Promise.all(updates);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Final value should be one of the sent values
      const finalTask = await db.get('SELECT split_layout FROM tasks WHERE id = ?', [testData.taskId]);
      const finalLayout = JSON.parse(finalTask.split_layout);
      expect(finalLayout.splitRatio).toBeGreaterThanOrEqual(0.1);
      expect(finalLayout.splitRatio).toBeLessThanOrEqual(1.0);
    });

    it('should handle GET requests during PUT operations', async () => {
      // Start a PUT request
      const putPromise = request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send({ mode: 'split', splitRatio: 0.7 });

      // Immediately send GET requests
      const getPromises = Array(5).fill(null).map(() => 
        request(app)
          .get(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
      );

      const [putResponse, ...getResponses] = await Promise.all([putPromise, ...getPromises]);

      expect(putResponse.status).toBe(200);
      getResponses.forEach(response => {
        expect(response.status).toBe(200);
        // Response should be either the old value or the new value
        expect(['tab', 'split']).toContain(response.body.mode);
      });
    });
  });

  describe('Special character and encoding tests', () => {
    it('should handle special characters in JSON', async () => {
      const layout = {
        mode: 'split',
        primaryTerminalId: 'term\n\r\t\b\f"\\/',
        customField: '< > & \' "',
      };

      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(layout)
        .expect(200);

      expect(response.body.primaryTerminalId).toBe('term\n\r\t\b\f"\\\/');
      expect(response.body.customField).toBe('< > & \' "');
    });

    it('should handle very large layout objects', async () => {
      const largeLayout = {
        mode: 'split',
        orientation: 'horizontal',
        splitRatio: 0.5
      };

      // Add many custom properties
      for (let i = 0; i < 100; i++) {
        largeLayout[`customProp${i}`] = `value${i}`.repeat(100);
      }

      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(largeLayout)
        .expect(200);

      expect(Object.keys(response.body).length).toBe(103); // 3 standard + 100 custom
    });
  });

  describe('Database constraint tests', () => {
    it('should handle task ID with special characters', async () => {
      const specialTaskId = "task-with-'quotes'-and-\"more\"";
      
      await db.run(
        `INSERT INTO tasks (id, project_id, name, branch, worktree_path, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [specialTaskId, testData.projectId, 'Special Task', 'feature/special', '/tmp/special', 'active']
      );

      const response = await request(app)
        .get(`/api/projects/${testData.projectId}/tasks/${encodeURIComponent(specialTaskId)}/split-layout`)
        .expect(200);

      expect(response.body.mode).toBe('tab');
    });

    it('should maintain data integrity with null project_id check', async () => {
      // Create a task with null project_id (shouldn't happen in practice)
      await db.run(
        `INSERT INTO tasks (id, project_id, name, branch, worktree_path, status, created_at)
         VALUES (?, NULL, ?, ?, ?, ?, datetime('now'))`,
        ['orphan-task', 'Orphan Task', 'feature/orphan', '/tmp/orphan', 'active']
      );

      const response = await request(app)
        .get(`/api/projects/${testData.projectId}/tasks/orphan-task/split-layout`)
        .expect(404);

      expect(response.body.error).toContain('Task not found in this project');
    });
  });

  describe('Performance and stress tests', () => {
    it('should handle layout with deeply nested objects', async () => {
      const createNestedObject = (depth) => {
        if (depth === 0) return 'value';
        return { nested: createNestedObject(depth - 1) };
      };

      const deepLayout = {
        mode: 'split',
        metadata: createNestedObject(10)
      };

      const response = await request(app)
        .put(`/api/projects/${testData.projectId}/tasks/${testData.taskId}/split-layout`)
        .send(deepLayout)
        .expect(200);

      expect(response.body.mode).toBe('split');
      expect(response.body.metadata).toBeDefined();
    });

    it('should handle multiple tasks with different layouts', async () => {
      // Create multiple tasks
      const taskIds = [];
      for (let i = 0; i < 5; i++) {
        const taskId = `test-task-${i}`;
        await db.run(
          `INSERT INTO tasks (id, project_id, name, branch, worktree_path, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
          [taskId, testData.projectId, `Task ${i}`, `feature/task-${i}`, `/tmp/task-${i}`, 'active']
        );
        taskIds.push(taskId);
      }

      // Set different layouts for each
      const layouts = taskIds.map((taskId, i) => ({
        taskId,
        layout: {
          mode: i % 2 === 0 ? 'split' : 'tab',
          splitRatio: (i + 1) / 10
        }
      }));

      // Update all layouts
      await Promise.all(layouts.map(({ taskId, layout }) =>
        request(app)
          .put(`/api/projects/${testData.projectId}/tasks/${taskId}/split-layout`)
          .send(layout)
      ));

      // Verify each layout is correctly stored
      for (const { taskId, layout } of layouts) {
        const response = await request(app)
          .get(`/api/projects/${testData.projectId}/tasks/${taskId}/split-layout`)
          .expect(200);

        expect(response.body).toMatchObject(layout);
      }
    });
  });
});