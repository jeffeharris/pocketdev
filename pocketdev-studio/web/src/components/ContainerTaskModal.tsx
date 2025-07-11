import React, { useState, useEffect } from 'react';
import { X, GitBranch, CheckCircle, Container, AlertCircle, Zap } from 'lucide-react';
import { Engineer } from '../types.ts';
import toast from 'react-hot-toast';

interface Props {
  engineer: Engineer;
  onClose: () => void;
  onTaskAssigned: () => void;
}

interface ProjectConfig {
  active: boolean;
  config?: {
    project: {
      repository: string;
      default_branch: string;
    };
  };
}

interface GitHubBranch {
  name: string;
  protected: boolean;
}

export function ContainerTaskModal({ engineer, onClose, onTaskAssigned }: Props) {
  const [repository, setRepository] = useState('');
  const [branch, setBranch] = useState('main');
  const [description, setDescription] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(['']);
  const [model, setModel] = useState('claude-sonnet-4-0');
  const [loading, setLoading] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [streamingEnabled, setStreamingEnabled] = useState(false);

  // Fetch active project configuration on mount
  useEffect(() => {
    fetchProjectConfig();
  }, []);

  const fetchProjectConfig = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/project/config');
      const data: ProjectConfig = await response.json();
      
      if (data.active && data.config) {
        setRepository(data.config.project.repository);
        setBranch(data.config.project.default_branch);
        
        // Check if credentials are available
        const credResponse = await fetch('http://localhost:3001/api/project/credentials');
        const credData = await credResponse.json();
        setHasCredentials(credData.available);
        
        // Fetch branches if we have a repository
        if (data.config.project.repository && credData.available) {
          fetchBranches(data.config.project.repository);
        }
      }
    } catch (error) {
      console.error('Failed to fetch project config:', error);
    }
  };

  const fetchBranches = async (repoUrl: string) => {
    setLoadingBranches(true);
    try {
      // Extract owner/repo from URL
      const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)(\.git)?$/);
      if (!match) return;
      
      const repoFullName = `${match[1]}/${match[2]}`;
      
      // Get token from localStorage (set by Settings page)
      const token = localStorage.getItem('GITHUB_PERSONAL_TOKEN');
      if (!token) return;
      
      const response = await fetch('http://localhost:3001/api/github/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, repoFullName })
      });
      
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches);
      }
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    } finally {
      setLoadingBranches(false);
    }
  };

  const handleAddCriteria = () => {
    setAcceptanceCriteria([...acceptanceCriteria, '']);
  };

  const handleCriteriaChange = (index: number, value: string) => {
    const updated = [...acceptanceCriteria];
    updated[index] = value;
    setAcceptanceCriteria(updated);
  };

  const handleRemoveCriteria = (index: number) => {
    setAcceptanceCriteria(acceptanceCriteria.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!repository) {
      toast.error('Please configure a repository in Settings first');
      return;
    }
    
    if (!description) {
      toast.error('Please provide a task description');
      return;
    }

    setLoading(true);
    
    try {
      // Get credentials from localStorage
      const gitToken = localStorage.getItem('GITHUB_PERSONAL_TOKEN');
      const gitUsername = localStorage.getItem('GITHUB_PERSONAL_USERNAME');
      
      const payload = {
        engineerId: engineer.id,
        repository,
        description,
        acceptanceCriteria: acceptanceCriteria.filter(c => c.trim()),
        model,
        streamingEnabled, // Add streaming flag
        // Pass branch only if different from default
        ...(branch && { branch }),
        // Include credentials if available
        ...(gitToken && gitUsername && { gitToken, gitUsername })
      };

      if (streamingEnabled) {
        // Handle streaming response
        const response = await fetch('http://localhost:3001/api/container/assign-task', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to start streaming task');
        }

        // Task started in streaming mode
        toast.success('Streaming task started! Check the engineer card for real-time updates.');
        onTaskAssigned();
        onClose();
        
        // The task progress will be handled by TaskProgress component via SSE
      } else {
        // Standard response handling
        const response = await fetch('http://localhost:3001/api/container/assign-task', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
          toast.success('Container task assigned successfully!');
          onTaskAssigned();
          onClose();
        } else {
          // Check if it's a pre-flight validation error
          if (data.preflightFailed && data.validationErrors) {
          // Build detailed error message
          const errorMessages = data.validationErrors.map(err => 
            `❌ ${err.message}${err.fix ? `\n   Fix: ${err.fix}` : ''}`
          ).join('\n\n');
          
          toast.error(
            <div className="space-y-2">
              <div className="font-semibold">Pre-flight validation failed:</div>
              <pre className="text-xs whitespace-pre-wrap">{errorMessages}</pre>
            </div>,
            { duration: 10000 } // Show for 10 seconds
          );
          } else {
            throw new Error(data.error || 'Failed to assign task');
          }
        }
      }
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to assign task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Container className="h-5 w-5 text-blue-600" />
              Assign Container Task to {engineer.name}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Task will run in an isolated Docker container with full Git integration
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Repository and Branch */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Repository
              </label>
              {repository ? (
                <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700">
                  {repository.replace(/^https:\/\/github\.com\//, '')}
                </div>
              ) : (
                <div className="px-3 py-2 bg-yellow-50 border border-yellow-300 rounded-md">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">No repository configured. Please configure in Settings.</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start from Branch
              </label>
              {branches.length > 0 ? (
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingBranches}
                >
                  {branches.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingBranches}
                />
              )}
              {loadingBranches && (
                <p className="text-sm text-gray-500 mt-1">Loading branches...</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe what the AI developer should build..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Acceptance Criteria
            </label>
            {acceptanceCriteria.map((criteria, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={criteria}
                  onChange={(e) => handleCriteriaChange(index, e.target.value)}
                  placeholder={`Criteria ${index + 1}`}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveCriteria(index)}
                  className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddCriteria}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              + Add Criteria
            </button>
          </div>


          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="claude-opus-4-0">Claude Opus 4 (Most Capable)</option>
                <option value="claude-sonnet-4-0">Claude Sonnet 4 (Balanced)</option>
                <option value="claude-3-7-sonnet-latest">Claude 3.7 Sonnet (Extended Thinking)</option>
                <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Previous Gen)</option>
                <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku (Fast)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Execution Mode
              </label>
              <button
                type="button"
                onClick={() => setStreamingEnabled(!streamingEnabled)}
                className={`w-full px-3 py-2 rounded-md border transition-all flex items-center justify-center gap-2 ${
                  streamingEnabled
                    ? 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Zap className={`h-4 w-4 ${streamingEnabled ? 'text-purple-600' : 'text-gray-400'}`} />
                <span className="font-medium">
                  {streamingEnabled ? 'Streaming Enabled' : 'Standard Mode'}
                </span>
              </button>
              {streamingEnabled && (
                <p className="text-xs text-purple-600 mt-1">
                  Real-time progress updates
                </p>
              )}
            </div>
          </div>

          {hasCredentials && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="flex items-start">
                <GitBranch className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Workflow:</p>
                  <ol className="mt-1 space-y-1 list-decimal list-inside">
                    <li>Clone repository from branch: <span className="font-mono">{branch}</span></li>
                    <li>Create feature branch for the task</li>
                    <li>Implement the requested functionality</li>
                    <li>Create verification tests</li>
                    <li>Stage changes for your review</li>
                    <li>You can accept and push to GitHub</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {!hasCredentials && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">
                  No GitHub credentials configured. Configure in Settings to enable push to repository.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Starting Container...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Assign Task
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}