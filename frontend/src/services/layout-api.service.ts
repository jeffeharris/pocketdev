/**
 * LayoutAPIService - Network operations for split view layouts
 * 
 * This service encapsulates all HTTP operations for layout persistence,
 * following Ousterhout's principle of information hiding. The store no longer
 * needs to know about API endpoints, HTTP methods, or error handling details.
 */

import type { SplitLayoutConfig } from '../stores/splitViewStore';

class LayoutAPIService {
  private readonly baseUrl = '/api';
  
  /**
   * Load layout configuration for a task
   */
  async loadLayout(projectId: string, taskId: string): Promise<SplitLayoutConfig | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/projects/${projectId}/tasks/${taskId}/split-layout`
      );
      
      if (response.ok) {
        return await response.json();
      }
      
      // 404 is expected when no layout exists yet
      if (response.status === 404) {
        return null;
      }
      
      // Log unexpected errors
      console.error(`Failed to load layout: ${response.status} ${response.statusText}`);
      return null;
    } catch (error) {
      console.error('Error loading split layout:', error);
      return null;
    }
  }
  
  /**
   * Save layout configuration for a task
   */
  async saveLayout(
    projectId: string, 
    taskId: string, 
    layout: SplitLayoutConfig
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/projects/${projectId}/tasks/${taskId}/split-layout`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(layout)
        }
      );
      
      if (!response.ok) {
        console.error(`Failed to save layout: ${response.status} ${response.statusText}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error saving split layout:', error);
      return false;
    }
  }
  
  /**
   * Delete layout configuration for a task
   */
  async deleteLayout(projectId: string, taskId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/projects/${projectId}/tasks/${taskId}/split-layout`,
        {
          method: 'DELETE'
        }
      );
      
      if (!response.ok && response.status !== 404) {
        console.error(`Failed to delete layout: ${response.status} ${response.statusText}`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting split layout:', error);
      return false;
    }
  }
}

// Export singleton instance
export const layoutAPI = new LayoutAPIService();