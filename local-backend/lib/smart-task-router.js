/**
 * Smart Task Router - Automatically assigns tasks to the right engineer
 * Reduces user decisions and makes the experience feel magical
 */

export class SmartTaskRouter {
  constructor() {
    this.patterns = {
      frontend: [
        /\b(ui|ux|button|form|page|component|style|css|design|layout|responsive|mobile|desktop|screen|display|animation|transition)\b/i,
        /\b(react|vue|angular|svelte|frontend|client|browser)\b/i,
        /\b(dark mode|theme|color|font|spacing|padding|margin)\b/i
      ],
      backend: [
        /\b(api|endpoint|database|db|server|auth|authentication|login|user|account|data|fetch|save|store|crud)\b/i,
        /\b(node|express|django|rails|laravel|backend|service)\b/i,
        /\b(performance|optimize|cache|redis|query|sql)\b/i
      ],
      devops: [
        /\b(deploy|deployment|docker|kubernetes|k8s|ci|cd|pipeline|build|infrastructure)\b/i,
        /\b(aws|azure|gcp|cloud|server|nginx|apache)\b/i,
        /\b(monitor|logging|metrics|alert)\b/i
      ],
      qa_manual: [
        /\b(test|testing|qa|quality|bug|error|issue|broken|fix|verify|validation)\b/i,
        /\b(e2e|end-to-end|integration|unit test|spec)\b/i,
        /\b(coverage|regression|smoke test)\b/i
      ]
    };
  }

  /**
   * Determines the best engineer for a task based on description
   * @param {string} description - Task description
   * @returns {string} Engineer role
   */
  routeTask(description) {
    const scores = {
      frontend: 0,
      backend: 0,
      devops: 0,
      qa_manual: 0,
      fullstack: 0 // Default fallback
    };

    // Score each role based on pattern matches
    for (const [role, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        const matches = description.match(pattern);
        if (matches) {
          scores[role] += matches.length;
        }
      }
    }

    // Find the role with highest score
    let bestRole = 'fullstack';
    let highestScore = 0;

    for (const [role, score] of Object.entries(scores)) {
      if (score > highestScore) {
        highestScore = score;
        bestRole = role;
      }
    }

    // If no clear winner, check for mixed indicators
    if (highestScore === 0 || 
        (scores.frontend > 0 && scores.backend > 0)) {
      bestRole = 'fullstack';
    }

    return bestRole;
  }

  /**
   * Generates smart acceptance criteria based on task type
   * @param {string} description - Task description
   * @param {string} taskType - Type of task (feature, bug, etc)
   * @returns {string[]} Acceptance criteria
   */
  generateAcceptanceCriteria(description, taskType) {
    const criteria = [];

    switch (taskType) {
      case 'feature':
        criteria.push('Feature works as described');
        criteria.push('Tests are included and passing');
        criteria.push('Code follows project conventions');
        
        // Add specific criteria based on description
        if (description.toLowerCase().includes('mobile')) {
          criteria.push('Works correctly on mobile devices');
        }
        if (description.toLowerCase().includes('api')) {
          criteria.push('API documentation is updated');
          criteria.push('Error handling is implemented');
        }
        if (description.toLowerCase().includes('ui') || description.toLowerCase().includes('component')) {
          criteria.push('Component is accessible (ARIA compliant)');
          criteria.push('Responsive design is implemented');
        }
        break;

      case 'bug':
        criteria.push('Bug is fixed and verified');
        criteria.push('Root cause is identified');
        criteria.push('Regression test is added');
        criteria.push('No new bugs introduced');
        break;

      case 'refactor':
        criteria.push('Code is cleaner and more maintainable');
        criteria.push('All tests still pass');
        criteria.push('No functionality is changed');
        criteria.push('Performance is maintained or improved');
        break;

      case 'test':
        criteria.push('Tests cover the specified functionality');
        criteria.push('Tests are meaningful (not just for coverage)');
        criteria.push('Tests pass consistently');
        criteria.push('Edge cases are covered');
        break;
    }

    return criteria;
  }

  /**
   * Estimates task complexity and duration
   * @param {string} description - Task description
   * @param {string} taskType - Type of task
   * @returns {Object} Complexity and estimated duration
   */
  estimateComplexity(description, taskType) {
    const words = description.split(' ').length;
    const hasMultipleParts = description.includes(' and ') || description.includes(',');
    
    // Simple heuristics for complexity
    let complexity = 'simple';
    let estimatedMinutes = 5;

    if (words > 20 || hasMultipleParts) {
      complexity = 'complex';
      estimatedMinutes = 15;
    } else if (words > 10) {
      complexity = 'medium';
      estimatedMinutes = 10;
    }

    // Adjust based on task type
    if (taskType === 'bug') {
      estimatedMinutes *= 1.5; // Bugs often take longer
    } else if (taskType === 'test') {
      estimatedMinutes *= 0.8; // Tests are often quicker
    }

    return {
      complexity,
      estimatedMinutes: Math.round(estimatedMinutes),
      confidence: complexity === 'simple' ? 'high' : 'medium'
    };
  }

  /**
   * Enhances the task description with inferred details
   * @param {string} description - Original task description
   * @param {Object} projectContext - Current project context
   * @returns {string} Enhanced description
   */
  enhanceDescription(description, projectContext = {}) {
    let enhanced = description;

    // Add common sense defaults
    if (!description.includes('test') && !description.toLowerCase().includes('without test')) {
      enhanced += '. Include appropriate tests.';
    }

    if (description.includes('button') && !description.includes('accessible')) {
      enhanced += ' Ensure the button is accessible.';
    }

    if (description.includes('api') && !description.includes('error')) {
      enhanced += ' Include proper error handling.';
    }

    if (description.includes('mobile') && !description.includes('responsive')) {
      enhanced += ' Ensure responsive design.';
    }

    // Add project-specific context
    if (projectContext.framework === 'react' && description.includes('component')) {
      enhanced += ' Use functional components with hooks.';
    }

    return enhanced;
  }
}

export default SmartTaskRouter;