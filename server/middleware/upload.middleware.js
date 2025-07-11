import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import config from '../config/index.js';

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

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images and common developer files
  const allowedMimes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    // Documents
    'application/pdf',
    'text/plain',
    'text/markdown',
    // Data files
    'application/json',
    'text/csv',
    'application/xml',
    'text/xml',
    'text/yaml',
    'application/x-yaml',
    // Code files
    'text/javascript',
    'application/javascript',
    'text/x-python',
    'text/x-typescript',
    'text/x-java',
    'text/x-c',
    'text/x-c++',
    'text/x-csharp',
    'text/x-go',
    'text/x-rust',
    'text/x-ruby',
    'text/x-php',
    'text/html',
    'text/css',
    // Archives
    'application/zip',
    'application/x-tar',
    'application/gzip',
    // Shell scripts
    'text/x-shellscript',
    'application/x-sh'
  ];
  
  // Also allow by extension for common code files that might not have correct mime types
  const allowedExtensions = [
    '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.c', '.cpp', '.cc', '.h', '.hpp',
    '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.r', '.m',
    '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
    '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
    '.sql', '.graphql', '.proto',
    '.dockerfile', '.dockerignore', '.gitignore', '.env', '.editorconfig',
    '.html', '.css', '.scss', '.sass', '.less',
    '.vue', '.svelte', '.astro'
  ];
  
  const ext = file.originalname.toLowerCase().match(/\.[^.]+$/);
  const hasAllowedExtension = ext && allowedExtensions.includes(ext[0]);
  
  if (allowedMimes.includes(file.mimetype) || hasAllowedExtension) {
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
    fileSize: config.upload.maxFileSize,
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
        error: `File too large. Maximum size is ${config.upload.maxFileSize / 1024 / 1024}MB`
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