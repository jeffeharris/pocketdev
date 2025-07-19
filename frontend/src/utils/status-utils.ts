import type { FileStatusType } from '../components/diff/StatusBadge';
import type { ToggleOption } from '../components/diff/ThreeStateToggle';

// Helper function to determine file statuses from git status string
export const parseFileStatuses = (status?: string): FileStatusType[] => {
  if (!status) return [];
  
  const statuses: FileStatusType[] = [];
  
  // Git status format: XY filename
  // X = status in index, Y = status in work tree
  const indexStatus = status[0];
  const workTreeStatus = status[1];
  
  // Handle staged changes
  if (indexStatus === 'A' || indexStatus === 'M' || indexStatus === 'R') {
    statuses.push('staged');
  }
  
  // Handle staged deletion separately
  if (indexStatus === 'D') {
    statuses.push('staged');
    statuses.push('deleted');
  }
  
  // Handle unstaged changes
  if (workTreeStatus === 'M') {
    statuses.push('unstaged');
  }
  
  // Handle unstaged deletion separately
  if (workTreeStatus === 'D') {
    statuses.push('unstaged');
    statuses.push('deleted');
  }
  
  // Handle untracked files
  if (status === '??') {
    statuses.push('untracked');
  }
  
  // Note: 'committed' status would need to come from a different source
  // (e.g., when showing commits not in base branch)
  
  return statuses;
};

// Export the toggle option labels for use in other components
const TOGGLE_OPTIONS = {
  working: {
    label: 'Working Tree',
    tooltip: 'Show uncommitted changes (staged, unstaged, and untracked files)'
  },
  all: {
    label: 'All Changes',
    tooltip: 'Show all changes including commits not yet in base branch'
  },
  base: {
    label: 'Base Branch',
    tooltip: 'Show only committed changes compared to base branch'
  }
};

export const getToggleLabel = (value: ToggleOption): string => {
  return TOGGLE_OPTIONS[value]?.label || '';
};

export const getToggleTooltip = (value: ToggleOption): string => {
  return TOGGLE_OPTIONS[value]?.tooltip || '';
};