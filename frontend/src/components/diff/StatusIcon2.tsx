import React from 'react';
import { Check, Circle, Plus, X, AlertCircle } from 'lucide-react';

// Simpler approach: What view are you looking at?
export type ViewStatus = 'staged' | 'unstaged' | 'both';

interface StatusIcon2Props {
  gitStatus: string;
  viewMode: 'working' | 'all' | 'base'; // What view we're in
  size?: 'sm' | 'md';
  className?: string;
}

// Determine what we're showing based on git status and view mode
function getViewStatus(gitStatus: string, viewMode: string): ViewStatus | null {
  const [index, workTree] = [gitStatus[0], gitStatus[1]];
  
  // Skip unmodified files
  if (gitStatus === '  ') return null;
  
  const hasStaged = index !== ' ' && index !== '?';
  const hasUnstaged = workTree !== ' ' && workTree !== '?';
  
  if (viewMode === 'working') {
    // In working view, we only show unstaged changes
    return hasUnstaged ? 'unstaged' : null;
  } else if (viewMode === 'all' || viewMode === 'base') {
    // In all/base view, show what the file has
    if (hasStaged && hasUnstaged) return 'both';
    if (hasStaged) return 'staged';
    if (hasUnstaged) return 'unstaged';
  }
  
  return null;
}

// Get the specific file state (conflict, deleted, etc)
function getFileState(gitStatus: string): string {
  // Conflicts are always important to show
  if (gitStatus.includes('U') || gitStatus === 'AA' || gitStatus === 'DD') {
    return 'conflict';
  }
  
  // Deleted files
  if (gitStatus.includes('D')) {
    return 'deleted';
  }
  
  // New files
  if (gitStatus === '??') {
    return 'new';
  }
  
  return 'modified';
}

const VIEW_INDICATORS = {
  staged: {
    icon: Check,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    label: 'Staged'
  },
  unstaged: {
    icon: Circle,
    color: 'text-yellow-600', 
    bgColor: 'bg-yellow-50',
    label: 'Unstaged'
  },
  both: {
    // Show both icons side by side
    icons: [Check, Circle],
    color: 'text-blue-600',
    bgColor: 'bg-blue-50', 
    label: 'Staged + Unstaged'
  }
};

const STATE_COLORS = {
  conflict: 'text-red-600',
  deleted: 'text-red-600',
  new: 'text-purple-600',
  modified: '' // Use default from view
};

export const StatusIcon2: React.FC<StatusIcon2Props> = ({ 
  gitStatus, 
  viewMode,
  size = 'sm',
  className = '' 
}) => {
  const viewStatus = getViewStatus(gitStatus, viewMode);
  if (!viewStatus) return null;
  
  const fileState = getFileState(gitStatus);
  const indicator = VIEW_INDICATORS[viewStatus];
  const stateColor = STATE_COLORS[fileState];
  
  const sizeClasses = size === 'sm' ? 'h-5' : 'h-6';
  const iconSize = size === 'sm' ? 14 : 16;
  
  // Special case for conflict - always show alert icon
  if (fileState === 'conflict') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className={`${sizeClasses} px-1.5 rounded ${indicator.bgColor} flex items-center gap-1`}>
          <AlertCircle className={`w-4 h-4 text-red-600`} strokeWidth={2} />
        </div>
      </div>
    );
  }
  
  // For "both" status, show two icons
  if (viewStatus === 'both' && 'icons' in indicator) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className={`${sizeClasses} px-1.5 rounded ${indicator.bgColor} flex items-center gap-0.5`}>
          {indicator.icons.map((Icon, i) => (
            <Icon 
              key={i} 
              className={`w-3.5 h-3.5 ${stateColor || indicator.color}`} 
              strokeWidth={2} 
            />
          ))}
        </div>
      </div>
    );
  }
  
  // Single icon
  const Icon = 'icon' in indicator ? indicator.icon : Circle;
  const color = stateColor || indicator.color;
  
  return (
    <div className={`inline-flex items-center ${className}`}>
      <div className={`${sizeClasses} px-1.5 rounded ${indicator.bgColor} flex items-center`}>
        <Icon className={`w-4 h-4 ${color}`} strokeWidth={2} />
      </div>
    </div>
  );
};

// Simplified legend for the UI
export const STATUS_LEGEND = {
  working: [
    { icon: Circle, label: 'Unstaged changes', color: 'text-yellow-600' },
    { icon: Plus, label: 'Untracked file', color: 'text-purple-600' },
  ],
  all: [
    { icon: Check, label: 'Staged only', color: 'text-green-600' },
    { icon: Circle, label: 'Unstaged only', color: 'text-yellow-600' },
    { icons: [Check, Circle], label: 'Both staged & unstaged', color: 'text-blue-600' },
  ],
  base: [
    { icon: Check, label: 'Committed changes', color: 'text-green-600' },
  ]
};