import type { PullRequest } from '../../types/git';

/**
 * PullRequestService Interface - Pull request management
 * 
 * Handles pull request operations and conflict checking.
 * This service integrates with GitHub for PR workflows.
 */

export interface IPullRequestService {
  /**
   * Check for merge conflicts with base branch
   * @param taskId Task identifier
   * @returns Promise<boolean> True if conflicts exist
   */
  checkConflicts(taskId: string): Promise<boolean>;

  /**
   * Create a pull request for the task
   * @param taskId Task identifier
   * @param description PR description
   * @returns Promise<PullRequest> Created pull request details
   */
  createPR(taskId: string, description: string): Promise<PullRequest>;
}