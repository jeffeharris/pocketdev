import React, { useState, useRef, useEffect } from 'react';
import { GitBranch, CheckCircle, FileText, Plus, AlertCircle, RefreshCw, ChevronDown, MessageSquare, FileEdit, Sparkles, Edit3, GitMerge, GitPullRequest, FolderSync } from 'lucide-react';
import type { Task } from '../../types/task';
import { TaskState } from '../../types/task';
import { TaskListItem } from '../task/TaskListItem';
import { TaskStatus } from '../task/TaskStatus';
import { DiffViewerModal } from '../diff/DiffViewerModal';
import { CommitModal } from '../git/CommitModal';
import { api } from '../../services/api';

interface SidebarProps {
  projectId: string;
  currentTask: Task;
  allTasks: Task[];
  onTaskSelect: (task: Task) => void;
  collapsed?: boolean;
  onCreateTask?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  projectId,
  currentTask,
  allTasks,
  onTaskSelect,
  collapsed = false,
  onCreateTask
}) => {
  const [showCommitOptions, setShowCommitOptions] = useState(false);
  const [showUpdateOptions, setShowUpdateOptions] = useState(false);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const commitOptionsRef = useRef<HTMLDivElement>(null);
  const updateOptionsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (commitOptionsRef.current && !commitOptionsRef.current.contains(event.target as Node)) {
        setShowCommitOptions(false);
      }
      if (updateOptionsRef.current && !updateOptionsRef.current.contains(event.target as Node)) {
        setShowUpdateOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Current Task Details */}
      <div className="p-4 border-b border-gray-200">
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-900 text-sm">#{currentTask.id.slice(-3)} {currentTask.name}</h2>
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
              const isBehind = (currentTask.gitStatus?.behind || 0) > 0;
              const isAhead = (currentTask.gitStatus?.ahead || 0) > 0;
              
              // Priority order: conflicts > uncommitted > behind > ahead (clean)
              if (hasConflicts) {
                return (
                  <button className="w-full flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 hover:scale-[1.02] transition-all duration-200 hover:shadow-lg active:scale-[0.98] cursor-pointer">
                    <AlertCircle className="w-4 h-4" />
                    Resolve Conflicts
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
                return (
                  <button 
                    onClick={handleCreatePR}
                    disabled={isProcessing}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 hover:scale-[1.02] transition-all duration-200 hover:shadow-lg active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    <GitPullRequest className="w-4 h-4" />
                    Create Pull Request
                  </button>
                );
              }
              
              return null; // No action needed
            })()}
          </div>
        </div>
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
    </div>
  );
};