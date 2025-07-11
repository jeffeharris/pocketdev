import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { MemoryEnhancedPrompts } from '../lib/memory-enhanced-prompts.js';
import { RepoInitializer } from '../lib/repo-initializer.js';

describe('Memory System Integration', () => {
  let testDir;
  let memoryEnhancer;
  let repoInitializer;
  
  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `pocketdev-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    memoryEnhancer = new MemoryEnhancedPrompts();
    repoInitializer = new RepoInitializer();
  });
  
  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });
  
  describe('Repository Initialization', () => {
    it('should create .pocketdev directory structure', async () => {
      const result = await repoInitializer.initializeRepo(testDir, {
        name: 'test-project',
        repository: 'https://github.com/test/repo',
        defaultBranch: 'main'
      });
      
      expect(result.success).toBe(true);
      
      // Check directories exist
      const pocketdevPath = path.join(testDir, '.pocketdev');
      const stats = await fs.stat(pocketdevPath);
      expect(stats.isDirectory()).toBe(true);
      
      // Check engineer directories
      const engineers = ['frontend', 'backend', 'devops', 'fullstack', 'qa_manual'];
      for (const engineer of engineers) {
        const engineerPath = path.join(pocketdevPath, 'engineers', engineer);
        const engineerStats = await fs.stat(engineerPath);
        expect(engineerStats.isDirectory()).toBe(true);
        
        // Check memory files
        const memoryTypes = ['performance.yml', 'failures.yml', 'patterns.yml'];
        for (const memType of memoryTypes) {
          const memPath = path.join(engineerPath, memType);
          const memStats = await fs.stat(memPath);
          expect(memStats.isFile()).toBe(true);
        }
      }
      
      // Check config file
      const configPath = path.join(pocketdevPath, 'config.json');
      const configStats = await fs.stat(configPath);
      expect(configStats.isFile()).toBe(true);
    });
  });
  
  describe('Memory Enhancement', () => {
    it('should enhance prompt with memory instructions for new repos', async () => {
      const basePrompt = 'You are a backend engineer.';
      const role = 'backend';
      
      const enhanced = await memoryEnhancer.buildEnhancedPrompt(
        basePrompt,
        role,
        testDir
      );
      
      expect(enhanced).toContain(basePrompt);
      expect(enhanced).toContain('PocketDev Memory System');
      expect(enhanced).toContain('Note any performance optimizations');
    });
    
    it('should load and include existing memories', async () => {
      // Initialize repo first
      await repoInitializer.initializeRepo(testDir, {
        name: 'test-project',
        repository: 'https://github.com/test/repo'
      });
      
      // Add some test memories
      const testMemories = {
        performance: [{
          learned: '2025-06-07',
          finding: 'Using batch operations improved speed by 10x',
          confidence: 'high'
        }],
        failures: [{
          learned: '2025-06-06',
          attempted: 'Storing all data in memory',
          result: 'OOM crash with large datasets',
          solution: 'Use streaming instead'
        }],
        patterns: [{
          learned: '2025-06-05',
          pattern: 'This codebase uses dependency injection',
          example: 'See services/auth.js'
        }]
      };
      
      await memoryEnhancer.saveMemories(testMemories, 'backend', testDir);
      
      // Now enhance a prompt
      const basePrompt = 'You are a backend engineer.';
      const enhanced = await memoryEnhancer.buildEnhancedPrompt(
        basePrompt,
        'backend',
        testDir
      );
      
      expect(enhanced).toContain('Known Performance Optimizations');
      expect(enhanced).toContain('batch operations improved speed by 10x');
      expect(enhanced).toContain('Failed Approaches to Avoid');
      expect(enhanced).toContain('Storing all data in memory');
      expect(enhanced).toContain('Successful Patterns');
      expect(enhanced).toContain('dependency injection');
    });
  });
  
  describe('Memory Extraction', () => {
    it('should extract performance memories from task results', async () => {
      // Initialize repo
      await repoInitializer.initializeRepo(testDir, {
        name: 'test-project',
        repository: 'https://github.com/test/repo'
      });
      
      const taskResult = {
        success: true,
        taskDescription: 'Optimize API performance',
        logs: [
          { type: 'stdout', message: 'Analyzing current implementation...' },
          { type: 'stdout', message: 'Found that using Promise.all() instead of sequential awaits reduced execution time by 80%' },
          { type: 'stdout', message: 'Applied optimization to all API endpoints' }
        ],
        duration: 45
      };
      
      const memories = await memoryEnhancer.extractMemoriesFromTask(
        taskResult,
        'backend',
        testDir
      );
      
      expect(memories.performance.length).toBeGreaterThan(0);
      expect(memories.performance[0].finding).toContain('Promise.all()');
      expect(memories.performance[0].finding).toContain('80%');
      
      // Verify memories were saved
      const savedMemories = await memoryEnhancer.loadMemories('backend', testDir);
      expect(savedMemories.performance).toBeDefined();
      expect(savedMemories.performance.length).toBeGreaterThan(0);
    });
    
    it('should extract failure memories from failed tasks', async () => {
      // Initialize repo
      await repoInitializer.initializeRepo(testDir, {
        name: 'test-project',
        repository: 'https://github.com/test/repo'
      });
      
      const taskResult = {
        success: false,
        taskDescription: 'Implement caching layer',
        error: 'Redis connection timeout - cache server unreachable',
        testResults: 'test.py failed: ConnectionError',
        logs: [],
        duration: 120
      };
      
      const memories = await memoryEnhancer.extractMemoriesFromTask(
        taskResult,
        'backend',
        testDir
      );
      
      expect(memories.failures.length).toBeGreaterThan(0);
      expect(memories.failures[0].attempted).toContain('caching layer');
      expect(memories.failures[0].result).toContain('Redis connection timeout');
    });
    
    it('should avoid duplicate memories', async () => {
      // Initialize repo
      await repoInitializer.initializeRepo(testDir, {
        name: 'test-project',
        repository: 'https://github.com/test/repo'
      });
      
      const taskResult = {
        success: true,
        logs: [
          { type: 'stdout', message: 'Using Promise.all() reduced time by 80%' }
        ]
      };
      
      // Extract memories twice
      await memoryEnhancer.extractMemoriesFromTask(taskResult, 'backend', testDir);
      await memoryEnhancer.extractMemoriesFromTask(taskResult, 'backend', testDir);
      
      // Should only have one memory, not duplicates
      const memories = await memoryEnhancer.loadMemories('backend', testDir);
      expect(memories.performance.length).toBe(1);
    });
  });
  
  describe('Memory Impact', () => {
    it('should demonstrate memory improving task performance', async () => {
      // This is a conceptual test showing how memories would improve performance
      // In practice, this would be measured by actual task execution times
      
      // Initialize repo
      await repoInitializer.initializeRepo(testDir, {
        name: 'test-project',
        repository: 'https://github.com/test/repo'
      });
      
      // Simulate first task without memories
      const firstTaskPrompt = await memoryEnhancer.buildEnhancedPrompt(
        'You are a backend engineer.',
        'backend',
        testDir
      );
      
      expect(firstTaskPrompt).not.toContain('Known Performance Optimizations');
      
      // Add memories from first task
      await memoryEnhancer.saveMemories({
        performance: [{
          learned: new Date().toISOString(),
          finding: 'Database queries with .include() are 10x faster than separate queries',
          confidence: 'high'
        }]
      }, 'backend', testDir);
      
      // Second task now has access to memories
      const secondTaskPrompt = await memoryEnhancer.buildEnhancedPrompt(
        'You are a backend engineer.',
        'backend',
        testDir
      );
      
      expect(secondTaskPrompt).toContain('Known Performance Optimizations');
      expect(secondTaskPrompt).toContain('.include() are 10x faster');
      
      // This demonstrates that the second task would have access to learnings
      // that could prevent it from making the same performance mistakes
    });
  });
});