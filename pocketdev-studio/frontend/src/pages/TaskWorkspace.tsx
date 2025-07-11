import React from 'react';
import { useParams } from 'react-router-dom';
import { TaskWorkspace as TaskWorkspaceComponent } from '../components/task/TaskWorkspace.tsx';

export const TaskWorkspace: React.FC = () => {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();

  if (!projectId || !taskId) {
    return <div>Invalid task parameters</div>;
  }

  return <TaskWorkspaceComponent projectId={projectId} taskId={taskId} />;
};