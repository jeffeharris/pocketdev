import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Key, Settings, X } from 'lucide-react';

interface TaskRecoveryModalProps {
  task: any;
  onClose: () => void;
  onRetry: (options: any) => void;
}

export function TaskRecoveryModal({ task, onClose, onRetry }: TaskRecoveryModalProps) {
  const [gitUsername, setGitUsername] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);

  // Get recovery plan from task
  const recoveryPlan = task.recoveryPlan || task.recovery;
  
  if (!recoveryPlan) {
    return null;
  }

  const handleRetry = async () => {
    if (recoveryPlan.failureType === 'git_auth_failure') {
      if (!gitUsername || !gitToken) {
        alert('Please provide both username and token');
        return;
      }
    }

    setIsRetrying(true);
    
    try {
      await onRetry({
        gitUsername,
        gitToken
      });
    } catch (error) {
      console.error('Retry failed:', error);
      setIsRetrying(false);
    }
  };

  const getFailureIcon = () => {
    switch (recoveryPlan.failureType) {
      case 'git_auth_failure':
        return <Key className="h-5 w-5" />;
      case 'dependency_failure':
        return <AlertTriangle className="h-5 w-5" />;
      default:
        return <AlertTriangle className="h-5 w-5" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            {getFailureIcon()}
            <h3 className="text-lg font-semibold">Task Recovery Available</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              The task failed but can be recovered. Failure type: <span className="font-medium">{recoveryPlan.failureType}</span>
            </p>
            
            {recoveryPlan.immediateActions && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
                <p className="text-sm font-medium text-amber-800 mb-1">Suggested Actions:</p>
                <ul className="text-sm text-amber-700 space-y-1">
                  {recoveryPlan.immediateActions.map((action: string, index: number) => (
                    <li key={index} className="flex items-start">
                      <span className="text-amber-600 mr-2">•</span>
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Credential input for git auth failures */}
          {recoveryPlan.failureType === 'git_auth_failure' && (
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GitHub Username
                </label>
                <input
                  type="text"
                  value={gitUsername}
                  onChange={(e) => setGitUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="username"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal Access Token
                </label>
                <input
                  type="password"
                  value={gitToken}
                  onChange={(e) => setGitToken(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ghp_..."
                />
              </div>
              
              <p className="text-xs text-gray-500">
                Need a token? <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Create one on GitHub</a>
              </p>
            </div>
          )}

          <div className="flex gap-3">
            {recoveryPlan.autoRecoveryAvailable && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Retrying...' : 'Retry Task'}
              </button>
            )}
            
            <button
              onClick={() => window.location.href = '/settings'}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Settings className="h-4 w-4" />
              Configure Settings
            </button>
          </div>

          {recoveryPlan.estimatedRetryTime && (
            <p className="text-xs text-gray-500 text-center mt-3">
              Estimated retry time: {recoveryPlan.estimatedRetryTime} seconds
            </p>
          )}
        </div>
      </div>
    </div>
  );
}