/**
 * Progress Monitor
 * Tracks and reports task execution progress with human-friendly messages
 */

import { EventEmitter } from 'events';

export class ProgressMonitor extends EventEmitter {
  constructor() {
    super();
    this.checkpoints = new Map();
    this.listeners = new Map();
  }

  /**
   * Register a progress listener for a task
   */
  addListener(taskId, callback) {
    if (!this.listeners.has(taskId)) {
      this.listeners.set(taskId, []);
    }
    this.listeners.get(taskId).push(callback);
  }

  /**
   * Remove listeners for a task
   */
  removeListeners(taskId) {
    this.listeners.delete(taskId);
    this.checkpoints.delete(taskId);
  }

  /**
   * Report a checkpoint
   */
  checkpoint(taskId, name, status = 'in_progress', details = null) {
    const checkpoint = {
      name,
      status, // 'pending', 'in_progress', 'completed', 'failed'
      details,
      timestamp: new Date(),
      message: this.getCheckpointMessage(name, status, details)
    };

    // Store checkpoint
    if (!this.checkpoints.has(taskId)) {
      this.checkpoints.set(taskId, []);
    }
    this.checkpoints.get(taskId).push(checkpoint);

    // Notify listeners
    const listeners = this.listeners.get(taskId) || [];
    listeners.forEach(callback => {
      try {
        callback(checkpoint);
      } catch (error) {
        console.error('Progress listener error:', error);
      }
    });

    // Emit event for SSE
    this.emit(`progress:${taskId}`, {
      summary: this.getStatusSummary(taskId),
      checkpoints: this.getCheckpoints(taskId)
    });

    return checkpoint;
  }

  /**
   * Get human-friendly checkpoint messages
   */
  getCheckpointMessage(name, status, details) {
    const messages = {
      // Pre-flight
      'preflight_start': {
        'in_progress': '🔍 Running pre-flight checks...',
        'completed': '✅ Pre-flight checks passed',
        'failed': '❌ Pre-flight validation failed'
      },

      // Repository operations
      'clone_start': {
        'in_progress': '📥 Cloning repository...',
        'completed': '✅ Repository cloned successfully',
        'failed': '❌ Failed to clone repository'
      },
      
      'checkout_branch': {
        'in_progress': `🌿 Creating feature branch...`,
        'completed': `✅ Feature branch created`,
        'failed': '❌ Failed to create branch'
      },

      // Task execution
      'claude_start': {
        'in_progress': '🤖 AI analyzing the task...',
        'completed': '✅ Task analysis complete',
        'failed': '❌ Task analysis failed'
      },

      'implementation_start': {
        'in_progress': '💻 Implementing features...',
        'completed': '✅ Implementation complete',
        'failed': '❌ Implementation failed'
      },

      'files_changed': {
        'in_progress': `📝 Modifying ${details?.count || 'multiple'} files...`,
        'completed': `✅ Modified ${details?.count || 'multiple'} files`,
        'failed': '❌ File modification failed'
      },

      // Verification
      'verification_start': {
        'in_progress': '🧪 Running verification tests...',
        'completed': '✅ All tests passed!',
        'failed': '❌ Verification failed'
      },

      'verification_retry': {
        'in_progress': `🔄 Fixing verification issues (attempt ${details?.attempt || 2})...`,
        'completed': '✅ Verification issues fixed',
        'failed': '❌ Could not fix verification issues'
      },

      // Git operations
      'git_stage': {
        'in_progress': '📦 Staging changes...',
        'completed': `✅ ${details?.count || 'All'} files staged`,
        'failed': '❌ Failed to stage changes'
      },

      'git_commit': {
        'in_progress': '💾 Committing changes...',
        'completed': '✅ Changes committed',
        'failed': '❌ Failed to commit'
      },

      'git_push': {
        'in_progress': '🚀 Pushing to remote...',
        'completed': '✅ Pushed to remote branch',
        'failed': '❌ Failed to push'
      },

      // Completion
      'task_complete': {
        'completed': `🎉 Task completed successfully in ${details?.duration || 'unknown'}!`,
        'failed': '❌ Task failed'
      },
      
      // Claude streaming events
      'claude_tool_use': {
        'in_progress': `🔧 ${details?.message || 'Using tool...'}`,
        'completed': '✅ Tool execution complete',
        'failed': '❌ Tool execution failed'
      },
      
      'claude_thinking': {
        'in_progress': '🤔 Claude is analyzing...',
        'completed': '✅ Analysis complete',
        'failed': '❌ Analysis failed'
      },
      
      'claude_complete': {
        'completed': '✅ Claude finished processing',
        'failed': '❌ Claude processing failed'
      },
      
      // Progress updates
      'waiting_for_results': {
        'in_progress': `⏳ ${details?.message || 'Waiting for results...'}`,
        'completed': '✅ Results received',
        'failed': '❌ Timeout waiting for results'
      }
    };

    // Default message if not found
    const messageSet = messages[name] || {};
    return messageSet[status] || `${status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⏳'} ${name}`;
  }

  /**
   * Get all checkpoints for a task
   */
  getCheckpoints(taskId) {
    return this.checkpoints.get(taskId) || [];
  }

  /**
   * Get current status summary
   */
  getStatusSummary(taskId) {
    const checkpoints = this.getCheckpoints(taskId);
    if (checkpoints.length === 0) {
      return { status: 'pending', message: 'Task not started' };
    }

    const latest = checkpoints[checkpoints.length - 1];
    const elapsed = Date.now() - checkpoints[0].timestamp;
    const elapsedMin = Math.floor(elapsed / 60000);
    const elapsedSec = Math.floor((elapsed % 60000) / 1000);

    return {
      status: latest.status,
      message: latest.message,
      elapsed: elapsedMin > 0 ? `${elapsedMin}m ${elapsedSec}s` : `${elapsedSec}s`,
      checkpointCount: checkpoints.length,
      currentStep: latest.name
    };
  }
}

// Singleton instance
export const progressMonitor = new ProgressMonitor();