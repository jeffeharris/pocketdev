/**
 * UploadService Interface - File upload management
 * 
 * Handles task-specific file uploads, particularly images.
 * This service operates within task context but has no service dependencies.
 */

export interface TaskImage {
  filename: string;
  size: number;
  sizeFormatted: string;
  referencePath: string;
  url?: string;
}

export interface UploadResult {
  success: boolean;
  filename: string;
  size: number;
  sizeFormatted: string;
  referencePath: string;
}

export interface IUploadService {
  /**
   * Get all uploaded images for a task
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @returns Promise<TaskImage[]> List of uploaded images
   */
  getTaskImages(projectId: string, taskId: string): Promise<TaskImage[]>;

  /**
   * Upload an image file to a task
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @param formData Form data containing the file
   * @returns Promise<UploadResult> Upload result with file details
   */
  uploadTaskImage(projectId: string, taskId: string, formData: FormData): Promise<UploadResult>;

  /**
   * Delete an uploaded image from a task
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @param filename Name of file to delete
   * @returns Promise<void>
   */
  deleteTaskImage(projectId: string, taskId: string, filename: string): Promise<void>;
}