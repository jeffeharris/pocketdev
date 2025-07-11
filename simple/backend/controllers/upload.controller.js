import path from 'path';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import config from '../config/index.js';

/**
 * Upload image to task
 */
export async function uploadImage(req, res, next) {
  try {
    const { projectId, taskId } = req.params;
    const models = req.app.locals.models;
    
    // Verify task exists
    const task = await models.tasks.findById(taskId);
    if (!task || task.project_id !== projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Check file size limit (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (req.file.size > maxSize) {
      await fs.unlink(req.file.path); // Clean up the uploaded file
      return res.status(400).json({ error: 'File size must be less than 10MB' });
    }
    
    // Check if file type is allowed - skip this check since multer already handles it
    // The multer middleware will reject invalid files before they reach this point
    
    // Create attachments directory for task
    const attachmentsDir = path.join(task.worktree_path, '.pocketdev', 'attachments');
    await fs.mkdir(attachmentsDir, { recursive: true });
    
    // Check total storage limit per task (100MB)
    const existingFiles = await fs.readdir(attachmentsDir).catch(() => []);
    let totalSize = 0;
    
    for (const file of existingFiles) {
      const stats = await fs.stat(path.join(attachmentsDir, file));
      totalSize += stats.size;
    }
    
    const maxTotalSize = 100 * 1024 * 1024; // 100MB total per task
    if (totalSize + req.file.size > maxTotalSize) {
      await fs.unlink(req.file.path); // Clean up the uploaded file
      return res.status(400).json({ error: 'Total storage limit exceeded (100MB per task)' });
    }
    
    // Check file count limit (50 files per task)
    if (existingFiles.length >= 50) {
      await fs.unlink(req.file.path); // Clean up the uploaded file
      return res.status(400).json({ error: 'Maximum 50 files allowed per task' });
    }
    
    // Move uploaded file to task directory
    const filename = req.file.filename;
    const sourcePath = req.file.path;
    const destPath = path.join(attachmentsDir, filename);
    
    // Copy file (can't rename across different filesystems)
    await fs.copyFile(sourcePath, destPath);
    
    // Delete the temporary file
    await fs.unlink(sourcePath);
    
    // Format size
    const sizeInKB = req.file.size / 1024;
    const sizeFormatted = sizeInKB > 1024 
      ? `${(sizeInKB / 1024).toFixed(2)} MB`
      : `${sizeInKB.toFixed(2)} KB`;
    
    // Reference path relative to worktree
    const referencePath = `@.pocketdev/attachments/${filename}`;
    
    res.json({
      success: true,
      filename,
      size: req.file.size,
      sizeFormatted,
      referencePath,
      url: `/api/projects/${projectId}/tasks/${taskId}/images/${filename}`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List images in task
 */
export async function listImages(req, res, next) {
  try {
    const { projectId, taskId } = req.params;
    const models = req.app.locals.models;
    
    // Verify task exists
    const task = await models.tasks.findById(taskId);
    if (!task || task.project_id !== projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const attachmentsDir = path.join(task.worktree_path, '.pocketdev', 'attachments');
    
    // Check if directory exists
    if (!fsSync.existsSync(attachmentsDir)) {
      return res.json({ images: [] });
    }
    
    // Read directory
    const files = await fs.readdir(attachmentsDir);
    
    // Get file stats
    const images = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(attachmentsDir, filename);
        const stats = await fs.stat(filePath);
        
        // Format size
        const sizeInKB = stats.size / 1024;
        const sizeFormatted = sizeInKB > 1024 
          ? `${(sizeInKB / 1024).toFixed(2)} MB`
          : `${sizeInKB.toFixed(2)} KB`;
        
        return {
          filename,
          size: stats.size,
          sizeFormatted,
          referencePath: `@.pocketdev/attachments/${filename}`,
          uploadedAt: stats.mtime,
          url: `/api/projects/${projectId}/tasks/${taskId}/images/${filename}`
        };
      })
    );
    
    res.json({ images });
  } catch (error) {
    next(error);
  }
}

/**
 * Serve image file
 */
export async function getImage(req, res, next) {
  try {
    const { projectId, taskId, filename } = req.params;
    const models = req.app.locals.models;
    
    // Verify task exists
    const task = await models.tasks.findById(taskId);
    if (!task || task.project_id !== projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const imagePath = path.join(task.worktree_path, '.pocketdev', 'attachments', filename);
    
    // Check if file exists
    if (!fsSync.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Send file
    res.sendFile(imagePath);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete image
 */
export async function deleteImage(req, res, next) {
  try {
    const { projectId, taskId, filename } = req.params;
    const models = req.app.locals.models;
    
    // Verify task exists
    const task = await models.tasks.findById(taskId);
    if (!task || task.project_id !== projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const imagePath = path.join(task.worktree_path, '.pocketdev', 'attachments', filename);
    
    // Check if file exists
    if (!fsSync.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Delete file
    await fs.unlink(imagePath);
    
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    next(error);
  }
}