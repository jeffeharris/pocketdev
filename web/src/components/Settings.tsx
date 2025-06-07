import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface ProjectConfig {
  active: boolean;
  path?: string;
  config?: {
    project: {
      name: string;
      repository: string;
      default_branch: string;
    };
    credentials: {
      profile: string;
    };
  };
}

interface GitHubRepo {
  full_name: string;
  name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
}

export default function Settings() {
  const navigate = useNavigate();
  const [activeProject, setActiveProject] = useState<ProjectConfig | null>(null);
  const [githubToken, setGithubToken] = useState('');
  const [githubUser, setGithubUser] = useState<{ login: string; name: string } | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchProjectConfig();
  }, []);

  const fetchProjectConfig = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/project/config');
      const data = await response.json();
      setActiveProject(data);
      if (data.active && data.config) {
        setSelectedRepo(data.config.project.repository);
        setSelectedBranch(data.config.project.default_branch);
      }
    } catch (error) {
      console.error('Failed to fetch project config:', error);
    }
  };

  const validateGitHubToken = async () => {
    if (!githubToken) return;
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/github/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken })
      });
      
      if (response.ok) {
        const data = await response.json();
        setGithubUser(data.user);
        setMessage('GitHub token validated successfully!');
        
        // Fetch repos
        await fetchRepos();
      } else {
        setMessage('Invalid GitHub token');
        setGithubUser(null);
      }
    } catch (error) {
      setMessage('Failed to validate token');
    } finally {
      setLoading(false);
    }
  };

  const fetchRepos = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/github/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken })
      });
      
      if (response.ok) {
        const data = await response.json();
        setRepos(data.repos);
      }
    } catch (error) {
      console.error('Failed to fetch repos:', error);
    }
  };

  const fetchBranches = async (repoFullName: string) => {
    if (!repoFullName || !githubToken) return;
    
    try {
      const response = await fetch('http://localhost:3001/api/github/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken, repoFullName })
      });
      
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches);
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    }
  };

  const handleRepoSelect = async (repoFullName: string) => {
    setSelectedRepo(repoFullName);
    if (repoFullName) {
      await fetchBranches(repoFullName);
      // Set default branch from repo
      const repo = repos.find(r => r.full_name === repoFullName);
      if (repo) {
        setSelectedBranch(repo.default_branch);
      }
    }
  };

  const saveProjectConfig = async () => {
    if (!selectedRepo) {
      setMessage('Please select a repository');
      return;
    }
    
    // Store credentials in environment variable format
    const credentialProfile = 'github-personal';
    localStorage.setItem('GITHUB_PERSONAL_TOKEN', githubToken);
    localStorage.setItem('GITHUB_PERSONAL_USERNAME', githubUser?.login || '');
    
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/project/set-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository: selectedRepo,
          defaultBranch: selectedBranch,
          credentialProfile
        })
      });
      
      if (response.ok) {
        setMessage('GitHub configuration saved successfully!');
        await fetchProjectConfig();
      } else {
        const error = await response.json();
        setMessage(`Failed to save: ${error.error}`);
      }
    } catch (error) {
      setMessage('Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-3xl font-bold">Project Settings</h1>
      </div>
      
      {/* Active Project Status */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Active Configuration</h2>
        {activeProject?.active ? (
          <div className="space-y-2">
            <p><span className="text-gray-400">Repository:</span> {activeProject.config?.project.repository}</p>
            <p><span className="text-gray-400">Default Branch:</span> {activeProject.config?.project.default_branch}</p>
          </div>
        ) : (
          <p className="text-gray-400">No repository configured</p>
        )}
      </div>

      {/* GitHub Configuration */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">GitHub Configuration</h2>
        
        <div className="space-y-4">
          {/* Token Input */}
          <div>
            <label className="block text-sm font-medium mb-2">GitHub Personal Access Token</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx"
                className="flex-1 px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={validateGitHubToken}
                disabled={loading || !githubToken}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Validate
              </button>
            </div>
            {githubUser && (
              <p className="mt-2 text-sm text-green-400">
                ✓ Authenticated as {githubUser.name || githubUser.login}
              </p>
            )}
          </div>

          {/* Repository Selection */}
          {repos.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Select Repository</label>
              <select
                value={selectedRepo}
                onChange={(e) => handleRepoSelect(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a repository...</option>
                {repos.map(repo => (
                  <option key={repo.full_name} value={repo.full_name}>
                    {repo.full_name} {repo.private && '🔒'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Branch Selection */}
          {branches.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Default Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {branches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
          )}

          {/* Save button */}
          {selectedRepo && (
            <div className="mt-4">
              <button
                onClick={saveProjectConfig}
                disabled={loading || !selectedRepo}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Save Configuration
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status Messages */}
      {message && (
        <div className={`p-4 rounded-lg ${
          message.includes('success') ? 'bg-green-800' : 'bg-red-800'
        }`}>
          {message}
        </div>
      )}
    </div>
  );
}