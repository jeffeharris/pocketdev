import React, { useState, useEffect, useRef } from 'react';
import { X, Search, GitBranch, Lock, Globe, ChevronDown } from 'lucide-react';
import { createProject } from '../../services/api';

interface GitHubRepo {
  fullName: string;
  name: string;
  url: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
}

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: () => void;
}

/**
 * Modal for adding new projects with GitHub integration
 * 
 * Features:
 * - GitHub repository browser with search
 * - Manual repository URL input
 * - Branch selection
 * - Real-time validation
 * - Keyboard navigation
 */
export const AddProjectModal: React.FC<AddProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated
}) => {
  const [activeTab, setActiveTab] = useState<'github' | 'manual'>('github');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [error, setError] = useState('');
  const [githubStatus, setGithubStatus] = useState<{
    enabled: boolean;
    valid: boolean;
    username?: string;
  }>({ enabled: false, valid: false });

  // Manual entry form
  const [manualForm, setManualForm] = useState({
    repoUrl: '',
    branch: 'main',
    projectName: ''
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check GitHub status on mount
  useEffect(() => {
    if (isOpen) {
      checkGitHubStatus();
    }
  }, [isOpen]);

  // Focus search when tab changes to GitHub
  useEffect(() => {
    if (isOpen && activeTab === 'github' && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, activeTab]);

  // Filter repos based on search
  useEffect(() => {
    if (searchQuery) {
      const filtered = repos.filter(repo =>
        repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredRepos(filtered);
    } else {
      setFilteredRepos(repos);
    }
  }, [searchQuery, repos]);

  const checkGitHubStatus = async () => {
    try {
      const response = await fetch('/api/github/status');
      const status = await response.json();
      setGithubStatus(status);
      
      if (status.enabled && status.valid) {
        loadGitHubRepos();
      } else {
        setError('GitHub integration not configured. Please set up your GitHub token in settings.');
      }
    } catch (err) {
      console.error('Failed to check GitHub status:', err);
      setError('Failed to connect to GitHub');
    }
  };

  const loadGitHubRepos = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/github/repos');
      if (!response.ok) throw new Error('Failed to load repositories');
      
      const repoData = await response.json();
      setRepos(repoData);
      setFilteredRepos(repoData);
    } catch (err) {
      console.error('Failed to load repos:', err);
      setError('Failed to load repositories. Please check your GitHub token.');
    } finally {
      setLoading(false);
    }
  };

  const selectRepo = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setBranchesLoading(true);
    setError('');
    
    try {
      const [owner, name] = repo.fullName.split('/');
      const response = await fetch(`/api/github/repos/${owner}/${name}/branches`);
      if (!response.ok) throw new Error('Failed to load branches');
      
      const branchData = await response.json();
      setBranches(branchData.map((b: any) => b.name));
      setSelectedBranch(repo.defaultBranch);
    } catch (err) {
      console.error('Failed to load branches:', err);
      setError('Failed to load branches');
      setBranches([repo.defaultBranch]);
      setSelectedBranch(repo.defaultBranch);
    } finally {
      setBranchesLoading(false);
    }
  };

  const handleCreateProject = async () => {
    setError('');
    setLoading(true);

    try {
      let projectData;
      
      if (activeTab === 'github' && selectedRepo) {
        projectData = {
          repoUrl: selectedRepo.url,
          branch: selectedBranch || selectedRepo.defaultBranch,
          projectName: selectedRepo.name
        };
      } else {
        projectData = {
          repoUrl: manualForm.repoUrl,
          branch: manualForm.branch || 'main',
          projectName: manualForm.projectName || manualForm.repoUrl.split('/').pop()?.replace('.git', '') || 'project'
        };
      }

      await createProject(projectData);
      onProjectCreated();
      onClose();
      
      // Reset form
      setSelectedRepo(null);
      setSelectedBranch('');
      setManualForm({ repoUrl: '', branch: 'main', projectName: '' });
      setSearchQuery('');
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Add New Project</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('github')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'github'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            GitHub Repositories
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'manual'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Manual URL
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {activeTab === 'github' ? (
            <div className="flex-1 flex flex-col">
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search repositories..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Repository List */}
              <div className="flex-1 border border-gray-200 rounded-lg overflow-auto">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">
                    Loading repositories...
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    {searchQuery ? 'No repositories found' : 'No repositories available'}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredRepos.map((repo) => (
                      <button
                        key={repo.fullName}
                        onClick={() => selectRepo(repo)}
                        className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                          selectedRepo?.fullName === repo.fullName ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{repo.fullName}</div>
                            <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                              {repo.private ? (
                                <Lock className="w-3 h-3" />
                              ) : (
                                <Globe className="w-3 h-3" />
                              )}
                              <span>{repo.private ? 'Private' : 'Public'}</span>
                              <span>•</span>
                              <span>Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          {selectedRepo?.fullName === repo.fullName && (
                            <div className="text-blue-600">
                              <GitBranch className="w-5 h-5" />
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Branch Selection */}
              {selectedRepo && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Branch
                  </label>
                  <div className="relative">
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      disabled={branchesLoading}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                    >
                      {branchesLoading ? (
                        <option>Loading branches...</option>
                      ) : (
                        branches.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Repository URL
                </label>
                <input
                  type="text"
                  value={manualForm.repoUrl}
                  onChange={(e) => setManualForm(prev => ({ ...prev, repoUrl: e.target.value }))}
                  placeholder="https://github.com/user/repo.git"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Branch
                </label>
                <input
                  type="text"
                  value={manualForm.branch}
                  onChange={(e) => setManualForm(prev => ({ ...prev, branch: e.target.value }))}
                  placeholder="main"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name (optional)
                </label>
                <input
                  type="text"
                  value={manualForm.projectName}
                  onChange={(e) => setManualForm(prev => ({ ...prev, projectName: e.target.value }))}
                  placeholder="My Project"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6">
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProject}
              disabled={loading || (activeTab === 'github' ? !selectedRepo : !manualForm.repoUrl)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};