import React from 'react';
import { CheckCircle, Clock, User, Activity } from 'lucide-react';
import type { TaskStatus as TaskStatusType } from '../../types/task';
import { clsx } from 'clsx';

interface TaskStatusProps {
  status: TaskStatusType;
  className?: string;
}

const statusConfig = {
  idle: {
    icon: CheckCircle,
    label: 'Idle',
    colorClass: 'bg-blue-100 text-blue-700 border-blue-300',
  },
  'user-request': {
    icon: User,
    label: 'User Request',
    colorClass: 'bg-purple-100 text-purple-700 border-purple-300 animate-pulse',
  },
  thinking: {
    icon: Clock,
    label: 'Thinking',
    colorClass: 'bg-yellow-100 text-yellow-700 border-yellow-300 animate-pulse',
  },
  working: {
    icon: Activity,
    label: 'Working',
    colorClass: 'bg-green-100 text-green-700 border-green-300',
  },
  'not-started': {
    icon: Clock,
    label: 'Not Started',
    colorClass: 'bg-gray-100 text-gray-700 border-gray-300',
  },
};

export const TaskStatus: React.FC<TaskStatusProps> = ({ status, className }) => {
  const config = statusConfig[status] || statusConfig['not-started'];
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border',
        config.colorClass,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </div>
  );
};