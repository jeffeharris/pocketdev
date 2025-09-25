/**
 * FileListSection Component
 * 
 * Reusable component for displaying a section of files (staged, unstaged, etc.)
 * in the diff viewer sidebar. Eliminates duplicate file list rendering.
 */

import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { DiffFile } from '../../../types/diff';
import { StatusIcon } from '../StatusIcon';
import { HighlightedPath } from '../SearchInput';
import { formatDiffStats } from '../utils/diff-parser';

export interface FileListSectionProps {
  title: string;
  files: DiffFile[];
  selectedFile?: DiffFile | null;
  searchTerm?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onFileSelect: (file: DiffFile, index: number) => void;
  onStageToggle?: (file: DiffFile) => void;
  pendingOperations?: Set<string>;
  showStageCheckbox?: boolean;
  emptyMessage?: string;
  className?: string;
}

export interface FileListSectionRef {
  scrollToFile: (filePath: string) => void;
}

/**
 * FileListSection - Reusable file list component for diff sidebar
 */
export const FileListSection = forwardRef<FileListSectionRef, FileListSectionProps>(({
  title,
  files,
  selectedFile,
  searchTerm = '',
  collapsed = false,
  onToggleCollapse,
  onFileSelect,
  onStageToggle,
  pendingOperations,
  showStageCheckbox = false,
  emptyMessage = 'No files',
  className
}, ref) => {
  const fileButtonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  
  // Expose scroll method via ref
  useImperativeHandle(ref, () => ({
    scrollToFile: (filePath: string) => {
      const button = fileButtonRefs.current[filePath];
      if (button) {
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }), []);
  
  const handleFileClick = (file: DiffFile, event: React.MouseEvent) => {
    event.preventDefault();
    const index = files.indexOf(file);
    onFileSelect(file, index);
  };
  
  const handleStageToggle = (file: DiffFile, event: React.MouseEvent) => {
    event.stopPropagation();
    onStageToggle?.(file);
  };
  
  if (files.length === 0 && !onToggleCollapse) {
    return null; // Don't show empty sections that can't be collapsed
  }
  
  return (
    <div className={clsx('border-b border-gray-200', className)}>
      {/* Section Header */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-1">
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
            <span className="text-xs font-medium text-gray-700">
              {title} ({files.length})
            </span>
          </div>
        </button>
      )}
      
      {/* File List */}
      {!collapsed && (
        <div className="pb-2">
          {files.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500 italic">
              {emptyMessage}
            </div>
          ) : (
            files.map((file) => {
              const isSelected = selectedFile?.path === file.path;
              const isPending = pendingOperations?.has(file.path);
              const stats = formatDiffStats(file.additions, file.deletions);
              
              return (
                <button
                  key={file.path}
                  ref={el => fileButtonRefs.current[file.path] = el}
                  onClick={(e) => handleFileClick(file, e)}
                  className={clsx(
                    'w-full px-3 py-1.5 text-left hover:bg-gray-100 transition-colors flex items-center gap-2 group',
                    isSelected && 'bg-blue-50 hover:bg-blue-100'
                  )}
                  disabled={isPending}
                >
                  {/* Stage/Unstage Checkbox */}
                  {showStageCheckbox && onStageToggle && (
                    <div className="flex-shrink-0">
                      {isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={file.staged || false}
                          onChange={(e) => handleStageToggle(file, e as any)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
                        />
                      )}
                    </div>
                  )}
                  
                  {/* File Status Icon */}
                  <StatusIcon 
                    type={file.type} 
                    className="flex-shrink-0"
                  />
                  
                  {/* File Path */}
                  <div className="flex-1 min-w-0">
                    <div className={clsx(
                      'text-xs truncate',
                      isSelected ? 'text-blue-900 font-medium' : 'text-gray-700'
                    )}>
                      {searchTerm ? (
                        <HighlightedPath path={file.path} searchTerm={searchTerm} />
                      ) : (
                        file.path
                      )}
                    </div>
                    
                    {/* Loading State */}
                    {file.loading && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        Loading diff...
                      </div>
                    )}
                  </div>
                  
                  {/* Change Stats */}
                  {!file.loading && stats !== 'No changes' && (
                    <div className="flex-shrink-0 text-xs">
                      {file.additions > 0 && (
                        <span className="text-green-600">+{file.additions}</span>
                      )}
                      {file.additions > 0 && file.deletions > 0 && (
                        <span className="text-gray-400 mx-0.5">/</span>
                      )}
                      {file.deletions > 0 && (
                        <span className="text-red-600">-{file.deletions}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
});

FileListSection.displayName = 'FileListSection';