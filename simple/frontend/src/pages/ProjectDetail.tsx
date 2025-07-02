import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, GitBranch, Plus, Activity } from 'lucide-react';
import type { Project } from '../types/project';
import type { Task, CreateTaskDTO } from '../types/task';
import { TaskListItem } from '../components/task/TaskListItem';
import { CreateTaskModal } from '../components/task/CreateTaskModal';
import { api } from '../services/api';

export const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadProjectAndTasks();
    }
  }, [projectId]);

  const loadProjectAndTasks = async () => {
    try {
      setLoading(true);
      const [projectData, tasksData, branchesData] = await Promise.all([
        api.getProject(projectId!),
        api.getTasks(projectId!),
        api.getProjectBranches(projectId!)
      ]);
      setProject(projectData);
      setTasks(tasksData);
      setBranches(branchesData);
    } catch (error) {
      console.error('Failed to load project data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (taskData: Omit<CreateTaskDTO, 'projectId'>) => {
    if (!projectId) return;
    
    try {
      const newTask = await api.createTask(projectId, {
        ...taskData,
        projectId
      });
      
      // Navigate to the new task
      navigate(`/projects/${projectId}/tasks/${newTask.id}`);
    } catch (error: any) {
      console.error('Failed to create task:', error);
      
      // Show specific error message
      const errorMessage = error.message || 'Failed to create task';
      if (errorMessage.includes('already exists')) {
        alert(`Cannot create task: A branch named "${taskData.branch}" already exists. Please choose a different branch name.`);
      } else if (errorMessage.includes('worktree')) {
        alert(`Cannot create task: This branch is already checked out in another worktree.`);
      } else {
        alert(`Failed to create task: ${errorMessage}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Loading project...</p>
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
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{project.name}</h1>
                <p className="text-sm text-gray-500">{project.baseBranch}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Active Tasks</h2>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map(task => (
            <Link
              key={task.id}
              to={`/projects/${projectId}/tasks/${task.id}`}
              className="block"
            >
              <TaskListItem
                task={task}
                isActive={false}
                onSelect={() => {}} // No-op since we're using Link
              />
            </Link>
          ))}
        </div>

        {tasks.length === 0 && (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No tasks yet</p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create your first task
            </button>
          </div>
        )}
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
    </div>
  );
};