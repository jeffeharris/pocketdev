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
    
    // Create images directory for task
    const imagesDir = path.join(task.worktree_path, '.claude', 'images');
    await fs.mkdir(imagesDir, { recursive: true });
    
    // Move uploaded file to task directory
    const filename = req.file.filename;
    const sourcePath = req.file.path;
    const destPath = path.join(imagesDir, filename);
    
    await fs.rename(sourcePath, destPath);
    
    res.json({
      message: 'Image uploaded successfully',
      filename,
      path: destPath,
      size: req.file.size,
      mimetype: req.file.mimetype
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
    
    const imagesDir = path.join(task.worktree_path, '.claude', 'images');
    
    // Check if directory exists
    if (!fsSync.existsSync(imagesDir)) {
      return res.json({ images: [] });
    }
    
    // Read directory
    const files = await fs.readdir(imagesDir);
    
    // Get file stats
    const images = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(imagesDir, filename);
        const stats = await fs.stat(filePath);
        
        return {
          filename,
          size: stats.size,
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
    
    const imagePath = path.join(task.worktree_path, '.claude', 'images', filename);
    
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
    
    const imagePath = path.join(task.worktree_path, '.claude', 'images', filename);
    
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