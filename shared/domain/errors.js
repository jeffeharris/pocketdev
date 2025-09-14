/**
 * Simple error hierarchy for PocketDev
 * Using lightweight categories instead of complex domain-specific errors
 */

export class AppError extends Error {
  constructor(message, code, field = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.field = field;
  }
}

export class ValidationError extends AppError {
  constructor(field, message) {
    super(`${field}: ${message}`, 'VALIDATION', field);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity, id) {
    super(`${entity} with id ${id} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class SystemError extends AppError {
  constructor(message, originalError = null) {
    super(message, 'SYSTEM');
    this.name = 'SystemError';
    this.originalError = originalError;
  }
}