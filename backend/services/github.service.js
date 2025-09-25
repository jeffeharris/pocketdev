/**
 * GitHubService - Handles all GitHub platform operations (PRs, issues, etc.)
 * 
 * This service provides a clean interface for GitHub-specific operations
 * using the GitHub CLI (gh command), separate from core git operations.
 * 
 * Following deep module principles: simple interface (4 methods), 
 * hiding complexity of GitHub CLI interactions and authentication.
 */
export class GitHubService {
  constructor(githubToken = null) {
    this.githubToken = githubToken;
  }

  /**
   * Create a pull request
   * @param {string} workingDirectory - Directory to run the command in
   * @param {string} title - PR title
   * @param {string} body - PR description
   * @param {Object} options - Additional options (base branch, draft status)
   * @returns {Promise<Object>} Command result
   */
  async createPullRequest(workingDirectory, title, body = '', options = {}) {
    const { base = 'main', draft = false } = options;
    
    // Build the gh pr create command
    let command = `gh pr create --title "${title}"`;
    if (body) {
      command += ` --body "${body}"`;
    }
    command += ` --base ${base}`;
    if (draft) {
      command += ' --draft';
    }
    
    return this._executeCommand(command, workingDirectory);
  }

  /**
   * Get pull request status
   * @param {string} workingDirectory - Directory to run the command in
   * @param {string} branch - Branch name to check PR status for
   * @returns {Promise<Object>} PR status information
   */
  async getPullRequestStatus(workingDirectory, branch = null) {
    try {
      // Get PR status for current branch or specified branch
      let command = 'gh pr status --json number,title,state,url';
      if (branch) {
        command += ` --branch ${branch}`;
      }
      
      const result = await this._executeCommand(command, workingDirectory);
      
      if (result.success && result.output) {
        try {
          const prData = JSON.parse(result.output);
          return {
            success: true,
            hasPR: !!prData.currentBranch,
            pr: prData.currentBranch || null
          };
        } catch (parseError) {
          // Fallback to checking if PR exists
          const listResult = await this._executeCommand(
            `gh pr list --head ${branch || 'HEAD'} --json number,title,state,url`,
            workingDirectory
          );
          
          if (listResult.success && listResult.output) {
            const prs = JSON.parse(listResult.output);
            return {
              success: true,
              hasPR: prs.length > 0,
              pr: prs[0] || null
            };
          }
        }
      }
      
      return {
        success: false,
        hasPR: false,
        pr: null,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        hasPR: false,
        pr: null,
        error: error.message
      };
    }
  }

  /**
   * Merge a pull request
   * @param {string} workingDirectory - Directory to run the command in  
   * @param {string} prNumber - PR number to merge
   * @param {Object} options - Merge options (squash, delete-branch, etc.)
   * @returns {Promise<Object>} Merge result
   */
  async mergePullRequest(workingDirectory, prNumber, options = {}) {
    const { squash = false, deleteBranch = true, mergeMethod = 'merge' } = options;
    
    let command = `gh pr merge ${prNumber}`;
    
    // Add merge method
    if (squash || mergeMethod === 'squash') {
      command += ' --squash';
    } else if (mergeMethod === 'rebase') {
      command += ' --rebase';
    } else {
      command += ' --merge';
    }
    
    // Add delete branch option
    if (deleteBranch) {
      command += ' --delete-branch';
    }
    
    // Auto-confirm
    command += ' --yes';
    
    return this._executeCommand(command, workingDirectory);
  }

  /**
   * Validate GitHub token and get user information
   * @param {string} workingDirectory - Optional directory to run command in (defaults to process.cwd())
   * @returns {Promise<Object>} Validation result with user info
   */
  async validateToken(workingDirectory = process.cwd()) {
    try {
      // Use gh auth status to validate the token
      const command = 'gh auth status --show-token';
      const result = await this._executeCommand(command, workingDirectory);

      if (result.success) {
        // Get full user information using gh api
        const userCommand = 'gh api user';
        const userResult = await this._executeCommand(userCommand, workingDirectory);

        if (userResult.success) {
          const userInfo = JSON.parse(userResult.output);

          // Try to get primary email if not available in user info
          let email = userInfo.email;
          if (!email) {
            const emailCommand = 'gh api user/emails';
            const emailResult = await this._executeCommand(emailCommand, workingDirectory);

            if (emailResult.success) {
              try {
                const emails = JSON.parse(emailResult.output);
                const primaryEmail = emails.find(e => e.primary && e.verified);
                email = primaryEmail ? primaryEmail.email : '';
              } catch (e) {
                console.warn('Failed to parse user emails:', e.message);
              }
            }
          }

          return {
            valid: true,
            username: userInfo.login,
            user: {
              login: userInfo.login,
              name: userInfo.name || userInfo.login,
              email: email || '',
              avatarUrl: userInfo.avatar_url || ''
            }
          };
        }
      }

      return {
        valid: false,
        error: result.error || 'Authentication failed'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message || 'Failed to validate token'
      };
    }
  }

