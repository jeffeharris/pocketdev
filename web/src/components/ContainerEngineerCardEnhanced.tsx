import React, { useState, useEffect } from 'react';
import { Engineer } from '../types';
import { Bot, Code, Server, Package, Clock, CheckCircle, AlertCircle, ZapOff, RotateCcw, Container, FileText, Brain } from 'lucide-react';
import { TaskLogViewer } from './TaskLogViewer';
import { TaskResultView } from './TaskResultView';
import { UnifiedTaskModal } from './UnifiedTaskModal';
import { EngineerMemories } from './EngineerMemories';
import { TaskProgress } from './TaskProgress';
import toast from 'react-hot-toast';

interface Props {
  engineer: Engineer & { containerized?: boolean };
}

export function ContainerEngineerCardEnhanced({ engineer: initialEngineer }: Props) {
  const [engineer, setEngineer] = useState(initialEngineer);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showMemories, setShowMemories] = useState(false);
  const [taskResult, setTaskResult] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Poll for engineer status updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (engineer.status === 'busy' && engineer.currentTaskDetails?.id) {
      setIsPolling(true);
      
      interval = setInterval(async () => {
        try {
          // Check task status
          const taskResponse = await fetch(`http://localhost:3001/api/container/tasks/${engineer.currentTaskDetails!.id}`);
          if (taskResponse.ok) {
            const task = await taskResponse.json();
            
            // If task is complete, show results
            if (task.status === 'completed' || task.status === 'failed') {
              setIsPolling(false);
              
              // Get the result - either from workspace or directly from task
              if (task.result) {
                if (task.result.workspacePath) {
                  // Try to get detailed result from workspace
                  try {
                    const resultResponse = await fetch(`http://localhost:3001/api/container/tasks/${task.id}/result`);
                    if (resultResponse.ok) {
                      const result = await resultResponse.json();
                      setTaskResult(result);
                      setShowResults(true);
                    } else {
                      // Fallback to task result if workspace result fails
                      setTaskResult(task.result);
                      setShowResults(true);
                    }
                  } catch (error) {
                    console.error('Error fetching task result:', error);
                    // Fallback to task result
                    setTaskResult(task.result);
                    setShowResults(true);
                  }
                } else {
                  // No workspace (e.g., pre-flight validation failure) - use task result directly
                  setTaskResult(task.result);
                  setShowResults(true);
                }
              }
              
              // Update engineer status
              setEngineer(prev => ({
                ...prev,
                status: 'idle',
                currentTaskDetails: null
              }));
            }
          }
        } catch (error) {
          console.error('Error polling task status:', error);
        }
      }, 3000); // Poll every 3 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [engineer.status, engineer.currentTaskDetails?.id]);

  // Update engineer when prop changes
  useEffect(() => {
    setEngineer(initialEngineer);
  }, [initialEngineer]);

  const handleReset = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/container/engineers/${engineer.id}/reset`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to reset engineer');
      
      setEngineer(prev => ({
        ...prev,
        status: 'idle',
        currentTaskDetails: null
      }));
      
      toast.success('Engineer reset successfully');
    } catch (error) {
      console.error('Error resetting engineer:', error);
      toast.error('Failed to reset engineer');
    }
  };

  const handleTaskAssigned = () => {
    setShowTaskModal(false);
    // Refresh engineer status
    fetch(`http://localhost:3001/api/container/engineers/${engineer.id}`)
      .then(res => res.json())
      .then(data => setEngineer(data))
      .catch(console.error);
  };

  const handleAcceptResult = async () => {
    if (!taskResult || !engineer.currentTaskDetails?.id) return;
    
    try {
      // Send signal to container to commit and push
      const response = await fetch(`http://localhost:3001/api/container/tasks/${engineer.currentTaskDetails.id}/accept`, {
        method: 'POST'
      });
      
      if (response.ok) {
        toast.success('Changes committed and pushed!');
        setShowResults(false);
        setTaskResult(null);
        
        // Update engineer status
        setEngineer(prev => ({
          ...prev,
          status: 'idle',
          currentTaskDetails: null
        }));
      } else {
        toast.error('Failed to accept task');
      }
    } catch (error) {
      console.error('Error accepting task:', error);
      toast.error('Failed to accept task');
    }
  };

  const handleFollowUp = async (followUpTask: string) => {
    if (!taskResult || !engineer.currentTaskDetails?.id) return;
    
    try {
      const response = await fetch(`http://localhost:3001/api/container/continue-task`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: engineer.currentTaskDetails.id,
          additionalInstructions: followUpTask
        })
      });
      
      if (response.ok) {
        toast.success('Follow-up task assigned!');
        setShowResults(false);
        setTaskResult(null);
        
        // Update engineer to busy again
        setEngineer(prev => ({
          ...prev,
          status: 'busy'
        }));
      } else {
        toast.error('Failed to assign follow-up task');
      }
    } catch (error) {
      console.error('Error assigning follow-up:', error);
      toast.error('Failed to assign follow-up task');
    }
  };

  const getStatusIcon = () => {
    switch (engineer.status) {
      case 'idle': return <ZapOff className="h-5 w-5 text-gray-400" />;
      case 'busy': return <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Bot className="h-5 w-5 text-gray-400" />;
    }
  };

  const getRoleIcon = () => {
    switch (engineer.role) {
      case 'frontend': return <Code className="h-4 w-4" />;
      case 'backend': return <Server className="h-4 w-4" />;
      case 'devops': return <Package className="h-4 w-4" />;
      default: return <Bot className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (engineer.status) {
      case 'idle': return 'bg-gray-100 text-gray-700';
      case 'busy': return 'bg-yellow-100 text-yellow-700';
      case 'error': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border-2 border-blue-200">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center text-white font-semibold relative">
                {engineer.name.charAt(0)}
                <Container className="h-4 w-4 absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 text-blue-600" />
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900">{engineer.name}</h3>
                <div className="flex items-center text-sm text-gray-500">
                  {getRoleIcon()}
                  <span className="ml-1 capitalize">{engineer.role} Engineer</span>
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Container</span>
                </div>
              </div>
            </div>
            {getStatusIcon()}
          </div>

          <div className="mb-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
              {engineer.status}
              {isPolling && ' (checking for completion...)'}
            </span>
          </div>

          {engineer.currentTaskDetails && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 line-clamp-2">
                {engineer.currentTaskDetails.description || engineer.currentTaskDetails.task}
              </p>
              {engineer.currentTaskDetails.repository && (
                <p className="text-xs text-gray-500 mt-1">
                  📁 {typeof engineer.currentTaskDetails.repository === 'string' 
                    ? engineer.currentTaskDetails.repository.split('/').slice(-2).join('/')
                    : engineer.currentTaskDetails.repository.url.split('/').slice(-2).join('/')}
                </p>
              )}
              {/* Show progress for running tasks */}
              {engineer.status === 'busy' && engineer.currentTaskDetails.id && (
                <div className="mt-3">
                  <TaskProgress taskId={engineer.currentTaskDetails.id} />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setShowTaskModal(true)}
              disabled={engineer.status !== 'idle'}
              className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                engineer.status === 'idle'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {engineer.status === 'idle' ? 'Assign Container Task' : 
               engineer.status === 'error' ? 'Error' : 'Running in Container'}
            </button>
            
            {engineer.status === 'error' && (
              <button
                onClick={handleReset}
                className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-md transition-colors"
                title="Reset Engineer"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            )}
            
            {(engineer.status === 'busy' || engineer.status === 'running') && engineer.currentTaskDetails?.id && (
              <button
                onClick={() => setShowLogs(true)}
                className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
                title="View Logs"
              >
                <FileText className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
            <span className="flex items-center">
              <Container className="h-3 w-3 mr-1" />
              Isolated Environment
            </span>
            <button
              onClick={() => setShowMemories(true)}
              className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
              title="View Engineer Memories"
            >
              <Brain className="h-3 w-3" />
              <span>Memories</span>
            </button>
            {engineer.taskHistory && engineer.taskHistory.length > 0 && (
              <span>{engineer.taskHistory.length} tasks completed</span>
            )}
          </div>
        </div>
      </div>
      
      {showTaskModal && (
        <UnifiedTaskModal
          engineer={engineer}
          mode="container"
          onClose={() => setShowTaskModal(false)}
          onTaskAssigned={handleTaskAssigned}
        />
      )}
      
      {showLogs && engineer.currentTaskDetails?.id && (
        <TaskLogViewer
          taskId={engineer.currentTaskDetails.id}
          engineerId={engineer.id}
          onClose={() => setShowLogs(false)}
        />
      )}
      
      {showResults && taskResult && (
        <TaskResultView
          result={taskResult}
          onAccept={handleAcceptResult}
          onFollowUp={handleFollowUp}
          onClose={() => {
            setShowResults(false);
            setTaskResult(null);
          }}
        />
      )}
      
      {showMemories && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Engineer Memories</h2>
              <button
                onClick={() => setShowMemories(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-8rem)]">
              <EngineerMemories 
                engineerRole={engineer.role} 
                projectId="current" 
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}