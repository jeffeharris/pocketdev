import { useEffect, useState } from 'react';
import { formatElapsedTime, getUpdateInterval } from '../utils/time-formatters';
import { WorkerStatus } from '@shared/types';

/**
 * Hook for displaying elapsed time with automatic updates
 * 
 * Single responsibility: Convert timestamp to formatted elapsed time
 * with appropriate update intervals based on worker status.
 * 
 * This is a presentation hook - it takes business data (timestamp, status)
 * and produces UI-ready formatted strings.
 * 
 * @param lastStateChange - ISO timestamp of last state change
 * @param status - Current worker status
 * @returns Formatted elapsed time string
 */
export function useElapsedTime(
  lastStateChange: string | null | undefined,
  status: WorkerStatus
): string {
  const [elapsedTime, setElapsedTime] = useState<string>('');

  useEffect(() => {
    if (!lastStateChange || status === WorkerStatus.NotStarted) {
      setElapsedTime('');
      return;
    }

    // Initial calculation
    const updateTime = () => {
      setElapsedTime(formatElapsedTime(lastStateChange, status));
    };
    
    updateTime();

    // Set up interval with appropriate frequency
    const interval = setInterval(updateTime, getUpdateInterval(status));
    
    return () => clearInterval(interval);
  }, [lastStateChange, status]);

  return elapsedTime;
}