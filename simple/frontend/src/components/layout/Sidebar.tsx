import React from 'react';
import { GitBranch, CheckCircle, FileText, Activity, Plus, AlertCircle } from 'lucide-react';
import type { Task } from '../../types/task';
import { TaskState } from '../../types/task';
import { TaskListItem } from '../task/TaskListItem';
import { TaskStatus } from '../task/TaskStatus';

interface SidebarProps {
  currentTask: Task;
  allTasks: Task[];
  onTaskSelect: (task: Task) => void;
  collapsed?: boolean;
  onCreateTask?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTask,
  allTasks,
  onTaskSelect,
  collapsed = false,
  onCreateTask
}) => {
  if (collapsed) return null;

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Current Task Details */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">#{currentTask.id.slice(-3)} {currentTask.title}</h2>
          <TaskStatus 
            workerStatus={currentTask.sessionState.status}
            gitStatus={currentTask.gitStatus}
            isMerged={currentTask.taskState === TaskState.Merged}
          />
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-600">{currentTask.description}</p>
          </div>
        </div>
      </div>

      {/* Repository Status Section */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <GitBranch className="w-4 h-4" />
          {currentTask.branch}
        </h3>
        
        <div className="space-y-3">
          {/* Visual Git Status */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Working Tree</span>
              <div className="flex items-center gap-1">
                {currentTask.gitStatus?.hasConflicts ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-red-700">Conflicts</span>
                  </>
                ) : ((currentTask.gitStatus?.staged || 0) + (currentTask.gitStatus?.unstaged || 0)) > 0 ? (
                  <>
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-amber-700">Modified</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-green-700">Clean</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Branch Status</span>
              <div className="text-xs">
                {currentTask.gitStatus?.behind > 0 && (
                  <span className="text-orange-600">{currentTask.gitStatus.behind} behind</span>
                )}
                {currentTask.gitStatus?.ahead > 0 && currentTask.gitStatus?.behind > 0 && ' • '}
                {currentTask.gitStatus?.ahead > 0 && (
                  <span className="text-blue-600">{currentTask.gitStatus.ahead} ahead</span>
                )}
                {(!currentTask.gitStatus?.ahead && !currentTask.gitStatus?.behind) && (
                  <span className="text-green-600">Up to date</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Changes</span>
              <div className="text-xs">
                {(currentTask.gitStatus?.staged || currentTask.gitStatus?.unstaged) ? (
                  <>
                    {currentTask.gitStatus?.staged > 0 && (
                      <span className="text-green-600">{currentTask.gitStatus.staged} staged</span>
                    )}
                    {currentTask.gitStatus?.staged > 0 && currentTask.gitStatus?.unstaged > 0 && ' • '}
                    {currentTask.gitStatus?.unstaged > 0 && (
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
              className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
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
            
            {/* Show context-aware primary actions */}
            {currentTask.gitStatus?.hasConflicts && (
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors">
                <AlertCircle className="w-4 h-4" />
                Resolve Conflicts
              </button>
            )}
            
            {!currentTask.gitStatus?.hasConflicts && ((currentTask.gitStatus?.staged || 0) + (currentTask.gitStatus?.unstaged || 0)) > 0 && (
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 transition-colors">
                <GitBranch className="w-4 h-4" />
                {currentTask.gitStatus?.staged > 0 
                  ? `Commit Staged (${currentTask.gitStatus.staged} files)`
                  : `Stage & Commit (${currentTask.gitStatus.unstaged} files)`
                }
              </button>
            )}
            
            {!currentTask.gitStatus?.hasConflicts && (currentTask.gitStatus?.behind || 0) > 0 && (
              <button className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                <Activity className="w-4 h-4" />
                Update Branch ({currentTask.gitStatus.behind} commits)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* All Tasks List */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">All Tasks</h3>
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

          <div className="space-y-2">
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
    </div>
  );
};