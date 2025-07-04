import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  GitBranch, 
  Plus, 
  Activity, 
  AlertCircle, 
  CheckCircle,
  ExternalLink,
  Archive,
  GitPullRequest,
  GitMerge,
  RefreshCw,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Project } from '../types/project';
import type { Task, CreateTaskDTO } from '../types/task';
import { TaskListItem } from '../components/task/TaskListItem';
import { CreateTaskModal } from '../components/task/CreateTaskModal';
import { api } from '../services/api';

interface AttentionItem {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  details: any;
  actions: string[];
}

export const ProjectDashboard: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [needsAttention, setNeedsAttention] = useState<AttentionItem[]>([]);
  const [planning, setPlanning] = useState<{ exists: boolean; content: string | null }>({ exists: false, content: null });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadDashboard();
    }
  }, [projectId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [dashboardData, tasksData, branchesData, planningData] = await Promise.all([
        api.getProjectDashboard(projectId!),
        api.getTasks(projectId!),
        api.getProjectBranches(projectId!),
        api.getProjectPlanning(projectId!)
      ]);
      
      setProject(dashboardData.project);
      setNeedsAttention(dashboardData.needsAttention);
      setTasks(tasksData);
      setBranches(branchesData);
      setPlanning(planningData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, item: AttentionItem) => {
    setActionLoading(action);
    
    try {
      switch (action) {
        case 'pull':
          await api.pullBaseBranch(projectId!);
          await loadDashboard();
          break;
        
        case 'push':
          await api.pushBaseBranch(projectId!);
          await loadDashboard();
          break;
        
        case 'open-task':
          navigate(`/projects/${projectId}/tasks/${item.details.taskId}`);
          break;
        
        case 'archive':
          if (confirm(`Archive task "${item.details.taskName}"?`)) {
            await api.archiveTask(projectId!, item.details.taskId);
            await loadDashboard();
          }
          break;
        
        case 'view-pr':
          window.open(item.details.prUrl, '_blank');
          break;
        
        default:
          console.log('Unhandled action:', action);
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      alert(`Failed to ${action}. Please try again.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateTask = async (taskData: Omit<CreateTaskDTO, 'projectId'>) => {
    if (!projectId) return;
    
    try {
      const newTask = await api.createTask(projectId, {
        ...taskData,
        projectId
      });
      
      navigate(`/projects/${projectId}/tasks/${newTask.id}`);
    } catch (error: any) {
      console.error('Failed to create task:', error);
      const errorMessage = error.message || 'Failed to create task';
      alert(`Failed to create task: ${errorMessage}`);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="w-5 h-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getActionButton = (action: string, item: AttentionItem) => {
    const isLoading = actionLoading === action;
    
    switch (action) {
      case 'pull':
        return (
          <button
            onClick={() => handleAction(action, item)}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <ArrowDown className="w-3 h-3" />
            Pull Changes
          </button>
        );
      
      case 'push':
        return (
          <button
            onClick={() => handleAction(action, item)}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <ArrowUp className="w-3 h-3" />
            Push to Origin
          </button>
        );
      
      case 'open-task':
        return (
          <button
            onClick={() => handleAction(action, item)}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Open Task
          </button>
        );
      
      case 'archive':
        return (
          <button
            onClick={() => handleAction(action, item)}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Archive className="w-3 h-3" />
            Archive
          </button>
        );
      
      case 'view-pr':
        return (
          <button
            onClick={() => handleAction(action, item)}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View PR
          </button>
        );
      
      case 'resolve-conflicts':
        return (
          <button
            onClick={() => handleAction(action, item)}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Resolve Conflicts
          </button>
        );
      
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Project not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <Link
              to="/projects"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Projects
            </Link>
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
                <p className="text-sm text-gray-500">Base: {project.base_branch}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Needs Attention Section */}
        {needsAttention.length > 0 ? (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">🔴 Needs Attention</h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {needsAttention.map((item, index) => (
                <div key={index} className="p-4">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(item.severity)}
                    <div className="flex-1">
                      <p className="text-gray-900">{item.message}</p>
                      <div className="mt-2 flex items-center gap-2">
                        {item.actions.map(action => getActionButton(action, item))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Status</h2>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-gray-600">All systems operational. Base branch is in sync.</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => handleAction('pull', { type: 'manual', severity: 'info', message: '', details: {}, actions: [] })}
                  disabled={actionLoading === 'pull'}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <ArrowDown className="w-3 h-3" />
                  Pull from Origin
                </button>
                <button
                  onClick={() => handleAction('push', { type: 'manual', severity: 'info', message: '', details: {}, actions: [] })}
                  disabled={actionLoading === 'push'}
                  className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <ArrowUp className="w-3 h-3" />
                  Push to Origin
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Planning Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Planning</h2>
              {planning.exists && (
                <button className="text-sm text-blue-600 hover:text-blue-700">
                  Edit PLANNING.md
                </button>
              )}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              {planning.exists && planning.content ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown>{planning.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No planning document found</p>
                  <button className="text-sm text-blue-600 hover:text-blue-700">
                    Create PLANNING.md
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Active Tasks Section */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Active Tasks ({tasks.filter(t => t.taskState === 'active').length})
              </h2>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Task
              </button>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {tasks.filter(t => t.taskState === 'active').slice(0, 5).map(task => (
                <div 
                  key={task.id} 
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/projects/${projectId}/tasks/${task.id}`)}
                >
                  <TaskListItem
                    task={task}
                    isActive={false}
                    onSelect={() => navigate(`/projects/${projectId}/tasks/${task.id}`)}
                  />
                </div>
              ))}
              {tasks.filter(t => t.taskState === 'active').length === 0 && (
                <div className="p-4 text-center text-gray-500">
                  No active tasks
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-4">Recent Activity</h3>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {/* Show both merged and recently updated tasks */}
              {[
                ...tasks.filter(t => t.taskState === 'merged').map(t => ({ ...t, activityType: 'merged' })),
                ...tasks.filter(t => t.taskState === 'active' && t.has_uncommitted_changes).map(t => ({ ...t, activityType: 'active' }))
              ]
                .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
                .slice(0, 5)
                .map(task => (
                  <div key={task.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {task.activityType === 'merged' ? (
                          <>
                            <GitMerge className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium text-gray-900">{task.name}</span>
                            <span className="text-sm text-gray-500">merged</span>
                          </>
                        ) : (
                          <>
                            <Activity className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium text-gray-900">{task.name}</span>
                            <span className="text-sm text-gray-500">in progress</span>
                          </>
                        )}
                      </div>
                      {task.merged_at && (
                        <span className="text-xs text-gray-400">
                          {new Date(task.merged_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              {tasks.length === 0 && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No recent activity
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      {project && (
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateTask}
          projectId={projectId!}
          baseBranch={project.base_branch}
          existingBranches={branches}
          occupiedBranches={tasks.map(t => t.branch)}
        />
      )}
    </div>
  );
};