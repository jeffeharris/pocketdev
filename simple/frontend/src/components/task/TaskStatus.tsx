import React from 'react';
import { GitBranch, CheckCircle, AlertCircle, Clock, Activity, User, GitMerge, XCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

/**
 * TaskStatus Component
 * 
 * Design Philosophy:
 * - Focus on the "jobs to be done" - what does the user need to know RIGHT NOW?
 * - Progressive disclosure - show only critical information by default
 * - Visual hierarchy - most important status gets prominence
 * - Mobile-first - must work well on small screens
 * 
 * Key Jobs to be Done:
 * 1. Know when AI needs my input (waiting state)
 * 2. Know when my task is out of sync with the codebase (behind/conflicts)
 * 3. Know when there are potential merge issues (conflicts)
 * 
 * What we DON'T show:
 * - Validation status (too subjective, can't be automatically determined)
 * - Phase/workflow states (implementation detail, not user-facing)
 * - Detailed git info when not actionable
 * 
 * Variants:
 * - compact (default): For sidebars, headers - shows only critical alerts
 * - inline: For task lists - minimal, scannable
 * - detailed: For expanded views - shows everything
 */
interface TaskStatusProps {
  workerStatus: string;
  gitStatus?: { 
    ahead: number; 
    behind: number; 
    hasConflicts: boolean; 
    staged?: number; 
    unstaged?: number; 
  };
  isMerged?: boolean;
  variant?: 'compact' | 'detailed' | 'inline';
}

export const TaskStatus: React.FC<TaskStatusProps> = ({ 
  workerStatus, 
  gitStatus,
  isMerged = false,
  variant = 'compact'
}) => {
  // Calculate common values once at the top to avoid redundant calculations
  // We combine staged and unstaged because users care about "do I have uncommitted work?"
  // more than the technical distinction between staged/unstaged
  const uncommittedTotal = (gitStatus?.staged || 0) + (gitStatus?.unstaged || 0);
  const hasUncommitted = uncommittedTotal > 0;
  
  // Job 1: When does AI need my input?
  // Simple boolean - either it's waiting or it's not. No ambiguity.
  const needsUserInput = workerStatus === 'waiting';
  
  // Job 2: Is my task out of sync?
  // Being "behind" means others have made changes we don't have yet
  // Having conflicts is a more severe form of being out of sync
  const isOutOfSync = gitStatus && (gitStatus.behind > 0 || gitStatus.hasConflicts);
  
  // Job 3: Are there merge issues?
  // Conflicts are the most critical status - they block progress entirely
  const hasMergeIssues = gitStatus?.hasConflicts;

  const workerConfig = {
    'not-started': { icon: Clock, label: 'Not Started', color: 'gray' },
    'idle': { icon: CheckCircle, label: 'Ready', color: 'blue' },
    'working': { icon: Activity, label: 'Working', color: 'yellow' },
    'waiting': { icon: User, label: 'Needs Input', color: 'purple', animate: true },
  };

  const worker = workerConfig[workerStatus] || workerConfig['not-started'];

  // Merged status overrides everything - once merged, nothing else matters
  // This provides closure and prevents confusion about what to do with a merged task
  if (isMerged) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        <GitMerge className="w-3 h-3" />
        Merged
      </div>
    );
  }

  // Inline variant for lists - maximum information density
  // Uses symbols instead of text, no borders/backgrounds to reduce visual noise
  // Priority: needs input > conflicts > behind > ahead > uncommitted
  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-1">
        {needsUserInput && (
          <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
        )}
        {hasMergeIssues && (
          <span className="text-red-600 text-xs">Conflicts</span>
        )}
        {!hasMergeIssues && gitStatus?.behind && gitStatus.behind > 0 && (
          <span className="text-orange-600 text-xs">↓{gitStatus.behind}</span>
        )}
        {gitStatus?.ahead && gitStatus.ahead > 0 && (
          <span className="text-green-600 text-xs">↑{gitStatus.ahead}</span>
        )}
        {hasUncommitted && (
          <span className="text-amber-600 text-xs">●{uncommittedTotal}</span>
        )}
      </div>
    );
  }

  // Detailed variant for expanded views - show everything with labels
  // Used when user has explicitly expanded a task and wants full context
  // Each status gets its own pill for maximum clarity
  if (variant === 'detailed') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className={clsx(
            'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
            needsUserInput 
              ? 'bg-purple-50 text-purple-700 border border-purple-200 animate-pulse'
              : `bg-${worker.color}-50 text-${worker.color}-700 border border-${worker.color}-200`
          )}>
            <worker.icon className="w-3 h-3" />
            {worker.label}
          </div>
        </div>
        
        {gitStatus && (
          <div className="flex flex-wrap gap-1">
            {gitStatus.hasConflicts && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                <AlertCircle className="w-3 h-3" />
                Conflicts
              </div>
            )}
            {gitStatus.behind > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                Behind {gitStatus.behind}
              </div>
            )}
            {gitStatus.ahead > 0 && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                Ahead {gitStatus.ahead}
              </div>
            )}
            {hasUncommitted && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                {gitStatus.staged > 0 && (
                  <>Staged: {gitStatus.staged}</>
                )}
                {gitStatus.staged > 0 && gitStatus.unstaged > 0 && ', '}
                {gitStatus.unstaged > 0 && (
                  <>Unstaged: {gitStatus.unstaged}</>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Compact variant (default) - Smart display based on priority
  // This is the most common view (sidebar, headers) so we optimize for:
  // 1. Always show worker status (user needs to know if AI is working)
  // 2. Show only the most important git status (conflicts > uncommitted > behind > ahead)
  // 3. Use visual hierarchy: worker state is primary, git state is secondary
  return (
    <div className="flex items-center gap-2">
      {/* Always show worker status */}
      <div className={clsx(
        'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
        needsUserInput 
          ? 'bg-purple-50 text-purple-700 border border-purple-200 animate-pulse'
          : `bg-${worker.color}-50 text-${worker.color}-700 border border-${worker.color}-200`
      )}>
        <worker.icon className="w-3 h-3" />
        {worker.label}
      </div>

      {/* Only show additional status if there's something important */}
      {gitStatus?.hasConflicts && (
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
          <AlertCircle className="w-3 h-3" />
          Conflicts
        </div>
      )}
      
      {/* Only show uncommitted changes if > 5 files to reduce noise
          Small changes (1-5 files) are normal during development
          Large changes (>5 files) might indicate user should commit */}
      {hasUncommitted && uncommittedTotal > 5 && (
        <div 
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200" 
          title={`${gitStatus?.staged || 0} staged, ${gitStatus?.unstaged || 0} unstaged files`}
        >
          <span>📝 {uncommittedTotal}</span>
        </div>
      )}
      
      {/* Behind status only shows if no conflicts (conflicts are more important)
          The !! converts to boolean to avoid React rendering "0" */}
      {!gitStatus?.hasConflicts && !!gitStatus?.behind && gitStatus.behind > 0 && (
        // TODO: Replace 'main' with actual base branch name from project config
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200" title={`${gitStatus.behind} commits behind main`}>
          <span>↓{gitStatus.behind}</span>
        </div>
      )}
      
      {!gitStatus?.hasConflicts && !!gitStatus?.ahead && gitStatus.ahead > 0 && (
        // TODO: Replace 'main' with actual base branch name from project config
        <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200" title={`${gitStatus.ahead} commits ahead of main`}>
          <span>↑{gitStatus.ahead}</span>
        </div>
      )}
    </div>
  );
};