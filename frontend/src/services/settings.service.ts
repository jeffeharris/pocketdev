/**
 * SettingsService - Application settings management
 * 
 * This service handles user preferences, GitHub integration, and system information.
 * It provides a clean interface for managing application configuration with
 * built-in mock support for development and testing.
 * 
 * Dependencies: None (leaf service)
 */

import { BaseService } from './base.service';
import type { ISettingsService } from './interfaces/settings.service.interface';
import type { Settings, UpdateSettingsDTO, GithubTestResult } from '../api/settings';

export class SettingsService extends BaseService implements ISettingsService {
  private mockSettings: Settings = {
    hasGithubToken: false,
    gitUserName: '',
    gitUserEmail: ''
  };

  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
    
    if (this.isMockEnabled) {
      this.initializeMockData();
    }
  }

  // Public interface - 4 simple methods following deep module principle

  async getSettings(): Promise<Settings> {
    if (this.isMockEnabled) {
      return { ...this.mockSettings };
    }
    
    return this.get<Settings>('/settings');
  }

  async updateSettings(settings: UpdateSettingsDTO): Promise<{ message: string; hasGithubToken: boolean }> {
    if (this.isMockEnabled) {
      // Update mock data with provided settings
      if (settings.gitUserName !== undefined) {
        this.mockSettings.gitUserName = settings.gitUserName;
      }
      if (settings.gitUserEmail !== undefined) {
        this.mockSettings.gitUserEmail = settings.gitUserEmail;
      }
      if (settings.githubToken !== undefined) {
        this.mockSettings.hasGithubToken = settings.githubToken.length > 0;
        this.mockSettings.githubToken = settings.githubToken;
      }
      
      return { 
        message: 'Settings updated successfully', 
        hasGithubToken: this.mockSettings.hasGithubToken 
      };
    }
    
    return this.put<{ message: string; hasGithubToken: boolean }>('/settings', settings);
  }

  async testGithubToken(): Promise<GithubTestResult> {
    if (this.isMockEnabled) {
      // Simulate successful test if token exists, failure otherwise
      if (this.mockSettings.hasGithubToken) {
        return { 
          valid: true, 
          user: { 
            login: 'mockuser', 
            name: 'Mock User', 
            email: 'mock@example.com' 
          } 
        };
      } else {
        return {
          valid: false,
          error: 'No GitHub token configured'
        };
      }
    }
    
    return this.post<GithubTestResult>('/settings/test-github');
  }

  async getSystemInfo(): Promise<{
    projectsDir: string;
    nodeVersion: string;
    platform: string;
  }> {
    if (this.isMockEnabled) {
      return { 
        projectsDir: '/projects',
        nodeVersion: 'v18.0.0',
        platform: 'linux'
      };
    }
    
    return this.get<{
      projectsDir: string;
      nodeVersion: string;
      platform: string;
    }>('/settings/system-info');
  }

  // Complex implementation details hidden from users

  protected initializeMockData(): void {
    this.mockSettings = {
      hasGithubToken: false,
      gitUserName: 'Mock Developer',
      gitUserEmail: 'dev@example.com',
      fileExists: true,
      fileHasToken: false
    };
  }

  /**
   * Get current mock settings state (for testing purposes)
   * @internal
   */
  public getMockState(): Settings | null {
    return this.isMockEnabled ? { ...this.mockSettings } : null;
  }

  /**
   * Reset mock settings to initial state (for testing purposes)
   * @internal
   */
  public resetMockState(): void {
    if (this.isMockEnabled) {
      this.initializeMockData();
    }
  }
}