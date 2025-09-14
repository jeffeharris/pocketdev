import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { TerminalPanel } from './TerminalPanel';
import type { Task } from '../../types/task';
import { useService } from '../../services';
import { useTerminalStore } from '../../stores/terminalStore';

export function StandaloneTerminal() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  const taskService = useService('task');
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !taskId) {
      setError('Missing project or task ID');
      setLoading(false);
      return;
    }

    const loadTask = async () => {
      try {
        const taskData = await taskService.getTask(projectId, taskId);
        setTask(taskData);
        
        // Initialize terminal store with task terminals
        if (taskData.terminals) {
          const { initializeTask } = useTerminalStore.getState();
          initializeTask(taskId, taskData.terminals);
        }
      } catch (err) {
        setError('Failed to load task');
        console.error('Error loading task:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTask();
  }, [projectId, taskId]);

  const handleReloadTask = async () => {
    if (!projectId || !taskId) return;
    
    try {
      const taskData = await taskService.getTask(projectId, taskId);
      setTask(taskData);
      
      if (taskData.terminals) {
        const { setTerminals } = useTerminalStore.getState();
        setTerminals(taskId, taskData.terminals);
      }
    } catch (err) {
      console.error('Error reloading task:', err);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading terminal...</div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400">{error || 'Task not found'}</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900">
      <TerminalPanel
        task={{
          ...task,
          onReload: handleReloadTask
        }}
        validationMode={false}
        onToggleValidation={() => {}}
        onToggleSidebar={() => {
          // In standalone mode, close the window
          window.close();
        }}
        isVisible={true}
        isFullscreen={true}
      />
    </div>
  );
}