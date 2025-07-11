import React, { useState, useEffect, useRef } from 'react';
import { X, Search, GitBranch, Lock, Globe, ChevronDown, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api.ts';

interface GitHubRepo {
  fullName: string;
  name: string;
  url: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: () => void;
}

/**
 * Modal for creating new projects with GitHub integration
 * 
 * Features:
 * - GitHub repository browser with search
 * - Manual repository URL input
 * - Consistent UX with fixed modal size
 * - Simplified keyboard navigation
 */
export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'github' | 'manual'>('github');
  
  // GitHub flow state
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  
  // Selection state
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  
  // Search/filter state (needed for the UI)
  const [repoSearch, setRepoSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  
  // Filtered lists
  const filteredRepos = repoSearch 
    ? repos.filter(repo => repo.fullName.toLowerCase().includes(repoSearch.toLowerCase()))
    : repos;

  const filteredBranches = branchSearch 
    ? branches.filter(branch => branch.toLowerCase().includes(branchSearch.toLowerCase()))
    : branches;
    
  // Refs for dropdowns
  const repoDropdownRef = useRef<HTMLDivElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  
  // Status states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [githubEnabled, setGithubEnabled] = useState(false);

  // Manual entry form
  const [manualForm, setManualForm] = useState({
    repoUrl: '',
    branch: '',
    projectName: ''
  });


  // Initialize on mount
  useEffect(() => {
    if (isOpen) {
      checkGitHubStatus();
      // Reset states
      setSuccess('');
      setError('');
      setSelectedRepo(null);
      setSelectedBranch('');
      setSelectedRepoId('');
      setRepoSearch('');
      setBranchSearch('');
      setManualForm({ repoUrl: '', branch: '', projectName: '' });
    }
  }, [isOpen]);


  const checkGitHubStatus = async () => {
    try {
      const response = await fetch('/api/github/status');
      const status = await response.json();
      setGithubEnabled(status.enabled && status.valid);
      
      if (status.enabled && status.valid) {
        loadGitHubRepos();
      }
    } catch (err) {
      console.error('Failed to check GitHub status:', err);
      setGithubEnabled(false);
    }
  };

  const loadGitHubRepos = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/github/repos');
      if (!response.ok) throw new Error('Failed to load repositories');
      
      const repoData = await response.json();
      // Sort by last updated date (newest first)
      const sortedRepos = repoData.sort((a: GitHubRepo, b: GitHubRepo) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setRepos(sortedRepos);
    } catch (err) {
      console.error('Failed to load repos:', err);
      setError('Failed to load repositories. Please check your GitHub token.');
    } finally {
      setLoading(false);
    }
  };

  // Handle repo selection
  const handleRepoChange = async (repoId: string) => {
    setSelectedRepoId(repoId);
    const repo = repos.find(r => r.fullName === repoId);
    if (!repo) return;
    
    setSelectedRepo(repo);
    setBranchesLoading(true);
    setError('');
    
    try {
      const [owner, name] = repo.fullName.split('/');
      const response = await fetch(`/api/github/repos/${owner}/${name}/branches`);
      if (!response.ok) throw new Error('Failed to load branches');
      
      const branchData = await response.json();
      setBranches(branchData.map((b: any) => b.name));
      setSelectedBranch('');
      setBranchSearch('');
    } catch (err) {
      console.error('Failed to load branches:', err);
      setError('Failed to load branches');
      setBranches([repo.defaultBranch]);
      setSelectedBranch('');
      setBranchSearch('');
    } finally {
      setBranchesLoading(false);
    }
  };
  
  // For compatibility with existing UI
  const selectRepo = (repo: GitHubRepo) => {
    handleRepoChange(repo.fullName);
    setRepoSearch(repo.fullName);
    setShowRepoDropdown(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent, dropdown: 'repo' | 'branch') => {
    if (e.key === 'Escape') {
      if (dropdown === 'repo') {
        setShowRepoDropdown(false);
      } else {
        setShowBranchDropdown(false);
      }
    }
  };

  const handleCreateProject = async () => {
    setError('');
    setSuccess('');
    setCreating(true);

    try {
      let projectData;
      
      if (activeTab === 'github' && selectedRepo) {
        projectData = {
          repoUrl: selectedRepo.url,
          branch: selectedBranch || selectedRepo.defaultBranch,
          projectName: selectedRepo.name
        };
      } else {
        // Auto-detect project name from URL if not provided
        const projectName = manualForm.projectName || 
          manualForm.repoUrl.split('/').pop()?.replace('.git', '') || 
          'project';
          
        projectData = {
          repoUrl: manualForm.repoUrl,
          branch: manualForm.branch,
          projectName
        };
      }

      const project = await api.createProject(projectData);
      setSuccess('Project created successfully! Redirecting...');
      
      // Auto-navigate after a short delay
      setTimeout(() => {
        onProjectCreated();
        navigate(`/projects/${project.id}`);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
      setCreating(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Create New Project</h2>
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

        {/* Content - Fixed Height */}
        <div className="p-6 h-96 overflow-y-auto">
          {/* Status Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {success}
            </div>
          )}

          {activeTab === 'github' ? (
            <div className="space-y-4">
              {!githubEnabled ? (
                <div className="text-center py-12">
                  <GitBranch className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-600 mb-2">GitHub integration not configured</p>
                  <p className="text-sm text-gray-500">Please set up your GitHub token in settings</p>
                </div>
              ) : (
                <>
                  {/* Repository Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Repository
                    </label>
                    <div className="relative" ref={repoDropdownRef}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          value={repoSearch}
                          onChange={(e) => {
                            setRepoSearch(e.target.value);
                            setShowRepoDropdown(true);
                            if (!selectedRepo || e.target.value !== selectedRepo.fullName) {
                              setSelectedRepo(null);
                              setBranches([]);
                              setSelectedBranch('');
                            }
                          }}
                          onFocus={() => setShowRepoDropdown(true)}
                          onKeyDown={(e) => handleKeyDown(e, 'repo')}
                          placeholder="Search repositories..."
                          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={loading}
                        />
                        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      </div>
                      
                      {/* Repository Dropdown */}
                      {showRepoDropdown && !loading && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                          {filteredRepos.length === 0 ? (
                            <div className="p-3 text-center text-gray-500 text-sm">
                              {repoSearch ? 'No repositories found' : 'No repositories available'}
                            </div>
                          ) : (
                            filteredRepos.map((repo) => (
                              <button
                                key={repo.fullName}
                                onClick={() => selectRepo(repo)}
                                className="w-full p-3 text-left hover:bg-gray-50 transition-colors border-b last:border-b-0"
                              >
                                <div className="font-medium text-gray-900">{repo.fullName}</div>
                                <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                  {repo.private ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                                  <span>{repo.private ? 'Private' : 'Public'}</span>
                                  <span>•</span>
                                  <span>Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Branch Selection */}
                  {selectedRepo && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Branch
                      </label>
                      <div className="relative" ref={branchDropdownRef}>
                        <div className="relative">
                          <GitBranch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input
                            type="text"
                            value={branchSearch}
                            onChange={(e) => {
                              setBranchSearch(e.target.value);
                              setShowBranchDropdown(true);
                            }}
                            onFocus={() => setShowBranchDropdown(true)}
                            onKeyDown={(e) => handleKeyDown(e, 'branch')}
                            placeholder={branchesLoading ? "Loading branches..." : "Search branches..."}
                            disabled={branchesLoading}
                            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        </div>
                        
                        {/* Branch Dropdown */}
                        {showBranchDropdown && !branchesLoading && branches.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                            {filteredBranches.length === 0 ? (
                              <div className="p-3 text-center text-gray-500 text-sm">
                                No branches found
                              </div>
                            ) : (
                              filteredBranches.map((branch) => (
                                <button
                                  key={branch}
                                  onClick={() => {
                                    setSelectedBranch(branch);
                                    setBranchSearch(branch);
                                    setShowBranchDropdown(false);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors border-b last:border-b-0"
                                >
                                  {branch}
                                  {branch === selectedRepo.defaultBranch && (
                                    <span className="text-xs text-gray-500 ml-2">(default)</span>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Selected Repository Summary */}
                  {selectedRepo && selectedBranch && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Ready to create project</h4>
                      <div className="space-y-1 text-sm text-gray-600">
                        <div>Repository: <span className="font-medium text-gray-900">{selectedRepo.fullName}</span></div>
                        <div>Branch: <span className="font-medium text-gray-900">{selectedBranch}</span></div>
                        <div>Project name: <span className="font-medium text-gray-900">{selectedRepo.name}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Loading State */}
                  {loading && (
                    <div className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
                      <p className="text-gray-500">Loading repositories...</p>
                    </div>
                  )}
                </>
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
                  Branch <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={manualForm.branch}
                  onChange={(e) => setManualForm(prev => ({ ...prev, branch: e.target.value }))}
                  placeholder="e.g. main, master, develop"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
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
                <p className="mt-1 text-xs text-gray-500">
                  If left empty, will be auto-detected from repository URL
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-6">
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={creating}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProject}
              disabled={creating || (activeTab === 'github' ? !selectedRepo || !selectedBranch : !manualForm.repoUrl || !manualForm.branch)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};