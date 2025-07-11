import React, { useState, useEffect } from 'react';
import { X, GitBranch, CheckCircle, Container, AlertCircle, Zap, Users, Loader } from 'lucide-react';
import { Engineer } from '../types.ts';
import toast from 'react-hot-toast';

interface Props {
  engineer: Engineer;
  onClose: () => void;
  onTaskAssigned: () => void;
  mode: 'host' | 'container';
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

export function UnifiedTaskModal({ engineer, onClose, onTaskAssigned, mode }: Props) {
  // Common state
  const [task, setTask] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-0');
  const [loading, setLoading] = useState(false);
  const [executionMode, setExecutionMode] = useState<'quick' | 'guided' | 'simulated'>('quick');
  
  // Container-specific state
  const [repository, setRepository] = useState('');
  const [branch, setBranch] = useState('main');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(['']);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [streamingEnabled, setStreamingEnabled] = useState(false);

  // Fetch project config for container mode
  useEffect(() => {
    if (mode === 'container') {
      fetchProjectConfig();
    }
  }, [mode]);

  const fetchProjectConfig = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/project/config');
      const data: ProjectConfig = await response.json();
      
      if (data.active && data.config) {
        setRepository(data.config.project.repository);
        setBranch(data.config.project.default_branch);
        
        const credResponse = await fetch('http://localhost:3001/api/project/credentials');
        const credData = await credResponse.json();
        setHasCredentials(credData.available);
        
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
      const match = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)(\.git)?$/);
      if (!match) return;
      
      const repoFullName = `${match[1]}/${match[2]}`;
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
    
    if (!task.trim()) {
      toast.error('Please provide a task description');
      return;
    }

    if (mode === 'container' && !repository) {
      toast.error('Please configure a repository in Settings first');
      return;
    }

    setLoading(true);
    
