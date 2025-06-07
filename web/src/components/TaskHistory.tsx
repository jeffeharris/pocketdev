import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Clock, FileText, DollarSign, Cpu, ExternalLink, GitBranch } from 'lucide-react';

interface TaskHistoryItem {
  id: string;
  engineerId: string;
  engineerName: string;
  engineerRole: string;
  task: string;
  status: 'complete' | 'error' | 'running';
  result?: string;
  cost: number;
  duration: number;
  sessionId?: string;
  filesCreated: Array<{ filename: string; size: number }>;
  completedAt: string | null;
  model: string;
  // Container-specific fields
  isContainer?: boolean;
  isRunning?: boolean;
  prUrl?: string;
  featureBranch?: string;
  repository?: string;
  testResults?: string;
  suggestedNextSteps?: string[];
  startTime?: string;
}

interface Props {
  onClose: () => void;
  onTaskClick?: (task: TaskHistoryItem) => void;
}

export function TaskHistory({ onClose, onTaskClick }: Props) {
  const [tasks, setTasks] = useState<TaskHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTaskHistory();
    // Refresh every 5 seconds
    const interval = setInterval(fetchTaskHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTaskHistory = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/task-history');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Failed to fetch task history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return null;
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'frontend': return 'text-blue-600';
      case 'backend': return 'text-green-600';
      case 'devops': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-40 flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Task History</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="text-gray-500 text-center">Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="text-gray-500 text-center">No completed tasks yet</p>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div 
                key={task.id} 
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onTaskClick?.(task)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">
                      {task.task}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-medium ${getRoleColor(task.engineerRole)}`}>
                        {task.engineerName}
                      </span>
                      {task.isContainer && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          Container
                        </span>
                      )}
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Cpu className="h-3 w-3" />
                        {task.model}
                      </span>
                    </div>
                  </div>
                  {getStatusIcon(task.status)}
                </div>
                
                {/* Cost and Duration */}
                <div className="flex items-center gap-4 mt-3 text-xs">
                  <span className="flex items-center gap-1 text-green-600">
                    <DollarSign className="h-3 w-3" />
                    {task.cost.toFixed(4)}
                  </span>
                  <span className="flex items-center gap-1 text-blue-600">
                    <Clock className="h-3 w-3" />
                    {formatDuration(task.duration)}
                  </span>
                  {task.filesCreated.length > 0 && (
                    <span className="flex items-center gap-1 text-purple-600">
                      <FileText className="h-3 w-3" />
                      {task.filesCreated.length} files
                    </span>
                  )}
                </div>

                {/* Files Created */}
                {task.filesCreated.length > 0 && (
                  <div className="mt-2 text-xs">
                    <p className="text-gray-500 mb-1">Files {task.isContainer ? 'changed' : 'created'}:</p>
                    <div className="flex flex-wrap gap-1">
                      {task.filesCreated.map((file, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 rounded text-gray-600">
                          {file.filename}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Container-specific info */}
                {task.isContainer && task.featureBranch && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <GitBranch className="h-3 w-3 text-gray-500" />
                    <span className="text-gray-600">{task.featureBranch}</span>
                  </div>
                )}
                
                {task.prUrl && (
                  <div className="mt-2">
                    <a 
                      href={task.prUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                      View PR
                    </a>
                  </div>
                )}
                
                <div className="mt-3 text-xs text-gray-500">
                  {task.status === 'running' ? (
                    <span className="text-blue-600">
                      Running for {formatDuration(task.duration)}
                    </span>
                  ) : (
                    formatDate(task.completedAt || new Date().toISOString())
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}