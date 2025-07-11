/**
 * Task Recovery Manager
 * Handles failure detection, recovery suggestions, and retry logic
 */

export default class TaskRecoveryManager {
  constructor() {
    this.recoveryStrategies = this.initializeStrategies();
  }

  initializeStrategies() {
    return {
      'git_auth_failure': {
        patterns: [
          /could not read Username/i,
          /Authentication failed/i,
          /Invalid username or password/i,
          /repository not found/i
        ],
        recoverable: true,
        suggestions: [
          'Configure git credentials in project settings',
          'Use SSH URL instead of HTTPS',
          'Ensure repository is accessible with provided credentials',
          'Check if personal access token has required permissions'
        ],
        autoRecovery: async (task, credentials) => {
          // Return updated environment with credentials
          return {
            GIT_USERNAME: credentials.gitUsername,
            GIT_PASSWORD: credentials.gitToken,
            REPO_URL: this.convertToAuthUrl(task.repository, credentials)
          };
        }
      },
      
      'dependency_failure': {
        patterns: [
          /npm install failed/i,
          /Cannot find module/i,
          /ENOENT.*package\.json/i,
          /npm ERR!/
        ],
        recoverable: true,
        suggestions: [
          'Check if package.json exists',
          'Verify Node.js version compatibility',
          'Clear npm cache and retry',
          'Check for private registry configuration'
        ],
        autoRecovery: async (task) => {
          return {
            PRE_INSTALL_COMMANDS: [
              'npm cache clean --force',
              'rm -rf node_modules package-lock.json',
              'npm install --legacy-peer-deps'
            ]
          };
        }
      },
      
      'permission_failure': {
        patterns: [
          /Permission denied/i,
          /EACCES/i,
          /cannot create directory/i
        ],
        recoverable: true,
        suggestions: [
          'Check file and directory permissions',
          'Ensure container has write access to workspace',
          'Verify Docker volume mounts'
        ]
      },
      
      'verification_failure': {
        patterns: [
          /verify\.(js|py) failed/i,
          /AssertionError/i,
          /Test failed/i,
          /verification failed/i
        ],
        recoverable: true,
        suggestions: [
          'Review verification script requirements',
          'Check if implementation matches acceptance criteria',
          'Ensure all dependencies are installed',
          'Run verification script locally for debugging'
        ],
        autoRecovery: async (task, context) => {
          // Request Claude to fix verification issues
          return {
            VERIFICATION_RETRY: true,
            VERIFICATION_CONTEXT: context.verificationError,
            TASK_UPDATE: `Fix the verification error: ${context.verificationError}`
          };
        }
      },
      
      'timeout_failure': {
        patterns: [
          /Task timeout/i,
          /Maximum execution time/i
        ],
        recoverable: false,
        suggestions: [
          'Break down task into smaller subtasks',
          'Increase timeout limit for complex tasks',
          'Check for infinite loops or blocking operations'
        ]
      }
    };
  }

  /**
   * Analyze task failure and provide recovery options
   */
  analyzeFailure(task, logs) {
    const errorText = this.extractErrorText(task, logs);
    
    for (const [failureType, strategy] of Object.entries(this.recoveryStrategies)) {
      for (const pattern of strategy.patterns) {
        if (pattern.test(errorText)) {
          return {
            failureType,
            recoverable: strategy.recoverable,
            suggestions: strategy.suggestions,
            hasAutoRecovery: !!strategy.autoRecovery,
            errorDetails: errorText
          };
        }
      }
    }
    
    // Unknown failure
    return {
      failureType: 'unknown',
      recoverable: true,
      suggestions: [
        'Review task logs for more details',
        'Try running the task again',
        'Check system health and dependencies'
      ],
      errorDetails: errorText
    };
  }

  /**
   * Extract error text from task and logs
   */
  extractErrorText(task, logs = []) {
    let errorText = task.result?.error || '';
    
    // Add relevant log messages
    const errorLogs = logs
      .filter(log => log.type === 'stderr' || log.message?.includes('ERROR'))
      .map(log => log.message)
      .join(' ');
    
    return `${errorText} ${errorLogs}`;
  }

  /**
   * Attempt automatic recovery
   */
  async attemptAutoRecovery(task, failureAnalysis, context = {}) {
    const strategy = this.recoveryStrategies[failureAnalysis.failureType];
    
    if (!strategy?.autoRecovery) {
      return null;
    }
    
    try {
      const recoveryConfig = await strategy.autoRecovery(task, context);
      return {
        success: true,
        config: recoveryConfig,
        failureType: failureAnalysis.failureType
      };
    } catch (error) {
      console.error('Auto-recovery failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convert HTTPS URL to authenticated URL
   */
  convertToAuthUrl(repoUrl, credentials) {
    if (!credentials.gitUsername || !credentials.gitToken) {
      return repoUrl;
    }
    
    try {
      const url = new URL(repoUrl);
      if (url.protocol === 'https:') {
        url.username = credentials.gitUsername;
        url.password = credentials.gitToken;
      }
      return url.toString();
    } catch {
      return repoUrl;
    }
  }

  /**
   * Check if a task is recoverable
   */
  isRecoverable(task) {
    if (!task.result || task.result.success) {
      return false;
    }
    
    const analysis = this.analyzeFailure(task, task.result.logs || []);
    return analysis.recoverable;
  }

  /**
   * Generate recovery plan
   */
  generateRecoveryPlan(task, failureAnalysis) {
    return {
      taskId: task.id,
      failureType: failureAnalysis.failureType,
      recoverable: failureAnalysis.recoverable,
      immediateActions: failureAnalysis.suggestions.slice(0, 2),
      autoRecoveryAvailable: failureAnalysis.hasAutoRecovery,
      requiredInput: this.getRequiredInput(failureAnalysis.failureType),
      estimatedRetryTime: this.estimateRetryTime(failureAnalysis.failureType)
    };
  }

  /**
   * Get required input for recovery
   */
  getRequiredInput(failureType) {
    const inputMap = {
      'git_auth_failure': ['gitUsername', 'gitToken'],
      'dependency_failure': [],
      'permission_failure': [],
      'verification_failure': []
    };
    
    return inputMap[failureType] || [];
  }

  /**
   * Estimate retry time
   */
  estimateRetryTime(failureType) {
    const timeMap = {
      'git_auth_failure': 30,
      'dependency_failure': 120,
      'permission_failure': 60,
      'verification_failure': 180
    };
    
    return timeMap[failureType] || 60;
  }
}

export { TaskRecoveryManager };