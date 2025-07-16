import React from 'react';
import { Check, Circle, AlertCircle, Plus, X, Loader2 } from 'lucide-react';

// Priority-based status - only show the most important one
export type FileStatus = 'conflict' | 'deleted' | 'new' | 'modified' | 'staged';
export type FileCategory = 'staged' | 'unstaged' | 'untracked' | 'committed';

interface StatusIconProps {
  gitStatus: string; // The two-letter git status code
  size?: 'sm' | 'md';
  showTooltip?: boolean;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  category?: FileCategory; // Used to determine if clickable
}

// Priority order: conflict > deleted > new > modified > staged
function getPriorityStatus(gitStatus: string): FileStatus | null {
  // Handle single-letter status codes from committed changes (git diff output)
  if (gitStatus.length === 1) {
    switch (gitStatus) {
      case 'A': return 'new';      // Added in commits
      case 'M': return 'modified';  // Modified in commits
      case 'D': return 'deleted';   // Deleted in commits
      case 'R': return 'modified';  // Renamed in commits
      default: return null;
    }
  }
  
  // Handle two-letter status codes from working tree
  const [index, workTree] = [gitStatus[0], gitStatus[1]];
  
  // Conflict states (highest priority)
  if (gitStatus.includes('U') || gitStatus === 'AA' || gitStatus === 'DD') {
    return 'conflict';
  }
  
  // Deleted (high priority - important to know)
  if (index === 'D' || workTree === 'D') {
    return 'deleted';
  }
  
  // New/Untracked (medium priority)
  if (gitStatus === '??') {
    return 'new';
  }
  
  // Modified in working tree (medium priority)
  if (workTree === 'M') {
    return 'modified';
  }
  
  // Added to index (staged)
  if (index === 'A') {
    return 'new';
  }
  
  // Modified in index (staged)
  if (index === 'M') {
    return 'staged';
  }
  
  return null;
}

// Check if file has staged changes (for secondary indicator)
function hasStagedChanges(gitStatus: string): boolean {
  // Single-letter codes (committed changes) don't have separate staged state
  if (gitStatus.length === 1) {
    return false;
  }
  
  const index = gitStatus[0];
  return index !== ' ' && index !== '?' && index !== 'U';
}

const STATUS_CONFIG = {
  conflict: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    label: 'Merge conflict'
  },
  deleted: {
    icon: X,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    label: 'Deleted'
  },
  new: {
    icon: Plus,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    label: 'New file'
  },
  modified: {
    icon: Circle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    label: 'Modified'
  },
  staged: {
    icon: Check,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    label: 'Staged'
  }
};

export const StatusIcon: React.FC<StatusIconProps> = ({ 
  gitStatus, 
  size = 'sm',
  showTooltip = true,
  className = '',
  onClick,
  disabled,
  isLoading,
  category
}) => {
  // Get the base status from git status code (for icon type)
  const status = getPriorityStatus(gitStatus);
  if (!status) return null;
  
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  
  // Determine if we should show a status dot based on category
  let showStatusDot = false;
  let dotColor = '';
  let dotTitle = '';
  
  if (category && category !== 'committed') {
    showStatusDot = true;
    if (category === 'staged') {
      dotColor = 'bg-green-500';
      dotTitle = 'Staged';
    } else if (category === 'unstaged') {
      dotColor = 'bg-yellow-500';
      dotTitle = 'Unstaged';
    } else if (category === 'untracked') {
      dotColor = 'bg-red-500';
      dotTitle = 'Untracked';
    }
  }
  
  // Build tooltip text
  let tooltipText = config.label;
  if (gitStatus.length === 1) {
    tooltipText += ' (committed)';
  }
  if (category) {
    tooltipText = `${category.charAt(0).toUpperCase() + category.slice(1)} • ${tooltipText}`;
  }
  tooltipText += ` • ${gitStatus}`;
  
  // Add click hint to tooltip if clickable
  if (onClick && !disabled && !isLoading && category && category !== 'committed') {
    const action = category === 'staged' ? 'unstage' : 'stage';
    tooltipText = `Click to ${action} • ${tooltipText}`;
  }
  
  const iconContent = (
    <>
      <div className={`rounded p-1 ${config.bgColor}`}>
        {isLoading ? (
          <Loader2 className={`${sizeClasses} animate-spin text-gray-500`} />
        ) : (
          <Icon className={`${sizeClasses} ${config.color}`} strokeWidth={2} />
        )}
      </div>
      {showStatusDot && !isLoading && (
        <div 
          className={`absolute -top-0.5 -right-0.5 w-2 h-2 ${dotColor} rounded-full border border-white`}
          title={dotTitle}
        />
      )}
    </>
  );
  
  // If clickable, wrap in button
  if (onClick) {
    return (
      <button
        onClick={onClick}
        disabled={disabled || isLoading}
        className={`relative inline-flex items-center justify-center ${className} ${
          disabled || isLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-80 transition-opacity'
        }`}
        title={showTooltip ? tooltipText : undefined}
      >
        {iconContent}
      </button>
    );
  }
  
  // Otherwise, return as div
  return (
    <div 
      className={`relative inline-flex items-center justify-center ${className}`}
      title={showTooltip ? tooltipText : undefined}
    >
      {iconContent}
    </div>
  );
};

// Export for documentation/testing
export const STATUS_PRIORITY = [
  { status: 'conflict', example: 'UU', description: 'Merge conflicts need immediate attention' },
  { status: 'deleted', example: 'D ', description: 'Deleted files are important to notice' },
  { status: 'new', example: '??', description: 'New untracked files' },
  { status: 'modified', example: ' M', description: 'Unstaged modifications' },
  { status: 'staged', example: 'M ', description: 'Staged and ready to commit' }
];