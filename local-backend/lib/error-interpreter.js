/**
 * Error Interpreter - Supervisor Module
 * Provides human-friendly natural language interpretations of technical errors
 */

export class ErrorInterpreter {
  constructor() {
    this.interpretations = new Map();
  }

  /**
   * Interpret validation errors into natural language
   * @param {Object} result - Task result with errors
   * @returns {Object} Natural language interpretation
   */
  interpretValidationErrors(result) {
    if (!result.validationErrors || result.validationErrors.length === 0) {
      return null;
    }

    const errors = result.validationErrors;
    const errorTypes = errors.map(e => e.check);
    
    // Build a context-aware message based on the combination of errors
    let interpretation = {
      summary: this.getSummary(errorTypes),
      explanation: this.getExplanation(errors),
      nextSteps: this.getNextSteps(errors),
      quickFixes: this.getQuickFixes(errors)
    };

    return interpretation;
  }

  getSummary(errorTypes) {
    // Provide context-aware summaries based on error combinations
    if (errorTypes.includes('apiKey') && errorTypes.includes('gitCredentials')) {
      return "I need valid credentials to complete this task";
    } else if (errorTypes.includes('apiKey')) {
      return "I don't have access to the AI service";
    } else if (errorTypes.includes('repository')) {
      return "I can't access the repository you specified";
    } else if (errorTypes.includes('taskConfig')) {
      return "The task needs more details";
    } else if (errorTypes.includes('docker')) {
      return "There's an issue with my development environment";
    } else if (errorTypes.includes('diskSpace')) {
      return "I don't have enough space to work on this task";
    }
    
    return "I encountered some issues preparing for this task";
  }

  getExplanation(errors) {
    const explanations = [];
    
    errors.forEach(error => {
      switch (error.check) {
        case 'apiKey':
          if (error.message.includes('missing')) {
            explanations.push("The Anthropic API key isn't configured. This key allows me to think and write code.");
          } else if (error.message.includes('invalid') || error.message.includes('expired')) {
            explanations.push("The Anthropic API key seems to be invalid or expired. I tested it and couldn't authenticate.");
          }
          break;
          
        case 'gitCredentials':
          explanations.push("The GitHub token isn't working properly. I need a fine-grained personal access token with specific permissions: Contents (to read and write code), Pull requests (to create PRs), and Metadata (basic repo info).");
          break;
          
        case 'repository':
          if (error.message.includes('URL format')) {
            explanations.push("The repository URL doesn't look right. It should be something like 'https://github.com/owner/repo'.");
          } else if (error.message.includes('private')) {
            explanations.push("This appears to be a private repository. I'll need valid credentials to access it.");
          }
          break;
          
        case 'taskConfig':
          if (error.message.includes('description')) {
            explanations.push("I need a clearer description of what you want me to build. The current description is too brief.");
          }
          if (error.message.includes('acceptance criteria')) {
            explanations.push("Please tell me how you'll know when the task is complete. What should the feature do?");
          }
          break;
          
        case 'docker':
          if (error.message.includes('not found')) {
            explanations.push("Docker isn't installed or isn't running. I need Docker to create an isolated environment for development.");
          } else if (error.message.includes('image')) {
            explanations.push("My development environment image is missing. You may need to rebuild the Docker images.");
          }
          break;
      }
    });
    
    return explanations.join(' ');
  }

  getNextSteps(errors) {
    const steps = [];
    const hasApiKey = errors.some(e => e.check === 'apiKey');
    const hasGitCreds = errors.some(e => e.check === 'gitCredentials');
    const hasDocker = errors.some(e => e.check === 'docker');
    
    if (hasApiKey) {
      steps.push("1. Get an Anthropic API key from https://console.anthropic.com");
      steps.push("2. Set it in your environment or project settings");
    }
    
    if (hasGitCreds) {
      const startNum = steps.length + 1;
      steps.push(`${startNum}. Create a GitHub fine-grained personal access token at https://github.com/settings/tokens?type=beta`);
      steps.push(`${startNum + 1}. Select the repositories you want to work with`);
      steps.push(`${startNum + 2}. Grant these Repository permissions:`);
      steps.push(`   - Contents: Read and write (to clone and push code)`);
      steps.push(`   - Pull requests: Read and write (to create PRs)`);
      steps.push(`   - Metadata: Read (always required)`);
      steps.push(`${startNum + 3}. Add the token to your project settings`);
    }
    
    if (hasDocker) {
      const startNum = steps.length + 1;
      steps.push(`${startNum}. Make sure Docker Desktop is running`);
      steps.push(`${startNum + 1}. Run 'docker-compose build' to create the development images`);
    }
    
    if (steps.length === 0) {
      // Generic next steps for other errors
      errors.forEach(error => {
        if (error.fix) {
          steps.push(error.fix);
        }
      });
    }
    
    return steps;
  }

  getQuickFixes(errors) {
    const fixes = [];
    
    errors.forEach(error => {
      switch (error.check) {
        case 'repository':
          if (error.message.includes('URL format')) {
            fixes.push({
              issue: 'Invalid repository URL',
              suggestion: 'Use a full GitHub URL like: https://github.com/octocat/Hello-World'
            });
          }
          break;
          
        case 'taskConfig':
          if (error.message.includes('description')) {
            fixes.push({
              issue: 'Task description too short',
              suggestion: 'Describe what feature you want built, including any specific requirements'
            });
          }
          break;
      }
    });
    
    return fixes;
  }

  /**
   * Interpret runtime errors from logs
   * @param {Array} logs - Container logs
   * @returns {Object} Natural language interpretation
   */
  interpretRuntimeErrors(logs) {
    // This would analyze logs for common patterns
    // For now, we'll focus on validation errors
    return null;
  }
}

export default ErrorInterpreter;