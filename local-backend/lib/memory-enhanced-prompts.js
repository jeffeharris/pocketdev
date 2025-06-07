import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export class MemoryEnhancedPrompts {
  constructor() {
    this.memoryTypes = ['performance', 'failures', 'patterns'];
  }

  /**
   * Build an enhanced system prompt that includes relevant memories
   * @param {string} basePrompt - The engineer's base system prompt
   * @param {string} role - Engineer role (frontend, backend, etc)
   * @param {string} workspacePath - Path to the repository workspace
   * @returns {string} Enhanced system prompt with memories
   */
  async buildEnhancedPrompt(basePrompt, role, workspacePath) {
    const memories = await this.loadMemories(role, workspacePath);
    
    if (!memories || Object.keys(memories).length === 0) {
      // No memories yet, just add instructions about memory system
      return this.addMemoryInstructions(basePrompt);
    }
    
    // Build enhanced prompt with memories
    let enhancedPrompt = basePrompt + '\n\n';
    enhancedPrompt += '## PocketDev Team Memory\n\n';
    enhancedPrompt += 'You have access to memories from previous tasks in this codebase. ';
    enhancedPrompt += 'Apply these learnings to work more efficiently:\n\n';
    
    // Add performance optimizations
    if (memories.performance && memories.performance.length > 0) {
      enhancedPrompt += '### Known Performance Optimizations:\n';
      memories.performance.forEach(mem => {
        enhancedPrompt += `- ${mem.finding} (discovered ${mem.learned})\n`;
        if (mem.context) enhancedPrompt += `  Context: ${mem.context}\n`;
      });
      enhancedPrompt += '\n';
    }
    
    // Add failed approaches to avoid
    if (memories.failures && memories.failures.length > 0) {
      enhancedPrompt += '### Failed Approaches to Avoid:\n';
      memories.failures.forEach(mem => {
        enhancedPrompt += `- DON'T: ${mem.attempted}\n`;
        enhancedPrompt += `  Result: ${mem.result}\n`;
        if (mem.solution) enhancedPrompt += `  Instead: ${mem.solution}\n`;
      });
      enhancedPrompt += '\n';
    }
    
    // Add successful patterns
    if (memories.patterns && memories.patterns.length > 0) {
      enhancedPrompt += '### Successful Patterns in This Codebase:\n';
      memories.patterns.forEach(mem => {
        enhancedPrompt += `- ${mem.pattern}\n`;
        if (mem.example) enhancedPrompt += `  Example: ${mem.example}\n`;
      });
      enhancedPrompt += '\n';
    }
    
    enhancedPrompt += this.getMemoryUpdateInstructions();
    
    return enhancedPrompt;
  }

  /**
   * Load memories for a specific engineer role
   */
  async loadMemories(role, workspacePath) {
    const memories = {};
    const pocketdevPath = path.join(workspacePath, '.pocketdev', 'engineers', role);
    
    try {
      // Check if .pocketdev exists
      await fs.access(pocketdevPath);
      
      // Load each memory type
      for (const memType of this.memoryTypes) {
        const memPath = path.join(pocketdevPath, `${memType}.yml`);
        try {
          const content = await fs.readFile(memPath, 'utf8');
          const data = yaml.load(content);
          if (data && data.memories) {
            memories[memType] = data.memories;
          }
        } catch (err) {
          // Memory file doesn't exist or is invalid, skip
          console.log(`No ${memType} memories found for ${role}`);
        }
      }
    } catch (err) {
      // .pocketdev doesn't exist yet
      console.log('No .pocketdev directory found in workspace');
    }
    
    return memories;
  }

  /**
   * Add instructions about the memory system for new repos
   */
  addMemoryInstructions(basePrompt) {
    return basePrompt + `\n\n## PocketDev Memory System

This repository uses PocketDev's memory system to help you learn and improve over time.

As you work on tasks:
1. Note any performance optimizations you discover
2. Track approaches that don't work and why
3. Identify successful patterns specific to this codebase

These learnings will be automatically extracted and stored in .pocketdev/ to help you and other engineers work more efficiently in future tasks.

Look for:
- Slow operations that could be optimized
- API rate limits or constraints
- Codebase-specific conventions
- Environment quirks or requirements

Your discoveries will make the entire AI team more effective!`;
  }

  /**
   * Instructions for updating memories after task
   */
  getMemoryUpdateInstructions() {
    return `## Memory Updates

If you discover any of the following during this task, make a note:
1. Performance optimizations (e.g., "Using Promise.all() instead of sequential awaits reduced execution time by 80%")
2. Failed approaches (e.g., "Tried storing all logs in memory but caused OOM crash")
3. Successful patterns (e.g., "This codebase uses custom error classes for all domain errors")

These will be added to the team memory for future tasks.`;
  }

  /**
   * Extract memories from task results
   * This analyzes the task conversation and extracts learnings
   */
  async extractMemoriesFromTask(taskResult, role, workspacePath) {
    const memories = {
      performance: [],
      failures: [],
      patterns: []
    };
    
    // Parse logs to extract Claude's conversation
    const claudeLogs = this.extractClaudeLogs(taskResult.logs);
    
    // Look for explicit memory notes from Claude
    const memoryNotes = this.extractMemoryNotes(claudeLogs);
    
    // Also analyze for implicit learnings
    const implicitLearnings = this.analyzeForImplicitLearnings(taskResult, claudeLogs);
    
    // Combine and categorize
    memories.performance = [...memoryNotes.performance, ...implicitLearnings.performance];
    memories.failures = [...memoryNotes.failures, ...implicitLearnings.failures];
    memories.patterns = [...memoryNotes.patterns, ...implicitLearnings.patterns];
    
    // Save memories if any were found
    if (memories.performance.length > 0 || memories.failures.length > 0 || memories.patterns.length > 0) {
      await this.saveMemories(memories, role, workspacePath);
    }
    
    return memories;
  }

  /**
   * Extract Claude's logs from task logs
   */
  extractClaudeLogs(logs) {
    if (!logs || !Array.isArray(logs)) return [];
    
    return logs
      .filter(log => log.type === 'stdout')
      .map(log => log.message)
      .join('\n');
  }

  /**
   * Extract explicit memory notes from Claude's output
   */
  extractMemoryNotes(claudeLogs) {
    const memories = {
      performance: [],
      failures: [],
      patterns: []
    };
    
    // Look for performance optimization notes
    const perfRegex = /(?:performance optimization|discovered|found that|noticed).*?(?:faster|slower|better|worse|reduced|increased).*?(?:by \d+%|significantly)?/gi;
    const perfMatches = claudeLogs.match(perfRegex) || [];
    
    // Also look for more complete patterns with percentages
    const perfWithPercentRegex = /[^.]*(?:reduced|increased|improved|faster|slower)[^.]*\d+%[^.]*/gi;
    const percentMatches = claudeLogs.match(perfWithPercentRegex) || [];
    perfMatches.push(...percentMatches);
    
    perfMatches.forEach(match => {
      memories.performance.push({
        learned: new Date().toISOString(),
        finding: match.trim(),
        confidence: 'high'
      });
    });
    
    // Look for failure notes
    const failRegex = /(?:failed|didn't work|caused|error|issue|problem).*?(?:because|due to|when)/gi;
    const failMatches = claudeLogs.match(failRegex) || [];
    
    failMatches.forEach(match => {
      memories.failures.push({
        learned: new Date().toISOString(),
        attempted: match.trim(),
        result: 'Failed',
        confidence: 'medium'
      });
    });
    
    // Look for pattern discoveries
    const patternRegex = /(?:this codebase|this project|found that|uses|follows|implements).*?(?:pattern|convention|approach|style)/gi;
    const patternMatches = claudeLogs.match(patternRegex) || [];
    
    patternMatches.forEach(match => {
      memories.patterns.push({
        learned: new Date().toISOString(),
        pattern: match.trim(),
        confidence: 'medium'
      });
    });
    
    return memories;
  }

  /**
   * Analyze for implicit learnings based on task outcome
   */
  analyzeForImplicitLearnings(taskResult, claudeLogs) {
    const memories = {
      performance: [],
      failures: [],
      patterns: []
    };
    
    // If task failed, extract the failure reason
    if (!taskResult.success && taskResult.error) {
      memories.failures.push({
        learned: new Date().toISOString(),
        attempted: taskResult.taskDescription || 'Task execution',
        result: taskResult.error,
        confidence: 'high'
      });
    }
    
    // If verification failed, note the approach
    if (taskResult.testResults && taskResult.testResults.includes('failed')) {
      memories.failures.push({
        learned: new Date().toISOString(),
        attempted: 'Verification approach',
        result: taskResult.testResults,
        confidence: 'medium'
      });
    }
    
    // Look for timing information
    if (taskResult.duration) {
      if (taskResult.duration < 60) {
        memories.performance.push({
          learned: new Date().toISOString(),
          finding: `Task type "${taskResult.taskDescription}" completed quickly (${taskResult.duration}s)`,
          confidence: 'low'
        });
      } else if (taskResult.duration > 300) {
        memories.patterns.push({
          learned: new Date().toISOString(),
          pattern: `Task type "${taskResult.taskDescription}" requires extended time (${taskResult.duration}s)`,
          confidence: 'low'
        });
      }
    }
    
    return memories;
  }

  /**
   * Save memories to .pocketdev files
   */
  async saveMemories(memories, role, workspacePath) {
    const pocketdevPath = path.join(workspacePath, '.pocketdev', 'engineers', role);
    
    try {
      // Ensure directory exists
      await fs.mkdir(pocketdevPath, { recursive: true });
      
      // Save each memory type
      for (const [type, mems] of Object.entries(memories)) {
        if (mems.length === 0) continue;
        
        const filePath = path.join(pocketdevPath, `${type}.yml`);
        
        // Load existing memories
        let existing = { memories: [] };
        try {
          const content = await fs.readFile(filePath, 'utf8');
          existing = yaml.load(content) || { memories: [] };
        } catch (err) {
          // File doesn't exist, use empty
        }
        
        // Add new memories (avoiding duplicates)
        const combined = [...existing.memories];
        
        for (const newMem of mems) {
          // Simple duplicate check based on content similarity
          const isDuplicate = combined.some(existingMem => {
            const existingText = JSON.stringify(existingMem).toLowerCase();
            const newText = JSON.stringify(newMem).toLowerCase();
            return existingText.includes(newText.substring(0, 50)) || 
                   newText.includes(existingText.substring(0, 50));
          });
          
          if (!isDuplicate) {
            combined.push(newMem);
          }
        }
        
        // Limit to max memories
        if (combined.length > 50) {
          // Keep most recent
          combined.sort((a, b) => new Date(b.learned) - new Date(a.learned));
          combined.splice(50);
        }
        
        // Save updated memories
        const yamlContent = yaml.dump({ memories: combined });
        await fs.writeFile(filePath, yamlContent);
        
        console.log(`Saved ${mems.length} new ${type} memories for ${role}`);
      }
    } catch (err) {
      console.error('Failed to save memories:', err);
    }
  }
}

export default MemoryEnhancedPrompts;