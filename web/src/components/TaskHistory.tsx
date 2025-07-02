import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, Clock, FileText, DollarSign, Cpu, ExternalLink, GitBranch, Search, Filter } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'error' | 'running'>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'frontend' | 'backend' | 'devops'>('all');

  useEffect(() => {
    fetchTaskHistory();
    // Refresh every 5 seconds
    const interval = setInterval(fetchTaskHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTaskHistory = async () => {
    try {
      // Fetch from both endpoints and combine
      const [containerResponse, regularResponse] = await Promise.all([
        fetch('http://localhost:3001/api/container/completed-tasks'),
        fetch('http://localhost:3001/api/task-history')
      ]);
      
      let allTasks: TaskHistoryItem[] = [];
      
      if (containerResponse.ok) {
        const containerTasks = await containerResponse.json();
        allTasks = [...containerTasks];
      }
      
      if (regularResponse.ok) {
        const regularTasks = await regularResponse.json();
        // Filter out duplicates by ID
        const existingIds = new Set(allTasks.map(t => t.id));
        const uniqueRegularTasks = regularTasks.filter((t: TaskHistoryItem) => !existingIds.has(t.id));
        allTasks = [...allTasks, ...uniqueRegularTasks];
      }
      
      // Remove any remaining duplicates by ID
      const uniqueTasks = allTasks.reduce((acc, task) => {
        if (!acc.find(t => t.id === task.id)) {
          acc.push(task);
        }
        return acc;
      }, [] as TaskHistoryItem[]);
      
      // Sort by date (newest first)
      uniqueTasks.sort((a, b) => {
        const dateA = new Date(a.completedAt || a.startTime || 0).getTime();
        const dateB = new Date(b.completedAt || b.startTime || 0).getTime();
        return dateB - dateA;
      });
      
      setTasks(uniqueTasks);
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

  // Filter tasks based on search and filters
  const filteredTasks = tasks.filter(task => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        task.task.toLowerCase().includes(query) ||
        task.engineerName.toLowerCase().includes(query) ||
        task.filesCreated.some(f => f.filename.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && task.status !== statusFilter) {
      return false;
    }

    // Role filter
    if (roleFilter !== 'all' && task.engineerRole !== roleFilter) {
      return false;
    }

    return true;
  });

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl z-40 flex flex-col">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Task History</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks, engineers, or files..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="complete">Completed</option>
            <option value="error">Failed</option>
            <option value="running">Running</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Engineers</option>
            <option value="frontend">Frontend</option>
            <option value="backend">Backend</option>
            <option value="devops">DevOps</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <p className="text-gray-500 text-center">Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="text-gray-500 text-center">No completed tasks yet</p>
        ) : (
          <>
            {/* Results count */}
            <div className="mb-4 text-sm text-gray-600">
              Showing {filteredTasks.length} of {tasks.length} tasks
            </div>
            
            {filteredTasks.length === 0 ? (
              <p className="text-gray-500 text-center">No tasks match your filters</p>
            ) : (
              <div className="space-y-4">
                {filteredTasks.map((task) => (
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
          </>
        )}
      </div>
    </div>
  );
}