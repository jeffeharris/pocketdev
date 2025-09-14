import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainHeader } from '../layout/MainHeader';
import { Sidebar } from '../layout/Sidebar';
import { TerminalPanel, type TerminalPanelHandle } from '../terminal/TerminalPanel';
import { LensSlider } from '../common/LensSlider';
import { CreateTaskModal } from './CreateTaskModal';
import type { Task, CreateTaskDTO } from '../../types/task';
import type { Project } from '../../types/project';
import { useService } from '../../services';
import { useWebSocketContext } from '../../contexts/WebSocketContext';
import { useTerminalStore } from '../../stores/terminalStore';

interface TaskWorkspaceProps {
  projectId: string;
  taskId: string;
}

export const TaskWorkspace: React.FC<TaskWorkspaceProps> = ({ projectId, taskId }) => {
  const navigate = useNavigate();
  const projectService = useService('project');
  const taskService = useService('task');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [validationMode, setValidationMode] = useState(false);
  const [activePhase, setActivePhase] = useState<'validate' | 'merge'>('validate');
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(60); // percentage for terminal when validation mode is on
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  
  // Real data from API
  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  
  // Track which terminals have been initialized
  const [initializedTerminals, setInitializedTerminals] = useState<Set<string>>(new Set());
  
  // Track terminal refs for focus management
  const terminalRefs = useRef<Map<string, TerminalPanelHandle>>(new Map());
  
  // WebSocket for real-time updates
  const { subscribe, unsubscribe } = useWebSocketContext();
  
  const activeTask = tasks.find(t => t.id === taskId) || tasks[0];
  
  // Load project and tasks on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [projectData, tasksData] = await Promise.all([
          projectService.getProject(projectId),
          taskService.getTasks(projectId)
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
    // Validate taskId before proceeding
    if (!taskId || taskId === 'undefined') {
      console.error('Invalid taskId:', taskId);
      return;
    }
    
    // Mark this terminal as initialized
    setInitializedTerminals(prev => new Set(prev).add(taskId));
    
    // Load detailed task data to get terminals
    const loadTaskDetails = async () => {
      try {
        const taskDetails = await taskService.getTask(projectId, taskId);
        // Update the task in our state with the detailed version that includes terminals
        setTasks(prevTasks => 
          prevTasks.map(task => 
            task.id === taskId ? { ...task, terminals: taskDetails.terminals } : task
          )
        );
        
        // Also update the terminal store
        if (taskDetails.terminals) {
          useTerminalStore.getState().initializeTask(taskId, taskDetails.terminals);
        }
      } catch (error: any) {
        console.error('Failed to load task details:', error);
        // If task not found, show error state
        if (error.status === 404) {
          setTasks([]);
          setLoading(false);
        }
      }
    };
    
    loadTaskDetails();
    
    // Focus the terminal using ref
    setTimeout(() => {
      const terminalRef = terminalRefs.current.get(taskId);
      if (terminalRef) {
        terminalRef.focus();
      } else {
      }
    }, 100);
  }, [taskId, projectId]);
  
  // Focus terminal when page becomes visible (tab switch, modal close, etc)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && taskId) {
        focusActiveTerminal('visibility change');
      }
    };
    
    const handleFocus = () => {
      if (taskId) {
        focusActiveTerminal('window focus');
      }
    };
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    // Focus on mount
    if (taskId) {
      focusActiveTerminal('component mount');
    }
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [taskId]);

  // Helper function to focus the active terminal
  const focusActiveTerminal = (reason: string) => {
    if (!taskId) return;
    
    setTimeout(() => {
      const terminalRef = terminalRefs.current.get(taskId);
      if (terminalRef) {
        terminalRef.focus();
      } else {
      }
    }, 200); // Slightly longer delay for modal close animations
  };

  const handleTaskSelect = (newTaskId: string, focusTabId?: string) => {
    // Don't do anything if we're already on this task
    if (newTaskId === taskId) {
      return;
    }
    
    // Store the tab to focus for when TerminalPanel mounts
    if (focusTabId) {
      sessionStorage.setItem(`focus-tab-${newTaskId}`, focusTabId);
    }
    
    // Navigate to the new task URL - this will trigger a re-render with new taskId prop
    navigate(`/projects/${projectId}/tasks/${newTaskId}`);
  };

  const handleTaskChange = (task: Task, focusTabId?: string) => {
    handleTaskSelect(task.id, focusTabId);
  };

  const handleCreateTask = async (taskData: Omit<CreateTaskDTO, 'projectId'>) => {
    try {
      const newTask = await taskService.createTask(projectId, {
        ...taskData,
        projectId
      });
      
      // Add the new task to our list
      setTasks(prevTasks => [...prevTasks, newTask]);
      
      // Close the modal
      setShowCreateModal(false);
      
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

  if (tasks.length === 0 || !activeTask) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Task Not Found</h2>
          <p className="text-gray-600 mb-4">The requested task could not be found or has been deleted.</p>
          <button
            onClick={() => window.location.href = `/projects/${projectId}`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {!fullscreenMode && (
        <MainHeader 
          project={project} 
          tasks={tasks} 
          activeTaskId={taskId}
          onTaskSelect={handleTaskSelect}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        {!fullscreenMode && (
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
        )}

        {/* Main Terminal Area - Split Layout */}
        <div className="flex-1 flex flex-col bg-gray-900 h-full overflow-hidden">
          {/* Render all initialized terminals but only show the active one */}
          {tasks.map(task => {
            const isActive = task.id === taskId;
            const isInitialized = initializedTerminals.has(task.id);
            
            // Only render if this is the active task or it has been initialized before
            if (!isActive && !isInitialized) {
              return null;
            }
            
            return (
              <div
                key={task.id}
                style={{ 
                  display: isActive ? 'flex' : 'none',
                  height: validationMode ? `${terminalHeight}%` : undefined
                }}
                className={`${validationMode ? 'flex-shrink-0' : 'flex-1'} flex flex-col`}
              >
                <TerminalPanel
                  ref={(ref) => {
                    if (ref) {
                      terminalRefs.current.set(task.id, ref);
                    } else {
                      terminalRefs.current.delete(task.id);
                    }
                  }}
                  task={{
                    ...task,
                    onReload: () => {
                      // Reload task details to get updated terminals
                      taskService.getTask(projectId, task.id).then(taskDetails => {
                        setTasks(prevTasks => 
                          prevTasks.map(t => 
                            t.id === task.id ? { ...t, terminals: taskDetails.terminals } : t
                          )
                        );
                        
                        // Also update the terminal store
                        if (taskDetails.terminals) {
                          useTerminalStore.getState().initializeTask(task.id, taskDetails.terminals);
                        }
                      });
                    }
                  }}
                  validationMode={validationMode}
                  onToggleValidation={() => setValidationMode(!validationMode)}
                  onToggleSidebar={() => setFullscreenMode(!fullscreenMode)}
                  isVisible={isActive}
                  isFullscreen={fullscreenMode}
                />
              </div>
            );
          })}

          {/* Validation/Merge Panel with Lens Slider - includes resize handle */}
          <LensSlider
            taskId={taskId}
            validationMode={validationMode}
            activePhase={activePhase}
            onPhaseChange={setActivePhase}
            onClose={() => setValidationMode(false)}
            panelHeight={100 - terminalHeight}
            onHeightChange={(newHeight) => setTerminalHeight(100 - newHeight)}
            isDragging={isDraggingDivider}
            onDraggingChange={setIsDraggingDivider}
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