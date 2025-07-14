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
  GitMerge,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Settings
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Project } from '../types/project';
import type { Task, CreateTaskDTO } from '../types/task';
import { TaskListItem } from '../components/task/TaskListItem';
import { CreateTaskModal } from '../components/task/CreateTaskModal';
import { PlanningEditor } from '../components/planning/PlanningEditor';
import { SettingsModal } from '../components/settings/SettingsModal';
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
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPlanningEditor, setShowPlanningEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadDashboardPhased();
    }
  }, [projectId]);

  // Phase 1: Load critical data for instant UI
  const loadCriticalData = async () => {
    const [projectData, tasksData] = await Promise.all([
      api.getProjectMinimal(projectId!),
      api.getTasksMinimal(projectId!)
    ]);
    
    setProject(projectData);
    setTasks(tasksData);
    setLoading(false); // UI is ready to use
  };

  // Phase 2: Load enrichment data in background
  const loadBackgroundData = async () => {
    setBackgroundLoading(true);
    
    try {
      // Load cached dashboard data first (no git fetch)
      const cachedDashboard = await api.getProjectDashboardCached(projectId!);
      setNeedsAttention(cachedDashboard.needsAttention);
      setLastUpdated(cachedDashboard.lastUpdated);
      
      // Load other data in parallel
      const [branchesData, planningData, fullTasksData] = await Promise.all([
        api.getProjectBranches(projectId!),
        api.getProjectPlanning(projectId!),
        api.getTasks(projectId!) // Full task data with git status
      ]);
      
      setBranches(branchesData);
      setPlanning(planningData);
      // Update tasks with full git status
      setTasks(fullTasksData);
      
      // Trigger background refresh for next time
      api.refreshProjectStatus(projectId!).catch(console.error);
    } catch (error) {
      console.error('Failed to load background data:', error);
    } finally {
      setBackgroundLoading(false);
    }
  };

  const loadDashboardPhased = async () => {
    try {
      // Phase 1: Load critical data
      await loadCriticalData();
      // Phase 2: Load background data (non-blocking)
      loadBackgroundData();
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    // Full refresh - used after actions
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
      setLastUpdated(new Date().toISOString());
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
          // Unhandled action
      }
    } catch (error: any) {
      console.error(`Failed to ${action}:`, error);
      
      // Check if this is a GitHub authentication error with detailed info
      if (error.status === 401 && error.response?.settingsUrl) {
        const { helpText, createTokenUrl, steps } = error.response;
        
        const userChoice = confirm(
          `${helpText}\n\n` +
          `Would you like to:\n` +
          `• Click OK to go to PocketDev settings\n` +
          `• Click Cancel to create a new GitHub token\n\n` +
          `Steps:\n${steps.join('\n')}`
        );
        
        if (userChoice) {
          navigate('/settings');
        } else {
          // Open GitHub token creation page with pre-filled settings
          window.open(createTokenUrl, '_blank');
          // Also navigate to settings for when they come back
          setTimeout(() => navigate('/settings'), 100);
        }
      } else {
        alert(`Failed to ${action}: ${error.message || 'Unknown error'}`);
      }
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

  const handleSavePlanning = async (content: string) => {
    if (!projectId) return;
    
    const result = await api.updateProjectPlanning(projectId, content);
    if (result.success) {
      // Reload planning content
      const planningData = await api.getProjectPlanning(projectId);
      setPlanning(planningData);
      
      // If changes were committed, show in needs attention
      if (result.needsPush) {
        await loadDashboard();
      }
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
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                to="/projects"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Projects
              </Link>
              <div className="h-4 w-px bg-gray-300" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                  <GitBranch className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
                  <p className="text-sm text-gray-500">Base: {project.baseBranch}</p>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Needs Attention Section */}
        {needsAttention.length > 0 ? (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Needs Attention</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {backgroundLoading && (
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Updating...
                  </span>
                )}
                {lastUpdated && !backgroundLoading && (
                  <span>
                    Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={() => loadDashboard()}
                  className="text-blue-600 hover:text-blue-700"
                  disabled={loading || backgroundLoading}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Project Status</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                {backgroundLoading && (
                  <span className="flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Updating...
                  </span>
                )}
                {lastUpdated && !backgroundLoading && (
                  <span>
                    Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                  </span>
                )}
                <button
                  onClick={() => loadDashboard()}
                  className="text-blue-600 hover:text-blue-700"
                  disabled={loading || backgroundLoading}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
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
                <button 
                  onClick={() => setShowPlanningEditor(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Edit PLANNING.md
                </button>
              )}
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              {planning.exists && planning.content ? (
                <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-ul:list-disc prose-li:marker:text-gray-600 prose-strong:text-gray-900">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{planning.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No planning document found</p>
                  <button 
                    onClick={() => {
                      setPlanning({ exists: true, content: `# Project Planning: ${project?.name || 'Project'}\n\n## 🎯 Project Overview\n\n## 🐛 Bugs & Issues\n\n## 💡 Feature Ideas\n\n## 🔧 Technical Debt\n\n## 📋 Current Sprint\n\n## 📝 Notes & Context\n` });
                      setShowPlanningEditor(true);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
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
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
          baseBranch={project.baseBranch}
          existingBranches={branches}
          occupiedBranches={tasks.map(t => t.branch)}
        />
      )}

      {/* Planning Editor */}
      {project && (
        <PlanningEditor
          isOpen={showPlanningEditor}
          content={planning.content || ''}
          projectName={project.name}
          onClose={() => setShowPlanningEditor(false)}
          onSave={handleSavePlanning}
        />
      )}
      
      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};