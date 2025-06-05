import React, { useState } from 'react';
import { Engineer } from '../types';
import { X, Zap, Users, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  engineer: Engineer;
  onClose: () => void;
  onTaskAssigned: () => void;
}

export function TaskModal({ engineer, onClose, onTaskAssigned }: Props) {
  const [task, setTask] = useState('');
  const [mode, setMode] = useState<'quick' | 'guided' | 'simulated'>('quick');
  const [model, setModel] = useState<'sonnet' | 'opus' | 'claude-3-5-sonnet-latest'>('sonnet');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task.trim()) return;

    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:3001/api/assign-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerId: engineer.id,
          task: task.trim(),
          mode: mode === 'simulated' ? 'simulated' : 'real',
          model: model
        })
      });

      if (!response.ok) throw new Error('Failed to assign task');

      toast.success(`Task assigned to ${engineer.name}`);
      onTaskAssigned();
    } catch (error) {
      toast.error('Failed to assign task. Make sure the backend is running.');
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
              <h2 className="text-xl font-semibold">Assign Task to {engineer.name}</h2>
              <p className="text-sm text-gray-500 mt-1">{engineer.role} Engineer</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Execution Mode
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setMode('simulated')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  mode === 'simulated'
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
                onClick={() => setMode('quick')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  mode === 'quick'
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
                onClick={() => setMode('guided')}
                disabled
                className="p-3 rounded-lg border-2 border-gray-200 opacity-50 cursor-not-allowed"
              >
                <Users className="h-5 w-5 mx-auto mb-1" />
                <div className="text-sm font-medium">Guided</div>
                <div className="text-xs text-gray-500">Coming soon</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Model Selection
            </label>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setModel('sonnet')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  model === 'sonnet'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-medium">Sonnet</div>
                <div className="text-xs text-gray-500">Fast & Smart</div>
              </button>
              
              <button
                type="button"
                onClick={() => setModel('opus')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  model === 'opus'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-medium">Opus</div>
                <div className="text-xs text-gray-500">Most Capable</div>
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
                <div className="text-xs text-gray-500">Latest</div>
              </button>
            </div>
          </div>

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
                  Assigning...
                </>
              ) : (
                'Assign Task'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}