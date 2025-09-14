import { ValidationError } from './errors.js';

/**
 * TerminalSession domain object - lightweight with validation
 * Represents an AI developer session in Shelltender
 */
export class TerminalSession {
  constructor(
    id,
    taskId,
    shelltenderId,
    tabName,
    tabOrder = 0,
    aiState = 'not-started',
    aiAgent = 'claude'
  ) {
    this.id = id;
    this.taskId = taskId;
    this.shelltenderId = shelltenderId;
    this.tabName = tabName;
    this.tabOrder = tabOrder;
    this.aiState = aiState; // 'not-started' | 'idle' | 'working' | 'waiting'
    this.aiAgent = aiAgent; // 'claude' | 'codex' | 'gemini' | 'aider'
    
    this.validate();
  }
  
  validate() {
    if (!this.id?.trim()) {
      throw new ValidationError('id', 'Session ID required');
    }
    
    if (!this.taskId?.trim()) {
      throw new ValidationError('taskId', 'Task ID required');
    }
    
    if (!this.shelltenderId?.trim()) {
      throw new ValidationError('shelltenderId', 'Shelltender ID required');
    }
    
    if (!this.tabName?.trim()) {
      throw new ValidationError('tabName', 'Tab name required');
    }
    
    const validStates = ['not-started', 'idle', 'working', 'waiting'];
    if (!validStates.includes(this.aiState)) {
      throw new ValidationError('aiState', `AI state must be one of: ${validStates.join(', ')}`);
    }
    
    const validAgents = ['claude', 'codex', 'gemini', 'aider'];
    if (!validAgents.includes(this.aiAgent)) {
      throw new ValidationError('aiAgent', `AI agent must be one of: ${validAgents.join(', ')}`);
    }
    
    if (typeof this.tabOrder !== 'number' || this.tabOrder < 0) {
      throw new ValidationError('tabOrder', 'Tab order must be a non-negative number');
    }
  }
  
  // Business rules
  isActive() {
    return this.aiState !== 'not-started';
  }
  
  canAcceptInput() {
    return this.aiState === 'idle' || this.aiState === 'waiting';
  }
  
  isWorking() {
    return this.aiState === 'working';
  }
  
  needsUserInput() {
    return this.aiState === 'waiting';
  }
  
  canStart() {
    return this.aiState === 'not-started';
  }
  
  canStop() {
    return this.aiState !== 'not-started';
  }
  
  // State transitions
  start() {
    if (!this.canStart()) {
      throw new ValidationError('aiState', 'Session already started');
    }
    this.aiState = 'idle';
  }
  
  startWorking() {
    if (!this.canAcceptInput()) {
      throw new ValidationError('aiState', 'Cannot start working from current state');
    }
    this.aiState = 'working';
  }
  
  completeWork() {
    if (!this.isWorking()) {
      throw new ValidationError('aiState', 'Not currently working');
    }
    this.aiState = 'idle';
  }
  
  requestInput() {
    if (!this.isWorking()) {
      throw new ValidationError('aiState', 'Can only request input while working');
    }
    this.aiState = 'waiting';
  }
  
  stop() {
    if (!this.canStop()) {
      throw new ValidationError('aiState', 'Session not started');
    }
    this.aiState = 'not-started';
  }
  
  // Factory method to create from database row
  static fromDatabase(row) {
    return new TerminalSession(
      row.id,
      row.task_id,
      row.shelltender_session_id || row.session_id,
      row.tab_name || `Session ${row.id.slice(0, 6)}`,
      row.tab_order || 0,
      row.ai_state || 'not-started',
      row.ai_agent || row.model || 'claude'
    );
  }
  
  // Convert to database format
  toDatabaseFormat() {
    return {
      id: this.id,
      task_id: this.taskId,
      shelltender_session_id: this.shelltenderId,
      session_id: this.shelltenderId, // For backward compatibility
      tab_name: this.tabName,
      tab_order: this.tabOrder,
      ai_state: this.aiState,
      model: this.aiAgent
    };
  }
}