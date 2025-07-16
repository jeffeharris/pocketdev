import React from 'react';
import { Check, Circle, Plus, GitCommit, X } from 'lucide-react';

export type FileStatusType = 'staged' | 'unstaged' | 'untracked' | 'committed' | 'deleted';

interface StatusBadgeProps {
  statuses: FileStatusType[];
  className?: string;
}

const STATUS_CONFIG = {
  staged: {
    icon: Check,
    label: 'S',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border border-green-200',
    title: 'Staged'
  },
  unstaged: {
    icon: Circle,
    label: 'M',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border border-orange-200',
    title: 'Modified (unstaged)'
  },
  untracked: {
    icon: Plus,
    label: 'U',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border border-gray-200',
    title: 'Untracked'
  },
  committed: {
    icon: GitCommit,
    label: 'C',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border border-blue-200',
    title: 'Committed'
  },
  deleted: {
    icon: X,
    label: 'D',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border border-red-200',
    title: 'Deleted'
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ statuses, className = '' }) => {
  if (statuses.length === 0) return null;

  return (
    <div className={`flex items-center justify-end gap-1 min-w-[3.5rem] sm:min-w-[4rem] ${className}`}>
      {statuses.map((status) => {
        const config = STATUS_CONFIG[status];
        const Icon = config.icon;
        
        return (
          <div
            key={status}
            className={`
              flex items-center justify-center
              w-6 h-6 rounded
              ${config.bgColor} ${config.color} ${config.borderColor}
              transition-transform hover:scale-110
            `}
            title={config.title}
            aria-label={config.title}
          >
            <Icon size={14} strokeWidth={2.5} />
          </div>
        );
      })}
    </div>
  );
};

