import React from 'react';
import { Check, AlertCircle, GitBranch, Plus, X } from 'lucide-react';

// Simplified, user-friendly file states
export type SimpleFileStatus = 'staged' | 'modified' | 'conflict' | 'untracked' | 'deleted';

interface StatusBadgeProps {
  gitStatus: string; // The two-letter git status code
  className?: string;
}

// Map git status codes to user-friendly states
function getSimpleStatus(gitStatus: string): SimpleFileStatus | null {
  const [index, workTree] = [gitStatus[0], gitStatus[1]];
  
  // Conflict states (UU, AA, DD, AU, UA, DU, UD)
  if (gitStatus.startsWith('U') || gitStatus.includes('U')) {
    return 'conflict';
  }
  if (gitStatus === 'AA' || gitStatus === 'DD') {
    return 'conflict';
  }
  
  // Deleted states
  if (index === 'D' || workTree === 'D') {
    return 'deleted';
  }
  
  // Untracked
  if (gitStatus === '??') {
    return 'untracked';
  }
  
  // Staged (clean) - only changes in index, working tree clean
  if (index !== ' ' && index !== '?' && workTree === ' ') {
    return 'staged';
  }
  
  // Modified (including mixed states like MM)
  if (workTree !== ' ' && workTree !== '?') {
    return 'modified';
  }
  
  // Any remaining staged changes
  if (index !== ' ' && index !== '?') {
    return 'staged';
  }
  
  return null;
}

const STATUS_CONFIG = {
  staged: {
    icon: Check,
    label: 'Staged',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border border-green-200',
    description: 'Ready to commit'
  },
  modified: {
    icon: AlertCircle,
    label: 'Modified',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border border-amber-200',
    description: 'Unstaged changes'
  },
  conflict: {
    icon: AlertCircle,
    label: 'Conflict',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border border-red-200',
    description: 'Merge conflict'
  },
  untracked: {
    icon: Plus,
    label: 'New',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border border-gray-200',
    description: 'Not tracked by git'
  },
  deleted: {
    icon: X,
    label: 'Deleted',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border border-red-200',
    description: 'File removed'
  }
};

export const StatusBadge2: React.FC<StatusBadgeProps> = ({ gitStatus, className = '' }) => {
  const simpleStatus = getSimpleStatus(gitStatus);
  if (!simpleStatus) return null;
  
  const config = STATUS_CONFIG[simpleStatus];
  const Icon = config.icon;
  
  // For files with both staged and unstaged changes (MM, MD, etc.)
  const hasMixedState = gitStatus[0] !== ' ' && gitStatus[0] !== '?' && 
                        gitStatus[1] !== ' ' && gitStatus[1] !== '?';
  
  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <div
        className={`
          inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
          ${config.bgColor} ${config.color} ${config.borderColor}
        `}
        title={`${config.description}${hasMixedState ? ' (has staged changes too)' : ''}`}
      >
        <Icon size={14} strokeWidth={2} />
        <span>{config.label}</span>
        {hasMixedState && (
          <span className="text-green-600 ml-0.5" title="Also has staged changes">+S</span>
        )}
      </div>
    </div>
  );
};

// Export for the playground
export const STATUS_EXAMPLES = [
  { code: '??', description: 'Untracked file' },
  { code: 'A ', description: 'New file (staged)' },
  { code: 'M ', description: 'Modified (staged)' },
  { code: ' M', description: 'Modified (not staged)' },
  { code: 'MM', description: 'Modified (both staged and unstaged)' },
  { code: 'D ', description: 'Deleted (staged)' },
  { code: ' D', description: 'Deleted (not staged)' },
  { code: 'UU', description: 'Both modified (merge conflict)' },
  { code: 'AA', description: 'Both added (merge conflict)' },
  { code: 'R ', description: 'Renamed (staged)' },
  { code: 'RM', description: 'Renamed and modified' },
];