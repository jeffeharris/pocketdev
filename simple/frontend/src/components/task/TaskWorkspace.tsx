import React, { useState, useEffect } from 'react';
import { MainHeader } from '../layout/MainHeader';
import { Sidebar } from '../layout/Sidebar';
import { TerminalPanel } from '../terminal/TerminalPanel';
import { LensSlider } from '../common/LensSlider';
import type { Task } from '../../types/task';
import type { Project } from '../../types/project';
import { api } from '../../services/api';
import { mockTasks, mockProjects } from '../../services/mockData';

interface TaskWorkspaceProps {
  projectId: string;
  taskId: string;
}

export const TaskWorkspace: React.FC<TaskWorkspaceProps> = ({ projectId, taskId }) => {
  const [activeTaskId, setActiveTaskId] = useState(taskId);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [validationMode, setValidationMode] = useState(false);
  const [activePhase, setActivePhase] = useState<'validate' | 'merge'>('validate');
  const [loading, setLoading] = useState(true);
  
  // Real data from API
  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  
  const activeTask = tasks.find(t => t.id === activeTaskId) || tasks[0];
  
  // Load project and tasks on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [projectData, tasksData] = await Promise.all([
          api.getProject(projectId),
          api.getTasks(projectId)
        ]);
        setProject(projectData);
        setTasks(tasksData);
      } catch (error) {
        console.error('Failed to load data:', error);
        // Fallback to mock data if API fails
        setProject(mockProjects[0]);
        setTasks(mockTasks);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [projectId]);
  
  // Update active task when taskId prop changes
  useEffect(() => {
    setActiveTaskId(taskId);
  }, [taskId]);

  const handleTaskSelect = (newTaskId: string) => {
    setActiveTaskId(newTaskId);
    // Reset validation mode when switching tasks
    setValidationMode(false);
  };

  const handleTaskChange = (task: Task) => {
    handleTaskSelect(task.id);
  };

  if (loading || !project) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <MainHeader 
        project={project} 
        tasks={tasks} 
        activeTaskId={activeTaskId}
        onTaskSelect={handleTaskSelect}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentTask={activeTask}
          allTasks={tasks}
          onTaskSelect={handleTaskChange}
          collapsed={sidebarCollapsed}
        />

        {/* Main Terminal Area - Split Layout */}
        <div className="flex-1 flex flex-col bg-gray-900">
          {/* Terminal Panel */}
          <TerminalPanel
            task={activeTask}
            validationMode={validationMode}
            onToggleValidation={() => setValidationMode(!validationMode)}
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
          />

          {/* Resize Handle */}
          {validationMode && (
            <div className="h-1 bg-gray-600 cursor-row-resize hover:bg-blue-500 transition-colors flex items-center justify-center">
              <div className="w-8 h-0.5 bg-gray-400 rounded"></div>
            </div>
          )}

          {/* Validation/Merge Panel with Lens Slider */}
          <LensSlider
            taskId={activeTaskId}
            validationMode={validationMode}
            activePhase={activePhase}
            onPhaseChange={setActivePhase}
            onClose={() => setValidationMode(false)}
          />
        </div>
      </div>
    </div>
  );
};