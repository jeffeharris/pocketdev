import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  minItemsToShow?: number;
  totalItems: number;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search files...',
  className = '',
  autoFocus = false,
  minItemsToShow = 5,
  totalItems
}) => {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Only show search if we have more items than the threshold
  const shouldShow = totalItems > minItemsToShow;
  
  // Manual debounce implementation
  const debouncedOnChange = useCallback((newValue: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
    }, 150);
  }, [onChange]);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  }, [debouncedOnChange]);
  
  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);
  
  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  if (!shouldShow) return null;
  
  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search 
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
          size={18}
        />
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="
            w-full pl-10 pr-10 py-2
            text-sm
            bg-white
            border border-gray-300
            rounded-lg
            focus:outline-none focus:ring-2 focus:ring-blue-500
            focus:border-transparent
            placeholder-gray-500
            transition-colors
          "
          aria-label="Search files"
        />
        {localValue && (
          <button
            onClick={handleClear}
            className="
              absolute right-3 top-1/2 -translate-y-1/2
              text-gray-400 hover:text-gray-600
              transition-colors
              focus:outline-none focus:text-gray-600
            "
            aria-label="Clear search"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

// Helper component to highlight search matches in file paths
interface HighlightedPathProps {
  path: string;
  searchTerm: string;
  className?: string;
  maxLength?: number;
}

export const HighlightedPath: React.FC<HighlightedPathProps> = ({
  path,
  searchTerm,
  className = '',
  maxLength = 50
}) => {
  const segments = useMemo(() => {
    if (!searchTerm) {
      return [{ text: path, isMatch: false }];
    }
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = path.split(regex);
    
    return parts.map((part, index) => ({
      text: part,
      isMatch: index % 2 === 1
    }));
  }, [path, searchTerm]);
  
  // Smart truncation logic
  const truncatedPath = useMemo(() => {
    if (path.length <= maxLength || !searchTerm) {
      return segments;
    }
    
    // Find the first match position
    const matchIndex = path.toLowerCase().indexOf(searchTerm.toLowerCase());
    if (matchIndex === -1) {
      return segments;
    }
    
    // Calculate optimal truncation to show the match
    const beforeMatch = Math.max(0, matchIndex - 10);
    const afterMatch = Math.min(path.length, matchIndex + searchTerm.length + 10);
    
    let truncated = path.substring(beforeMatch, afterMatch);
    if (beforeMatch > 0) truncated = '...' + truncated;
    if (afterMatch < path.length) truncated = truncated + '...';
    
    // Re-segment the truncated path
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = truncated.split(regex);
    
    return parts.map((part, index) => ({
      text: part,
      isMatch: index % 2 === 1
    }));
  }, [path, searchTerm, maxLength, segments]);
  
  return (
    <span className={`group relative ${className}`}>
      {/* Main path display */}
      <span className="block truncate">
        {truncatedPath.map((segment, index) => (
          <span
            key={index}
            className={
              segment.isMatch
                ? 'bg-yellow-200 text-gray-900 px-0.5 rounded'
                : ''
            }
          >
            {segment.text}
          </span>
        ))}
      </span>
      
      {/* Full path tooltip on hover */}
      {path.length > maxLength && (
        <div className="
          absolute left-0 bottom-full mb-2 
          invisible group-hover:visible
          z-50 w-max max-w-md
          px-3 py-2 
          bg-gray-900
          text-white text-sm
          rounded-lg shadow-lg
          opacity-0 group-hover:opacity-100
          transition-opacity duration-200
          pointer-events-none
        ">
          <div className="break-all">
            {segments.map((segment, index) => (
              <span
                key={index}
                className={
                  segment.isMatch
                    ? 'bg-yellow-600/50 px-0.5 rounded'
                    : ''
                }
              >
                {segment.text}
              </span>
            ))}
          </div>
          <div className="
            absolute top-full left-4 
            w-0 h-0 
            border-l-[6px] border-l-transparent
            border-r-[6px] border-r-transparent
            border-t-[6px] border-t-gray-900
          " />
        </div>
      )}
    </span>
  );
};