import path from 'path';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import { 
  ALLOWED_MIME_TYPES, 
  FILE_SIZE_LIMITS, 
  isFileAllowed, 
  UPLOAD_ERROR_MESSAGES 
} from '../config/upload.config.js';

/**
 * UploadService - Handles all file upload and attachment operations
 * 
 * This service provides a clean interface for managing file uploads and attachments,
 * hiding the complexity of file storage, validation, and size management.
 * 
 * Following deep module principles: simple interface (5 methods), 
 * complex file handling implementation.
 */
export class UploadService {
  constructor(models, eventEmitterService = null) {
    this.models = models;
    this.eventEmitterService = eventEmitterService;
    
    // Use centralized configuration for file validation
  }

  /**
   * Upload and store a file attachment for a task
   * @param {string} projectId - Project ID
   * @param {string} taskId - Task ID
   * @param {Object} fileData - Uploaded file data from multer
   * @returns {Promise<Object>} Upload result with file metadata
   */
  async uploadFile(projectId, taskId, fileData) {
    // Verify task exists and get worktree path
    const task = await this._getValidatedTask(projectId, taskId);
    
    // Validate file upload
    const validation = await this.validateUpload(task, fileData);
    if (!validation.isValid) {
      // Clean up uploaded temp file
      if (fileData.path && fsSync.existsSync(fileData.path)) {
        await fs.unlink(fileData.path);
      }
      throw new Error(validation.error);
    }

    try {
      // Create attachments directory
      const attachmentsDir = this._getAttachmentsDir(task.worktree_path);
      await fs.mkdir(attachmentsDir, { recursive: true });

      // Generate destination path
      const filename = fileData.filename;
      const destPath = path.join(attachmentsDir, filename);

      // Copy file to task directory (handle cross-filesystem moves)
      await fs.copyFile(fileData.path, destPath);
      
      // Delete temporary file
      await fs.unlink(fileData.path);

      // Format file metadata
      const fileMetadata = this._formatFileMetadata(projectId, taskId, fileData);

      // Emit upload event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit('upload.file-attached', {
          taskId,
          projectId,
          filename,
          size: fileData.size,
          mimeType: fileData.mimetype
        });
      }

      return fileMetadata;
    } catch (error) {
      // Clean up on failure
      if (fileData.path && fsSync.existsSync(fileData.path)) {
        await fs.unlink(fileData.path);
      }
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  /**
   * Get all attachments for a task
   * @param {string} projectId - Project ID
   * @param {string} taskId - Task ID
   * @returns {Promise<Array>} Array of attachment metadata
   */
  async getAttachments(projectId, taskId) {
    const task = await this._getValidatedTask(projectId, taskId);
    const attachmentsDir = this._getAttachmentsDir(task.worktree_path);

    // Check if attachments directory exists
    if (!fsSync.existsSync(attachmentsDir)) {
      return [];
    }

    // Read directory and get file stats
    const files = await fs.readdir(attachmentsDir);
    
    const attachments = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(attachmentsDir, filename);
        const stats = await fs.stat(filePath);
        
        return this._formatFileInfo(projectId, taskId, filename, stats);
      })
    );

    return attachments;
  }

  /**
   * Get a specific attachment file path for serving
   * @param {string} projectId - Project ID
   * @param {string} taskId - Task ID
   * @param {string} filename - Filename to retrieve
   * @returns {Promise<string>} Absolute file path
   */
  async getAttachment(projectId, taskId, filename) {
    const task = await this._getValidatedTask(projectId, taskId);
    const filePath = path.join(this._getAttachmentsDir(task.worktree_path), filename);

    // Validate file exists and is within attachments directory (security)
    if (!fsSync.existsSync(filePath)) {
      throw new Error('Attachment not found');
    }

    // Ensure file is within the expected directory (prevent path traversal)
    const attachmentsDir = this._getAttachmentsDir(task.worktree_path);
    const resolvedPath = path.resolve(filePath);
    const resolvedAttachmentsDir = path.resolve(attachmentsDir);
    
    if (!resolvedPath.startsWith(resolvedAttachmentsDir)) {
      throw new Error('Invalid file path');
    }

    return resolvedPath;
  }

  /**
   * Delete an attachment from a task
   * @param {string} projectId - Project ID
   * @param {string} taskId - Task ID
   * @param {string} filename - Filename to delete
   * @returns {Promise<void>}
   */
  async deleteAttachment(projectId, taskId, filename) {
    const task = await this._getValidatedTask(projectId, taskId);
    const filePath = path.join(this._getAttachmentsDir(task.worktree_path), filename);

    // Check if file exists
    if (!fsSync.existsSync(filePath)) {
      throw new Error('Attachment not found');
    }

    // Security: Ensure file is within attachments directory
    const attachmentsDir = this._getAttachmentsDir(task.worktree_path);
    const resolvedPath = path.resolve(filePath);
    const resolvedAttachmentsDir = path.resolve(attachmentsDir);
    
    if (!resolvedPath.startsWith(resolvedAttachmentsDir)) {
      throw new Error('Invalid file path');
    }

    // Delete the file
    await fs.unlink(filePath);

    // Emit deletion event
    if (this.eventEmitterService) {
      this.eventEmitterService.emit('upload.file-deleted', {
        taskId,
        projectId,
        filename
      });
    }
  }

  /**
   * Validate file upload before processing
   * @param {Object} task - Task object with worktree_path
   * @param {Object} fileData - Uploaded file data
   * @returns {Promise<Object>} Validation result
   */
  async validateUpload(task, fileData) {
    try {
      // Check if file was provided
      if (!fileData) {
        return { isValid: false, error: 'No file uploaded' };
      }

      // Check file size limit
      if (fileData.size > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
        return { 
          isValid: false, 
          error: UPLOAD_ERROR_MESSAGES.FILE_TOO_LARGE
        };
      }

      // Check if file is allowed (MIME type and extension)
      if (!isFileAllowed(fileData.originalname || fileData.filename, fileData.mimetype)) {
        return { 
          isValid: false, 
          error: UPLOAD_ERROR_MESSAGES.FILE_TYPE_NOT_ALLOWED
        };
      }

      // Check storage limits
      const attachmentsDir = this._getAttachmentsDir(task.worktree_path);
      const storageCheck = await this._checkStorageLimits(attachmentsDir, fileData.size);
      
      if (!storageCheck.isValid) {
        return storageCheck;
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: `Validation failed: ${error.message}` };
    }
  }

  // Private helper methods

  /**
   * Get and validate task exists and belongs to project
   * @private
   */
  async _getValidatedTask(projectId, taskId) {
    const task = await this.models.tasks.findById(taskId);
    if (!task || task.project_id !== projectId) {
      throw new Error('Task not found');
    }
    return task;
  }

  /**
   * Get attachments directory path for a task
   * @private
   */
  _getAttachmentsDir(worktreePath) {
    return path.join(worktreePath, '.pocketdev', 'attachments');
  }

  /**
   * Check storage limits for task
   * @private
   */
  async _checkStorageLimits(attachmentsDir, newFileSize) {
    try {
      // Get existing files if directory exists
      let existingFiles = [];
      if (fsSync.existsSync(attachmentsDir)) {
        existingFiles = await fs.readdir(attachmentsDir);
      }

      // Check file count limit
      if (existingFiles.length >= FILE_SIZE_LIMITS.MAX_FILE_COUNT) {
        return { 
          isValid: false, 
          error: UPLOAD_ERROR_MESSAGES.TOO_MANY_FILES
        };
      }

      // Calculate total existing size
      let totalSize = 0;
      for (const file of existingFiles) {
        const stats = await fs.stat(path.join(attachmentsDir, file));
        totalSize += stats.size;
      }

      // Check total size limit
      if (totalSize + newFileSize > FILE_SIZE_LIMITS.MAX_TOTAL_SIZE) {
        return { 
          isValid: false, 
          error: UPLOAD_ERROR_MESSAGES.STORAGE_LIMIT_EXCEEDED
        };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: `Storage check failed: ${error.message}` };
    }
  }

  /**
   * Format file metadata for API response
   * @private
   */
  _formatFileMetadata(projectId, taskId, fileData) {
    return {
      success: true,
      filename: fileData.filename,
      size: fileData.size,
      sizeFormatted: this._formatBytes(fileData.size),
      referencePath: `@.pocketdev/attachments/${fileData.filename}`,
      url: `/api/projects/${projectId}/tasks/${taskId}/images/${fileData.filename}`,
      mimeType: fileData.mimetype
    };
  }

  /**
   * Format file info for listing attachments
   * @private
   */
  _formatFileInfo(projectId, taskId, filename, stats) {
    return {
      filename,
      size: stats.size,
      sizeFormatted: this._formatBytes(stats.size),
      referencePath: `@.pocketdev/attachments/${filename}`,
      uploadedAt: stats.mtime,
      url: `/api/projects/${projectId}/tasks/${taskId}/images/${filename}`
    };
  }

  /**
   * Format bytes to human-readable string
   * @private
   */
  _formatBytes(bytes) {
    const sizeInKB = bytes / 1024;
    return sizeInKB > 1024 
      ? `${(sizeInKB / 1024).toFixed(2)} MB`
      : `${sizeInKB.toFixed(2)} KB`;
  }
}