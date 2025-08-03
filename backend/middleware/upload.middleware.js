import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import config from '../config/index.js';
import { isFileAllowed, FILE_SIZE_LIMITS } from '../config/upload.config.js';

// Configure storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Ensure uploads directory exists
    const uploadDir = config.upload.uploadsDir;
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  }
});

// File filter using centralized configuration
const fileFilter = (req, file, cb) => {
  if (isFileAllowed(file.originalname, file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: images, PDFs, documents, code files (.py, .js, .ts, etc), config files (.yaml, .json, etc), and archives`), false);
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: FILE_SIZE_LIMITS.MAX_FILE_SIZE,
    files: 10 // Max 10 files per request
  }
});

// Middleware for single file upload
export const uploadSingle = (fieldName = 'file') => upload.single(fieldName);

// Middleware for multiple file upload
export const uploadMultiple = (fieldName = 'files', maxCount = 10) => 
  upload.array(fieldName, maxCount);

// Error handling middleware for multer
export function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `File too large. Maximum size is ${FILE_SIZE_LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files. Maximum is 10 files per request'
      });
    }
    return res.status(400).json({
      error: `Upload error: ${err.message}`
    });
  }
  
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: err.message
    });
  }
  
  next(err);
}