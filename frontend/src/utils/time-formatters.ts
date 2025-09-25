/**
 * Time formatting utilities
 * Pure functions for formatting timestamps and durations
 * Extracted from useTaskStatus to follow single responsibility principle
 */

/**
 * Format elapsed time based on worker status
 * Different formats for different states:
 * - Working: Shows seconds for real-time feedback
 * - Idle/Waiting: Shows minutes/hours for less frequent updates
 * 
 * @param lastStateChange - ISO timestamp of last state change
 * @param status - Current worker status
 * @returns Formatted time string or empty string if no timestamp
 */
export function formatElapsedTime(
  lastStateChange: string | null | undefined,
  status: 'not-started' | 'idle' | 'working' | 'waiting'
): string {
  if (!lastStateChange || status === 'not-started') {
    return '';
  }

  const lastChange = new Date(lastStateChange).getTime();
  const now = Date.now();
  const diffMs = now - lastChange;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (status === 'working') {
    // For working status, show seconds for real-time feedback
    if (diffSeconds < 60) {
      return `${diffSeconds}s`;
    } else if (diffMinutes < 60) {
      const seconds = diffSeconds % 60;
      return `${diffMinutes}m ${seconds}s`;
    } else {
      return `${diffHours}h ${diffMinutes % 60}m`;
    }
  } else {
    // For idle/waiting, show minutes/hours/days
    if (diffMinutes < 1) {
      return '< 1m';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    } else if (diffHours < 24) {
      return `${diffHours}h ${diffMinutes % 60}m`;
    } else {
      return `${diffDays}d ${diffHours % 24}h`;
    }
  }
}

/**
 * Get update interval based on worker status
 * Working state needs frequent updates (1s), others less frequent (1m)
 * 
 * @param status - Current worker status
 * @returns Update interval in milliseconds
 */
export function getUpdateInterval(
  status: 'not-started' | 'idle' | 'working' | 'waiting'
): number {
  return status === 'working' ? 1000 : 60000;
}

/**
 * Format relative time for display (e.g., "5 minutes ago")
 * 
 * @param timestamp - ISO timestamp
 * @returns Human-readable relative time
 */
export function formatRelativeTime(timestamp: string | null | undefined): string {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Format duration in milliseconds to human-readable string
 * 
 * @param durationMs - Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(durationMs: number): string {
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}