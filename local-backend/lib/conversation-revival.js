/**
 * Conversation Revival Handler
 * Enables resuming previous Claude conversations using stored session IDs
 */

export class ConversationRevivalHandler {
  constructor(containerManager) {
    this.containerManager = containerManager;
  }

  /**
   * Resume a previous task conversation
   * @param {string} originalTaskId - The task ID with the session to resume
   * @param {string} continuationInstructions - New instructions to continue with
   * @param {object} options - Additional options
   * @returns {Promise<object>} New task with resumed conversation
   */
  async resumeConversation(originalTaskId, continuationInstructions, options = {}) {
    // Get the original task to extract session ID
    const originalTask = await this.containerManager.getTask(originalTaskId);
    
    if (!originalTask) {
      throw new Error(`Original task ${originalTaskId} not found`);
    }

    if (!originalTask.sessionId || originalTask.sessionId === 'null') {
      throw new Error('Original task has no valid session ID to resume');
    }

    // Get the engineer who worked on the original task
    const engineer = this.containerManager.engineers.get(originalTask.engineerId);
    if (!engineer) {
      throw new Error(`Engineer ${originalTask.engineerId} not found`);
    }

    if (engineer.status !== 'idle') {
      throw new Error(`Engineer ${engineer.name} is currently busy`);
    }

    // Prepare the new task with session continuation
    const revivalTask = {
      repository: originalTask.repository,
      branch: originalTask.branch || originalTask.repository?.branch,
      description: continuationInstructions,
      acceptanceCriteria: originalTask.acceptanceCriteria || [],
      model: originalTask.model || 'claude-sonnet-4-0',
      
      // Critical: Pass the session ID for revival
      sessionId: originalTask.sessionId,
      isRevival: true,
      parentTaskId: originalTaskId,
      
      // Include context about the original task
      revivalContext: {
        originalDescription: originalTask.description || originalTask.task,
        originalResult: originalTask.result?.summary || originalTask.result,
        filesChanged: originalTask.filesChanged || [],
        prUrl: originalTask.prUrl,
        featureBranch: originalTask.featureBranch
      },
      
      ...options
    };

    // Assign the task with special handling for revival
    const newTask = await this.containerManager.assignTask(engineer.id, revivalTask);
    
    // Store the revival relationship
    if (this.containerManager.db) {
      const { taskEvents } = await import('../db/schema.js');
      const { db } = await import('../db/index.js');
      
      await db.insert(taskEvents).values({
        taskId: newTask.id,
        eventType: 'conversation_revived',
        eventData: {
          originalTaskId,
          sessionId: originalTask.sessionId,
          revivalReason: options.reason || 'user_requested'
        },
        createdAt: new Date()
      });
    }

    return newTask;
  }

  /**
   * Check if a task can be revived
   * @param {string} taskId - The task ID to check
   * @returns {Promise<object>} Revival eligibility status
   */
  async canReviveConversation(taskId) {
    try {
      const task = await this.containerManager.getTask(taskId);
      
      if (!task) {
        return {
          canRevive: false,
          reason: 'Task not found'
        };
      }

      if (!task.sessionId || task.sessionId === 'null') {
        return {
          canRevive: false,
          reason: 'No session ID available'
        };
      }

      // Check if session is too old (Claude sessions expire)
      const taskAge = Date.now() - new Date(task.completedAt || task.startTime).getTime();
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (taskAge > maxAge) {
        return {
          canRevive: false,
          reason: 'Session too old (>7 days)',
          sessionId: task.sessionId,
          age: taskAge
        };
      }

      // Check if engineer is available
      const engineer = this.containerManager.engineers.get(task.engineerId);
      if (!engineer) {
        return {
          canRevive: false,
          reason: 'Original engineer not found'
        };
      }

      return {
        canRevive: true,
        sessionId: task.sessionId,
        engineerId: task.engineerId,
        engineerName: engineer.name,
        engineerAvailable: engineer.status === 'idle',
        originalDescription: task.description || task.task,
        completedAt: task.completedAt
      };

    } catch (error) {
      return {
        canRevive: false,
        reason: `Error: ${error.message}`
      };
    }
  }

  /**
   * Get tasks that can potentially be revived
   * @param {object} filters - Optional filters
   * @returns {Promise<array>} List of revivable tasks
   */
  async getRevivableTasks(filters = {}) {
    const { db } = await import('../db/index.js');
    const { tasks } = await import('../db/schema.js');
    const { and, isNotNull, gte, eq } = await import('drizzle-orm');
    
    const conditions = [
      isNotNull(tasks.sessionId),
      eq(tasks.status, 'complete')
    ];

    // Add time filter (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    conditions.push(gte(tasks.completedAt, sevenDaysAgo));

    // Add engineer filter if specified
    if (filters.engineerId) {
      conditions.push(eq(tasks.engineerProfileId, filters.engineerId));
    }

    const revivableTasks = await db.query.tasks.findMany({
      where: and(...conditions),
      with: {
        engineerProfile: true
      },
      orderBy: (tasks, { desc }) => [desc(tasks.completedAt)],
      limit: 20
    });

    // Check each task's revival eligibility
    const tasksWithStatus = await Promise.all(
      revivableTasks.map(async (task) => {
        const status = await this.canReviveConversation(task.id);
        return {
          ...task,
          revivalStatus: status
        };
      })
    );

    return tasksWithStatus.filter(t => t.revivalStatus.canRevive);
  }
}

export default ConversationRevivalHandler;