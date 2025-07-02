import { Router } from 'express';
import * as uploadController from '../controllers/upload.controller.js';
import { uploadSingle, handleUploadError } from '../middleware/upload.middleware.js';

const router = Router();

// Upload routes - nested under projects/:projectId/tasks/:taskId
router.post('/projects/:projectId/tasks/:taskId/upload', 
  uploadSingle('image'),
  uploadController.uploadImage,
  handleUploadError
);

router.get('/projects/:projectId/tasks/:taskId/images', 
  uploadController.listImages
);

router.get('/projects/:projectId/tasks/:taskId/images/:filename', 
  uploadController.getImage
);

router.delete('/projects/:projectId/tasks/:taskId/images/:filename', 
  uploadController.deleteImage
);

export default router;