import React, { useState, useEffect } from 'react';
import { 
  X, CheckCircle, XCircle, Clock, FileText, DollarSign, 
  Cpu, GitBranch, ExternalLink, RefreshCw, Send, Check
} from 'lucide-react';
import { TaskResultView } from './TaskResultView';

interface TaskDetail {
  id: string;
  engineerId: string;
  engineerName: string;
  engineerRole: string;
  task: string;
  status: 'complete' | 'error';
  result?: string;
  cost: number;
  duration: number;
  sessionId?: string;
  filesCreated: Array<{ filename: string; size: number }>;
  completedAt: string;
  model: string;
  // Container-specific fields
  isContainer?: boolean;
  prUrl?: string;
  featureBranch?: string;
  repository?: string;
  testResults?: string;
  suggestedNextSteps?: string[];
  // Full result data for container tasks
  fullResult?: any;
}

interface Props {
  task: TaskDetail;
  onClose: () => void;
}

export function TaskDetailModal({ task, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [fullTaskData, setFullTaskData] = useState<any>(null);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);

  useEffect(() => {
    // For container tasks, fetch full result data
    if (task.isContainer && task.id) {
      fetchFullTaskData();
    }
  }, [task.id]);

  const fetchFullTaskData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`http://localhost:3001/api/container/tasks/${task.id}/result`);
      if (response.ok) {
        const data = await response.json();
        setFullTaskData(data);
      }
    } catch (error) {
      console.error('Failed to fetch task details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!task.isContainer || !task.id) return;
    
    setIsSubmittingFollowUp(true);
    try {
      const response = await fetch(`http://localhost:3001/api/container/tasks/${task.id}/accept`, {
        method: 'POST'
      });
      
      if (response.ok) {
        // Refresh task data
        await fetchFullTaskData();
        alert('Task accepted and changes committed!');
      }
    } catch (error) {
      console.error('Failed to accept task:', error);
      alert('Failed to accept task');
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  const handleFollowUp = async () => {
    if (!task.isContainer || !task.id || !followUpInput.trim()) return;
    
    setIsSubmittingFollowUp(true);
    try {
      const response = await fetch('http://localhost:3001/api/container/continue-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          additionalInstructions: followUpInput
        })
      });
      
      if (response.ok) {
        setFollowUpInput('');
        alert('Follow-up task submitted!');
        onClose();
      }
    } catch (error) {
      console.error('Failed to submit follow-up:', error);
      alert('Failed to submit follow-up');
    } finally {
      setIsSubmittingFollowUp(false);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'frontend': return 'text-blue-600 bg-blue-50';
      case 'backend': return 'text-green-600 bg-green-50';
      case 'devops': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // If we have full container task data with TaskResultView format, use that component
  if (task.isContainer && fullTaskData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Task Details</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-6">
            <TaskResultView
              result={fullTaskData}
              onAccept={handleAccept}
              onRequestChanges={(changes) => setFollowUpInput(changes)}
            />
          </div>
        </div>
      </div>
    );
  }

  // Fallback view for non-container tasks or while loading
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Task Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Task Header */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">{task.task}</h3>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(task.engineerRole)}`}>
                    {task.engineerName}
                  </span>
                  {task.isContainer && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                      Container Task
                    </span>
                  )}
                  <span className="text-sm text-gray-500">
                    {new Date(task.completedAt).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    {task.status === 'complete' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span className="text-sm">Status</span>
                  </div>
                  <p className="font-semibold">{task.status === 'complete' ? 'Completed' : 'Failed'}</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Duration</span>
                  </div>
                  <p className="font-semibold">{formatDuration(task.duration)}</p>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm">Cost</span>
                  </div>
                  <p className="font-semibold">${task.cost.toFixed(4)}</p>
                </div>
              </div>

              {/* Result */}
              {task.result && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Result</h4>
                  <p className="text-gray-700 bg-gray-50 rounded-lg p-4">{task.result}</p>
                </div>
              )}

              {/* Files */}
              {task.filesCreated.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    Files {task.isContainer ? 'Changed' : 'Created'}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {task.filesCreated.map((file, index) => (
                      <span key={index} className="px-3 py-1 bg-gray-100 rounded-md text-sm">
                        {file.filename}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Container-specific info */}
              {task.isContainer && (
                <>
                  {task.repository && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Repository</h4>
                      <p className="text-gray-700">{task.repository}</p>
                    </div>
                  )}
                  
                  {task.featureBranch && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        Feature Branch
                      </h4>
                      <p className="text-gray-700 font-mono text-sm">{task.featureBranch}</p>
                    </div>
                  )}
                  
                  {task.testResults && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Test Results</h4>
                      <pre className="text-sm bg-gray-50 rounded-lg p-4 overflow-x-auto">
                        {task.testResults}
                      </pre>
                    </div>
                  )}
                  
                  {task.suggestedNextSteps && task.suggestedNextSteps.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Suggested Next Steps</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {task.suggestedNextSteps.map((step, index) => (
                          <li key={index} className="text-gray-700">{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {task.prUrl && (
                    <div>
                      <a 
                        href={task.prUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Pull Request
                      </a>
                    </div>
                  )}
                </>
              )}

              {/* Model info */}
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Cpu className="h-4 w-4" />
                  <span>Model: {task.model}</span>
                  {task.sessionId && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span>Session: {task.sessionId}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}