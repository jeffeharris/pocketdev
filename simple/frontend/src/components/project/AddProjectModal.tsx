import React, { useState, useEffect, useRef } from 'react';
import { X, Search, GitBranch, Lock, Globe, ChevronDown, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

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
 * - Auto-navigation to project after creation
 */
export const AddProjectModal: React.FC<AddProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'github' | 'manual'>('github');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [branchQuery, setBranchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [selectedBranchIndex, setSelectedBranchIndex] = useState(-1);
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
  const branchInputRef = useRef<HTMLInputElement>(null);
  const branchDropdownRef = useRef<HTMLDivElement>(null);

  // Filtered repos based on search
  const filteredRepos = searchQuery 
    ? repos.filter(repo => repo.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  // Filtered branches based on search
  const filteredBranches = branchQuery 
    ? branches.filter(branch => branch.toLowerCase().includes(branchQuery.toLowerCase()))
    : branches;

  // Check GitHub status on mount
  useEffect(() => {
    if (isOpen) {
      checkGitHubStatus();
      setSuccess('');
      setError('');
    }
  }, [isOpen]);

  // Focus search when tab changes to GitHub
  useEffect(() => {
    if (isOpen && activeTab === 'github' && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, activeTab]);

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
      setBranchQuery(repo.defaultBranch);
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
        projectData = {
          repoUrl: manualForm.repoUrl,
          branch: manualForm.branch || 'main',
          projectName: manualForm.projectName || manualForm.repoUrl.split('/').pop()?.replace('.git', '') || 'project'
        };
      }

      const project = await api.createProject(projectData);
      setSuccess('Project created successfully! Redirecting...');
      
      // Auto-navigate after a short delay
      setTimeout(() => {
        onProjectCreated();
        navigate(`/projects/${project.id}`);
        
        // Reset form
        setSelectedRepo(null);
        setSelectedBranch('');
        setBranchQuery('');
        setManualForm({ repoUrl: '', branch: 'main', projectName: '' });
        setSearchQuery('');
        setShowBranchDropdown(false);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
      setCreating(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const displayRepos = searchQuery ? filteredRepos : repos.slice(0, 10); // Show first 10 repos if no search
    if (displayRepos.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex(prev => 
            prev < displayRepos.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex(prev => 
            prev > 0 ? prev - 1 : displayRepos.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedSuggestionIndex >= 0 && displayRepos[selectedSuggestionIndex]) {
            selectRepo(displayRepos[selectedSuggestionIndex]);
            setSearchQuery(displayRepos[selectedSuggestionIndex].fullName);
            setSelectedSuggestionIndex(-1);
          }
          break;
        case 'Escape':
          setSearchQuery('');
          setSelectedSuggestionIndex(-1);
          break;
      }
    }
  };

  const handleBranchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showBranchDropdown && filteredBranches.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedBranchIndex(prev => 
            prev < filteredBranches.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedBranchIndex(prev => 
            prev > 0 ? prev - 1 : filteredBranches.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedBranchIndex >= 0 && filteredBranches[selectedBranchIndex]) {
            setSelectedBranch(filteredBranches[selectedBranchIndex]);
            setBranchQuery(filteredBranches[selectedBranchIndex]);
            setShowBranchDropdown(false);
            setSelectedBranchIndex(-1);
          }
          break;
        case 'Escape':
          setShowBranchDropdown(false);
          setSelectedBranchIndex(-1);
          break;
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
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
        <div className="p-6" style={{ minHeight: '320px' }}>
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
            <div>
              {/* Repository Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedSuggestionIndex(-1);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  onFocus={() => setSelectedSuggestionIndex(-1)}
                  placeholder="Search repositories..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                
                {/* Repository Dropdown - Show recent repos or search results */}
                {!selectedRepo && (searchQuery || !loading) && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {!searchQuery && repos.length > 0 && (
                      <div className="px-3 py-2 text-xs text-gray-500 border-b">
                        Recent repositories
                      </div>
                    )}
                    {(() => {
                      const displayRepos = searchQuery ? filteredRepos : repos.slice(0, 10);
                      if (displayRepos.length === 0) {
                        return (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            {searchQuery ? 'No repositories found' : 'No repositories available'}
                          </div>
                        );
                      }
                      return displayRepos.map((repo, index) => (
                      <button
                        key={repo.fullName}
                        onClick={() => {
                          selectRepo(repo);
                          setSearchQuery(repo.fullName);
                          setSelectedSuggestionIndex(-1);
                        }}
                        className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                          index === selectedSuggestionIndex ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="font-medium text-gray-900">{repo.fullName}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          {repo.private ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                          <span>{repo.private ? 'Private' : 'Public'}</span>
                          <span>•</span>
                          <span>Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </button>
                    ));
                    })()}
                  </div>
                )}
              </div>

              {/* Selected Repository Info */}
              {selectedRepo && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium text-gray-900">{selectedRepo.fullName}</div>
                      <div className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                        {selectedRepo.private ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                        <span>{selectedRepo.private ? 'Private' : 'Public'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedRepo(null);
                        setSearchQuery('');
                        setBranches([]);
                        setSelectedBranch('');
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Branch Selection with Typeahead */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Branch
                    </label>
                    <input
                      ref={branchInputRef}
                      type="text"
                      value={branchQuery}
                      onChange={(e) => {
                        setBranchQuery(e.target.value);
                        setShowBranchDropdown(true);
                        setSelectedBranchIndex(-1);
                      }}
                      onKeyDown={handleBranchKeyDown}
                      onFocus={() => {
                        setShowBranchDropdown(true);
                        setSelectedBranchIndex(-1);
                      }}
                      onBlur={() => setTimeout(() => {
                        setShowBranchDropdown(false);
                        setSelectedBranchIndex(-1);
                      }, 200)}
                      placeholder={branchesLoading ? "Loading branches..." : "Type to search branches..."}
                      disabled={branchesLoading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    
                    {/* Branch Dropdown */}
                    {showBranchDropdown && !branchesLoading && filteredBranches.length > 0 && (
                      <div 
                        ref={branchDropdownRef}
                        className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto"
                      >
                        {filteredBranches.map((branch, index) => (
                          <button
                            key={branch}
                            type="button"
                            onClick={() => {
                              setSelectedBranch(branch);
                              setBranchQuery(branch);
                              setShowBranchDropdown(false);
                              setSelectedBranchIndex(-1);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                              index === selectedBranchIndex ? 'bg-blue-50' : ''
                            }`}
                          >
                            {branch}
                            {branch === selectedRepo.defaultBranch && (
                              <span className="text-xs text-gray-500 ml-2">(default)</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500">Loading repositories...</p>
                </div>
              )}

              {/* Empty State */}
              {!loading && !selectedRepo && !searchQuery && (
                <div className="text-center py-8 text-gray-500">
                  <GitBranch className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Search for a repository to get started</p>
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
              disabled={creating}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProject}
              disabled={creating || (activeTab === 'github' ? !selectedRepo : !manualForm.repoUrl)}
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