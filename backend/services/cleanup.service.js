// Cleanup operations service
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fsSync from 'fs';
import { promises as fs } from 'fs';

const execAsync = promisify(exec);

/**
 * Clean up orphaned worktrees on startup
 * @param {Object} models - Database models instance
 */
export async function cleanupOrphanedWorktrees(models) {
  try {
    console.log('Checking for orphaned worktrees...');
    const orphans = await models.worktreeRegistry.findOrphaned();
    
    if (orphans.length > 0) {
      console.log(`Found ${orphans.length} orphaned worktrees`);
      for (const orphan of orphans) {
        if (fsSync.existsSync(orphan.path)) {
          console.log(`  - ${orphan.path} (orphaned)`);
        }
      }
    }
  } catch (error) {
    console.error('Error during cleanup check:', error);
  }
}

/**
 * Archive an orphaned worktree
 * @param {string} worktreePath - Path to the worktree
 * @param {string} archiveDir - Directory to move orphaned worktrees to
 * @param {string} reason - Reason for archiving
 * @returns {Promise<string>} The archive path
 */
export async function archiveOrphanedWorktree(worktreePath, archiveDir, reason = 'orphaned') {
  const timestamp = Date.now();
  const basename = path.basename(worktreePath);
  const archivePath = path.join(archiveDir, '.archived', `${basename}-${timestamp}`);
  
  // Create archive directory
  await fs.mkdir(path.dirname(archivePath), { recursive: true });
  
  // Move worktree to archive
  await execAsync(`mv "${worktreePath}" "${archivePath}"`);
  
  // Create metadata file
  const metadataPath = path.join(archivePath, '.archive-metadata.json');
  await fs.writeFile(metadataPath, JSON.stringify({
    originalPath: worktreePath,
    archivedAt: new Date().toISOString(),
    reason
  }, null, 2));
  
  return archivePath;
}

/**
 * Get the size of a directory
 * @param {string} dirPath - Path to the directory
 * @returns {Promise<number>} Size in bytes
 */
export async function getDirectorySize(dirPath) {
  try {
    const result = await execAsync(`du -sb "${dirPath}" | cut -f1`);
    return parseInt(result.stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

/**
 * Clean up multiple worktree paths
 * @param {string[]} paths - Array of worktree paths to clean
 * @param {Object} models - Database models instance
 * @param {boolean} dryRun - If true, only simulate the cleanup
 * @returns {Promise<Object>} Cleanup results
 */
export async function cleanupWorktreePaths(paths, models, dryRun = true) {
  const cleaned = [];
  let totalFreed = 0;
  
  for (const worktreePath of paths) {
    if (fsSync.existsSync(worktreePath)) {
      const size = await getDirectorySize(worktreePath);
      
      if (!dryRun) {
        await execAsync(`rm -rf "${worktreePath}"`);
        await models.removeWorktreeRegistration(worktreePath);
      }
      
      cleaned.push({
        path: worktreePath,
        size,
        sizeFormatted: formatBytes(size)
      });
      totalFreed += size;
    }
  }
  
  return {
    cleaned: cleaned.length,
    totalFreed,
    totalFreedFormatted: formatBytes(totalFreed),
    items: cleaned
  };
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Find and clean stale worktrees (not in database)
 * @param {string} projectsDir - Base projects directory
 * @param {Object} models - Database models instance
 * @returns {Promise<Object>} Cleanup results
 */
export async function cleanStaleWorktrees(projectsDir, models) {
  try {
    // Get all directories in projects folder
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    const directories = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => path.join(projectsDir, entry.name));
    
    // Get all known worktree paths from database
    const knownWorktrees = await models.getAllWorktreePaths();
    const knownPaths = new Set(knownWorktrees);
    
    // Find stale directories
    const staleDirectories = directories.filter(dir => !knownPaths.has(dir));
    
    if (staleDirectories.length === 0) {
      return { cleaned: 0, totalFreed: 0, items: [] };
    }
    
    // Clean up stale directories
    return await cleanupWorktreePaths(staleDirectories, models, false);
  } catch (error) {
    console.error('Error cleaning stale worktrees:', error);
    throw error;
  }
}