  /**
   * Get repositories for the authenticated user
   * @returns {Promise<Array>} List of repositories
   */
  async getRepositories() {
    try {
      const command = 'gh repo list --limit 100 --json name,nameWithOwner,url,isPrivate,defaultBranchRef,updatedAt';
      const result = await this._executeCommand(command, process.cwd());

      if (result.success && result.output) {
        const repos = JSON.parse(result.output);
        return repos.map(repo => ({
          name: repo.name,
          fullName: repo.nameWithOwner,
          url: repo.url,
          defaultBranch: repo.defaultBranchRef?.name || 'main',
          private: repo.isPrivate,
          updatedAt: repo.updatedAt
        }));
      }

      throw new Error(result.error || 'Failed to fetch repositories');
    } catch (error) {
      throw new Error(`Failed to fetch repositories: ${error.message}`);
    }
  }

  /**
   * Get branches for a specific repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Promise<Array>} List of branches
   */
  async getBranches(owner, repo) {
    try {
      const command = `gh api repos/${owner}/${repo}/branches --paginate --jq '.[] | {name: .name, protected: .protected}'`;
      const result = await this._executeCommand(command, process.cwd());

      if (result.success && result.output) {
        // Parse NDJSON output (newline-delimited JSON)
        const branches = result.output.trim().split('\n')
          .filter(line => line)
          .map(line => JSON.parse(line));

        return branches;
      }

      throw new Error(result.error || 'Failed to fetch branches');
    } catch (error) {
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }
  }

  /**
   * Make a generic GitHub API request
   * @param {string} path - API path (e.g., '/user', '/repos/owner/repo')
   * @returns {Promise<any>} API response
   */
  async request(path) {
    try {
      const command = `gh api ${path}`;
      const result = await this._executeCommand(command, process.cwd());

      if (result.success && result.output) {
        try {
          return JSON.parse(result.output);
        } catch {
          return result.output; // Return raw output if not JSON
        }
      }

      throw new Error(result.error || 'API request failed');
    } catch (error) {
      throw new Error(`GitHub API error: ${error.message}`);
    }
  }

  /**
   * List pull requests
   * @param {string} workingDirectory - Directory to run the command in
   * @param {Object} options - List options (state, limit, etc.)
   * @returns {Promise<Object>} List of PRs
   */
  async listPullRequests(workingDirectory, options = {}) {
    const { state = 'open', limit = 10, author = null, base = null } = options;
    
    let command = `gh pr list --json number,title,state,author,url,createdAt,updatedAt`;
    command += ` --state ${state}`;
    command += ` --limit ${limit}`;
    
    if (author) {
      command += ` --author ${author}`;
    }
    
    if (base) {
      command += ` --base ${base}`;
    }
    
    const result = await this._executeCommand(command, workingDirectory);
    
    if (result.success && result.output) {
      try {
        const prs = JSON.parse(result.output);
        return {
          success: true,
          prs: prs
        };
      } catch (parseError) {
        return {
          success: false,
          prs: [],
          error: `Failed to parse PR list: ${parseError.message}`
        };
      }
    }
    
    return {
      success: false,
      prs: [],
      error: result.error
    };
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Execute a shell command with proper error handling
   * @private
   */
  async _executeCommand(command, workingDirectory) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      // Set up environment with GitHub token
      const env = { ...process.env };
      if (this.githubToken) {
        env.GH_TOKEN = this.githubToken;
        env.GITHUB_TOKEN = this.githubToken;
      }
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDirectory,
        env: env,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      // Check for common GitHub CLI errors in stderr
      if (stderr && stderr.includes('error')) {
        return {
          success: false,
          output: stdout,
          error: stderr
        };
      }
      
      return {
        success: true,
        output: stdout.trim(),
        error: stderr
      };
    } catch (error) {
      // Handle specific GitHub CLI errors
      if (error.message.includes('gh: command not found')) {
        return {
          success: false,
          output: '',
          error: 'GitHub CLI (gh) is not installed. Please install it first.'
        };
      }
      
      if (error.message.includes('authentication')) {
        return {
          success: false,
          output: '',
          error: 'GitHub authentication failed. Please check your token.'
        };
      }
      
      return {
        success: false,
        output: error.stdout || '',
        error: error.message || error.stderr || 'Command failed'
      };
    }
  }
}

export default GitHubService;