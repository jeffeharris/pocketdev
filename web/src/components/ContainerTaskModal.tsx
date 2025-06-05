import React, { useState } from 'react';
import { X, GitBranch, CheckCircle, Container } from 'lucide-react';
import { Engineer } from '../types';
import toast from 'react-hot-toast';

interface Props {
  engineer: Engineer;
  onClose: () => void;
  onTaskAssigned: () => void;
}

export function ContainerTaskModal({ engineer, onClose, onTaskAssigned }: Props) {
  const [repository, setRepository] = useState('');
  const [branch, setBranch] = useState('main');
  const [description, setDescription] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(['']);
  const [testFramework, setTestFramework] = useState('jest');
  const [model, setModel] = useState('claude-3-5-sonnet-latest');
  const [gitUsername, setGitUsername] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (!repository || !description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    
    try {
      const payload: any = {
        engineerId: engineer.id,
        repository: {
          url: repository,
          branch: branch || 'main'
        },
        description,
        acceptanceCriteria: acceptanceCriteria.filter(c => c.trim()),
        testFramework,
        model
      };

      // Add credentials if provided
      if (gitUsername && gitToken) {
        payload.repository.credentials = {
          username: gitUsername,
          token: gitToken
        };
      }

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
        throw new Error(data.error || 'Failed to assign task');
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Repository URL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              placeholder="https://github.com/organization/repository.git"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch
              </label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Framework
              </label>
              <select
                value={testFramework}
                onChange={(e) => setTestFramework(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="jest">Jest</option>
                <option value="pytest">Pytest</option>
                <option value="mocha">Mocha</option>
              </select>
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

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Git Authentication (Optional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={gitUsername}
                  onChange={(e) => setGitUsername(e.target.value)}
                  placeholder="github-username"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Personal Access Token
                </label>
                <input
                  type="password"
                  value={gitToken}
                  onChange={(e) => setGitToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Latest)</option>
              <option value="claude-3-opus-latest">Claude 3 Opus</option>
              <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex items-start">
              <GitBranch className="h-5 w-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Workflow Preview:</p>
                <ol className="mt-1 space-y-1 list-decimal list-inside">
                  <li>Clone repository and create feature branch</li>
                  <li>Write tests following TDD principles</li>
                  <li>Implement code to pass tests</li>
                  <li>Run tests and iterate until passing</li>
                  <li>Commit and push changes</li>
                  <li>Generate PR link for review</li>
                </ol>
              </div>
            </div>
          </div>

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