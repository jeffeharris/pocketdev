import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class DockerClaudeManager {
  constructor() {
    this.containerPrefix = 'claude-';
  }

  /**
   * Execute a task in a Claude container
   */
  async executeTask(engineerId, task, role) {
    const containerName = `${this.containerPrefix}${role}`;
    
    // Build the command to run inside the container
    const claudeCommand = [
      'claude',
      '-p', `"${task}"`,
      '--output-format', 'json',
      '--allowedTools', 'Read',
      '--allowedTools', 'Write',
      '--allowedTools', 'Edit',
      '--allowedTools', 'Bash',
      '--allowedTools', 'View'
    ].join(' ');

    try {
      // Execute command in the container
      const { stdout, stderr } = await execAsync(
        `docker exec ${containerName} bash -c "${claudeCommand}"`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
      );

      if (stderr) {
        console.error('Claude stderr:', stderr);
      }

      // Parse the JSON output
      const result = JSON.parse(stdout);
      return {
        success: true,
        result: result.result,
        sessionId: result.session_id,
        cost: result.cost
      };
    } catch (error) {
      console.error('Docker execution error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute interactive Claude session
   */
  async startInteractiveSession(engineerId, role) {
    const containerName = `${this.containerPrefix}${role}`;
    
    // Start an interactive Claude session using docker exec
    const dockerProcess = spawn('docker', [
      'exec',
      '-it',
      containerName,
      'claude',
      'code'
    ], {
      stdio: 'pipe'
    });

    return {
      process: dockerProcess,
      containerName
    };
  }

  /**
   * Check if container is running
   */
  async isContainerRunning(containerName) {
    try {
      const { stdout } = await execAsync(
        `docker ps --filter "name=${containerName}" --format "{{.Names}}"`
      );
      return stdout.trim() === containerName;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(containerName, tail = 100) {
    try {
      const { stdout } = await execAsync(
        `docker logs ${containerName} --tail ${tail}`
      );
      return stdout;
    } catch (error) {
      return null;
    }
  }

  /**
   * Copy file to container
   */
  async copyToContainer(containerName, localPath, containerPath) {
    try {
      await execAsync(
        `docker cp "${localPath}" ${containerName}:${containerPath}`
      );
      return true;
    } catch (error) {
      console.error('Copy to container error:', error);
      return false;
    }
  }

  /**
   * Copy file from container
   */
  async copyFromContainer(containerName, containerPath, localPath) {
    try {
      await execAsync(
        `docker cp ${containerName}:${containerPath} "${localPath}"`
      );
      return true;
    } catch (error) {
      console.error('Copy from container error:', error);
      return false;
    }
  }
}