import React, { useState, useRef, useEffect } from 'react';
import { GitBranch, CheckCircle, FileText, Plus, AlertCircle, RefreshCw, ChevronDown, MessageSquare, FileEdit, Sparkles, Edit3, GitMerge, GitPullRequest, FolderSync, MoreVertical, Edit2, Archive, Trash2, RotateCw, Upload, Image, Paperclip } from 'lucide-react';
import type { Task } from '../../types/task.ts';
import { TaskState } from '../../types/task.ts';
import { TaskListItem } from '../task/TaskListItem.tsx';
import { TaskStatus } from '../task/TaskStatus.tsx';
import { DiffViewerModal } from '../diff/DiffViewerModal.tsx';
import { CommitModal } from '../git/CommitModal.tsx';
import { ImageUpload } from '../common/ImageUpload.tsx';
import { useImageUpload } from '../../hooks/useImageUpload.ts';
import { api } from '../../services/api.ts';

interface SidebarProps {
  projectId: string;
  currentTask: Task;
  allTasks: Task[];
  onTaskSelect: (task: Task) => void;
  collapsed?: boolean;
  onCreateTask?: () => void;
  onTaskUpdate?: (taskId: string, updates: Partial<Task>) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projectId,
  currentTask,
  allTasks,
  onTaskSelect,
  collapsed = false,
  onCreateTask,
  onTaskUpdate
}) => {
  const [showCommitOptions, setShowCommitOptions] = useState(false);
  const [showUpdateOptions, setShowUpdateOptions] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [showTaskActions, setShowTaskActions] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [commits, setCommits] = useState<any[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const commitOptionsRef = useRef<HTMLDivElement>(null);
  const updateOptionsRef = useRef<HTMLDivElement>(null);
  const taskActionsRef = useRef<HTMLDivElement>(null);
  
  // Image upload hook
  const {
    images,
    isUploading,
    uploadProgress,
    loadImages,
    uploadImage,
    deleteImage,
    isLoadingImages
  } = useImageUpload(projectId, currentTask.id);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (commitOptionsRef.current && !commitOptionsRef.current.contains(event.target as Node)) {
        setShowCommitOptions(false);
      }
      if (updateOptionsRef.current && !updateOptionsRef.current.contains(event.target as Node)) {
        setShowUpdateOptions(false);
      }
      if (taskActionsRef.current && !taskActionsRef.current.contains(event.target as Node)) {
        setShowTaskActions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load commit history when reset modal opens
  useEffect(() => {
    if (showResetModal) {
      loadCommitHistory();
    }
  }, [showResetModal]);

  // Load images when task changes
  useEffect(() => {
    if (currentTask?.id) {
      loadImages();
    }
  }, [currentTask?.id, loadImages]);

  const loadCommitHistory = async () => {
    try {
      const history = await api.getCommitHistory(projectId, currentTask.id);

      // Find the last merge commit
      const lastMergeIndex = history.findIndex((commit: any) => commit.isMerge);

      // Mark commits as resettable based on merge boundary
      const commitsWithResetFlag = history.map((commit: any, index: number) => ({
        ...commit,
        canReset: lastMergeIndex === -1 || index < lastMergeIndex
      }));

      setCommits(commitsWithResetFlag);
    } catch (error) {
      console.error('Failed to load commit history:', error);
      setCommits([]);
    }
  };

  if (collapsed) return null;

  const handleCommitClick = () => {
    setShowCommitOptions(false);
    setShowCommitModal(true);
  };

  const handleUpdateClick = async () => {
    setShowUpdateOptions(false);
    setIsProcessing(true);
    
    try {
      const result = await api.updateBranch(projectId, currentTask.id);
      if (!result.success) {
        alert(`Update failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Update failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreatePR = async () => {
    setIsProcessing(true);
    
    try {
      const result = await api.gitOperation(projectId, currentTask.id, 'pr', {
        message: `${currentTask.name} - ${currentTask.description}`
      });
      if (result.success) {
        // Extract PR URL from output if available
        const prUrlMatch = result.output.match(/https:\/\/github\.com\/[^\s]+/);
        if (prUrlMatch) {
          window.open(prUrlMatch[0], '_blank');
        } else {
          alert('Pull request created successfully!');
        }
      } else {
        alert(`Failed to create PR: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Failed to create PR: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePushBranch = async () => {
    console.log('handlePushBranch called');
    setIsProcessing(true);

    try {
      console.log(`Calling api.gitOperation with projectId: ${projectId}, taskId: ${currentTask.id}`);
      const result = await api.gitOperation(projectId, currentTask.id, 'push');
      console.log('Git operation result:', result);
      
      if (!result.success) {
        alert(`Failed to push: ${result.error || 'Unknown error'}`);
      } else {
        // Show success feedback
        console.log('Push successful:', result.output);
        if (result.error && result.error.includes('Everything up-to-date')) {
          alert('Already up to date - nothing to push');
        } else if (result.output || result.error) {
          alert(`Push successful! ${result.output || result.error || ''}`);
        } else {
          alert('Push completed successfully!');
        }
      }
      // Git status will update automatically via WebSocket
    } catch (error: any) {
      console.error('Push error:', error);
      // Check if it's an authentication error
      if (error.message.includes('Authentication') || error.message.includes('403')) {
        alert('Push failed: GitHub authentication error. Please check your GitHub token in Settings.');
      } else {
        alert(`Failed to push: ${error.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMergeToBase = async () => {
    // Confirm merge action
    const confirmed = window.confirm(
      `Are you sure you want to merge "${currentTask.name}" into the base branch?\n\nThis will merge all ${currentTask.gitStatus?.ahead || 0} commits.`
    );

    if (!confirmed) return;

    setIsProcessing(true);

    try {
      console.log('Merging task:', currentTask.id, 'Current state:', currentTask.taskState);
      const result = await api.mergeToBase(projectId, currentTask.id);
      console.log('Merge result:', result);
      
      if (result.success) {
        alert('Branch merged successfully!');
        // The task state will update via WebSocket to show it's merged
        console.log('Waiting for WebSocket update to change task state to merged...');
        
        // Manually refresh the task status after a short delay if WebSocket doesn't update
        setTimeout(async () => {
          try {
            console.log('Manually fetching updated task status...');
            const updatedTask = await api.getTask(currentTask.id);
            console.log('Updated task:', updatedTask);
            if (onTaskUpdate && updatedTask.taskState === TaskState.Merged) {
              onTaskUpdate(currentTask.id, updatedTask);
            }
          } catch (error) {
            console.error('Failed to fetch updated task:', error);
          }
        }, 2000);
      } else {
        alert(`Failed to merge: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Merge error:', error);
      alert(`Failed to merge: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRenameTask = async () => {
    if (!newTaskName.trim() || newTaskName === currentTask.name) {
      setShowRenameModal(false);
      return;
    }

    setIsProcessing(true);
    try {
      const result = await api.updateTask(projectId, currentTask.id, { name: newTaskName.trim() });
      if (result) {
        // Update the task in the parent component
        if (onTaskUpdate) {
          onTaskUpdate(currentTask.id, { name: newTaskName.trim() });
        }
        setShowRenameModal(false);
      }
    } catch (error: any) {
      alert(`Failed to rename task: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Current Task Details */}
      <div className="p-4 border-b border-gray-200">
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-900 text-sm">#{currentTask.id.slice(-3)} {currentTask.name || 'Unnamed Task'}</h2>
            <div className="relative" ref={taskActionsRef}>
              <button
                onClick={() => setShowTaskActions(!showTaskActions)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:scale-110 cursor-pointer group"
                title="Task actions"
              >
                <MoreVertical className="w-4 h-4 text-gray-500 group-hover:text-gray-700 transition-colors" />
              </button>
              
              {showTaskActions && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <button
                    onClick={() => {
                      setNewTaskName(currentTask.name || '');
                      setShowRenameModal(true);
                      setShowTaskActions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150 flex items-center gap-2 cursor-pointer"
                  >
                    <Edit2 className="w-4 h-4" />
                    Rename Task
                  </button>
                  <button
                    onClick={async () => {
                      setShowTaskActions(false);
                      if (confirm(`Are you sure you want to archive "${currentTask.name}"?`)) {
                        try {
                          await api.archiveTask(projectId, currentTask.id);
                          if (onTaskUpdate) {
                            onTaskUpdate(currentTask.id, { taskState: TaskState.Archived });
                          }
                        } catch (error: any) {
                          alert(`Failed to archive task: ${error.message}`);
                        }
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150 flex items-center gap-2 cursor-pointer"
                  >
                    <Archive className="w-4 h-4" />
                    Archive Task
                  </button>
                  <hr className="my-1 border-gray-200" />
                  <button
                    onClick={async () => {
                      setShowTaskActions(false);
                      if (confirm('Are you sure you want to reset all uncommitted changes? This cannot be undone.')) {
                        try {
                          await api.gitOperation(projectId, currentTask.id, 'reset-uncommitted');
                          // Git status will update via WebSocket
                        } catch (error: any) {
                          alert(`Failed to reset changes: ${error.message}`);
                        }
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150 flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reset Uncommitted Changes
                  </button>
                  <button
                    onClick={() => {
                      setShowTaskActions(false);
                      setShowResetModal(true);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150 flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                    Reset to Previous Commit...
                  </button>
                  <hr className="my-1 border-gray-200" />
                  <button
                    onClick={() => {
                      // TODO: Implement delete functionality
                      setShowTaskActions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-100 transition-colors duration-150 flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Task
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center justify-end">
            <TaskStatus 
              workerStatus={currentTask.sessionState.status}
              gitStatus={currentTask.gitStatus}
              isMerged={currentTask.taskState === TaskState.Merged}
            />
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-600">{currentTask.description}</p>
          </div>
        </div>
      </div>

      {/* Repository Status Section */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2 text-sm">
          <GitBranch className="w-4 h-4" />
          {currentTask.branch}
        </h3>
        
        <div className="space-y-3">
          {/* Visual Git Status */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">Working Tree</span>
              <div className="flex items-center gap-1">
                {currentTask.gitStatus?.hasConflicts ? (
                  <>
                    <AlertCircle className="w-3 h-3 text-red-500" />
                    <span className="text-xs text-red-700">Conflicts</span>
                  </>
                ) : ((currentTask.gitStatus?.staged || 0) + (currentTask.gitStatus?.unstaged || 0)) > 0 ? (
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
                {currentTask.gitStatus && currentTask.gitStatus.behind > 0 && (
                  <span className="text-orange-600">{currentTask.gitStatus.behind} behind</span>
                )}
                {currentTask.gitStatus && currentTask.gitStatus.ahead > 0 && currentTask.gitStatus.behind > 0 && ' • '}
                {currentTask.gitStatus && currentTask.gitStatus.ahead > 0 && (
                  <span className="text-blue-600">{currentTask.gitStatus.ahead} ahead</span>
                )}
                {(!currentTask.gitStatus?.ahead && !currentTask.gitStatus?.behind) && (
                  <span className="text-green-600">Up to date</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">Changes</span>
              <div className="text-xs">
                {(currentTask.gitStatus && (currentTask.gitStatus.staged || currentTask.gitStatus.unstaged)) ? (
                  <>
                    {currentTask.gitStatus.staged && currentTask.gitStatus.staged > 0 && (
                      <span className="text-green-600">{currentTask.gitStatus.staged} staged</span>
                    )}
                    {currentTask.gitStatus.staged && currentTask.gitStatus.staged > 0 && currentTask.gitStatus.unstaged && currentTask.gitStatus.unstaged > 0 && ' • '}
                    {currentTask.gitStatus.unstaged && currentTask.gitStatus.unstaged > 0 && (
                      <span className="text-amber-600">{currentTask.gitStatus.unstaged} unstaged</span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-500">No changes</span>
                )}
              </div>
            </div>
          </div>

          {/* Git Actions - Context-aware */}
          <div className="space-y-2">
            {/* Always show diff button for layout stability */}
            <button 
              className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm transition-all duration-200 cursor-pointer hover:bg-gray-100 hover:border-gray-400 hover:shadow-md"
              onClick={() => setShowDiffModal(true)}
              title={
                currentTask.gitStatus?.hasConflicts ? "View merge conflicts" :
                currentTask.taskState === TaskState.Merged ? "View merge commit" :
                ((currentTask.gitStatus?.staged || 0) + (currentTask.gitStatus?.unstaged || 0)) > 0 ? "View uncommitted changes" :
                (currentTask.gitStatus?.ahead || 0) > 0 ? "View branch changes vs base" :
                "No changes to view"
              }
            >
              <FileText className="w-4 h-4" />
              {currentTask.gitStatus?.hasConflicts ? "View Conflicts" :
               currentTask.taskState === TaskState.Merged ? "View Merge Commit" :
               ((currentTask.gitStatus?.staged || 0) + (currentTask.gitStatus?.unstaged || 0)) > 0 ? "View Uncommitted Changes" :
               (currentTask.gitStatus?.ahead || 0) > 0 ? "View Branch Changes" :
               "View Changes"}
            </button>
            
            {/* Context-specific primary action */}
            {(() => {
              // Determine which action button to show based on git state priority
              const hasConflicts = currentTask.gitStatus?.hasConflicts;
              // Get counts from backend (no more mocks needed!)
              const staged = currentTask.gitStatus?.staged || 0;
              const unstaged = currentTask.gitStatus?.unstaged || 0;
              const untracked = currentTask.gitStatus?.untracked || 0;
              // Total uncommitted = staged + unstaged + untracked
              const uncommittedCount = staged + unstaged + untracked;
              const hasUncommitted = uncommittedCount > 0;
              const behindCount = currentTask.gitStatus?.behind || 0;
              const aheadCount = currentTask.gitStatus?.ahead || 0;
              const isBehind = behindCount > 0;
              const isAhead = aheadCount > 0;
              
              // Priority order: conflicts > uncommitted > behind > ahead (clean)
              if (hasConflicts) {
                return (
                  <button 
                    onClick={async () => {
                      setIsProcessing(true);
                      try {
                        // First, get the actual conflict data
                        const conflictData = await api.getTaskDiff(projectId, currentTask.id, 'base');
                        
                        // Store in sessionStorage for the prototype page to access
                        sessionStorage.setItem('mergeConflictData', JSON.stringify({
                          taskId: currentTask.id,
                          taskName: currentTask.name,
                          branch: currentTask.branch,
                          projectId: projectId,
                          files: conflictData.files,
                          timestamp: Date.now()
                        }));
                        
                        // Open the merge conflict prototype
                        window.open('/prototype/merge-conflict', '_blank');
                      } catch (error: any) {
                        alert(`Failed to load conflict data: ${error.message}`);
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    disabled={isProcessing}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 hover:scale-[1.02] transition-all duration-200 hover:shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-50">
                    <AlertCircle className="w-4 h-4" />
                    {isProcessing ? 'Loading...' : 'Resolve Conflicts'}
                  </button>
                );
              }
              
              if (hasUncommitted) {
                return (
                  <div className="relative" ref={commitOptionsRef}>
                <div className="flex">
                  <button 
                    onClick={handleCommitClick}
                    disabled={isProcessing}
                    className="flex-1 flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-l-lg text-sm hover:bg-amber-700 hover:scale-[1.02] transition-all duration-200 hover:shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    <GitBranch className="w-4 h-4" />
                    {staged > 0 
                      ? `Commit Staged (${staged} files)`
                      : `Stage & Commit (${unstaged + untracked} files)`
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
                    <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-amber-700 transition-colors flex items-center gap-2 cursor-pointer">
                      <MessageSquare className="w-4 h-4 opacity-80" />
                      Commit with Message...
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-amber-700 transition-colors flex items-center gap-2 cursor-pointer">
                      <FileEdit className="w-4 h-4 opacity-80" />
                      Stage All & Commit
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-amber-700 transition-colors flex items-center gap-2 cursor-pointer">
                      <Sparkles className="w-4 h-4 opacity-80" />
                      AI-Assisted Stage & Commit
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-amber-700 transition-colors flex items-center gap-2 cursor-pointer">
                      <Edit3 className="w-4 h-4 opacity-80" />
                      Amend Last Commit
                    </button>
                  </div>
                )}
                  </div>
                );
              }
              
              if (isBehind) {
                return (
                  <div className="relative" ref={updateOptionsRef}>
                <div className="flex">
                  <button 
                    onClick={handleUpdateClick}
                    disabled={isProcessing}
                    className="flex-1 flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-l-lg text-sm hover:bg-orange-700 hover:scale-[1.02] transition-all duration-200 hover:shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
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
                    <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-orange-700 transition-colors flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <GitMerge className="w-4 h-4 opacity-80" />
                        Update via Merge
                      </div>
                      <span className="text-xs opacity-60">Default</span>
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-orange-700 transition-colors flex items-center gap-2 cursor-pointer">
                      <GitBranch className="w-4 h-4 opacity-80" />
                      Update via Rebase
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-orange-700 transition-colors flex items-center gap-2 cursor-pointer">
                      <Sparkles className="w-4 h-4 opacity-80" />
                      AI-Assisted Update
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm text-white hover:bg-orange-700 transition-colors flex items-center gap-2 cursor-pointer">
                      <FolderSync className="w-4 h-4 opacity-80" />
                      Sync & Update All Tasks
                    </button>
                  </div>
                )}
                  </div>
                );
              }
              
              if (isAhead && !hasUncommitted) {
                // Check if we need to push first
                const hasRemoteTracking = currentTask.gitStatus?.hasRemoteTracking;
                const unpushedCount = currentTask.gitStatus?.unpushed || 0;

                if (unpushedCount > 0) {
                  // There are unpushed commits
                  return (
                    <button
                      onClick={handlePushBranch}
                      disabled={isProcessing}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 hover:scale-[1.02] transition-all duration-200 hover:shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      {hasRemoteTracking === false
                        ? `Push Branch (${unpushedCount} commits)`
                        : `Push ${unpushedCount} commit${unpushedCount > 1 ? 's' : ''}`
                      }
                    </button>
                  );
                } else {
                  // All commits pushed, ready for PR
                  return (
                    <div className="space-y-2">
                    <button
                      onClick={handleMergeToBase}
                      disabled={isProcessing}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 hover:scale-[1.02] transition-all duration-200 hover:shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-50"
                    >
                      <GitMerge className="w-4 h-4" />
                      Merge to Base Branch
                    </button>
                    <button
                      onClick={handleCreatePR}
                      disabled={isProcessing}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 hover:scale-[1.02] transition-all duration-200 hover:shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-50"
                    >
                      <GitPullRequest className="w-4 h-4" />
                      Create Pull Request
                    </button>
                  </div>);
                }
              }
              
              return null; // No action needed
            })()}
          </div>
        </div>
      </div>

      {/* Attachments Section */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => setShowAttachments(!showAttachments)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Attachments</span>
            {images.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {images.length}
              </span>
            )}
          </div>
          <ChevronDown 
            className={`w-4 h-4 text-gray-400 transition-transform ${
              showAttachments ? 'rotate-180' : ''
            }`}
          />
        </button>

        {showAttachments && (
          <div className="p-4 pt-0">
            <ImageUpload
              projectId={projectId}
              taskId={currentTask.id}
              images={images}
              onUpload={uploadImage}
              onDelete={deleteImage}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              compact={true}
            />
          </div>
        )}
      </div>

      {/* All Tasks List */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900 text-sm">All Tasks</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{allTasks.length} active</span>
              {onCreateTask && (
                <button
                  onClick={onCreateTask}
                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200 hover:scale-110 cursor-pointer"
                  title="Create new task"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            {allTasks.map(task => (
              <TaskListItem
                key={task.id}
                task={task}
                isActive={task.id === currentTask.id}
                onSelect={onTaskSelect}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Diff Viewer Modal */}
      <DiffViewerModal
        isOpen={showDiffModal}
        onClose={() => setShowDiffModal(false)}
        projectId={projectId}
        taskId={currentTask.id}
        taskTitle={currentTask.name}
        branch={currentTask.branch}
      />

      {/* Commit Modal */}
      <CommitModal
        isOpen={showCommitModal}
        onClose={() => setShowCommitModal(false)}
        projectId={projectId}
        taskId={currentTask.id}
        fileCount={(currentTask.gitStatus?.staged || 0) + (currentTask.gitStatus?.unstaged || 0) + (currentTask.gitStatus?.untracked || 0)}
        stagedCount={currentTask.gitStatus?.staged || 0}
        onSuccess={() => {
          // Git status will update automatically via WebSocket
          // The backend triggers a status check after commit
        }}
      />

      {/* Rename Task Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Rename Task</h3>
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameTask();
                  if (e.key === 'Escape') setShowRenameModal(false);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter new task name"
                autoFocus
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowRenameModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenameTask}
                  disabled={isProcessing || !newTaskName.trim() || newTaskName === currentTask.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Renaming...' : 'Rename'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset to Commit Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">Reset to Previous Commit</h3>
              <p className="text-sm text-gray-600 mt-1">
                Select a commit to reset your branch to. This will remove all commits after the selected one.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {commits.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  Loading commit history...
                </div>
              ) : (
                <div className="space-y-2">
                  {commits.map((commit, index) => (
                    <div key={commit.hash} className="relative">
                      <button
                        onClick={() => setSelectedCommit(commit.hash)}
                        disabled={!commit.canReset}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                          selectedCommit === commit.hash
                            ? 'border-blue-500 bg-blue-50'
                            : commit.canReset
                            ? 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-mono text-sm text-gray-600 mb-1">
                              {commit.hash.substring(0, 7)}
                            </div>
                            <div className="font-medium text-gray-900">
                              {commit.message}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {commit.author} • {commit.date}
                            </div>
                          </div>
                          {commit.isMerge && (
                            <div className="ml-3 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                              Merge
                            </div>
                          )}
                        </div>
                      </button>

                      {commit.isMerge && !commit.canReset && (
                        <div className="absolute inset-x-0 -bottom-2 flex items-center">
                          <div className="flex-1 border-b border-red-300"></div>
                          <div className="px-3 text-xs text-red-600 bg-white">
                            Cannot reset before merge commits
                          </div>
                          <div className="flex-1 border-b border-red-300"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setSelectedCommit('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedCommit) return;

                  const commit = commits.find(c => c.hash === selectedCommit);
                  if (!commit) return;

                  if (confirm(`Are you sure you want to reset to "${commit.message}"? This will remove all commits after this point.`)) {
                    setIsProcessing(true);
                    try {
                      await api.gitOperation(projectId, currentTask.id, 'reset-to-commit', {
                        commit: selectedCommit
                      });
                      setShowResetModal(false);
                      setSelectedCommit('');
                    } catch (error: any) {
                      alert(`Failed to reset: ${error.message}`);
                    } finally {
                      setIsProcessing(false);
                    }
                  }
                }}
                disabled={!selectedCommit || isProcessing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Resetting...' : 'Reset to Commit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};