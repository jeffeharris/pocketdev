/**
 * PullRequestService - Pull request management
 * 
 * This service handles pull request operations and conflict checking.
 * It provides a clean interface for GitHub PR workflows with built-in 
 * mock support for development and testing.
 * 
 * Dependencies: None (leaf service)
 */

import { BaseService } from './base.service';
import type { IPullRequestService } from './interfaces/pull-request.service.interface';
import type { PullRequest } from '../types/git';

export class PullRequestService extends BaseService implements IPullRequestService {
  private mockPRCounter = 1000;

  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
    
    if (this.isMockEnabled) {
      this.initializeMockData();
    }
  }

  // Public interface - 2 simple methods following deep module principle

  async checkConflicts(taskId: string): Promise<boolean> {
    if (this.isMockEnabled) {
      // 30% chance of conflicts in mock mode
      return Math.random() > 0.7;
    }
    
    const result = await this.get<{ hasConflicts: boolean }>(`/tasks/${taskId}/git/check-conflicts`);
    return result.hasConflicts;
  }

  async createPR(taskId: string, description: string): Promise<PullRequest> {
    if (this.isMockEnabled) {
      const prId = this.mockPRCounter++;
      return {
        id: prId,
        url: `https://github.com/user/repo/pull/${prId}`,
        title: 'Mock PR',
        description,
        state: 'open',
        mergeable: true,
        conflicts: false,
      };
    }
    
    return this.post<PullRequest>(`/tasks/${taskId}/pr/create`, { description });
  }

  // Complex implementation details hidden from users

  protected initializeMockData(): void {
    // Reset mock counter for consistent testing
    this.mockPRCounter = 1000;
  }

  /**
   * Get current mock PR counter (for testing purposes)
   * @internal
   */
  public getMockState(): { prCounter: number } | null {
    return this.isMockEnabled ? { prCounter: this.mockPRCounter } : null;
  }

  /**
   * Reset mock state to initial values (for testing purposes)
   * @internal
   */
  public resetMockState(): void {
    if (this.isMockEnabled) {
      this.initializeMockData();
    }
  }
}