import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Terminal, Wrench, FileCode, CheckCircle, AlertCircle, DollarSign, Clock } from 'lucide-react';

interface StreamingTaskViewProps {
  engineerId: string;
  task: {
    description: string;
    repository?: string;
    acceptanceCriteria?: string[];
  };
  onComplete?: (result: any) => void;
  onCancel?: () => void;
}

interface StreamEvent {
  type: string;
  taskId?: string;
  data?: any;
}

export function StreamingTaskView({ engineerId, task, onComplete, onCancel }: StreamingTaskViewProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cost, setCost] = useState<number>(0);
  const [toolUsageCount, setToolUsageCount] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const startStreaming = async () => {
    setIsStreaming(true);
    setEvents([]);
    setError(null);
    setResult(null);
    setToolUsageCount({});

    try {
      // Create EventSource for Server-Sent Events
      const response = await fetch(`http://localhost:3001/api/container/engineers/${engineerId}/stream-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(task),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            // Skip event type lines, we parse from data
          } else if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              handleStreamEvent(data);
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }

    } catch (err) {
      console.error('Streaming error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleStreamEvent = (event: StreamEvent) => {
    setEvents(prev => [...prev, event]);

    switch (event.type) {
      case 'stream:init':
        if (event.data?.sessionId) {
          setSessionId(event.data.sessionId);
        }
        break;

      case 'stream:tool_use':
        if (event.data?.name) {
          setCurrentTool(event.data.name);
          setToolUsageCount(prev => ({
            ...prev,
            [event.data.name]: (prev[event.data.name] || 0) + 1
          }));
        }
        break;

      case 'stream:text':
        // Handle text updates if needed
        break;

      case 'stream:complete':
        if (event.data) {
          setCost(event.data.cost || 0);
          setResult(event.data);
          if (onComplete) {
            onComplete(event.data);
          }
        }
        setCurrentTool(null);
        break;

      case 'task-complete':
        if (event.task) {
          setResult(event.task.result);
          if (onComplete) {
            onComplete(event.task);
          }
        }
        break;

      case 'error':
        setError(event.error || 'An error occurred');
        setIsStreaming(false);
        break;
    }
  };

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'Bash':
      case 'LS':
        return <Terminal className="w-4 h-4" />;
      case 'Read':
      case 'Write':
      case 'Edit':
      case 'MultiEdit':
        return <FileCode className="w-4 h-4" />;
      default:
        return <Wrench className="w-4 h-4" />;
    }
  };

  const formatCost = (costInDollars: number) => {
    if (costInDollars < 0.01) {
      return `$${(costInDollars * 100).toFixed(2)}¢`;
    }
    return `$${costInDollars.toFixed(3)}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Streaming Task Execution
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {task.description}
        </p>
      </div>

      {/* Status Bar */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {sessionId && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Session: {sessionId.substring(0, 8)}...
              </span>
            )}
            {currentTool && (
              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                {getToolIcon(currentTool)}
                <span className="text-sm font-medium">{currentTool}</span>
              </div>
            )}
          </div>
          {cost > 0 && (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm font-medium">{formatCost(cost)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Event Stream */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {events.map((event, index) => (
          <div
            key={index}
            className={`text-sm ${
              event.type === 'error' 
                ? 'text-red-600 dark:text-red-400' 
                : 'text-gray-700 dark:text-gray-300'
            }`}
          >
            {event.type === 'stream:init' && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Session initialized with {event.data?.tools?.length || 0} tools available</span>
              </div>
            )}
            {event.type === 'stream:tool_use' && (
              <div className="flex items-center gap-2">
                {getToolIcon(event.data?.name || '')}
                <span>Using {event.data?.name}</span>
              </div>
            )}
            {event.type === 'stream:text' && event.data?.text && (
              <div className="pl-6 text-gray-600 dark:text-gray-400">
                {event.data.text.substring(0, 100)}...
              </div>
            )}
            {event.type === 'stream:complete' && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                {event.data?.success ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                <span className="font-medium">
                  Task {event.data?.success ? 'completed' : 'failed'} in {event.data?.duration}ms
                </span>
              </div>
            )}
          </div>
        ))}
        <div ref={eventsEndRef} />
      </div>

      {/* Tool Usage Summary */}
      {Object.keys(toolUsageCount).length > 0 && (
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2">
            {Object.entries(toolUsageCount).map(([tool, count]) => (
              <div
                key={tool}
                className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md"
              >
                {getToolIcon(tool)}
                <span className="text-xs font-medium">{tool}</span>
                <span className="text-xs text-gray-500">×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="px-6 py-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-3">
          {!isStreaming && !result && (
            <button
              onClick={startStreaming}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Terminal className="w-4 h-4" />
              Start Streaming Execution
            </button>
          )}
          {isStreaming && (
            <div className="flex-1 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Streaming in progress...</span>
            </div>
          )}
          {result && (
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Done
            </button>
          )}
          {onCancel && !result && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}