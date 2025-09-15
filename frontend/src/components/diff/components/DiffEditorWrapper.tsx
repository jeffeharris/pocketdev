/**
 * DiffEditorWrapper Component
 * 
 * Wrapper component for Monaco DiffEditor that handles common configuration
 * and provides a consistent interface. Can be reused by both DiffViewerModal
 * and PrototypeMergeConflict components.
 */

import React, { useEffect, useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { clsx } from 'clsx';
import { 
  getEditorOptions, 
  getLanguageFromPath,
  canUseSplitView 
} from '../utils/monaco-config';
import { 
  parseDiffToCode, 
  isBinaryDiff, 
  getBinaryFileMessage 
} from '../utils/diff-parser';

export interface DiffEditorWrapperProps {
  diff?: string;
  filePath?: string;
  original?: string;
  modified?: string;
  viewMode?: 'split' | 'unified';
  height?: string;
  language?: string;
  title?: string;
  titleColor?: 'red' | 'green' | 'purple' | 'blue' | 'gray';
  loading?: boolean;
  error?: string;
  className?: string;
  options?: Record<string, any>;
  onMount?: (editor: any) => void;
}

/**
 * DiffEditorWrapper - Reusable Monaco DiffEditor component
 */
export const DiffEditorWrapper: React.FC<DiffEditorWrapperProps> = ({
  diff,
  filePath = '',
  original: originalProp,
  modified: modifiedProp,
  viewMode = 'split',
  height = '600px',
  language: languageProp,
  title,
  titleColor = 'gray',
  loading = false,
  error,
  className,
  options: customOptions,
  onMount
}) => {
  const [original, setOriginal] = useState(originalProp || '');
  const [modified, setModified] = useState(modifiedProp || '');
  const [isBinary, setIsBinary] = useState(false);
  
  // Parse diff if provided
  useEffect(() => {
    if (diff && !originalProp && !modifiedProp) {
      if (isBinaryDiff(diff)) {
        setIsBinary(true);
        const message = getBinaryFileMessage(filePath);
        setOriginal(message);
        setModified(message);
      } else {
        const { original: orig, modified: mod } = parseDiffToCode(diff);
        setOriginal(orig);
        setModified(mod);
        setIsBinary(false);
      }
    } else {
      setOriginal(originalProp || '');
      setModified(modifiedProp || '');
      setIsBinary(false);
    }
  }, [diff, originalProp, modifiedProp, filePath]);
  
  // Determine language from file path if not provided
  const language = languageProp || getLanguageFromPath(filePath);
  
  // Get editor options based on view mode
  const editorOptions = {
    ...getEditorOptions(viewMode === 'split' ? 'diff' : 'unified'),
    ...customOptions
  };
  
  // Check if we can use split view based on container width
  const [canSplit, setCanSplit] = useState(true);
  
  useEffect(() => {
    const checkWidth = () => {
      const container = document.querySelector('.diff-editor-container');
      if (container) {
        setCanSplit(canUseSplitView(container.clientWidth));
      }
    };
    
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, []);
  
  // Force unified view if screen is too narrow
  const actualViewMode = canSplit ? viewMode : 'unified';
  const actualOptions = {
    ...editorOptions,
    renderSideBySide: actualViewMode === 'split'
  };
  
  // Title color classes
  const titleColorClasses = {
    red: 'bg-red-50 text-red-800 border-red-200',
    green: 'bg-green-50 text-green-800 border-green-200',
    purple: 'bg-purple-50 text-purple-800 border-purple-200',
    blue: 'bg-blue-50 text-blue-800 border-blue-200',
    gray: 'bg-gray-50 text-gray-800 border-gray-200'
  };
  
  return (
    <div className={clsx('diff-editor-container', className)}>
      {/* Optional Title Bar */}
      {title && (
        <div className={clsx(
          'px-4 py-2 text-sm font-medium border-b',
          titleColorClasses[titleColor]
        )}>
          {title}
        </div>
      )}
      
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
            Loading diff...
          </div>
        </div>
      )}
      
      {/* Error State */}
      {error && !loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-600 mb-2">{error}</p>
          </div>
        </div>
      )}
      
      {/* Binary File Message */}
      {isBinary && !loading && !error && (
        <div className="flex items-center justify-center h-64 bg-gray-50">
          <div className="text-center text-gray-600">
            <div className="text-4xl mb-4">📄</div>
            <p className="font-medium">Binary File</p>
            <p className="text-sm mt-2">Changes to binary files cannot be displayed</p>
            <p className="text-xs text-gray-500 mt-1">{filePath}</p>
          </div>
        </div>
      )}
      
      {/* Diff Editor */}
      {!loading && !error && !isBinary && (
        <DiffEditor
          height={height}
          language={language}
          original={original}
          modified={modified}
          theme="vs"
          options={actualOptions}
          onMount={onMount}
        />
      )}
      
      {/* Empty State */}
      {!loading && !error && !isBinary && !original && !modified && (
        <div className="flex items-center justify-center h-64 bg-gray-50">
          <div className="text-center text-gray-500">
            <p>No changes to display</p>
          </div>
        </div>
      )}
    </div>
  );
};