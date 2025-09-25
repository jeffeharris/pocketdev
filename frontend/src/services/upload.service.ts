/**
 * UploadService - File upload management
 * 
 * Handles task-specific file uploads, particularly images.
 * This service operates within task context and provides a simple interface
 * for uploading, retrieving, and deleting task-related image files.
 * 
 * Deep module design:
 * - Simple interface: 3 methods for core upload operations
 * - Hidden complexity: Multipart form handling, mock data, error management
 * - Clear abstraction: Users don't need to know about FormData or API details
 */

import { BaseService } from './base.service';
import type { 
  IUploadService, 
  TaskImage, 
  UploadResult 
} from './interfaces/upload.service.interface';

export class UploadService extends BaseService implements IUploadService {
  private mockImages: Map<string, TaskImage[]> = new Map();

  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
    
    if (this.isMockEnabled) {
      this.initializeMockData();
    }
  }

  // Simple public interface - 3 core methods (deep module principle)

  async getTaskImages(projectId: string, taskId: string): Promise<TaskImage[]> {
    if (this.isMockEnabled) {
      const taskKey = `${projectId}:${taskId}`;
      return this.mockImages.get(taskKey) || [];
    }
    
    const response = await this.get<{ images: TaskImage[] }>(
      `/projects/${projectId}/tasks/${taskId}/images`
    );
    
    return response.images || [];
  }

  async uploadTaskImage(projectId: string, taskId: string, formData: FormData): Promise<UploadResult> {
    if (this.isMockEnabled) {
      return this.handleMockUpload(projectId, taskId, formData);
    }
    
    const result = await this.upload<UploadResult>(
      `/projects/${projectId}/tasks/${taskId}/upload`,
      formData
    );
    
    return result;
  }

  async deleteTaskImage(projectId: string, taskId: string, filename: string): Promise<void> {
    if (this.isMockEnabled) {
      this.handleMockDelete(projectId, taskId, filename);
      return;
    }
    
    await this.delete<void>(
      `/projects/${projectId}/tasks/${taskId}/images/${filename}`
    );
  }

  // Complex implementation hidden from users

  private handleMockUpload(projectId: string, taskId: string, formData: FormData): UploadResult {
    const taskKey = `${projectId}:${taskId}`;
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No file provided in form data');
    }
    
    const mockResult: UploadResult = {
      success: true,
      filename: file.name || 'mock-image.png',
      size: file.size || 1024,
      sizeFormatted: this.formatFileSize(file.size || 1024),
      referencePath: `@.pocketdev/tmp/images/${file.name || 'mock-image.png'}`
    };
    
    // Add to mock storage
    const existingImages = this.mockImages.get(taskKey) || [];
    const newImage: TaskImage = {
      filename: mockResult.filename,
      size: mockResult.size,
      sizeFormatted: mockResult.sizeFormatted,
      referencePath: mockResult.referencePath,
      url: this.generateMockImageUrl(mockResult.filename)
    };
    
    existingImages.push(newImage);
    this.mockImages.set(taskKey, existingImages);
    
    return mockResult;
  }

  private handleMockDelete(projectId: string, taskId: string, filename: string): void {
    const taskKey = `${projectId}:${taskId}`;
    const existingImages = this.mockImages.get(taskKey) || [];
    
    const filteredImages = existingImages.filter(img => img.filename !== filename);
    this.mockImages.set(taskKey, filteredImages);
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private generateMockImageUrl(filename: string): string {
    // Generate a placeholder image URL for mock mode
    const width = 400;
    const height = 300;
    const text = encodeURIComponent(filename.split('.')[0] || 'image');
    
    return `https://via.placeholder.com/${width}x${height}/cccccc/666666?text=${text}`;
  }

  protected initializeMockData(): void {
    // Initialize with some sample images for development
    const sampleImages: TaskImage[] = [
      {
        filename: 'screenshot-1.png',
        size: 2048,
        sizeFormatted: '2.0 KB',
        referencePath: '@.pocketdev/tmp/images/screenshot-1.png',
        url: this.generateMockImageUrl('screenshot-1.png')
      },
      {
        filename: 'diagram.jpg',
        size: 15360,
        sizeFormatted: '15.0 KB',
        referencePath: '@.pocketdev/tmp/images/diagram.jpg',
        url: this.generateMockImageUrl('diagram.jpg')
      }
    ];
    
    // Add sample data for mock projects/tasks
    this.mockImages.set('proj_1:task_1', [...sampleImages]);
    this.mockImages.set('proj_2:task_1', [sampleImages[0]]);
  }
}