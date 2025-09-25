/**
 * @fileoverview JavaScript exports for shared types
 * This file re-exports the TypeScript type constants for use in JavaScript
 * Use JSDoc imports to get type checking in JavaScript files:
 * @typedef {import('./index').Task} Task
 */

// Re-export constants for JavaScript usage
export const WorkerStatus = {
  NotStarted: 'not-started',
  Idle: 'idle',
  Working: 'working',
  Waiting: 'waiting'
};

export const TaskState = {
  Active: 'active',
  Merged: 'merged',
  Archived: 'archived'
};

export const AIAgent = {
  Claude: 'claude',
  Codex: 'codex',
  Gemini: 'gemini',
  Aider: 'aider'
};

// Helper functions
export function isWorkerStatus(value) {
  return Object.values(WorkerStatus).includes(value);
}

export function isTaskState(value) {
  return Object.values(TaskState).includes(value);
}

export function isAIAgent(value) {
  return Object.values(AIAgent).includes(value);
}