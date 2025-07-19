import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  // Server configuration
  port: process.env.PORT || 3005,
  
  // Directory paths
  projectsDir: process.env.PROJECTS_DIR || path.join(__dirname, '../../projects'),
  dataDir: path.join(__dirname, '../../data'),
  
  // Database
  dbPath: path.join(__dirname, '../../data/pocketdev.db'),
  
  // GitHub
  githubToken: process.env.GITHUB_TOKEN || '',
  
  // Settings
  settingsPath: path.join(process.env.HOME || '.', '.pocketdev-settings.json'),
  
  // Shelltender
  shelltenderApiUrl: process.env.SHELLTENDER_API_URL || 'http://localhost:8080',
  shelltenderWsUrl: process.env.SHELLTENDER_WS_URL || 'ws://localhost:8080/ws',
  
  // Upload settings
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    uploadsDir: path.join(__dirname, '../../data/uploads')
  }
};