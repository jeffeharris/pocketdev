import React from 'react';
import { useParams } from 'react-router-dom';
import { TaskWorkspace as TaskWorkspaceComponent } from '../components/task/TaskWorkspace';

export const TaskWorkspace: React.FC = () => {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();

  if (!projectId || !taskId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Invalid Task Parameters</h2>
          <p className="text-gray-600">Project ID or Task ID is missing.</p>
        </div>
      </div>
    );
  }

  return <TaskWorkspaceComponent projectId={projectId} taskId={taskId} />;
};