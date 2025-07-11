import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, DollarSign, FileCode, GitBranch, ExternalLink, AlertCircle, CheckCircle, Loader2, MessageSquare } from 'lucide-react';
import { TaskLogViewer } from './TaskLogViewer.tsx';
import { TaskRecoveryModal } from './TaskRecoveryModal.tsx';
import { GitDiffViewer } from './GitDiffViewer.tsx';

interface TaskData {
  id: string;
  engineerId: string;
  engineerName: string;
  engineerRole: string;
  task: string;
  status: 'running' | 'complete' | 'error' | 'awaiting_review' | 'accepted' | 'rejected';
  result: string | any; // Can be string or object
  cost: number;
  duration: number;
  sessionId?: string;
  filesCreated?: Array<{ filename: string; size: number }>;
  completedAt?: string;
  model?: string;
  isContainer?: boolean;
  isRunning?: boolean;
  prUrl?: string;
  featureBranch?: string;
  repository?: any;
  testResults?: any;
  suggestedNextSteps?: string[];
  startTime?: string;
  reviewStatus?: string;
  acceptanceCriteria?: string[];
  tokensInput?: number;
  tokensOutput?: number;
  numTurns?: number;
}

export function TaskView() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'result' | 'diff' | 'logs' | 'sessions'>('result');
  const [showFollowUpInput, setShowFollowUpInput] = useState(false);
  const [followUpTask, setFollowUpTask] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recovery, setRecovery] = useState<any>(null);
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [question, setQuestion] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  useEffect(() => {
    fetchTaskDetails();
    // Poll for updates if task is running
    const interval = setInterval(() => {
      if (task?.isRunning) {
        fetchTaskDetails();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [taskId, task?.isRunning]);

  const fetchTaskDetails = async () => {
    try {
      // First try container tasks
      const containerResponse = await fetch('http://localhost:3001/api/container/completed-tasks');
      if (containerResponse.ok) {
        const containerTasks = await containerResponse.json();
        const containerTask = containerTasks.find((t: TaskData) => t.id === taskId);
        if (containerTask) {
          // Fetch full task details for container tasks to get complete result data
          try {
            const fullTaskResponse = await fetch(`http://localhost:3001/api/container/tasks/${taskId}`);
            if (fullTaskResponse.ok) {
              const fullTask = await fullTaskResponse.json();
              // Merge the full result data with the task info
              containerTask.result = fullTask.result;
              containerTask.status = fullTask.status === 'failed' ? 'error' : fullTask.status;
            }
          } catch (err) {
            console.error('Failed to fetch full task details:', err);
          }
          
          // Map database status to UI status
          if (containerTask.status === 'complete' && !containerTask.reviewStatus) {
            containerTask.status = 'awaiting_review';
          } else if (containerTask.reviewStatus === 'approved') {
            containerTask.status = 'accepted';
          }
          setTask(containerTask);
          setLoading(false);
          
          // Check for recovery options if task failed
          if (containerTask.status === 'error' || containerTask.status === 'failed') {
            checkRecoveryOptions(containerTask.id);
          }
          return;
        }
      }

      // Then try regular tasks
      const response = await fetch('http://localhost:3001/api/task-history');
      if (response.ok) {
        const tasks = await response.json();
        const regularTask = tasks.find((t: TaskData) => t.id === taskId);
        if (regularTask) {
          setTask(regularTask);
          setLoading(false);
          return;
        }
      }

      setError('Task not found');
      setLoading(false);
    } catch (err) {
      console.error('Error fetching task:', err);
      setError('Failed to load task details');
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms || ms === 0) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatCost = (cost: number) => {
    if (!cost || cost === 0) return '$0.00';
    return `$${cost.toFixed(2)}`;
  };

  const checkRecoveryOptions = async (taskId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/container/tasks/${taskId}/recovery`);
      if (response.ok) {
        const recoveryData = await response.json();
        setRecovery(recoveryData);
        // Auto-show recovery modal if recovery is available
        if (recoveryData.recoverable && recoveryData.autoRecoveryAvailable) {
          setShowRecovery(true);
        }
      }
    } catch (err) {
      console.error('Failed to check recovery options:', err);
    }
  };

  const fetchSessions = async () => {
    if (!task || !task.engineerId) return;
    
    setSessionsLoading(true);
    try {
      const response = await fetch(`http://localhost:3005/api/projects/${task.engineerId}/tasks/${task.id}/sessions`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      } else {
        console.error('Failed to fetch sessions');
        setSessions([]);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRetry = async (options: any) => {
    if (!task) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`http://localhost:3001/api/container/tasks/${task.id}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      });

      if (response.ok) {
        const result = await response.json();
        // Navigate to new task
        navigate(`/task/${result.newTaskId}`);
      } else {
        const error = await response.json();
        alert(`Retry failed: ${error.error}`);
      }
    } catch (err) {
      console.error('Retry error:', err);
      alert('Failed to retry task');
    } finally {
      setIsSubmitting(false);
      setShowRecovery(false);
    }
  };

  const handleAccept = async () => {
    if (!task || !task.id) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`http://localhost:3001/api/container/tasks/${task.id}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update task status locally
        setTask(prev => prev ? { ...prev, status: 'accepted', reviewStatus: 'approved' } : null);
        // Show success message
        alert('Task accepted and changes committed!');
      } else {
        throw new Error('Failed to accept task');
      }
    } catch (err) {
      console.error('Error accepting task:', err);
      alert('Failed to accept task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFollowUp = async () => {
    if (!task || !followUpTask.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:3001/api/container/continue-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskId: task.id,
          additionalInstructions: followUpTask
        })
      });

      if (response.ok) {
        // Clear the form
        setFollowUpTask('');
        setShowFollowUpInput(false);
        // Refresh task details
        fetchTaskDetails();
        alert('Follow-up task sent to engineer!');
      } else {
        throw new Error('Failed to send follow-up');
      }
    } catch (err) {
      console.error('Error sending follow-up:', err);
      alert('Failed to send follow-up. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!task || !question.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`http://localhost:3001/api/container/tasks/${task.id}/ask-question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: question.trim()
        })
      });

      if (response.ok) {
        const result = await response.json();
        // Clear the form
        setQuestion('');
        setShowQuestionInput(false);
        // Navigate to the Q&A task
        navigate(`/task/${result.questionTaskId}`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to send question');
      }
    } catch (err) {
      console.error('Question error:', err);
      alert('Failed to send question');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {error || 'Task not found'}
          </h2>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Dashboard</span>
              </button>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-xl font-semibold text-gray-900">Task Details</h1>
            </div>
            {task.isRunning && (
              <span className="flex items-center gap-2 text-sm text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Task in progress...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Task Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Task Summary Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{task.task}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Assigned to {task.engineerName} ({task.engineerRole})
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  task.status === 'complete' || task.status === 'accepted' ? 'bg-green-100 text-green-800' :
                  task.status === 'error' || task.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  task.status === 'awaiting_review' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {task.status === 'complete' ? 'Completed' :
                   task.status === 'accepted' ? 'Accepted' :
                   task.status === 'rejected' ? 'Rejected' :
                   task.status === 'awaiting_review' ? 'Awaiting Review' :
                   task.status === 'error' ? 'Failed' :
                   'Running'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Duration</p>
                    <p className="font-medium">{formatDuration(task.duration)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Cost</p>
                    <p className="font-medium">{formatCost(task.cost)}</p>
                  </div>
                </div>
              </div>

              {/* Additional Metrics */}
              {(task.tokensInput || task.tokensOutput || task.numTurns) && (
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                  {task.tokensInput && (
                    <div>
                      <p className="text-sm text-gray-600">Input Tokens</p>
                      <p className="font-medium">{task.tokensInput.toLocaleString()}</p>
                    </div>
                  )}
                  {task.tokensOutput && (
                    <div>
                      <p className="text-sm text-gray-600">Output Tokens</p>
                      <p className="font-medium">{task.tokensOutput.toLocaleString()}</p>
                    </div>
                  )}
                  {task.numTurns && (
                    <div>
                      <p className="text-sm text-gray-600">Turns</p>
                      <p className="font-medium">{task.numTurns}</p>
                    </div>
                  )}
                </div>
              )}

              {task.featureBranch && (
                <div className="mt-4 flex items-center gap-3">
                  <GitBranch className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-600">Feature Branch</p>
                    <p className="font-medium">{task.featureBranch}</p>
                  </div>
                </div>
              )}

              {task.prUrl && (
                <div className="mt-4">
                  <a
                    href={task.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Pull Request
                  </a>
                </div>
              )}
            </div>

            {/* Result/Diff/Logs Section */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="border-b px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Task Details</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('result')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'result' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Result
                    </button>
                    {(task.status === 'running' || task.status === 'complete' || task.status === 'accepted') && (
                      <button
                        onClick={() => setActiveTab('diff')}
                        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                          activeTab === 'diff' 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Changes
                      </button>
                    )}
                    <button
                      onClick={() => setActiveTab('logs')}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'logs' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Logs
                    </button>
                    <button
                      onClick={() => {
                        setActiveTab('sessions');
                        if (sessions.length === 0 && !sessionsLoading) {
                          fetchSessions();
                        }
                      }}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        activeTab === 'sessions' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Sessions
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                {activeTab === 'logs' ? (
                  <TaskLogViewer 
                    taskId={task.id} 
                    engineerId={task.engineerId}
                    onClose={() => {}}
                  />
                ) : activeTab === 'diff' ? (
                  <GitDiffViewer 
                    taskId={task.id} 
                    engineerId={task.engineerId}
                  />
                ) : activeTab === 'sessions' ? (
                  <div className="space-y-4">
                    {sessionsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <p>No sessions found for this task.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-700">Claude Sessions ({sessions.length})</h4>
                        {sessions.map((session, index) => (
                          <div key={session.sessionId} className="border rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    index === 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {index === 0 ? 'Active' : 'Previous'}
                                  </span>
                                  <span className="text-sm text-gray-600">
                                    {new Date(session.created).toLocaleString()}
                                  </span>
                                </div>
                                <p className="font-mono text-sm text-gray-700 mb-2">{session.sessionId}</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Messages:</span>
                                    <span className="ml-2 font-medium">{session.messageCount}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Size:</span>
                                    <span className="ml-2 font-medium">{session.sizeFormatted}</span>
                                  </div>
                                  {session.analytics && (
                                    <>
                                      <div>
                                        <span className="text-gray-500">Tokens:</span>
                                        <span className="ml-2 font-medium">
                                          {(session.analytics.totalInputTokens + session.analytics.totalOutputTokens).toLocaleString()}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-gray-500">Model:</span>
                                        <span className="ml-2 font-medium text-xs">
                                          {session.analytics.model?.split('/').pop() || 'Unknown'}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </div>
                                {session.analytics?.toolUsage && Object.keys(session.analytics.toolUsage).length > 0 && (
                                  <div className="mt-3">
                                    <p className="text-xs text-gray-500 mb-1">Tools Used:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {Object.entries(session.analytics.toolUsage).map(([tool, count]) => (
                                        <span key={tool} className="px-2 py-0.5 text-xs bg-gray-100 rounded">
                                          {tool} ({count as number})
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="ml-4">
                                <button
                                  onClick={() => {
                                    // Copy command to clipboard
                                    const command = `claude -r ${session.sessionId}`;
                                    navigator.clipboard.writeText(command);
                                    alert(`Command copied to clipboard:\n${command}`);
                                  }}
                                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                  title="Copy resume command"
                                >
                                  Resume
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Check if this is a failed task with supervisor interpretation */}
                    {task.status === 'error' && task.result ? (
                      <>
                        {/* Try to parse result as JSON to get naturalLanguageError */}
                        {(() => {
                          try {
                            // First check if result is already an object
                            if (typeof task.result === 'object' && task.result !== null) {
                              // Check for naturalLanguageError in the result object
                              if (task.result.naturalLanguageError) {
                                const nlError = task.result.naturalLanguageError;
                              return (
                                <>
                                  {/* Supervisor Analysis Box */}
                                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <div className="flex items-start gap-3">
                                      <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                        <h4 className="font-semibold text-amber-900 mb-2">Supervisor Analysis</h4>
                                        <p className="text-amber-800 font-medium mb-3">{nlError.summary}</p>
                                        {nlError.explanation && (
                                          <p className="text-amber-700 text-sm mb-4">{nlError.explanation}</p>
                                        )}
                                        
                                        {nlError.nextSteps && nlError.nextSteps.length > 0 && (
                                          <div className="mt-4">
                                            <h5 className="font-medium text-amber-900 mb-2">Next Steps:</h5>
                                            <ol className="list-decimal list-inside space-y-1">
                                              {nlError.nextSteps.map((step: string, idx: number) => (
                                                <li key={idx} className="text-sm text-amber-700">{step}</li>
                                              ))}
                                            </ol>
                                          </div>
                                        )}
                                        
                                        {nlError.quickFixes && nlError.quickFixes.length > 0 && (
                                          <div className="mt-4">
                                            <h5 className="font-medium text-amber-900 mb-2">Quick Fixes:</h5>
                                            <div className="space-y-2">
                                              {nlError.quickFixes.map((fix: any, idx: number) => (
                                                <div key={idx} className="bg-amber-100 rounded p-2">
                                                  <p className="text-sm font-medium text-amber-900">{fix.issue}</p>
                                                  <p className="text-sm text-amber-700">{fix.suggestion}</p>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Raw error details if needed */}
                                  {task.result.errorDetails && (
                                    <details className="bg-gray-50 rounded-lg p-4">
                                      <summary className="cursor-pointer text-sm font-medium text-gray-700">
                                        Technical Details
                                      </summary>
                                      <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap">
                                        {task.result.errorDetails}
                                      </pre>
                                    </details>
                                  )}
                                </>
                              );
                              }
                            }
                            // If result is a string, just show it
                            return <p className="text-gray-700 whitespace-pre-wrap">{typeof task.result === 'string' ? task.result : JSON.stringify(task.result, null, 2)}</p>;
                          } catch (e) {
                            // If parsing fails, show as plain text
                            return <p className="text-gray-700 whitespace-pre-wrap">{typeof task.result === 'string' ? (task.result || 'No result available') : JSON.stringify(task.result, null, 2)}</p>;
                          }
                        })()}
                      </>
                    ) : (
                      // Non-error tasks or tasks without results
                      <div className="prose prose-sm max-w-none">
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {task.result 
                            ? (typeof task.result === 'string' ? task.result : JSON.stringify(task.result, null, 2))
                            : 'No result available'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions for Accepted Tasks */}
            {(task.status === 'accepted' || task.reviewStatus === 'approved') && task.sessionId && task.sessionId !== 'null' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Follow-up</h3>
                
                {showQuestionInput ? (
                  <div className="space-y-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-md p-3 mb-4">
                      <p className="text-sm text-purple-800">
                        Ask any question about the completed work. The engineer will use the original conversation context.
                      </p>
                    </div>
                    <textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="e.g., How can I extend this feature? What are the performance implications?"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAskQuestion}
                        disabled={!question.trim() || isSubmitting}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Ask Engineer
                      </button>
                      <button
                        onClick={() => {
                          setShowQuestionInput(false);
                          setQuestion('');
                        }}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Have questions about the completed work? Ask the engineer for clarification or guidance.
                    </p>
                    <button
                      onClick={() => setShowQuestionInput(true)}
                      className="px-4 py-2 text-purple-600 bg-white border border-purple-600 rounded-md hover:bg-purple-50 flex items-center gap-2"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Ask a Question
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Review Actions - Only show for completed tasks awaiting review */}
            {(task.status === 'awaiting_review' || task.status === 'complete') && !task.reviewStatus && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Review</h3>
                
                {/* Question Input */}
                {showQuestionInput ? (
                  <div className="space-y-4">
                    <div className="bg-purple-50 border border-purple-200 rounded-md p-3 mb-4">
                      <p className="text-sm text-purple-800">
                        Ask any question about the work that was done. The engineer will use the same conversation context to provide answers.
                      </p>
                    </div>
                    <label className="block text-sm font-medium text-gray-700">
                      What would you like to know?
                    </label>
                    <textarea
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="e.g., Why did you choose this approach? Can you explain how this component works?"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAskQuestion}
                        disabled={!question.trim() || isSubmitting}
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Ask Engineer
                      </button>
                      <button
                        onClick={() => {
                          setShowQuestionInput(false);
                          setQuestion('');
                        }}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : showFollowUpInput ? (
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Describe what changes or improvements you'd like:
                    </label>
                    <textarea
                      value={followUpTask}
                      onChange={(e) => setFollowUpTask(e.target.value)}
                      placeholder="Be specific about what needs to be changed..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleFollowUp}
                        disabled={!followUpTask.trim() || isSubmitting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        Send Follow-up
                      </button>
                      <button
                        onClick={() => {
                          setShowFollowUpInput(false);
                          setFollowUpTask('');
                        }}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                      Review the task results and decide whether to accept the changes or request modifications.
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={handleAccept}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        <CheckCircle className="h-4 w-4" />
                        Accept & Commit
                      </button>
                      <button
                        onClick={() => setShowFollowUpInput(true)}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-blue-600 bg-white border border-blue-600 rounded-md hover:bg-blue-50 flex items-center gap-2"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Request Changes
                      </button>
                      <button
                        onClick={() => setShowQuestionInput(true)}
                        disabled={isSubmitting || !task.sessionId || task.sessionId === 'null'}
                        className="px-4 py-2 text-purple-600 bg-white border border-purple-600 rounded-md hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        title={!task.sessionId ? 'No conversation session available' : 'Ask a question about this task'}
                      >
                        <MessageSquare className="h-4 w-4" />
                        Ask Question
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Files Created */}
            {task.filesCreated && task.filesCreated.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Files Created</h3>
                <div className="space-y-2">
                  {task.filesCreated.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <FileCode className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-700">{file.filename}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Test Results */}
            {task.testResults && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Test Results</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Tests Run</span>
                    <span className="font-medium">{task.testResults.total || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Passed</span>
                    <span className="font-medium text-green-600">{task.testResults.passed || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Failed</span>
                    <span className="font-medium text-red-600">{task.testResults.failed || 0}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Acceptance Criteria */}
            {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Acceptance Criteria</h3>
                <ul className="space-y-2">
                  {task.acceptanceCriteria.map((criteria, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className={`h-4 w-4 rounded border-2 mt-0.5 ${
                        task.status === 'accepted' ? 'bg-green-500 border-green-500' : 'border-gray-300'
                      }`}>
                        {task.status === 'accepted' && (
                          <CheckCircle className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <span className="text-sm text-gray-700">{criteria}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Suggested Next Steps */}
            {task.suggestedNextSteps && task.suggestedNextSteps.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Suggested Next Steps</h3>
                <ul className="space-y-2">
                  {task.suggestedNextSteps.map((step, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                      <span className="text-sm text-gray-700">{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Metadata */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Details</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Task ID</p>
                  <p className="font-mono text-sm">{task.id}</p>
                </div>
                {task.sessionId && (
                  <div>
                    <p className="text-sm text-gray-600">Session ID</p>
                    <p className="font-mono text-sm">{task.sessionId}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Model</p>
                  <p className="text-sm">{task.model || 'claude-3-5-sonnet-latest'}</p>
                </div>
                {task.completedAt && (
                  <div>
                    <p className="text-sm text-gray-600">Completed At</p>
                    <p className="text-sm">{new Date(task.completedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recovery Modal */}
      {showRecovery && recovery && (
        <TaskRecoveryModal
          task={{ ...task, recoveryPlan: recovery }}
          onClose={() => setShowRecovery(false)}
          onRetry={handleRetry}
        />
      )}

      {/* Show recovery button for failed tasks */}
      {task && (task.status === 'error' || task.status === 'failed') && recovery?.recoverable && (
        <div className="fixed bottom-4 right-4">
          <button
            onClick={() => setShowRecovery(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg shadow-lg hover:bg-amber-700"
          >
            <AlertCircle className="h-5 w-5" />
            Recovery Available
          </button>
        </div>
      )}
    </div>
  );
}