import React, { useState } from 'react';
import { X, Terminal, GitBranch, ListChecks } from 'lucide-react';
import { StreamingTaskView } from './StreamingTaskView';

interface StreamingTaskModalProps {
  engineerId: string;
  onClose: () => void;
  onComplete: (result: any) => void;
}

export function StreamingTaskModal({ engineerId, onClose, onComplete }: StreamingTaskModalProps) {
  const [showStreaming, setShowStreaming] = useState(false);
  const [task, setTask] = useState({
    description: '',
    repository: '',
    branch: 'main',
    acceptanceCriteria: ['']
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowStreaming(true);
  };

  const handleAcceptanceCriteriaChange = (index: number, value: string) => {
    const newCriteria = [...task.acceptanceCriteria];
    newCriteria[index] = value;
    setTask({ ...task, acceptanceCriteria: newCriteria });
  };

  const addAcceptanceCriteria = () => {
    setTask({ ...task, acceptanceCriteria: [...task.acceptanceCriteria, ''] });
  };

  const removeAcceptanceCriteria = (index: number) => {
    const newCriteria = task.acceptanceCriteria.filter((_, i) => i !== index);
    setTask({ ...task, acceptanceCriteria: newCriteria });
  };

  if (showStreaming) {
    return (
      <StreamingTaskView
        engineerId={engineerId}
        task={{
          description: task.description,
          repository: task.repository ? {
            url: task.repository,
            branch: task.branch
          } : undefined,
          acceptanceCriteria: task.acceptanceCriteria.filter(c => c.trim())
        }}
        onComplete={onComplete}
        onCancel={() => setShowStreaming(false)}
      />
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl">
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Terminal className="w-5 h-5 text-purple-600" />
          Stream Container Task
        </h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Task Description
          </label>
          <textarea
            value={task.description}
            onChange={(e) => setTask({ ...task, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
            rows={3}
            placeholder="Describe the task for the AI engineer..."
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <GitBranch className="w-4 h-4 inline mr-1" />
            Repository URL (optional)
          </label>
          <input
            type="text"
            value={task.repository}
            onChange={(e) => setTask({ ...task, repository: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
            placeholder="https://github.com/username/repo.git"
          />
        </div>

        {task.repository && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Branch
            </label>
            <input
              type="text"
              value={task.branch}
              onChange={(e) => setTask({ ...task, branch: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
              placeholder="main"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <ListChecks className="w-4 h-4 inline mr-1" />
            Acceptance Criteria (optional)
          </label>
          {task.acceptanceCriteria.map((criteria, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={criteria}
                onChange={(e) => handleAcceptanceCriteriaChange(index, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter acceptance criteria..."
              />
              {task.acceptanceCriteria.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAcceptanceCriteria(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addAcceptanceCriteria}
            className="text-sm text-purple-600 hover:text-purple-700"
          >
            + Add criteria
          </button>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-2">
            🚀 Streaming Mode Features
          </h3>
          <ul className="text-xs text-purple-700 dark:text-purple-400 space-y-1">
            <li>• Real-time progress updates as Claude works</li>
            <li>• See which tools are being used</li>
            <li>• Live cost tracking</li>
            <li>• Immediate feedback on task execution</li>
          </ul>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded-md hover:from-purple-700 hover:to-blue-700 font-medium"
          >
            Start Streaming Task
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}