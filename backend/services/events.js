/**
 * Event Constants
 * 
 * Centralized event type definitions for the EventEmitterService.
 * This ensures consistent event naming and makes refactoring easier.
 */

// Task Events
export const TASK_EVENTS = {
  CREATED: 'task.created',
  UPDATED: 'task.updated',
  DELETED: 'task.deleted',
  STATE_CHANGED: 'task.state-changed'
};

// Terminal Events
export const TERMINAL_EVENTS = {
  CREATED: 'terminal.created',
  STATE_CHANGED: 'terminal.state-changed',
  CLOSED: 'terminal.closed'
};

// AI Events
export const AI_EVENTS = {
  STATE_CHANGED: 'ai.state-changed',
  ATTENTION_NEEDED: 'ai.attention-needed'
};

// Git Events
export const GIT_EVENTS = {
  STATUS_CHANGED: 'git.status-changed',
  OPERATION_COMPLETED: 'git.operation-completed'
};

// Project Events
export const PROJECT_EVENTS = {
  CREATED: 'project.created',
  UPDATED: 'project.updated',
  DELETED: 'project.deleted'
};

// Split View Events
export const SPLIT_EVENTS = {
  LAYOUT_CHANGED: 'split.layout-changed'
};

// Container Events
export const CONTAINER_EVENTS = {
  CREATED: 'container.created',
  STOPPED: 'container.stopped',
  RESTARTED: 'container.restarted',
  ERROR: 'container.error'
};

// Upload Events
export const UPLOAD_EVENTS = {
  FILE_ATTACHED: 'upload.file-attached',
  FILE_DELETED: 'upload.file-deleted',
  VALIDATION_FAILED: 'upload.validation-failed'
};

// Monitoring Events
export const MONITORING_EVENTS = {
  METRICS_COLLECTED: 'monitoring.metrics-collected',
  HEALTH_CRITICAL: 'monitoring.health-critical'
};

// All events (for pattern matching)
export const ALL_EVENTS = {
  ...TASK_EVENTS,
  ...TERMINAL_EVENTS,
  ...AI_EVENTS,
  ...GIT_EVENTS,
  ...PROJECT_EVENTS,
  ...SPLIT_EVENTS,
  ...CONTAINER_EVENTS,
  ...UPLOAD_EVENTS,
  ...MONITORING_EVENTS
};