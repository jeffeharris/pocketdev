import React, { useState } from 'react';
import { X, GitBranch, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useShortcutContext, useKeyboardShortcut } from '../../hooks/keyboard';

interface CommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  taskId: string;
  fileCount: number;
  stagedCount: number;
  onSuccess?: () => void;
}

export const CommitModal: React.FC<CommitModalProps> = ({
  isOpen,
  onClose,
  projectId,
  taskId,
  fileCount,
  stagedCount,
  onSuccess
}) => {
  const [message, setMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Activate commit modal context when open (high priority for modal)
  useShortcutContext('commitModal', { enabled: isOpen, priority: 30 });

  const handleCommit = async () => {
    if (!message.trim()) {
      setError('Please enter a commit message');
      return;
    }

    setIsCommitting(true);
    setError(null);

    try {
      const result = await api.stageAndCommit(projectId, taskId, message);
      
      if (result.success) {
        onClose();
        setMessage('');
        onSuccess?.();
      } else {
        setError(result.error || 'Commit failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to commit changes');
    } finally {
      setIsCommitting(false);
    }
  };

  // Keyboard shortcut for Ctrl+Enter to commit
  useKeyboardShortcut('ctrl+enter', () => {
    if (message.trim() && !isCommitting) {
      handleCommit();
    }
  }, {
    contexts: ['commitModal'],
    description: 'Commit changes',
    enabled: isOpen && !!message.trim() && !isCommitting
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Commit Changes</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            disabled={isCommitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              {stagedCount > 0 
                ? `Committing ${stagedCount} staged file${stagedCount !== 1 ? 's' : ''}`
                : `Staging and committing ${fileCount} file${fileCount !== 1 ? 's' : ''}`
              }
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="commit-message" className="block text-sm font-medium text-gray-700 mb-2">
                Commit Message
              </label>
              <textarea
                id="commit-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                rows={4}
                placeholder="Describe your changes..."
                autoFocus
                disabled={isCommitting}
              />
              <p className="mt-1 text-xs text-gray-500">
                Press Ctrl+Enter (Cmd+Enter on Mac) to commit
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={isCommitting}
          >
            Cancel
          </button>
          <button
            onClick={handleCommit}
            disabled={!message.trim() || isCommitting}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCommitting ? 'Committing...' : 'Commit'}
          </button>
        </div>
      </div>
    </div>
  );
};