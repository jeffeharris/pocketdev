import React, { useState, useEffect } from 'react';
import { GitBranch, RefreshCw, FileCode, Plus, Minus } from 'lucide-react';

interface DiffLine {
  type: 'header' | 'hunk' | 'add' | 'remove' | 'context';
  content: string;
  lineNumber?: number;
}

interface Props {
  taskId: string;
  engineerId: string;
}

export function GitDiffViewer({ taskId, engineerId }: Props) {
  const [diff, setDiff] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetchDiff();
    // Poll for updates every 3 seconds
    const interval = setInterval(fetchDiff, 3000);
    return () => clearInterval(interval);
  }, [taskId]);

  const fetchDiff = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/container/tasks/${taskId}/diff`);
      if (response.ok) {
        const data = await response.json();
        if (data.diff && data.diff !== diff) {
          setDiff(data.diff);
          setLastUpdated(new Date());
        }
        setError(null);
      } else if (response.status === 404) {
        setError('No changes yet');
      } else {
        setError('Failed to fetch diff');
      }
    } catch (err) {
      setError('Error fetching changes');
    } finally {
      setLoading(false);
    }
  };

  const parseDiff = (rawDiff: string): DiffLine[] => {
    const lines = rawDiff.split('\n');
    const parsed: DiffLine[] = [];

    lines.forEach(line => {
      if (line.startsWith('diff --git')) {
        parsed.push({ type: 'header', content: line });
      } else if (line.startsWith('+++') || line.startsWith('---')) {
        parsed.push({ type: 'header', content: line });
      } else if (line.startsWith('@@')) {
        parsed.push({ type: 'hunk', content: line });
      } else if (line.startsWith('+')) {
        parsed.push({ type: 'add', content: line });
      } else if (line.startsWith('-')) {
        parsed.push({ type: 'remove', content: line });
      } else {
        parsed.push({ type: 'context', content: line });
      }
    });

    return parsed;
  };

  const getLineStyle = (type: DiffLine['type']) => {
    switch (type) {
      case 'header':
        return 'bg-gray-100 text-gray-700 font-mono text-xs px-3 py-1';
      case 'hunk':
        return 'bg-blue-50 text-blue-700 font-mono text-xs px-3 py-1';
      case 'add':
        return 'bg-green-50 text-green-800 font-mono text-sm px-3 py-0.5';
      case 'remove':
        return 'bg-red-50 text-red-800 font-mono text-sm px-3 py-0.5';
      case 'context':
        return 'bg-white text-gray-600 font-mono text-sm px-3 py-0.5';
      default:
        return 'font-mono text-sm px-3 py-0.5';
    }
  };

  const getLineIcon = (type: DiffLine['type']) => {
    switch (type) {
      case 'add':
        return <Plus className="h-3 w-3 text-green-600" />;
      case 'remove':
        return <Minus className="h-3 w-3 text-red-600" />;
      default:
        return null;
    }
  };

  if (loading && !diff) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Loading changes...
      </div>
    );
  }

  if (error && !diff) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileCode className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p>{error}</p>
      </div>
    );
  }

  const diffLines = parseDiff(diff);
  const stats = {
    additions: diffLines.filter(l => l.type === 'add').length,
    deletions: diffLines.filter(l => l.type === 'remove').length,
    files: diffLines.filter(l => l.content.startsWith('diff --git')).length
  };

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <GitBranch className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">{stats.files} file{stats.files !== 1 ? 's' : ''}</span>
          </span>
          <span className="flex items-center gap-1">
            <Plus className="h-3 w-3 text-green-600" />
            <span className="text-green-600">{stats.additions}</span>
          </span>
          <span className="flex items-center gap-1">
            <Minus className="h-3 w-3 text-red-600" />
            <span className="text-red-600">{stats.deletions}</span>
          </span>
        </div>
        {lastUpdated && (
          <span className="text-gray-500 flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />
            Updated {new Date().getTime() - lastUpdated.getTime() < 5000 ? 'just now' : 'moments ago'}
          </span>
        )}
      </div>

      {/* Diff Content */}
      <div className="border rounded-lg overflow-hidden bg-gray-50">
        <div className="overflow-x-auto">
          {diffLines.length > 0 ? (
            <div className="min-w-full">
              {diffLines.map((line, idx) => (
                <div
                  key={idx}
                  className={`${getLineStyle(line.type)} ${
                    line.type === 'header' || line.type === 'hunk' ? 'border-b border-gray-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className="w-4 flex-shrink-0">
                      {getLineIcon(line.type)}
                    </span>
                    <span className="whitespace-pre overflow-x-auto">
                      {line.content || ' '}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <FileCode className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No changes detected yet</p>
              <p className="text-sm mt-1">Changes will appear here as the engineer works</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}