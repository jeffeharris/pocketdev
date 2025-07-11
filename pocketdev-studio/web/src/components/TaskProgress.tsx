import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react';

interface ProgressCheckpoint {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message: string;
  timestamp: string;
}

interface ProgressSummary {
  status: string;
  message: string;
  elapsed: string;
  checkpointCount: number;
  currentStep: string;
}

interface Props {
  taskId: string;
  className?: string;
}

export function TaskProgress({ taskId, className = '' }: Props) {
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [checkpoints, setCheckpoints] = useState<ProgressCheckpoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let eventSource: EventSource | null = null;

    const fetchProgress = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/container/tasks/${taskId}/progress`);
        if (response.ok) {
          const data = await response.json();
          setSummary(data.summary);
          setCheckpoints(data.checkpoints || []);
        } else {
          setError('Failed to fetch progress');
        }
      } catch (err) {
        console.error('Progress fetch error:', err);
        setError('Connection error');
      }
    };

    // Try SSE first for real-time updates
    try {
      eventSource = new EventSource(`http://localhost:3001/api/container/tasks/${taskId}/progress/stream`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.summary) {
          setSummary(data.summary);
        }
        if (data.name) {
          // This is a new checkpoint
          setCheckpoints(prev => [...prev, data]);
        }
      };

      eventSource.onerror = (err) => {
        console.error('SSE error:', err);
        eventSource?.close();
        // Fall back to polling
        fetchProgress();
        interval = setInterval(fetchProgress, 2000);
      };
    } catch (err) {
      // Browser doesn't support SSE or other error
      fetchProgress();
      interval = setInterval(fetchProgress, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, [taskId]);

  if (error) {
    return (
      <div className={`flex items-center gap-2 text-red-600 ${className}`}>
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className={`flex items-center gap-2 text-gray-500 ${className}`}>
        <Loader className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading progress...</span>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <Loader className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className={`${className}`}>
      {/* Summary */}
      <div className="flex items-center gap-3 mb-3">
        {getStatusIcon(summary.status)}
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-900">{summary.message}</p>
          <p className="text-xs text-gray-500">Elapsed: {summary.elapsed}</p>
        </div>
      </div>

      {/* Recent checkpoints */}
      {checkpoints.length > 0 && (
        <div className="space-y-1">
          {checkpoints.slice(-3).map((checkpoint, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              {getStatusIcon(checkpoint.status)}
              <span className="text-gray-600">{checkpoint.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Progress indicator */}
      {summary.status === 'in_progress' && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-blue-600 h-1 rounded-full animate-pulse"
              style={{ width: `${Math.min((summary.checkpointCount * 10), 90)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}