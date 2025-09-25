import type { Settings, UpdateSettingsDTO, GithubTestResult } from '../../api/settings';

/**
 * SettingsService Interface - Application settings management
 * 
 * Handles user preferences, GitHub integration, and system information.
 * This service has no dependencies on other services.
 */
export interface ISettingsService {
  /**
   * Get current application settings
   * @returns Promise<Settings> Current settings including GitHub token status
   */
  getSettings(): Promise<Settings>;

  /**
   * Update application settings
   * @param settings Partial settings to update
   * @returns Promise<{ message: string; hasGithubToken: boolean }> Update result
   */
  updateSettings(settings: UpdateSettingsDTO): Promise<{ message: string; hasGithubToken: boolean }>;

  /**
   * Test GitHub token validity
   * @returns Promise<GithubTestResult> Token validation result with user info
   */
  testGithubToken(): Promise<GithubTestResult>;

  /**
   * Get system information
   * @returns Promise<SystemInfo> System details like paths, versions
   */
  getSystemInfo(): Promise<{
    projectsDir: string;
    nodeVersion: string;
    platform: string;
  }>;
}