/**
 * Diff Parser Utilities
 * 
 * Utilities for parsing git diff output into usable formats for Monaco editor.
 * Extracts original and modified code from unified diff format.
 */

/**
 * Parse unified diff into original and modified code strings
 * 
 * @param diff - Git diff output in unified format
 * @returns Object containing original and modified code strings
 */
export function parseDiffToCode(diff: string): {
  original: string;
  modified: string;
} {
  if (!diff) {
    return { original: '', modified: '' };
  }

  const lines = diff.split('\n');
  const original: string[] = [];
  const modified: string[] = [];
  let inHunk = false;

  for (const line of lines) {
    // Hunk header (e.g., @@ -1,4 +1,6 @@)
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }
    
    // Skip non-hunk lines (file headers, etc.)
    if (!inHunk) continue;

    if (line.startsWith('-')) {
      // Removed line - goes to original only
      original.push(line.substring(1));
    } else if (line.startsWith('+')) {
      // Added line - goes to modified only
      modified.push(line.substring(1));
    } else if (line.startsWith(' ')) {
      // Context line - goes to both
      const contextLine = line.substring(1);
      original.push(contextLine);
      modified.push(contextLine);
    } else if (line.startsWith('\\')) {
      // Special marker (e.g., "\ No newline at end of file")
      // Skip these
      continue;
    }
  }

  return {
    original: original.join('\n'),
    modified: modified.join('\n')
  };
}

/**
 * Extract conflict sections from a file with merge conflicts
 * 
 * @param content - File content with merge conflict markers
 * @returns Parsed conflict sections
 */
export function parseConflictSections(content: string): {
  beforeConflict: string;
  currentChanges: string;
  incomingChanges: string;
  afterConflict: string;
  hasConflicts: boolean;
  conflictRanges: Array<{
    startLine: number;
    endLine: number;
    currentStart: number;
    currentEnd: number;
    incomingStart: number;
    incomingEnd: number;
  }>;
} {
  const lines = content.split('\n');
  const conflictRanges: Array<{
    startLine: number;
    endLine: number;
    currentStart: number;
    currentEnd: number;
    incomingStart: number;
    incomingEnd: number;
  }> = [];
  
  let beforeConflict: string[] = [];
  let currentChanges: string[] = [];
  let incomingChanges: string[] = [];
  let afterConflict: string[] = [];
  
  let inConflict = false;
  let inCurrent = false;
  let inIncoming = false;
  let conflictStart = -1;
  let currentStart = -1;
  let incomingStart = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('<<<<<<<')) {
      inConflict = true;
      inCurrent = true;
      conflictStart = i + 1; // Line numbers are 1-based
      currentStart = i + 2;
    } else if (line.startsWith('=======')) {
      inCurrent = false;
      inIncoming = true;
      incomingStart = i + 2;
    } else if (line.startsWith('>>>>>>>')) {
      inIncoming = false;
      inConflict = false;
      
      conflictRanges.push({
        startLine: conflictStart,
        endLine: i + 1,
        currentStart: currentStart,
        currentEnd: incomingStart - 2,
        incomingStart: incomingStart,
        incomingEnd: i
      });
    } else {
      if (!inConflict && conflictRanges.length === 0) {
        beforeConflict.push(line);
      } else if (!inConflict && conflictRanges.length > 0) {
        afterConflict.push(line);
      } else if (inCurrent) {
        currentChanges.push(line);
      } else if (inIncoming) {
        incomingChanges.push(line);
      }
    }
  }
  
  return {
    beforeConflict: beforeConflict.join('\n'),
    currentChanges: currentChanges.join('\n'),
    incomingChanges: incomingChanges.join('\n'),
    afterConflict: afterConflict.join('\n'),
    hasConflicts: conflictRanges.length > 0,
    conflictRanges
  };
}

/**
 * Count additions and deletions in a diff
 * 
 * @param diff - Git diff output
 * @returns Object with addition and deletion counts
 */
export function countDiffChanges(diff: string): {
  additions: number;
  deletions: number;
} {
  const lines = diff.split('\n');
  let additions = 0;
  let deletions = 0;
  
  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
    }
  }
  
  return { additions, deletions };
}

/**
 * Extract file path from diff header
 * 
 * @param diffHeader - First few lines of a git diff
 * @returns The file path being diffed
 */
export function extractFilePathFromDiff(diffHeader: string): string {
  const lines = diffHeader.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('--- a/')) {
      return line.substring(6);
    } else if (line.startsWith('+++ b/')) {
      return line.substring(6);
    } else if (line.startsWith('diff --git a/')) {
      const match = line.match(/diff --git a\/(.+) b\//);
      if (match) {
        return match[1];
      }
    }
  }
  
  return '';
}

/**
 * Check if a diff represents a binary file
 * 
 * @param diff - Git diff output
 * @returns True if the diff is for a binary file
 */
export function isBinaryDiff(diff: string): boolean {
  return diff.includes('Binary files') || diff.includes('GIT binary patch');
}

/**
 * Create a placeholder message for binary files
 * 
 * @param filePath - Path to the binary file
 * @returns A user-friendly message
 */
export function getBinaryFileMessage(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase() || '';
  const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'];
  const fontExtensions = ['ttf', 'otf', 'woff', 'woff2', 'eot'];
  
  if (imageExtensions.includes(extension)) {
    return `// Binary image file: ${filePath}\n// Changes to image files cannot be displayed as text diff`;
  } else if (fontExtensions.includes(extension)) {
    return `// Binary font file: ${filePath}\n// Changes to font files cannot be displayed as text diff`;
  } else {
    return `// Binary file: ${filePath}\n// Changes to binary files cannot be displayed as text diff`;
  }
}

/**
 * Format diff stats for display
 * 
 * @param additions - Number of added lines
 * @param deletions - Number of deleted lines
 * @returns Formatted string like "+10 -5"
 */
export function formatDiffStats(additions: number, deletions: number): string {
  const addStr = additions > 0 ? `+${additions}` : '';
  const delStr = deletions > 0 ? `-${deletions}` : '';
  
  if (addStr && delStr) {
    return `${addStr} ${delStr}`;
  } else if (addStr) {
    return addStr;
  } else if (delStr) {
    return delStr;
  } else {
    return 'No changes';
  }
}