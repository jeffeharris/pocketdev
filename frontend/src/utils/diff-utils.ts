import type { DiffFile, FileCategory } from '../types/diff';
import { FileCategory as FileCategoryValues } from '../types/diff';

/**
 * Determines which status badges should be shown for a file
 * A file can have multiple statuses (e.g., both staged and unstaged changes)
 */
export function getFileStatuses(file: DiffFile): FileCategory[] {
  const statuses: FileCategory[] = [];
  
  // Use the primary status if available
  if (file.status) {
    statuses.push(file.status);
  } else if (file.category) {
    // Fallback to category field for backward compatibility
    statuses.push(file.category);
  } else {
    // Determine from boolean flags
    if (file.staged) statuses.push(FileCategoryValues.Staged);
    if (file.unstaged) statuses.push(FileCategoryValues.Unstaged);
    if (file.untracked) statuses.push(FileCategoryValues.Untracked);
    if (file.committed) statuses.push(FileCategoryValues.Committed);
  }
  
  return statuses;
}

/**
 * Get the primary status for a file (for single badge display)
 * Priority: untracked > unstaged > staged > committed
 */
export function getPrimaryFileStatus(file: DiffFile): FileCategory | null {
  if (file.untracked) return FileCategoryValues.Untracked;
  if (file.unstaged) return FileCategoryValues.Unstaged;
  if (file.staged) return FileCategoryValues.Staged;
  if (file.committed) return FileCategoryValues.Committed;
  
  // Fallback to status or category field
  return file.status || file.category || null;
}

/**
 * Group files by their status category
 */
export function groupFilesByStatus(files: DiffFile[]): Record<FileCategory, DiffFile[]> {
  const grouped: Record<FileCategory, DiffFile[]> = {
    [FileCategoryValues.Staged]: [],
    [FileCategoryValues.Unstaged]: [],
    [FileCategoryValues.Untracked]: [],
    [FileCategoryValues.Committed]: []
  };
  
  files.forEach(file => {
    const primaryStatus = getPrimaryFileStatus(file);
    if (primaryStatus) {
      grouped[primaryStatus].push(file);
    }
  });
  
  return grouped;
}

/**
 * Count files by status category
 */
export function countFilesByStatus(files: DiffFile[]): Record<FileCategory, number> {
  const counts: Record<FileCategory, number> = {
    [FileCategoryValues.Staged]: 0,
    [FileCategoryValues.Unstaged]: 0,
    [FileCategoryValues.Untracked]: 0,
    [FileCategoryValues.Committed]: 0
  };
  
  files.forEach(file => {
    if (file.staged) counts[FileCategoryValues.Staged]++;
    if (file.unstaged) counts[FileCategoryValues.Unstaged]++;
    if (file.untracked) counts[FileCategoryValues.Untracked]++;
    if (file.committed) counts[FileCategoryValues.Committed]++;
  });
  
  return counts;
}

/**
 * Get a descriptive subtitle for the current view mode
 */
export function getViewModeSubtitle(
  viewMode: 'working' | 'all' | 'base',
  fileCount: number,
  baseBranch?: string
): string {
  switch (viewMode) {
    case 'working':
      return `Working Tree (${fileCount} ${fileCount === 1 ? 'file' : 'files'})`;
    case 'all':
      return `All Changes (${fileCount} ${fileCount === 1 ? 'file' : 'files'})`;
    case 'base':
      return baseBranch 
        ? `Comparing with origin/${baseBranch}`
        : `Base Branch Comparison`;
    default:
      return '';
  }
}

/**
 * Get git command used for a specific view mode
 */
export function getViewModeGitCommand(
  viewMode: 'working' | 'all' | 'base',
  baseBranch?: string
): string {
  switch (viewMode) {
    case 'working':
      return 'git status --porcelain && git diff';
    case 'all':
      return `git status --porcelain && git diff origin/${baseBranch || 'main'}...HEAD`;
    case 'base':
      return `git diff origin/${baseBranch || 'main'}...HEAD`;
    default:
      return '';
  }
}

/**
 * Filter files based on search query
 */
export function filterFilesBySearch(files: DiffFile[], searchQuery: string): DiffFile[] {
  if (!searchQuery.trim()) return files;
  
  const query = searchQuery.toLowerCase();
  return files.filter(file => 
    file.path.toLowerCase().includes(query)
  );
}

/**
 * Get highlight ranges for search matches in a file path
 */
export function getSearchHighlightRanges(filePath: string, searchQuery: string): Array<[number, number]> {
  if (!searchQuery.trim()) return [];
  
  const ranges: Array<[number, number]> = [];
  const query = searchQuery.toLowerCase();
  const pathLower = filePath.toLowerCase();
  
  let index = 0;
  while (index < pathLower.length) {
    const matchIndex = pathLower.indexOf(query, index);
    if (matchIndex === -1) break;
    
    ranges.push([matchIndex, matchIndex + query.length]);
    index = matchIndex + query.length;
  }
  
  return ranges;
}

/**
 * Check if we should show the search box based on file count
 */
export function shouldShowSearch(fileCount: number): boolean {
  return fileCount > 5;
}

/**
 * Get empty state message for different scenarios
 */
export function getEmptyStateMessage(
  viewMode: 'working' | 'all' | 'base',
  hasWorkingChanges: boolean,
  baseBranch?: string,
  unpushedCommits?: number
): { title: string; subtitle?: string; action?: string } {
  switch (viewMode) {
    case 'working':
      return {
        title: '✓ Working tree is clean',
        subtitle: 'All changes have been committed',
        action: 'View commit history'
      };
      
    case 'all':
      if (unpushedCommits && unpushedCommits > 0) {
        return {
          title: `✓ Your branch is up to date with ${baseBranch || 'base branch'}`,
          subtitle: `You have ${unpushedCommits} unpushed ${unpushedCommits === 1 ? 'commit' : 'commits'}`,
          action: 'Push to remote'
        };
      }
      return {
        title: `✓ Your branch is up to date with ${baseBranch || 'base branch'}`,
        subtitle: 'No changes to display',
        action: 'Switch to another branch'
      };
      
    case 'base':
      if (!hasWorkingChanges) {
        return {
          title: `✓ No changes to merge`,
          subtitle: `Your branch matches ${baseBranch || 'base branch'}`,
          action: 'Create new task'
        };
      }
      return {
        title: 'No committed changes',
        subtitle: 'Commit your changes to see them here',
        action: 'Stage and commit'
      };
      
    default:
      return { title: 'No changes to display' };
  }
}