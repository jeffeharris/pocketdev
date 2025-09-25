/**
 * Monaco Editor Configuration Utilities
 * 
 * Centralized configuration for Monaco editors used in diff viewing
 * and merge conflict resolution. Following the deep module pattern,
 * these configurations hide Monaco complexity behind simple interfaces.
 */

/**
 * Standard options for diff viewers
 * Used in DiffViewerModal for comparing file changes
 */
export const DIFF_EDITOR_OPTIONS = {
  readOnly: true,
  renderSideBySide: true,
  minimap: { enabled: false },
  scrollbar: {
    vertical: 'visible' as const,
    horizontal: 'auto' as const,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
    useShadows: false
  },
  scrollBeyondLastLine: false,
  padding: { top: 10, bottom: 10 },
  diffAlgorithm: 'advanced',
  renderValidationDecorations: 'off' as const,
  fontSize: 13,
  lineHeight: 20,
  letterSpacing: 0.5,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  folding: false,
  lineNumbers: 'on' as const,
  renderWhitespace: 'selection' as const,
  guides: {
    indentation: false,
    bracketPairs: false
  }
};

/**
 * Options for unified (inline) diff view
 * Collapses side-by-side into a single view with inline changes
 */
export const UNIFIED_DIFF_OPTIONS = {
  ...DIFF_EDITOR_OPTIONS,
  renderSideBySide: false,
  lineNumbers: 'on' as const,
  glyphMargin: true
};

/**
 * Options for merge conflict resolution editors
 * Used in PrototypeMergeConflict for interactive conflict resolution
 */
export const MERGE_EDITOR_OPTIONS = {
  ...DIFF_EDITOR_OPTIONS,
  readOnly: false,
  wordWrap: 'on' as const,
  renderValidationDecorations: 'on' as const,
  quickSuggestions: false,
  parameterHints: { enabled: false },
  suggestOnTriggerCharacters: false,
  acceptSuggestionOnCommitCharacter: false,
  tabCompletion: 'off' as const,
  links: false,
  contextmenu: true
};

/**
 * Options for inline merge conflict editing
 * Allows direct editing of conflicts in the main editor
 */
export const INLINE_MERGE_OPTIONS = {
  fontSize: 13,
  lineHeight: 20,
  letterSpacing: 0.5,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  minimap: { enabled: false },
  scrollbar: {
    vertical: 'visible' as const,
    horizontal: 'auto' as const,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
    useShadows: false
  },
  padding: { top: 10, bottom: 10 },
  lineNumbers: 'on' as const,
  glyphMargin: true,
  folding: true,
  wordWrap: 'on' as const,
  renderWhitespace: 'selection' as const,
  renderValidationDecorations: 'off' as const,
  quickSuggestions: false,
  guides: {
    indentation: true,
    bracketPairs: true
  }
};

/**
 * Options for comparison diff editors in three-way merge
 * Shows current vs incoming changes side by side
 */
export const COMPARISON_DIFF_OPTIONS = {
  ...DIFF_EDITOR_OPTIONS,
  lineNumbers: 'off' as const,
  scrollbar: {
    ...DIFF_EDITOR_OPTIONS.scrollbar,
    alwaysConsumeMouseWheel: false
  },
  padding: { top: 5, bottom: 5 }
};

/**
 * Get editor options based on view mode
 */
export function getEditorOptions(
  mode: 'diff' | 'unified' | 'merge' | 'inline-merge' | 'comparison'
): Record<string, any> {
  switch (mode) {
    case 'diff':
      return DIFF_EDITOR_OPTIONS;
    case 'unified':
      return UNIFIED_DIFF_OPTIONS;
    case 'merge':
      return MERGE_EDITOR_OPTIONS;
    case 'inline-merge':
      return INLINE_MERGE_OPTIONS;
    case 'comparison':
      return COMPARISON_DIFF_OPTIONS;
    default:
      return DIFF_EDITOR_OPTIONS;
  }
}

/**
 * Check if screen width supports split view
 * Monaco needs ~800px minimum for effective split view
 */
export function canUseSplitView(containerWidth: number): boolean {
  return containerWidth >= 800;
}

/**
 * Get responsive editor height based on viewport
 */
export function getResponsiveHeight(
  viewportHeight: number,
  hasHeader: boolean = true,
  hasFooter: boolean = false
): string {
  const headerHeight = hasHeader ? 60 : 0;
  const footerHeight = hasFooter ? 50 : 0;
  const padding = 20;
  
  const availableHeight = viewportHeight - headerHeight - footerHeight - padding;
  return `${Math.max(400, availableHeight)}px`;
}

/**
 * Language mappings for common file extensions
 */
export const LANGUAGE_MAP: Record<string, string> = {
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'json': 'json',
  'html': 'html',
  'css': 'css',
  'scss': 'scss',
  'sass': 'scss',
  'less': 'less',
  'py': 'python',
  'rb': 'ruby',
  'go': 'go',
  'rs': 'rust',
  'java': 'java',
  'c': 'c',
  'cpp': 'cpp',
  'cs': 'csharp',
  'php': 'php',
  'swift': 'swift',
  'kt': 'kotlin',
  'scala': 'scala',
  'sh': 'shell',
  'bash': 'shell',
  'zsh': 'shell',
  'fish': 'shell',
  'ps1': 'powershell',
  'yml': 'yaml',
  'yaml': 'yaml',
  'xml': 'xml',
  'md': 'markdown',
  'mdx': 'markdown',
  'sql': 'sql',
  'dockerfile': 'dockerfile',
  'Dockerfile': 'dockerfile',
  'makefile': 'makefile',
  'Makefile': 'makefile'
};

/**
 * Get language from file path
 */
export function getLanguageFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();
  return extension ? (LANGUAGE_MAP[extension] || 'plaintext') : 'plaintext';
}