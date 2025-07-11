import https from 'https';

class GitHubAPI {
  constructor(token) {
    this.token = token;
  }

  async request(path, options = {}) {
    return new Promise((resolve, reject) => {
      const requestOptions = {
        hostname: 'api.github.com',
        path,
        method: options.method || 'GET',
        headers: {
          'Authorization': `token ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PocketDev',
          ...options.headers
        }
      };

      const req = https.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              resolve(data);
            }
          } else {
            reject(new Error(`GitHub API error: ${res.statusCode} ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      
      if (options.body) {
        req.write(JSON.stringify(options.body));
      }
      
      req.end();
    });
  }

  async validateToken() {
    try {
      const user = await this.request('/user');
      return { valid: true, username: user.login };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async getRepositories() {
    try {
      const repos = await this.request('/user/repos?per_page=100&sort=updated');
      return repos.map(repo => ({
        name: repo.name,
        fullName: repo.full_name,
        url: repo.clone_url,
        defaultBranch: repo.default_branch,
        private: repo.private,
        updatedAt: repo.updated_at
      }));
    } catch (error) {
      throw new Error(`Failed to fetch repositories: ${error.message}`);
    }
  }

  async getRepository(owner, repo) {
    try {
      const data = await this.request(`/repos/${owner}/${repo}`);
      return {
        name: data.name,
        fullName: data.full_name,
        url: data.clone_url,
        defaultBranch: data.default_branch,
        private: data.private
      };
    } catch (error) {
      throw new Error(`Failed to fetch repository: ${error.message}`);
    }
  }

  async getBranches(owner, repo) {
    try {
      const branches = await this.request(`/repos/${owner}/${repo}/branches?per_page=100`);
      return branches.map(branch => ({
        name: branch.name,
        protected: branch.protected
      }));
    } catch (error) {
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }
  }
}

export default GitHubAPI;