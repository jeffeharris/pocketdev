import { generateAcceptAttribute } from '../config/upload.config.js';

/**
 * Get upload configuration for frontend
 */
export async function getUploadConfig(req, res) {
  res.json({
    acceptAttribute: generateAcceptAttribute(),
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxTotalSize: 100 * 1024 * 1024, // 100MB
    maxFileCount: 50
  });
}

/**
 * Upload image to task
 */
export async function uploadImage(req, res, next) {
  try {
    const { projectId, taskId } = req.params;
    const uploadService = req.services.UploadService;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Upload file through service
    const result = await uploadService.uploadFile(projectId, taskId, req.file);
    
    res.json(result);
  } catch (error) {
    // Handle specific validation errors with appropriate status codes
    if (error.message.includes('Task not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('File size') || 
        error.message.includes('storage limit') || 
        error.message.includes('Maximum') ||
        error.message.includes('File type not allowed')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * List images in task
 */
export async function listImages(req, res, next) {
  try {
    const { projectId, taskId } = req.params;
    const uploadService = req.services.UploadService;
    
    // Get attachments through service
    const images = await uploadService.getAttachments(projectId, taskId);
    
    res.json({ images });
  } catch (error) {
    if (error.message.includes('Task not found')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Serve image file
 */
export async function getImage(req, res, next) {
  try {
    const { projectId, taskId, filename } = req.params;
    const uploadService = req.services.UploadService;
    
    // Get file path through service (includes security validation)
    const imagePath = await uploadService.getAttachment(projectId, taskId, filename);
    
    // Send file
    res.sendFile(imagePath);
  } catch (error) {
    if (error.message.includes('Task not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('Invalid file path')) {
      return res.status(404).json({ error: 'Image not found' });
    }
    next(error);
  }
}

/**
 * Delete image
 */
export async function deleteImage(req, res, next) {
  try {
    const { projectId, taskId, filename } = req.params;
    const uploadService = req.services.UploadService;
    
    // Delete attachment through service
    await uploadService.deleteAttachment(projectId, taskId, filename);
    
    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    if (error.message.includes('Task not found')) {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.includes('not found') || error.message.includes('Invalid file path')) {
      return res.status(404).json({ error: 'Image not found' });
    }
    next(error);
  }
}