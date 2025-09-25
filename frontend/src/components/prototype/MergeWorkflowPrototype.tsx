import React, { useState, useEffect, useRef } from 'react';
import { GitBranch, CheckCircle, AlertCircle, Clock, Activity, User, FileCheck, ArrowRight, GitMerge, GitPullRequest, FileText, RefreshCw, MessageSquare, FileEdit, Edit3, Sparkles, FolderSync, RotateCcw, AlertTriangle, Copy, Archive, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { TaskStatus } from '../task/TaskStatus';
import { WorkerStatus } from '@shared/types';
import { useShortcutContext, useKeyboardShortcut } from '../../hooks/keyboard';

// Mock data for different task states
const mockTasks = [
  {
    id: '1',
    name: 'Add user authentication',
    branch: 'feat/user-auth',
    workerStatus: 'idle',
    phase: 'generate',
    gitStatus: { ahead: 5, behind: 0, hasConflicts: false, staged: 3, unstaged: 9 },
    isMerged: false
  },
  {
    id: '2',
    name: 'Fix navigation bug',
    branch: 'fix/nav-bug',
    workerStatus: 'working',
    phase: 'validate',
    gitStatus: { ahead: 2, behind: 3, hasConflicts: false, staged: 0, unstaged: 0 },
    isMerged: false
  },
  {
    id: '3',
    name: 'Update documentation',
    branch: 'chore/update-docs',
    workerStatus: 'waiting',
    phase: 'merge',
    gitStatus: { ahead: 1, behind: 0, hasConflicts: true, staged: 0, unstaged: 3 },
    isMerged: false
  },
  {
    id: '4',
    name: 'Implement dark mode',
    branch: 'feat/dark-mode',
    workerStatus: 'not-started',
    phase: 'generate',
    gitStatus: { ahead: 0, behind: 5, hasConflicts: false, staged: 0, unstaged: 0 },
    isMerged: false
  },
  {
    id: '5',
    name: 'Fix login issue',
    branch: 'fix/login-issue',
    workerStatus: 'idle',
    phase: 'merge',
    gitStatus: { ahead: 0, behind: 0, hasConflicts: false, staged: 0, unstaged: 0 },
    isMerged: true
  }
];

// Enhanced TaskStatus Component - Focused on real jobs
interface TaskStatusProps {
  workerStatus: string;
  gitStatus?: { ahead: number; behind: number; hasConflicts: boolean; staged?: number; unstaged?: number };
  isMerged?: boolean;
  variant?: 'compact' | 'detailed' | 'inline';
}

const TaskStatusPrototype: React.FC<TaskStatusProps> = ({ 
  workerStatus, 
  gitStatus,
  isMerged = false,
  variant = 'compact'
}) => {
  // Calculate common values once
  const uncommittedTotal = (gitStatus?.staged || 0) + (gitStatus?.unstaged || 0);
  const hasUncommitted = uncommittedTotal > 0;
  
  // Job 1: When does AI need my input?
  const needsUserInput = workerStatus === 'waiting';
  
  // Job 2: Is my task out of sync?
  // TODO: isOutOfSync was commented out to fix TS6133 (unused variable) error
  // This logic may need to be re-incorporated when implementing the full UI
  // It checks if a task is behind the main branch or has conflicts
  // const isOutOfSync = gitStatus && (gitStatus.behind > 0 || gitStatus.hasConflicts);
  
  // Job 3: Are there merge issues?
  const hasMergeIssues = gitStatus?.hasConflicts;

  const workerConfig = {
    'not-started': { icon: Clock, label: 'Not Started', color: 'gray' },
    'idle': { icon: CheckCircle, label: 'Ready', color: 'blue' },
    'working': { icon: Activity, label: 'Working', color: 'yellow' },
    'waiting': { icon: User, label: 'Needs Input', color: 'purple', animate: true },
  };

  const worker = workerConfig[workerStatus as keyof typeof workerConfig] || workerConfig['not-started'];

  // Merged status overrides everything
  if (isMerged) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
        <GitMerge className="w-3 h-3" />
        Merged
      </div>
    );
  }

  if (variant === 'inline') {
    // Priority: Conflicts > Uncommitted > Needs Input > Behind > Working > Ready
    const hasUncommitted = gitStatus && ((gitStatus.staged || 0) + (gitStatus.unstaged || 0)) > 0;
    
    if (hasMergeIssues) {
      return <span className="text-xs text-red-600 font-medium">⚠️ Conflicts</span>;
    }
    if (hasUncommitted) {
      const total = (gitStatus.staged || 0) + (gitStatus.unstaged || 0);
      return <span className="text-xs text-amber-600" title={`${gitStatus.staged || 0} staged, ${gitStatus.unstaged || 0} unstaged`}>📝 {total} uncommitted</span>;
    }
    if (needsUserInput) {
      return <span className="text-xs text-purple-600 font-medium animate-pulse">👤 Needs Input</span>;
    }
    if (gitStatus && gitStatus.behind > 0) {
      // TODO: Replace 'main' with actual base branch name from project config
      return <span className="text-xs text-red-600" title={`${gitStatus.behind} commits behind main`}>↓{gitStatus.behind}</span>;
    }
    if (workerStatus === 'working') {
      return <span className="text-xs text-yellow-600">⚡ Working</span>;
    }
    return <span className="text-xs text-blue-600">✓ {worker.label}</span>;
  }

  if (variant === 'detailed') {
    return (
      <div className="space-y-2">
        {/* Worker Status */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-20">AI Status:</span>
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

        {/* Git Sync Status */}
        {gitStatus && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20">Branch:</span>
            <div className="flex items-center gap-2">
              {gitStatus.hasConflicts ? (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                  <AlertCircle className="w-3 h-3" />
                  Has Conflicts
                </div>
              ) : (
                <>
                  {gitStatus.behind > 0 && (
                    // TODO: Replace 'main' with actual base branch name from project config
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200" title={`${gitStatus.behind} commits behind main`}>
                      <span>↓{gitStatus.behind}</span>
                    </div>
                  )}
                  {gitStatus.ahead > 0 && (
                    // TODO: Replace 'main' with actual base branch name from project config
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200" title={`${gitStatus.ahead} commits ahead of main`}>
                      <span>↑{gitStatus.ahead}</span>
                    </div>
                  )}
                  {gitStatus.ahead === 0 && gitStatus.behind === 0 && (
                    <span className="text-xs text-green-600">Up to date</span>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Compact variant (default) - Smart display based on priority
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
      
      {hasUncommitted && uncommittedTotal > 5 && (
        <div 
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200" 
          title={`${gitStatus?.staged || 0} staged, ${gitStatus?.unstaged || 0} unstaged files`}
        >
          <span>📝 {uncommittedTotal}</span>
        </div>
      )}
      
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

// Main Prototype Component
// Tailwind classes used: hover:bg-amber-700 hover:bg-orange-700 hover:bg-gray-100 hover:scale-105 hover:shadow-xl
export const MergeWorkflowPrototype: React.FC = () => {
  const [selectedTask, setSelectedTask] = useState(mockTasks[0]);
  const [statusVariant, setStatusVariant] = useState<'compact' | 'detailed' | 'inline'>('compact');
  const [useEnhancedStatus, setUseEnhancedStatus] = useState(true);
  const [showTaskMenu, setShowTaskMenu] = useState(false);
  const [showUpdateOptions, setShowUpdateOptions] = useState(false);
  const [showCommitOptions, setShowCommitOptions] = useState(false);
  const [selectedDropdownOption, setSelectedDropdownOption] = useState(0);

  // Refs for dropdown click outside handling
  const taskMenuRef = useRef<HTMLDivElement>(null);
  const updateOptionsRef = useRef<HTMLDivElement>(null);
  const commitOptionsRef = useRef<HTMLDivElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  
  // Activate merge workflow keyboard context
  useShortcutContext('mergeWorkflow');

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (taskMenuRef.current && !taskMenuRef.current.contains(event.target as Node)) {
        setShowTaskMenu(false);
      }
      if (updateOptionsRef.current && !updateOptionsRef.current.contains(event.target as Node)) {
        setShowUpdateOptions(false);
      }
      if (commitOptionsRef.current && !commitOptionsRef.current.contains(event.target as Node)) {
        setShowCommitOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation - Dropdown navigation
  const dropdownIsOpen = showCommitOptions || showUpdateOptions;
  const optionCount = showCommitOptions ? 4 : showUpdateOptions ? 4 : 0;
  
  useKeyboardShortcut('arrowup', () => {
    if (dropdownIsOpen && selectedDropdownOption > 0) {
      setSelectedDropdownOption(selectedDropdownOption - 1);
    } else {
      const currentIndex = mockTasks.findIndex(task => task.id === selectedTask.id);
      if (currentIndex > 0) {
        setSelectedTask(mockTasks[currentIndex - 1]);
      }
    }
  }, {
    contexts: ['mergeWorkflow'],
    description: dropdownIsOpen ? 'Previous option' : 'Previous task',
    enabled: true,
    preventDefault: true
  });
  
  useKeyboardShortcut('arrowdown', () => {
    if (dropdownIsOpen && selectedDropdownOption < optionCount - 1) {
      setSelectedDropdownOption(selectedDropdownOption + 1);
    } else {
      const currentIndex = mockTasks.findIndex(task => task.id === selectedTask.id);
      if (currentIndex < mockTasks.length - 1) {
        setSelectedTask(mockTasks[currentIndex + 1]);
      }
    }
  }, {
    contexts: ['mergeWorkflow'],
    description: dropdownIsOpen ? 'Next option' : 'Next task',
    enabled: true,
    preventDefault: true
  });
  
  useKeyboardShortcut('arrowright', () => {
    if (!dropdownIsOpen) {
      // Open the appropriate dropdown based on task state
      if (selectedTask.gitStatus?.staged > 0 || selectedTask.gitStatus?.unstaged > 0) {
        setShowCommitOptions(true);
        setSelectedDropdownOption(0);
      } else if (selectedTask.gitStatus?.behind > 0) {
        setShowUpdateOptions(true);
        setSelectedDropdownOption(0);
      }
    }
  }, {
    contexts: ['mergeWorkflow'],
    description: 'Open action menu',
    enabled: !dropdownIsOpen,
    preventDefault: true
  });
  
  useKeyboardShortcut('arrowleft', () => {
    // Close any open dropdown
    setShowCommitOptions(false);
    setShowUpdateOptions(false);
  }, {
    contexts: ['mergeWorkflow'],
    description: 'Close action menu',
    enabled: dropdownIsOpen,
    preventDefault: true
  });
  
  useKeyboardShortcut('enter', () => {
    if (dropdownIsOpen) {
      // Execute the selected option
      console.log('Execute option:', selectedDropdownOption);
      setShowCommitOptions(false);
      setShowUpdateOptions(false);
    } else {
      // Execute the primary action for the current task
      if (selectedTask.gitStatus?.hasConflicts) {
        console.log('Execute: Resolve Conflicts');
      } else if (selectedTask.gitStatus?.staged > 0 || selectedTask.gitStatus?.unstaged > 0) {
        console.log('Execute: Commit Staged/Stage & Commit');
      } else if (selectedTask.gitStatus?.behind > 0) {
        console.log('Execute: Update Branch (Merge)');
      } else if (selectedTask.gitStatus?.ahead > 0) {
        console.log('Execute: Create Pull Request');
      }
    }
  }, {
    contexts: ['mergeWorkflow'],
    description: dropdownIsOpen ? 'Select option' : 'Execute action',
    enabled: true
  });
  
  useKeyboardShortcut('escape', () => {
    setShowCommitOptions(false);
    setShowUpdateOptions(false);
  }, {
    contexts: ['mergeWorkflow'],
    description: 'Close menu',
    enabled: dropdownIsOpen
  });

  // Scroll selected task into view
  useEffect(() => {
    if (taskListRef.current) {
      const selectedElement = taskListRef.current.querySelector(`[data-task-id="${selectedTask.id}"]`) as HTMLElement;
      if (selectedElement) {
        const container = taskListRef.current;
        const elementRect = selectedElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Check if element is fully visible
        const isFullyVisible = 
          elementRect.top >= containerRect.top &&
          elementRect.bottom <= containerRect.bottom;
        
        if (!isFullyVisible) {
          // Add some padding to ensure the focus ring is visible
          const scrollPadding = 8; // pixels
          
          if (elementRect.top < containerRect.top) {
            // Scrolling up
            container.scrollTop -= (containerRect.top - elementRect.top) + scrollPadding;
          } else if (elementRect.bottom > containerRect.bottom) {
            // Scrolling down
            container.scrollTop += (elementRect.bottom - containerRect.bottom) + scrollPadding;
          }
        }
      }
    }
  }, [selectedTask]);

  // TODO: getWorkerStatus was commented out to fix TS6133 (unused variable) error
  // This mapping function may be needed if string statuses need to be converted to WorkerStatus enums
  // const getWorkerStatus = (status: string): WorkerStatus => {
  //   const mapping: Record<string, WorkerStatus> = {
  //     'not-started': WorkerStatus.NotStarted,
  //     'idle': WorkerStatus.Idle,
  //     'working': WorkerStatus.Working,
  //     'waiting': WorkerStatus.Waiting,
  //   };
  //   return mapping[status] || WorkerStatus.NotStarted;
  // };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Hidden div to ensure Tailwind generates these classes */}
      <div className="hidden hover:bg-amber-700 hover:bg-orange-700 hover:bg-gray-100 hover:bg-red-50 hover:scale-105 hover:shadow-xl" />
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Merge Workflow & TaskStatus Prototype</h1>
          <p className="text-gray-600">Comparing current TaskStatus with enhanced version</p>
          <a href="/prototype/merge-states" className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block">
            → View Merge States Diagram
          </a>
          {/* Test button with inline styles */}
          <button 
            style={{ 
              marginTop: '10px',
              padding: '10px 20px',
              backgroundColor: '#3B82F6',
              color: 'white',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563EB';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3B82F6';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Test Hover (Inline Styles)
          </button>
        </div>

        {/* Component Toggle */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Component Version</h2>
          <div className="flex gap-6 mb-6">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="component"
                checked={!useEnhancedStatus}
                onChange={() => setUseEnhancedStatus(false)}
              />
              <span className="font-medium">Current TaskStatus</span>
              <span className="text-sm text-gray-500">(Worker status only)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="component"
                checked={useEnhancedStatus}
                onChange={() => setUseEnhancedStatus(true)}
              />
              <span className="font-medium">Enhanced TaskStatus</span>
              <span className="text-sm text-gray-500">(With git status and merge readiness)</span>
            </label>
          </div>

          {useEnhancedStatus && (
            <>
              <h3 className="text-sm font-semibold mb-2 text-gray-700">Display Variants</h3>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="variant"
                    value="compact"
                    checked={statusVariant === 'compact'}
                    onChange={(e) => setStatusVariant(e.target.value as any)}
                  />
                  <span>Compact</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="variant"
                    value="detailed"
                    checked={statusVariant === 'detailed'}
                    onChange={(e) => setStatusVariant(e.target.value as any)}
                  />
                  <span>Detailed</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="variant"
                    value="inline"
                    checked={statusVariant === 'inline'}
                    onChange={(e) => setStatusVariant(e.target.value as any)}
                  />
                  <span>Inline</span>
                </label>
              </div>
            </>
          )}
        </div>

        {/* Use Case Examples */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Status Display Use Cases</h2>
          
          {/* Use Case 1: Sidebar Header */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">1. Sidebar Task Header (Limited Space)</h3>
            <div className="bg-gray-50 p-3 rounded max-w-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">Add user auth</span>
                {useEnhancedStatus ? (
                  // Only show worker status + most critical indicator
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <TaskStatusPrototype
                      workerStatus={selectedTask.workerStatus}
                      gitStatus={selectedTask.gitStatus}
                      variant={statusVariant}
                    />
                  </div>
                ) : (
                  <TaskStatus workerStatus={selectedTask.workerStatus} />
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Shows worker status + only critical alerts (conflicts)</p>
          </div>

          {/* Use Case 2: Task List */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">2. Task List Item (Scannable)</h3>
            <div className="bg-gray-50 p-2 rounded max-w-md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Fix navigation bug</div>
                  <div className="text-xs text-gray-500">fix/nav-bug</div>
                </div>
                {useEnhancedStatus ? (
                  <TaskStatusPrototype
                    workerStatus="working"
                    gitStatus={{ ahead: 2, behind: 0, hasConflicts: false }}
                    variant="inline"
                  />
                ) : (
                  <TaskStatus workerStatus={WorkerStatus.Working} />
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Minimal text-only status for quick scanning</p>
          </div>

          {/* Use Case 3: Task Detail View */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">3. Task Detail Panel (Full Context)</h3>
            <div className="bg-gray-50 p-4 rounded max-w-sm">
              {useEnhancedStatus ? (
                <TaskStatusPrototype
                  workerStatus={selectedTask.workerStatus}
                  gitStatus={selectedTask.gitStatus}
                  variant="detailed"
                />
              ) : (
                <div>
                  <span className="text-sm text-gray-600">Status: </span>
                  <TaskStatus workerStatus={selectedTask.workerStatus} />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">All status information with labels for clarity</p>
          </div>

          {/* Use Case 4: Job-Focused Display */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">4. Focused on Real Jobs (Proposed)</h3>
            <div className="space-y-3">
              {/* Job 1: AI needs my input */}
              <div>
                <p className="text-xs text-gray-600 mb-1">Job: "I need to know when AI needs my input"</p>
                <div className="bg-gray-50 p-3 rounded max-w-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Review changes task</span>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 animate-pulse">
                        <User className="w-3 h-3" />
                        Needs Input
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Job 2: Out of sync with codebase */}
              <div>
                <p className="text-xs text-gray-600 mb-1">Job: "I need to see when task is out of sync"</p>
                <div className="bg-gray-50 p-3 rounded max-w-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Feature task</span>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        <CheckCircle className="w-3 h-3" />
                        Ready
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200" title="5 commits behind main">
                        <span>↓5</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Job 3: Merge conflicts warning */}
              <div>
                <p className="text-xs text-gray-600 mb-1">Job: "I need to know about merge conflicts"</p>
                <div className="bg-gray-50 p-3 rounded max-w-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Refactor task</span>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                        <Activity className="w-3 h-3" />
                        Working
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                        <AlertCircle className="w-3 h-3" />
                        Conflicts
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Merged state */}
              <div>
                <p className="text-xs text-gray-600 mb-1">Completed task</p>
                <div className="bg-gray-50 p-3 rounded max-w-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Login fix</span>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                        <GitMerge className="w-3 h-3" />
                        Merged
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Focus: Show AI attention needs, sync status, and merge readiness</p>
          </div>
        </div>

        {/* Side by Side Comparison */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Component Comparison</h2>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Current TaskStatus</h3>
              <div className="space-y-3">
                {mockTasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">{task.name}</span>
                    <TaskStatus workerStatus={task.workerStatus} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Enhanced TaskStatus (Compact)</h3>
              <div className="space-y-3">
                {mockTasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">{task.name}</span>
                    <TaskStatusPrototype
                      workerStatus={task.workerStatus}
                      gitStatus={task.gitStatus}
                      variant={statusVariant}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Detailed View */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Selected Task Details</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">{selectedTask.name}</h3>
              <p className="text-sm text-gray-500">{selectedTask.branch}</p>
            </div>
            
            {useEnhancedStatus ? (
              <TaskStatusPrototype
                workerStatus={selectedTask.workerStatus}
                gitStatus={selectedTask.gitStatus}
                variant="detailed"
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Worker Status:</span>
                <TaskStatus workerStatus={selectedTask.workerStatus} />
              </div>
            )}

            {/* Action Buttons based on phase */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Available Actions</h4>
              <div className="flex gap-2">
                {selectedTask.phase === 'generate' && (
                  <>
                    <button className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
                      Open Terminal
                    </button>
                    <button className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700">
                      Start Validation
                    </button>
                  </>
                )}
                {selectedTask.phase === 'validate' && (
                  <>
                    <button className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700">
                      View Preview
                    </button>
                    <button className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">
                      Proceed to Merge
                    </button>
                  </>
                )}
                {selectedTask.phase === 'merge' && (
                  <>
                    <button className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700">
                      <GitPullRequest className="w-4 h-4 inline mr-1" />
                      Create PR
                    </button>
                    <button className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">
                      <GitMerge className="w-4 h-4 inline mr-1" />
                      Merge Now
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Phase Flow Visualization */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Task Phase Flow</h2>
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <div className={clsx(
                "w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2",
                selectedTask.phase === 'generate' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"
              )}>
                <Activity className="w-8 h-8" />
              </div>
              <div className="text-sm font-medium">Generate</div>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <div className="flex-1 text-center">
              <div className={clsx(
                "w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2",
                selectedTask.phase === 'validate' ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-400"
              )}>
                <FileCheck className="w-8 h-8" />
              </div>
              <div className="text-sm font-medium">Validate</div>
            </div>
            <ArrowRight className="w-6 h-6 text-gray-400" />
            <div className="flex-1 text-center">
              <div className={clsx(
                "w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-2",
                selectedTask.phase === 'merge' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
              )}>
                <GitBranch className="w-8 h-8" />
              </div>
              <div className="text-sm font-medium">Merge</div>
            </div>
          </div>
        </div>

        {/* Realistic TaskWorkspace Layout */}
        <div className="bg-gray-100 rounded-lg shadow-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Realistic TaskWorkspace Layout</h2>
          <div className="bg-white rounded shadow-sm overflow-hidden" style={{ height: '600px' }}>
            {/* Main Header Bar */}
            <div className="h-14 bg-gray-800 text-white flex items-center justify-between px-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">Project:</span>
                <span className="font-medium">PocketDev</span>
                <span className="text-gray-500">/</span>
                <span className="text-sm">Task #{selectedTask.id}</span>
              </div>
              
              {/* Task Actions Menu */}
              <div className="relative" ref={taskMenuRef}>
                <button 
                  className="p-2 hover:bg-gray-700 rounded transition-colors" 
                  title="Task Actions"
                  onClick={() => setShowTaskMenu(!showTaskMenu)}
                >
                  <span className="text-gray-400">•••</span>
                </button>
                
                {/* Dropdown menu */}
                {showTaskMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer">
                        <Copy className="w-4 h-4 opacity-60" />
                        Copy Branch Name
                      </button>
                      <div className="border-t border-gray-100 my-1"></div>
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer">
                        <RotateCcw className="w-4 h-4 opacity-60" />
                        Reset to Last Commit
                      </button>
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer">
                        <RefreshCw className="w-4 h-4 opacity-60" />
                        Reset to Previous Commit...
                      </button>
                      <button className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 cursor-pointer">
                        <AlertTriangle className="w-4 h-4 opacity-60" />
                        Discard All Changes
                      </button>
                      <div className="border-t border-gray-100 my-1"></div>
                      <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2 cursor-pointer">
                        <Archive className="w-4 h-4 opacity-60" />
                        Archive Task
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex h-[calc(100%-3.5rem)]">
              {/* Sidebar */}
              <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                {/* Current Task Details */}
                <div className="p-4 border-b border-gray-200">
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="font-semibold text-gray-900 text-sm">#{selectedTask.id.slice(-3)} {selectedTask.name}</h2>
                    </div>
                    <div className="flex items-center justify-end">
                      {useEnhancedStatus ? (
                        <TaskStatusPrototype
                          workerStatus={selectedTask.workerStatus}
                              gitStatus={selectedTask.gitStatus}
                          variant={statusVariant}
                        />
                      ) : (
                        <TaskStatus workerStatus={selectedTask.workerStatus} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Repository Status */}
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2 text-sm">
                    <GitBranch className="w-4 h-4" />
                    {selectedTask.branch}
                  </h3>
                  
                  {/* Git Status */}
                  <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                    {useEnhancedStatus && selectedTask.gitStatus ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">Working Tree</span>
                          <div className="flex items-center gap-1">
                            {selectedTask.gitStatus.hasConflicts ? (
                              <>
                                <AlertCircle className="w-3 h-3 text-red-500" />
                                <span className="text-xs text-red-700">Conflicts</span>
                              </>
                            ) : (selectedTask.gitStatus.staged > 0 || selectedTask.gitStatus.unstaged > 0) ? (
                              <>
                                <FileText className="w-3 h-3 text-amber-500" />
                                <span className="text-xs text-amber-700">Modified</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3 text-green-500" />
                                <span className="text-xs text-green-700">Clean</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">Branch Status</span>
                          <div className="text-xs">
                            {selectedTask.gitStatus.behind > 0 && (
                              <span className="text-orange-600">{selectedTask.gitStatus.behind} behind</span>
                            )}
                            {selectedTask.gitStatus.ahead > 0 && selectedTask.gitStatus.behind > 0 && ' • '}
                            {selectedTask.gitStatus.ahead > 0 && (
                              <span className="text-blue-600">{selectedTask.gitStatus.ahead} ahead</span>
                            )}
                            {selectedTask.gitStatus.ahead === 0 && selectedTask.gitStatus.behind === 0 && (
                              <span className="text-green-600">Up to date</span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">Changes</span>
                          <div className="text-xs">
                            {(selectedTask.gitStatus.staged > 0 || selectedTask.gitStatus.unstaged > 0) ? (
                              <>
                                {selectedTask.gitStatus.staged > 0 && (
                                  <span className="text-green-600">{selectedTask.gitStatus.staged} staged</span>
                                )}
                                {selectedTask.gitStatus.staged > 0 && selectedTask.gitStatus.unstaged > 0 && ' • '}
                                {selectedTask.gitStatus.unstaged > 0 && (
                                  <span className="text-amber-600">{selectedTask.gitStatus.unstaged} unstaged</span>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-500">No changes</span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      // Current version - static display
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">Working Tree</span>
                          <span className="text-xs text-green-700">Clean</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-700">Branch Status</span>
                          <span className="text-xs text-green-700">Up to date</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Git Actions - Dynamic based on state */}
                  <div className="space-y-2 mt-3">
                    {useEnhancedStatus ? (
                      // Enhanced version - context-aware buttons
                      <>
                        {/* Context-aware diff button - always present for layout stability */}
                        <button 
                          className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm transition-all duration-200 cursor-pointer hover:bg-gray-100 hover:border-gray-400 hover:shadow-md"
                          title={
                            selectedTask.gitStatus?.hasConflicts ? "View merge conflicts" :
                            selectedTask.isMerged ? "View merge commit" :
                            ((selectedTask.gitStatus?.staged || 0) > 0 || (selectedTask.gitStatus?.unstaged || 0) > 0) ? "View uncommitted changes" :
                            (selectedTask.gitStatus?.ahead || 0) > 0 ? "View branch changes vs base" :
                            "No changes to view"
                          }
                        >
                          <FileText className="w-4 h-4" />
                          {selectedTask.gitStatus?.hasConflicts ? "View Conflicts" :
                           selectedTask.isMerged ? "View Merge Commit" :
                           ((selectedTask.gitStatus?.staged || 0) > 0 || (selectedTask.gitStatus?.unstaged || 0) > 0) ? "View Uncommitted Changes" :
                           (selectedTask.gitStatus?.ahead || 0) > 0 ? "View Branch Changes" :
                           "View Changes"}
                        </button>

                        {/* Context-specific primary action */}
                        {selectedTask.gitStatus?.hasConflicts ? (
                          <button className="w-full flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors cursor-pointer">
                            <AlertCircle className="w-4 h-4" />
                            Resolve Conflicts
                          </button>
                        ) : (selectedTask.gitStatus?.staged || 0) > 0 || (selectedTask.gitStatus?.unstaged || 0) > 0 ? (
                          <div className="relative" ref={commitOptionsRef}>
                            <div className="flex">
                              <button className="flex-1 flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-l-lg text-sm hover:bg-amber-500 hover:scale-105 transition-all duration-200 hover:shadow-xl active:scale-95 cursor-pointer">
                                <GitBranch className="w-4 h-4" />
                                {selectedTask.gitStatus?.staged > 0 
                                  ? `Commit Staged (${selectedTask.gitStatus.staged} files)`
                                  : `Stage & Commit (${selectedTask.gitStatus.unstaged} files)`
                                }
                              </button>
                              <button 
                                className="px-2 py-2 bg-amber-600 text-white rounded-r-lg text-sm hover:bg-amber-700 hover:scale-[1.02] transition-all duration-200 border-l border-amber-500 active:scale-[0.98] cursor-pointer"
                                onClick={() => setShowCommitOptions(!showCommitOptions)}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                            {showCommitOptions && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-amber-600 rounded-lg shadow-lg overflow-hidden z-10">
                                <button className={clsx(
                                  "w-full text-left px-3 py-2 text-sm text-white transition-colors flex items-center gap-2 cursor-pointer",
                                  selectedDropdownOption === 0 ? "bg-amber-700" : "hover:bg-amber-700"
                                )}>
                                  <MessageSquare className="w-4 h-4 opacity-80" />
                                  Commit with Message...
                                </button>
                                <button className={clsx(
                                  "w-full text-left px-3 py-2 text-sm text-white transition-colors flex items-center gap-2 cursor-pointer",
                                  selectedDropdownOption === 1 ? "bg-amber-700" : "hover:bg-amber-700"
                                )}>
                                  <FileEdit className="w-4 h-4 opacity-80" />
                                  Stage All & Commit
                                </button>
                                <button className={clsx(
                                  "w-full text-left px-3 py-2 text-sm text-white transition-colors flex items-center gap-2 cursor-pointer",
                                  selectedDropdownOption === 2 ? "bg-amber-700" : "hover:bg-amber-700"
                                )}>
                                  <Sparkles className="w-4 h-4 opacity-80" />
                                  AI-Assisted Stage & Commit
                                </button>
                                <button className={clsx(
                                  "w-full text-left px-3 py-2 text-sm text-white transition-colors flex items-center gap-2 cursor-pointer",
                                  selectedDropdownOption === 3 ? "bg-amber-700" : "hover:bg-amber-700"
                                )}>
                                  <Edit3 className="w-4 h-4 opacity-80" />
                                  Amend Last Commit
                                </button>
                              </div>
                            )}
                          </div>
                        ) : selectedTask.gitStatus?.behind && selectedTask.gitStatus.behind > 0 ? (
                          <div className="relative" ref={updateOptionsRef}>
                            <div className="flex">
                              <button className="flex-1 flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-l-lg text-sm hover:bg-orange-700 hover:scale-[1.02] transition-all duration-200 hover:shadow-lg active:scale-[0.98] cursor-pointer">
                                <RefreshCw className="w-4 h-4" />
                                Update Branch (Merge)
                              </button>
                              <button 
                                className="px-2 py-2 bg-orange-600 text-white rounded-r-lg text-sm hover:bg-orange-700 hover:scale-[1.02] transition-all duration-200 border-l border-orange-500 active:scale-[0.98] cursor-pointer"
                                onClick={() => setShowUpdateOptions(!showUpdateOptions)}
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                            {showUpdateOptions && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-orange-600 rounded-lg shadow-lg overflow-hidden z-10">
                                <button className={clsx(
                                  "w-full text-left px-3 py-2 text-sm text-white transition-colors flex items-center justify-between cursor-pointer",
                                  selectedDropdownOption === 0 ? "bg-orange-700" : "hover:bg-orange-700"
                                )}>
                                  <div className="flex items-center gap-2">
                                    <GitMerge className="w-4 h-4 opacity-80" />
                                    <span>Merge from main</span>
                                  </div>
                                  <span className="text-xs opacity-60">Default</span>
                                </button>
                                <button className={clsx(
                                  "w-full text-left px-3 py-2 text-sm text-white transition-colors flex items-center gap-2 cursor-pointer",
                                  selectedDropdownOption === 1 ? "bg-orange-700" : "hover:bg-orange-700"
                                )}>
                                  <FolderSync className="w-4 h-4 opacity-80" />
                                  Rebase on main
                                </button>
                                <button className={clsx(
                                  "w-full text-left px-3 py-2 text-sm text-white transition-colors flex items-center gap-2 cursor-pointer",
                                  selectedDropdownOption === 2 ? "bg-orange-700" : "hover:bg-orange-700"
                                )}>
                                  <Sparkles className="w-4 h-4 opacity-80" />
                                  AI-Assisted Update
                                </button>
                                <div className="border-t border-orange-500 opacity-50"></div>
                                <button className={clsx(
                                  "w-full text-left px-3 py-2 text-sm text-white transition-colors flex items-center gap-2 opacity-80",
                                  selectedDropdownOption === 3 ? "bg-orange-700" : "hover:bg-orange-700"
                                )}>
                                  <AlertTriangle className="w-4 h-4" />
                                  Force Update
                                </button>
                              </div>
                            )}
                          </div>
                        ) : selectedTask.gitStatus?.ahead && selectedTask.gitStatus.ahead > 0 ? (
                          <>
                            <button className="w-full flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 hover:scale-[1.02] transition-all duration-200 hover:shadow-lg active:scale-[0.98] cursor-pointer">
                              <GitPullRequest className="w-4 h-4" />
                              Create Pull Request
                            </button>
                            <button className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200 hover:shadow-lg active:scale-[0.98] cursor-pointer">
                              <GitMerge className="w-4 h-4" />
                              Merge to Main
                            </button>
                          </>
                        ) : selectedTask.isMerged ? (
                          <button className="w-full flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors cursor-pointer">
                            <GitBranch className="w-4 h-4" />
                            Archive Task
                          </button>
                        ) : (
                          <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors cursor-pointer">
                            <Activity className="w-4 h-4" />
                            Compare with Base
                          </button>
                        )}
                      </>
                    ) : (
                      // Current version - static buttons
                      <>
                        <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors cursor-pointer">
                          <FileText className="w-4 h-4" />
                          View File Changes
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors cursor-pointer">
                          <GitBranch className="w-4 h-4" />
                          Show Git Log
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors cursor-pointer">
                          <Activity className="w-4 h-4" />
                          Compare with Base
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Task List */}
                <div className="flex-1 overflow-auto p-4" ref={taskListRef}>
                  <h3 className="font-medium text-gray-900 mb-2 text-sm">All Tasks</h3>
                  <div className="space-y-1">
                    {mockTasks.map(task => (
                      <div
                        key={task.id}
                        data-task-id={task.id}
                        className={clsx(
                          "p-2 rounded cursor-pointer text-sm transition-all",
                          task.id === selectedTask.id 
                            ? "bg-blue-50 ring-2 ring-blue-500 ring-opacity-50" 
                            : "hover:bg-gray-50"
                        )}
                        onClick={() => setSelectedTask(task)}
                      >
                        <div className="font-medium text-gray-900">#{task.id} {task.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {useEnhancedStatus ? (
                            <TaskStatusPrototype
                              workerStatus={task.workerStatus}
                                      gitStatus={task.gitStatus}
                              variant="inline"
                            />
                          ) : (
                            <TaskStatus workerStatus={task.workerStatus} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Terminal Area */}
              <div className="flex-1 bg-gray-900 flex items-center justify-center">
                <div className="text-gray-500 text-center">
                  <div className="text-6xl mb-4">⌨️</div>
                  <div className="text-lg">Terminal Area</div>
                  <div className="text-sm mt-2">AI Developer Workspace</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};