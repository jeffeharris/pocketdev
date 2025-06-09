import React from 'react';
import { CheckCircle, XCircle, Clock, GitBranch, FileText, DollarSign, AlertCircle } from 'lucide-react';

interface TaskResult {
  success: boolean;
  sessionId: string;
  summary: string;
  error: string | null;
  errorDetails?: string;
  humanFriendlyMessage?: string;
  naturalLanguageError?: {
    summary: string;
    explanation: string;
    nextSteps: string[];
    quickFixes: Array<{
      issue: string;
      suggestion: string;
    }>;
  };
  duration: number;
  cost_usd: number;
  timestamp: string;
  engineerRole: string;
  model: string;
  taskDescription: string;
  filesChanged: string[];
  testResults: string;
  suggestedNextSteps: string[];
  featureBranch: string;
  canContinue: boolean;
}

interface Props {
  result: TaskResult;
  onAccept: () => void;
  onFollowUp: (task: string) => void;
  onClose: () => void;
}

export function TaskResultView({ result, onAccept, onFollowUp, onClose }: Props) {
  const [followUpTask, setFollowUpTask] = React.useState('');
  const [showFollowUpInput, setShowFollowUpInput] = React.useState(false);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`p-6 border-b ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                {result.success ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-600" />
                )}
                <h2 className="text-2xl font-bold text-gray-900">
                  Task {result.success ? 'Completed' : 'Failed'}
                </h2>
              </div>
              <p className="mt-2 text-gray-700">{result.summary}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Supervisor Interpretation or Error Message */}
          {result.naturalLanguageError ? (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
              <div className="mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-amber-900">Supervisor Analysis</h3>
                    <p className="mt-2 text-amber-800">{result.naturalLanguageError.summary}</p>
                    {result.naturalLanguageError.explanation && (
                      <p className="mt-2 text-amber-700">{result.naturalLanguageError.explanation}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Next Steps */}
              {result.naturalLanguageError.nextSteps.length > 0 && (
                <div className="mt-4 border-t border-amber-200 pt-4">
                  <h4 className="text-sm font-medium text-amber-900 mb-2">Next Steps:</h4>
                  <ul className="space-y-1">
                    {result.naturalLanguageError.nextSteps.map((step, index) => (
                      <li key={index} className="text-sm text-amber-700">{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick Fixes */}
              {result.naturalLanguageError.quickFixes.length > 0 && (
                <div className="mt-4 border-t border-amber-200 pt-4">
                  <h4 className="text-sm font-medium text-amber-900 mb-2">Quick Fixes:</h4>
                  <div className="space-y-2">
                    {result.naturalLanguageError.quickFixes.map((fix, index) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium text-amber-800">{fix.issue}:</span>
                        <span className="text-amber-700 ml-1">{fix.suggestion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : result.errorDetails ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                <div className="text-red-800">
                  <p className="font-medium">Error Details</p>
                  <pre className="mt-2 text-sm whitespace-pre-wrap">{result.errorDetails}</pre>
                </div>
              </div>
            </div>
          ) : result.error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                <div className="text-red-800">
                  <p className="font-medium">Error</p>
                  <p className="mt-1">{result.error}</p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Metadata */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-md p-3">
              <div className="flex items-center text-gray-600 mb-1">
                <Clock className="h-4 w-4 mr-1" />
                <span className="text-sm">Duration</span>
              </div>
              <p className="font-semibold">{formatDuration(result.duration)}</p>
            </div>
            <div className="bg-gray-50 rounded-md p-3">
              <div className="flex items-center text-gray-600 mb-1">
                <DollarSign className="h-4 w-4 mr-1" />
                <span className="text-sm">Cost</span>
              </div>
              <p className="font-semibold">{formatCost(result.cost_usd)}</p>
            </div>
            <div className="bg-gray-50 rounded-md p-3">
              <div className="flex items-center text-gray-600 mb-1">
                <GitBranch className="h-4 w-4 mr-1" />
                <span className="text-sm">Branch</span>
              </div>
              <p className="font-semibold text-xs truncate" title={result.featureBranch}>
                {result.featureBranch.split('/').pop()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-md p-3">
              <div className="flex items-center text-gray-600 mb-1">
                <span className="text-sm">Model</span>
              </div>
              <p className="font-semibold text-xs truncate" title={result.model}>
                {result.model.split('-').slice(0, 3).join('-')}
              </p>
            </div>
          </div>

          {/* Files Changed */}
          {result.filesChanged.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Files Changed ({result.filesChanged.length})
              </h3>
              <div className="bg-gray-50 rounded-md p-3">
                <ul className="space-y-1">
                  {result.filesChanged.map((file, index) => (
                    <li key={index} className="text-sm font-mono text-gray-700">
                      {file}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Test Results */}
          {result.testResults && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Test Results</h3>
              <div className="bg-gray-50 rounded-md p-3">
                <p className="text-sm text-gray-700">{result.testResults}</p>
              </div>
            </div>
          )}

          {/* Suggested Next Steps */}
          {result.suggestedNextSteps.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Suggested Next Steps</h3>
              <ul className="list-disc list-inside space-y-1">
                {result.suggestedNextSteps.map((step, index) => (
                  <li key={index} className="text-sm text-gray-700">{step}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Follow-up Input */}
          {showFollowUpInput && (
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Follow-up Task
              </label>
              <textarea
                value={followUpTask}
                onChange={(e) => setFollowUpTask(e.target.value)}
                placeholder="Describe what changes or improvements you'd like..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    if (followUpTask.trim()) {
                      onFollowUp(followUpTask);
                    }
                  }}
                  disabled={!followUpTask.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send Follow-up
                </button>
                <button
                  onClick={() => {
                    setShowFollowUpInput(false);
                    setFollowUpTask('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Session ID: <span className="font-mono">{result.sessionId}</span>
            </div>
            <div className="flex gap-3">
              {result.canContinue && !showFollowUpInput && (
                <button
                  onClick={() => setShowFollowUpInput(true)}
                  className="px-4 py-2 text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50"
                >
                  Request Changes
                </button>
              )}
              {result.success && (
                <button
                  onClick={onAccept}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Accept & Commit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}