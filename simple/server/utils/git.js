import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

// Git operations helper
export async function gitCommand(projectPath, command) {
  try {
    const env = { ...process.env };
    
    // Add safe directory config to avoid dubious ownership errors
    const safeCommand = `git config --global --add safe.directory ${projectPath} 2>/dev/null; ${command}`;
    
    const { stdout, stderr } = await exec(safeCommand, { 
      cwd: projectPath,
      env,
      shell: '/bin/sh'
    });
    return { success: true, output: stdout, error: stderr };
  } catch (error) {
    // Always include output even on error to prevent undefined errors
    return { success: false, output: '', error: error.message };
  }
}

// Configure git credentials for a repository
export async function configureGitCredentials(projectPath, githubToken) {
  // Configure merge tool
  await exec(`git config merge.tool vimdiff`, { cwd: projectPath });
  await exec(`git config merge.conflictstyle diff3`, { cwd: projectPath });
  await exec(`git config mergetool.prompt false`, { cwd: projectPath });
  
  if (!githubToken) return;
  
  try {
    const { stdout: remoteUrl } = await exec('git remote get-url origin', { cwd: projectPath });
    
    if (remoteUrl.includes('github.com')) {
      // Configure git to use GitHub CLI as credential helper
      await exec(`git config credential.helper "!gh auth git-credential"`, { cwd: projectPath });
      
      // Make sure GH_TOKEN is set for the environment
      process.env.GH_TOKEN = githubToken;
      process.env.GITHUB_TOKEN = githubToken;
    }
  } catch (error) {
    console.error('Failed to configure git credentials:', error);
  }
}

// Get directory size
export async function getDirectorySize(dirPath) {
  try {
    const result = await exec(`du -sb "${dirPath}" | cut -f1`);
    return parseInt(result.stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

// Format bytes to human readable
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}