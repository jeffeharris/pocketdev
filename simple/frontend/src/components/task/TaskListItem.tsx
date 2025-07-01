import React from 'react';
import type { Task } from '../../types/task';
import { TaskStatus } from './TaskStatus';
import { clsx } from 'clsx';

interface TaskListItemProps {
  task: Task;
  isActive: boolean;
  onSelect: (task: Task) => void;
  needsAttention?: boolean;
}

export const TaskListItem: React.FC<TaskListItemProps> = ({ 
  task, 
  isActive, 
  onSelect, 
  needsAttention 
}) => {
  return (
    <div 
      className={clsx(
        'relative p-3 rounded-lg cursor-pointer transition-all border',
        isActive 
          ? 'bg-blue-50 border-blue-200 shadow-sm' 
          : needsAttention
          ? 'bg-yellow-50 border-yellow-200 hover:shadow-sm'
          : 'bg-white border-gray-200 hover:shadow-sm hover:border-gray-300'
      )}
      onClick={() => onSelect(task)}
    >
      {needsAttention && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        </div>
      )}
      
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900">#{task.id.slice(-3)}</span>
            <TaskStatus status={task.status} />
          </div>
          <h4 className="font-medium text-gray-900 text-sm truncate">{task.title}</h4>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{task.engineer}</span>
        <span>{task.duration}</span>
      </div>
      
      {needsAttention && (
        <div className="mt-2 text-xs text-yellow-700 font-medium">
          {task.status === 'user-request' && 'Needs user input'}
          {task.status === 'thinking' && 'Processing request'}
        </div>
      )}
    </div>
  );
};