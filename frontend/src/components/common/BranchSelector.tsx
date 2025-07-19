import React, { useState, useRef, useEffect } from 'react';
import { GitBranch, ChevronDown } from 'lucide-react';

interface BranchSelectorProps {
  value: string;
  onChange: (branch: string) => void;
  branches: string[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  // Optional validation
  blockedBranches?: Set<string>;
  occupiedBranches?: string[];
  baseBranch?: string;
  protectedBranches?: string[];
  defaultBranch?: string;
  // Display options
  showIcons?: boolean;
  showStatusLabels?: boolean;
  enableKeyboardNavigation?: boolean;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  value,
  onChange,
  branches,
  placeholder = "Search branches...",
  required = false,
  disabled = false,
  loading = false,
  className = "",
  blockedBranches,
  occupiedBranches = [],
  baseBranch,
  protectedBranches = ['main', 'master'],
  defaultBranch,
  showIcons = true,
  showStatusLabels = true,
  enableKeyboardNavigation = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter branches based on search
  const filteredBranches = branches.filter(branch =>
    branch.toLowerCase().includes(search.toLowerCase())
  );

  // Check if a branch is blocked
  const isBranchBlocked = (branch: string) => {
    if (blockedBranches?.has(branch)) return true;
    if (occupiedBranches.includes(branch)) return true;
    if (branch === baseBranch) return true;
    if (protectedBranches.includes(branch)) return true;
    return false;
  };

  // Get status label for a branch
  const getBranchStatus = (branch: string) => {
    if (occupiedBranches.includes(branch)) return 'In use';
    if (branch === baseBranch) return 'Base branch';
    if (protectedBranches.includes(branch)) return 'Protected';
    if (branch === defaultBranch) return '(default)';
    return '';
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!enableKeyboardNavigation || !isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredBranches.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredBranches.length) {
          const branch = filteredBranches[selectedIndex];
          if (!isBranchBlocked(branch)) {
            selectBranch(branch);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Select a branch
  const selectBranch = (branch: string) => {
    onChange(branch);
    setSearch(branch);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Auto-scroll to selected item
  useEffect(() => {
    if (selectedIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Update search when value changes externally
  useEffect(() => {
    setSearch(value);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        {showIcons && (
          <GitBranch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={loading ? "Loading branches..." : placeholder}
          disabled={disabled || loading}
          required={required}
          className={`w-full ${showIcons ? 'pl-10 pr-10' : 'px-3'} py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
        {showIcons && (
          <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !loading && branches.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto"
        >
          {filteredBranches.length === 0 ? (
            <div className="p-3 text-center text-gray-500 text-sm">
              No matching branches
            </div>
          ) : (
            filteredBranches.map((branch, index) => {
              const isBlocked = isBranchBlocked(branch);
              const status = getBranchStatus(branch);
              const isSelected = index === selectedIndex;

              return (
                <button
                  key={branch}
                  type="button"
                  disabled={isBlocked}
                  onClick={() => {
                    if (!isBlocked) {
                      selectBranch(branch);
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-3 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                    isBlocked 
                      ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                      : isSelected
                        ? 'bg-blue-50 text-blue-700' 
                        : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <span>{branch}</span>
                  {showStatusLabels && status && (
                    <span className={`text-xs ${isBlocked ? 'text-gray-500' : 'text-gray-400'}`}>
                      {status}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};