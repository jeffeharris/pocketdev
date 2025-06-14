import { useEffect, useState, useRef } from 'react';
import { Terminal, X, Loader2 } from 'lucide-react';

interface LogEntry {
  type: 'stdout' | 'stderr';
  message: string;
  timestamp: Date;
}

interface TaskLogViewerProps {
  taskId: string;
  engineerId: string;
  onClose: () => void;
}

export function TaskLogViewer({ taskId, engineerId, onClose }: TaskLogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [taskResult, setTaskResult] = useState<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Poll for logs every 2 seconds
    const fetchLogs = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/container/tasks/${taskId}`);
        if (!response.ok) return;
        
        const task = await response.json();
        
        // Update logs
        if (task.result?.logs) {
          setLogs(task.result.logs);
        }
        
        // Check if task is complete
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'error') {
          setIsStreaming(false);
          setTaskResult(task.result);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
        }
      } catch (error) {
        console.error('Error fetching logs:', error);
      }
    };

    // Initial fetch
    fetchLogs();
    
    // Set up polling
    intervalRef.current = setInterval(fetchLogs, 2000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [taskId]);

  // Auto-scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-gray-900 shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
            <div className="flex items-center space-x-3">
              <Terminal className="h-6 w-6 text-green-400" />
              <div>
                <h2 className="text-lg font-semibold text-white">Task Logs</h2>
                <p className="text-sm text-gray-400">Task ID: {taskId.slice(0, 8)}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {isStreaming && (
                <div className="flex items-center space-x-2 text-green-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Streaming...</span>
                </div>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Logs */}
          <div className="flex-1 overflow-auto bg-black p-4 font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500">Waiting for logs...</div>
            ) : (
              <>
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={`mb-1 ${
                      log.type === 'stderr' ? 'text-red-400' : 'text-gray-300'
                    }`}
                  >
                    <span className="text-gray-500">[{formatTimestamp(log.timestamp)}]</span>{' '}
                    {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </>
            )}
          </div>

          {/* Result Summary */}
          {taskResult && (
            <div className={`border-t ${
              taskResult.success ? 'border-green-800 bg-green-900' : 'border-red-800 bg-red-900'
            } bg-opacity-20 p-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`font-semibold ${
                    taskResult.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    Task {taskResult.success ? 'Completed' : 'Failed'}
                  </p>
                  {taskResult.prUrl && (
                    <a
                      href={taskResult.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:underline"
                    >
                      View Pull Request →
                    </a>
                  )}
                  {taskResult.error && (
                    <p className="text-sm text-red-300 mt-1">{taskResult.error}</p>
                  )}
                </div>
                {taskResult.duration && (
                  <div className="text-right text-sm text-gray-400">
                    <p>Duration: {Math.round(taskResult.duration / 1000)}s</p>
                    {taskResult.cost_usd && (
                      <p>Cost: ${taskResult.cost_usd.toFixed(4)}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}