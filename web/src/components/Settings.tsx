import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';

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
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          </div>
        </div>
        
        {/* Active Configuration */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Configuration</h2>
          {activeProject?.active ? (
            <div className="space-y-2">
              <p className="text-sm"><span className="font-medium text-gray-600">Repository:</span> <span className="text-gray-900">{activeProject.config?.project.repository}</span></p>
              <p className="text-sm"><span className="font-medium text-gray-600">Default Branch:</span> <span className="text-gray-900">{activeProject.config?.project.default_branch}</span></p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No repository configured</p>
          )}
        </div>

        {/* GitHub Configuration */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">GitHub Configuration</h2>
          
          <div className="space-y-4">
            {/* Token Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">GitHub Personal Access Token</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={validateGitHubToken}
                  disabled={loading || !githubToken}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Validate
                </button>
              </div>
              {githubUser && (
                <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Authenticated as {githubUser.name || githubUser.login}
                </p>
              )}
            </div>

            {/* Repository Selection */}
            {repos.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Repository</label>
                <select
                  value={selectedRepo}
                  onChange={(e) => handleRepoSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Default Branch</label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {branches.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Save button */}
            {selectedRepo && (
              <div className="pt-4">
                <button
                  onClick={saveProjectConfig}
                  disabled={loading || !selectedRepo}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Configuration
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {message && (
          <div className={`mt-6 p-4 rounded-md ${
            message.includes('success') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message}
          </div>
        )}
      </main>
    </div>
  );
}