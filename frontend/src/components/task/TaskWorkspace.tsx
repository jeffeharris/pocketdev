import React, { useState, useEffect, useRef } from 'react';
import { MainHeader } from '../layout/MainHeader';
import { Sidebar } from '../layout/Sidebar';
import { TerminalPanel, type TerminalPanelHandle } from '../terminal/TerminalPanel';
import { LensSlider } from '../common/LensSlider';
import { CreateTaskModal } from './CreateTaskModal';
import type { Task, CreateTaskDTO } from '../../types/task';
import type { Project } from '../../types/project';
import { api } from '../../services/api';
import { useWebSocketContext } from '../../contexts/WebSocketContext';

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Real data from API
  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  
  // Track which terminals have been initialized
  const [initializedTerminals, setInitializedTerminals] = useState<Set<string>>(new Set());
  
  // Track terminal refs for focus management
  const terminalRefs = useRef<Map<string, TerminalPanelHandle>>(new Map());
  
  // WebSocket for real-time updates
  const { subscribe, unsubscribe } = useWebSocketContext();
  
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
        // Failed to load data
        // Don't use mock data - show error state instead
        setProject(null);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [projectId]);
  
  // Subscribe to WebSocket updates for git status
  useEffect(() => {
    // Handler for git status updates
    const handleGitStatusUpdate = (data: any) => {
      if (data.type === 'git_status_update' && data.data) {
        const { taskId: updatedTaskId, gitStatus } = data.data;
        
        // Update the task's git status
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === updatedTaskId 
              ? { ...task, gitStatus } 
              : task
          )
        );
      }
    };
    
    // Subscribe to all task updates
    tasks.forEach(task => {
      subscribe('task', task.id, handleGitStatusUpdate);
    });
    
    // Cleanup subscriptions
    return () => {
      tasks.forEach(task => {
        unsubscribe('task', task.id, handleGitStatusUpdate);
      });
    };
  }, [tasks, subscribe, unsubscribe]);
  
  // Update active task when taskId prop changes and load task details
  useEffect(() => {
    // taskId prop changed
    setActiveTaskId(taskId);
    // Mark this terminal as initialized
    setInitializedTerminals(prev => new Set(prev).add(taskId));
    
    // Load detailed task data to get terminals
    const loadTaskDetails = async () => {
      try {
        const taskDetails = await api.getTask(projectId, taskId);
        // Update the task in our state with the detailed version that includes terminals
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId ? { ...task, terminals: taskDetails.terminals } : task
          )
        );
      } catch (error) {
        console.error('Failed to load task details:', error);
      }
    };
    
    loadTaskDetails();
    
    // Focus the terminal using ref
    setTimeout(() => {
      const terminalRef = terminalRefs.current.get(taskId);
      if (terminalRef) {
        console.log('[TaskWorkspace] Focusing terminal for task:', taskId);
        terminalRef.focus();
      } else {
        console.log('[TaskWorkspace] Terminal ref not found for task:', taskId);
      }
    }, 100);
  }, [taskId, projectId]);
  
  // Focus terminal when page becomes visible (tab switch, modal close, etc)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && activeTaskId) {
        focusActiveTerminal('visibility change');
      }
    };
    
    const handleFocus = () => {
      if (activeTaskId) {
        focusActiveTerminal('window focus');
      }
    };
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    // Focus on mount
    if (activeTaskId) {
      focusActiveTerminal('component mount');
    }
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [activeTaskId]);

  // Helper function to focus the active terminal
  const focusActiveTerminal = (reason: string) => {
    const taskId = activeTaskId;
    if (!taskId) return;
    
    setTimeout(() => {
      const terminalRef = terminalRefs.current.get(taskId);
      if (terminalRef) {
        console.log(`[TaskWorkspace] Focusing terminal for task: ${taskId} (reason: ${reason})`);
        terminalRef.focus();
      } else {
        console.log(`[TaskWorkspace] Terminal ref not found for task: ${taskId} (reason: ${reason})`);
      }
    }, 200); // Slightly longer delay for modal close animations
  };

  const handleTaskSelect = (newTaskId: string) => {
    console.log('[TaskWorkspace] handleTaskSelect called with:', newTaskId);
    setActiveTaskId(newTaskId);
    // Reset validation mode when switching tasks
    setValidationMode(false);
    
    // Mark this terminal as initialized
    setInitializedTerminals(prev => new Set(prev).add(newTaskId));
    
    // Focus the terminal using ref
    setTimeout(() => {
      const terminalRef = terminalRefs.current.get(newTaskId);
      if (terminalRef) {
        console.log('[TaskWorkspace] Focusing terminal for task:', newTaskId);
        terminalRef.focus();
      } else {
        console.log('[TaskWorkspace] Terminal ref not found for task:', newTaskId);
      }
    }, 100);
  };

  const handleTaskChange = (task: Task) => {
    handleTaskSelect(task.id);
  };

  const handleCreateTask = async (taskData: Omit<CreateTaskDTO, 'projectId'>) => {
    try {
      const newTask = await api.createTask(projectId, {
        ...taskData,
        projectId
      });
      
      // Add the new task to our list
      setTasks(prevTasks => [...prevTasks, newTask]);
      
      // Switch to the new task
      setActiveTaskId(newTask.id);
      
      // Close the modal
      setShowCreateModal(false);
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

  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId ? { ...task, ...updates } : task
      )
    );
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to connect to backend</h2>
          <p className="text-gray-600">Please check that the backend server is running.</p>
        </div>
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
          projectId={projectId}
          currentTask={activeTask}
          allTasks={tasks}
          onTaskSelect={handleTaskChange}
          collapsed={sidebarCollapsed}
          onCreateTask={() => setShowCreateModal(true)}
          onTaskUpdate={handleTaskUpdate}
          baseBranch={project?.baseBranch}
        />

        {/* Main Terminal Area - Split Layout */}
        <div className="flex-1 flex flex-col bg-gray-900">
          {/* Render all initialized terminals but only show the active one */}
          {tasks.map(task => {
            const isActive = task.id === activeTaskId;
            const isInitialized = initializedTerminals.has(task.id);
            
            // Only render if this is the active task or it has been initialized before
            if (!isActive && !isInitialized) {
              return null;
            }
            
            return (
              <div
                key={task.id}
                style={{ display: isActive ? 'flex' : 'none' }}
                className="flex-1 flex flex-col"
              >
                <TerminalPanel
                  ref={(ref) => {
                    if (ref) {
                      terminalRefs.current.set(task.id, ref);
                    } else {
                      terminalRefs.current.delete(task.id);
                    }
                  }}
                  task={task}
                  validationMode={validationMode}
                  onToggleValidation={() => setValidationMode(!validationMode)}
                  onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
                  isVisible={isActive}
                />
              </div>
            );
          })}

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

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          // Focus terminal after modal closes
          focusActiveTerminal('create task modal closed');
        }}
        onSubmit={handleCreateTask}
        projectId={projectId}
        baseBranch={project?.baseBranch}
        occupiedBranches={tasks.map(t => t.branch)}
      />
    </div>
  );
};