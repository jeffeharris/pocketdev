import React from 'react';
import type { Task } from '../../types/task.ts';

interface TaskSidebarProps {
  currentTask: Task;
  allTasks: Task[];
  onTaskSelect: (task: Task) => void;
}

export const TaskSidebar: React.FC<TaskSidebarProps> = ({
  currentTask,
  allTasks,
  onTaskSelect,
}) => {
  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4">
        <h2 className="font-semibold">Task Sidebar - Coming Soon</h2>
        <p className="text-sm text-gray-500 mt-2">Current: {currentTask.name}</p>
      </div>
    </div>
  );
};