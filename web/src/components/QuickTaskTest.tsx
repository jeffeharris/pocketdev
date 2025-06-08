import React, { useState } from 'react';
import { QuickTaskInput } from './QuickTaskInput';
import { Sparkles, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function QuickTaskTest() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTask, setCurrentTask] = useState<any>(null);
  const [taskStatus, setTaskStatus] = useState<any>(null);

  const handleQuickTask = async (task: any) => {
    setIsProcessing(true);
    setCurrentTask(null);
    setTaskStatus(null);

    try {
      // Submit the task
      const response = await fetch('http://localhost:3001/api/container/quick-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign task');
      }

      setCurrentTask(result.task);
      toast.success(result.message);

      // Start polling for status
      pollTaskStatus(result.task.id);

    } catch (error: any) {
      toast.error(error.message);
      setIsProcessing(false);
    }
  };

  const pollTaskStatus = async (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/container/quick-status/${taskId}`);
        const status = await response.json();

        setTaskStatus(status);

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          setIsProcessing(false);

          if (status.status === 'completed' && status.result?.success) {
            toast.success('Task completed successfully! 🎉');
          } else if (status.status === 'failed') {
            toast.error('Task failed. Please check the details.');
          }
        }
      } catch (error) {
        console.error('Failed to poll status:', error);
      }
    }, 2000); // Poll every 2 seconds
  };

  const getStatusIcon = () => {
    if (!taskStatus) return <Clock className="h-5 w-5 text-gray-400 animate-pulse" />;
    
    switch (taskStatus.status) {
      case 'running':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Quick Task Magic ✨
          </h1>
          <p className="text-gray-600">
            Describe what you want. Watch it happen.
          </p>
        </div>

        <QuickTaskInput 
          onTaskSubmit={handleQuickTask}
          isProcessing={isProcessing}
        />

        {currentTask && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  {getStatusIcon()}
                  Task Progress
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {currentTask.assignedTo.name} ({currentTask.assignedTo.role})
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                currentTask.complexity === 'simple' ? 'bg-green-100 text-green-700' :
                currentTask.complexity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-orange-100 text-orange-700'
              }`}>
                {currentTask.complexity} • ~{currentTask.estimatedMinutes}min
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-500">Task:</span>
                <p className="text-sm text-gray-900">{currentTask.description}</p>
              </div>

              {taskStatus && (
                <>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Status:</span>
                    <p className="text-sm text-gray-900 capitalize">{taskStatus.status}</p>
                  </div>

                  {taskStatus.currentStep && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">Current Step:</span>
                      <p className="text-sm text-gray-900">{taskStatus.currentStep}</p>
                    </div>
                  )}

                  {taskStatus.progress > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Progress</span>
                        <span className="text-gray-900">{taskStatus.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${taskStatus.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {taskStatus.canReview && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-800 font-medium mb-2">
                        ✅ Task completed successfully!
                      </p>
                      <button className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                        Review Changes & Create PR
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        <div className="text-center text-sm text-gray-500 mt-8">
          <p>💡 Tip: Click the microphone for voice input!</p>
        </div>
      </div>
    </div>
  );
}