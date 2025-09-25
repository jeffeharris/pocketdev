/**
 * Centralized upload configuration
 * Single source of truth for file type validation
 */

// Allowed MIME types
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff',
  
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/rtf',
  
  // Text files
  'text/plain',
  'text/csv',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'application/json',
  'application/xml',
  'text/xml',
  'text/yaml',
  'application/x-yaml',
  'text/markdown',
  'text/x-markdown',
  
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-7z-compressed',
  
  // Code files
  'text/x-python',
  'text/x-java-source',
  'text/x-java',
  'text/x-c',
  'text/x-c++',
  'text/x-csharp',
  'text/x-go',
  'text/x-rust',
  'text/x-ruby',
  'text/x-php',
  'text/x-swift',
  'text/x-kotlin',
  'text/x-scala',
  'text/x-typescript',
  'text/x-shellscript',
  'application/x-sh',
  
  // Media files
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
  
  // Other common types
  'application/octet-stream' // Generic binary files
];

// Allowed file extensions (for files with incorrect MIME types)
export const ALLOWED_EXTENSIONS = [
  // Code files
  '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.c', '.cpp', '.cc', '.h', '.hpp',
  '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.r', '.m',
  '.lua', '.dart', '.elm', '.clj', '.ex', '.exs', '.erl', '.hrl', '.fs', '.fsx',
  '.ml', '.mli', '.nim', '.v', '.zig',
  
  // Config files
  '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.config',
  '.json', '.xml', '.properties', '.env', '.env.local', '.env.production',
  
  // Shell scripts
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  
  // Database & query files
  '.sql', '.graphql', '.gql', '.proto',
  
  // Docker & CI/CD
  '.dockerfile', '.dockerignore', '.gitignore', '.gitattributes',
  
  // Web files
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.styl',
  '.vue', '.svelte', '.astro', '.mdx',
  
  // Documentation
  '.md', '.markdown', '.rst', '.adoc', '.txt', '.log',
  
  // Data files
  '.csv', '.tsv', '.json', '.jsonl', '.ndjson', '.xml', '.yaml', '.yml',
  
  // Build files
  '.makefile', '.mk', '.cmake', '.gradle', '.maven',
  
  // Editor configs
  '.editorconfig', '.prettierrc', '.eslintrc', '.stylelintrc',
  
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff',
  
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
  
  // Archives
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar',
  
  // Media
  '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.webm', '.mkv'
];

// File size limits
export const FILE_SIZE_LIMITS = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB per file
  MAX_TOTAL_SIZE: 100 * 1024 * 1024, // 100MB total per task
  MAX_FILE_COUNT: 50 // Maximum files per task
};

// Generate accept attribute for HTML file inputs
export function generateAcceptAttribute() {
  const mimeTypes = ALLOWED_MIME_TYPES.join(',');
  const extensions = ALLOWED_EXTENSIONS.join(',');
  return `${mimeTypes},${extensions}`;
}

// Check if file is allowed
export function isFileAllowed(filename, mimetype) {
  // Check MIME type
  if (mimetype && ALLOWED_MIME_TYPES.includes(mimetype)) {
    return true;
  }
  
  // Check extension
  const ext = filename.toLowerCase().match(/\.[^.]+$/);
  if (ext && ALLOWED_EXTENSIONS.includes(ext[0])) {
    return true;
  }
  
  return false;
}

// Export for use in error messages
export const UPLOAD_ERROR_MESSAGES = {
  FILE_TYPE_NOT_ALLOWED: 'File type not allowed. Supported types include images, documents, code files, config files, archives, and media formats.',
  FILE_TOO_LARGE: `File size must be less than ${FILE_SIZE_LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB`,
  TOO_MANY_FILES: `Maximum ${FILE_SIZE_LIMITS.MAX_FILE_COUNT} files allowed per task`,
  STORAGE_LIMIT_EXCEEDED: `Total storage limit exceeded (${FILE_SIZE_LIMITS.MAX_TOTAL_SIZE / 1024 / 1024}MB per task)`
};