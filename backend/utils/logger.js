/**
 * Simple structured logger for observability
 * Outputs JSON for easy parsing by log aggregators
 */

class Logger {
  constructor(name = 'app') {
    this.name = name;
    this.timers = new Map();
  }

  /**
   * Start timing an operation
   */
  startTimer(operationId) {
    this.timers.set(operationId, Date.now());
  }

  /**
   * End timing and return duration in ms
   */
  endTimer(operationId) {
    const startTime = this.timers.get(operationId);
    if (!startTime) return null;
    
    const duration = Date.now() - startTime;
    this.timers.delete(operationId);
    return duration;
  }

  /**
   * Log with structured data
   */
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: this.name,
      message,
      ...data
    };

    // In production, this would go to a log aggregator
    // For now, output to console as JSON
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    } else {
      // Dev-friendly output
      const color = this._getColor(level);
      console.log(`${color}[${timestamp}] [${level.toUpperCase()}] ${this.name}: ${message}${this._reset}`, 
                  Object.keys(data).length > 0 ? data : '');
    }
  }

  info(message, data = {}) {
    this.log('info', message, data);
  }

  warn(message, data = {}) {
    this.log('warn', message, data);
  }

  error(message, data = {}) {
    this.log('error', message, data);
  }

  debug(message, data = {}) {
    if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') {
      this.log('debug', message, data);
    }
  }

  /**
   * Log an operation with timing
   */
  async timeOperation(operationName, operation, context = {}) {
    const timerId = `${operationName}-${Date.now()}`;
    this.startTimer(timerId);
    
    try {
      const result = await operation();
      const duration = this.endTimer(timerId);
      
      this.info(`${operationName} completed`, {
        ...context,
        duration_ms: duration,
        success: true
      });
      
      return result;
    } catch (error) {
      const duration = this.endTimer(timerId);
      
      this.error(`${operationName} failed`, {
        ...context,
        duration_ms: duration,
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(context = {}) {
    const childLogger = new Logger(this.name);
    childLogger.context = { ...this.context, ...context };
    return childLogger;
  }

  _getColor(level) {
    const colors = {
      debug: '\x1b[36m',  // Cyan
      info: '\x1b[32m',   // Green
      warn: '\x1b[33m',   // Yellow
      error: '\x1b[31m'   // Red
    };
    return colors[level] || '\x1b[37m';  // Default white
  }

  get _reset() {
    return '\x1b[0m';
  }
}

// Export singleton instance and class
export const logger = new Logger('pocketdev');
export { Logger };