    try {
      if (mode === 'host') {
        // Host mode submission
        const response = await fetch('http://localhost:3001/api/assign-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            engineerId: engineer.id,
            task: task.trim(),
            mode: executionMode === 'simulated' ? 'simulated' : 'real',
            model: model
          })
        });

        if (!response.ok) throw new Error('Failed to assign task');

        toast.success(`Task assigned to ${engineer.name}`);
        onTaskAssigned();
        onClose();
      } else {
        // Container mode submission
        const gitToken = localStorage.getItem('GITHUB_PERSONAL_TOKEN');
        const gitUsername = localStorage.getItem('GITHUB_PERSONAL_USERNAME');
        
        const payload = {
          engineerId: engineer.id,
          repository,
          description: task,
          acceptanceCriteria: acceptanceCriteria.filter(c => c.trim()),
          model,
          streamingEnabled,
          ...(branch && { branch }),
          ...(gitToken && gitUsername && { gitToken, gitUsername })
        };

        const response = await fetch('http://localhost:3001/api/container/assign-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        
        if (response.ok && data.success) {
          toast.success(streamingEnabled 
            ? 'Streaming task started! Check the engineer card for real-time updates.'
            : 'Container task assigned successfully!'
          );
          onTaskAssigned();
          onClose();
        } else {
          if (data.preflightFailed && data.validationErrors) {
            const errorMessages = data.validationErrors.map(err => 
              `❌ ${err.message}${err.fix ? `\n   Fix: ${err.fix}` : ''}`
            ).join('\n\n');
            
            toast.error(
              <div className="space-y-2">
                <div className="font-semibold">Pre-flight validation failed:</div>
                <pre className="text-xs whitespace-pre-wrap">{errorMessages}</pre>
              </div>,
              { duration: 10000 }
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

  const exampleTasks = {
    frontend: [
      'Create a new React component file called UserProfile.jsx with props for name, email, and avatar',
      'Write a TodoList.jsx component that manages a list of tasks with add, remove, and toggle functionality',
      'Create a responsive Navigation.jsx component with mobile hamburger menu'
    ],
    backend: [
      'Create an Express server.js file with basic CRUD endpoints for a user model',
      'Write a middleware/auth.js file that validates JWT tokens',
      'Create a database/schema.sql file with tables for users, posts, and comments'
    ],
    devops: [
      'Create a Dockerfile for a Node.js application with multi-stage build',
      'Write a docker-compose.yml file with services for frontend, backend, and postgres',
      'Create a .github/workflows/ci.yml file for automated testing and deployment'
    ],
    fullstack: [
      'Create a complete user authentication system with register.jsx, login.jsx, and auth middleware files',
      'Build a blog system with Post.jsx component and corresponding API endpoints in posts.js',
      'Create a file upload system with FileUpload.jsx component and server-side handling'
    ]
  };

  const examples = exampleTasks[engineer.role] || exampleTasks.fullstack;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                {mode === 'container' && <Container className="h-5 w-5 text-blue-600" />}
                Assign Task to {engineer.name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {engineer.role} Engineer
                {mode === 'container' && ' - Isolated Docker container with Git integration'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-88px)]">
          {/* Repository and Branch for container mode */}
          {mode === 'container' && (
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
          )}

          {/* Task Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Task Description
            </label>
            <textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe what you want the AI engineer to do..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={4}
              required
            />
          </div>

          {/* Acceptance Criteria for container mode */}
          {mode === 'container' && (
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
          )}

          {/* Execution Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Execution Mode
            </label>
            {mode === 'host' ? (
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setExecutionMode('simulated')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    executionMode === 'simulated'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Loader className="h-5 w-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">Simulated</div>
                  <div className="text-xs text-gray-500">For testing</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => setExecutionMode('quick')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    executionMode === 'quick'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Zap className="h-5 w-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">Quick Task</div>
                  <div className="text-xs text-gray-500">Autonomous</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => setExecutionMode('guided')}
                  disabled
                  className="p-3 rounded-lg border-2 border-gray-200 opacity-50 cursor-not-allowed"
                >
                  <Users className="h-5 w-5 mx-auto mb-1" />
                  <div className="text-sm font-medium">Guided</div>
                  <div className="text-xs text-gray-500">Coming soon</div>
                </button>
              </div>
            ) : (
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
            )}
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Model Selection
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setModel('claude-opus-4-0')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  model === 'claude-opus-4-0'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-medium">Opus 4</div>
                <div className="text-xs text-gray-500">Most Capable</div>
              </button>
              
              <button
                type="button"
                onClick={() => setModel('claude-sonnet-4-0')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  model === 'claude-sonnet-4-0'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-medium">Sonnet 4</div>
                <div className="text-xs text-gray-500">Balanced</div>
              </button>

              <button
                type="button"
                onClick={() => setModel('claude-3-5-sonnet-latest')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  model === 'claude-3-5-sonnet-latest'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-medium">3.5 Sonnet</div>
                <div className="text-xs text-gray-500">Previous Gen</div>
              </button>
            </div>
            
            {mode === 'container' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setModel('claude-3-7-sonnet-latest')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    model === 'claude-3-7-sonnet-latest'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium">3.7 Sonnet</div>
                  <div className="text-xs text-gray-500">Extended Thinking</div>
                </button>
                
                <button
                  type="button"
                  onClick={() => setModel('claude-3-5-haiku-latest')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    model === 'claude-3-5-haiku-latest'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium">3.5 Haiku</div>
                  <div className="text-xs text-gray-500">Fast</div>
                </button>
              </div>
            )}
          </div>

          {/* Example Tasks */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Example Tasks
            </label>
            <div className="space-y-2">
              {examples.map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setTask(example)}
                  className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Container mode workflow info */}
          {mode === 'container' && hasCredentials && (
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

          {mode === 'container' && !hasCredentials && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">
                  No GitHub credentials configured. Configure in Settings to enable push to repository.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !task.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {mode === 'container' ? 'Starting Container...' : 'Assigning...'}
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