import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { CreateTaskDTO } from '../../types/task.ts';

/**
 * Converts a task name into a valid git branch name
 * Examples:
 *   "Add User Authentication" → "add-user-authentication"
 *   "Fix: Memory leak!!" → "fix-memory-leak"
 *   "URGENT --- Update deps" → "urgent-update-deps"
 */
const generateBranchName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Replace multiple hyphens with single
    .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
};

/**
 * Validates and formats branch name input in real-time
 * - Converts to lowercase automatically
 * - Replaces spaces with hyphens as user types
 * - Blocks invalid characters
 * - Prevents multiple consecutive hyphens
 * Note: Trailing hyphens are cleaned up on blur/submit
 */
const formatBranchName = (input: string): string => {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')       // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Only allow lowercase letters, numbers, and hyphens
    .replace(/-+/g, '-')        // No multiple consecutive hyphens
    .replace(/^-/, '');         // No leading hyphen (trailing handled on blur/submit)
};

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Omit<CreateTaskDTO, 'projectId'>) => void;
  projectId: string;
  existingBranches?: string[];     // All branches in the repository
  baseBranch?: string;              // The base branch (e.g., 'main', 'develop')
  occupiedBranches?: string[];      // Branches already checked out in worktrees
}

/**
 * Modal for creating new tasks with git branch management
 * 
 * Features:
 * - Auto-generates branch names from task names
 * - Supports creating new branches or using existing ones
 * - Validates branch names in real-time
 * - Prevents selection of occupied/protected branches
 * - Full keyboard navigation with arrow keys
 * - Smart focus management
 * 
 * Branch restrictions:
 * - Cannot use the base branch (typically 'main' or 'develop')
 * - Cannot use protected branches ('main', 'master')
 * - Cannot use branches already checked out in other worktrees
 */
export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  projectId,
  existingBranches = [],
  baseBranch = 'main',
  occupiedBranches = []
}) => {
  const [branchMode, setBranchMode] = useState<'new' | 'existing'>('new');
  // Track if user has manually edited the branch name (stops auto-generation)
  const [branchManuallyEdited, setBranchManuallyEdited] = useState(false);
  // Control visibility of branch suggestions dropdown
  const [showBranchSuggestions, setShowBranchSuggestions] = useState(false);
  // Track keyboard navigation position in dropdown (-1 = no selection)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  // Track if user has toggled branch mode (to prevent focus on initial load)
  const [hasToggledBranchMode, setHasToggledBranchMode] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    branch: '',
    branchPrefix: 'feat/' as const,
    existingBranch: ''
  });
  
  // Refs for managing focus and scroll behavior
  const nameInputRef = useRef<HTMLInputElement>(null);
  const existingBranchRef = useRef<HTMLInputElement>(null);
  const newBranchRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-focus name input when modal opens
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isOpen]);

  // Focus branch input when switching modes (but not on initial load)
  // Delay prevents focus jumping when navigating with keyboard
  useEffect(() => {
    if (!isOpen || !hasToggledBranchMode) return;
    
    const focusTimeout = setTimeout(() => {
      if (branchMode === 'new' && newBranchRef.current) {
        newBranchRef.current.focus();
      } else if (branchMode === 'existing' && existingBranchRef.current) {
        existingBranchRef.current.focus();
      }
    }, 600); // 600ms delay to allow for keyboard navigation
    
    return () => clearTimeout(focusTimeout);
  }, [branchMode, isOpen, hasToggledBranchMode]);

  // Scroll selected suggestion into view during keyboard navigation
  // 'nearest' only scrolls if the item is outside the visible area
  useEffect(() => {
    if (selectedSuggestionIndex >= 0 && dropdownRef.current) {
      const selectedElement = dropdownRef.current.children[selectedSuggestionIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ 
          block: 'nearest', 
          behavior: 'smooth' 
        });
      }
    }
  }, [selectedSuggestionIndex]);

  /**
   * Handles name input changes and auto-generates branch name
   * Auto-generation only happens if:
   * 1. User hasn't manually edited the branch field
   * 2. We're in "new branch" mode
   */
  const handleNameChange = (value: string) => {
    setFormData(prev => ({ ...prev, name: value }));
    
    // Only auto-generate if user hasn't manually edited branch and we're in new branch mode
    if (!branchManuallyEdited && branchMode === 'new') {
      const generatedBranch = generateBranchName(value);
      setFormData(prev => ({ ...prev, branch: generatedBranch }));
    }
  };

  /**
   * Handles manual branch name input with real-time validation
   * - Formats input as user types (lowercase, spaces→hyphens)
   * - If field is cleared, re-enables auto-generation from name
   */
  const handleBranchChange = (value: string) => {
    const formatted = formatBranchName(value);
    
    // If branch is cleared, allow auto-generation to resume
    if (formatted === '') {
      setBranchManuallyEdited(false);
    } else {
      setBranchManuallyEdited(true);
    }
    
    setFormData(prev => ({ ...prev, branch: formatted }));
  };

  // Clean up trailing dashes on blur
  const handleBranchBlur = () => {
    setFormData(prev => ({
      ...prev,
      branch: prev.branch.replace(/-+$/, '') // Remove trailing dashes
    }));
  };

  /**
   * Determine which branches cannot be selected:
   * - Base branch (where new branches are created from)
   * - Protected branches (main, master)
   * - Occupied branches (already checked out in other worktrees)
   */
  const blockedBranches = new Set([
    baseBranch,
    'main',
    'master',
    ...occupiedBranches
  ]);

  // Filter branches based on search input
  const filteredBranches = existingBranches.filter(branch => 
    formData.existingBranch === '' || 
    branch.toLowerCase().includes(formData.existingBranch.toLowerCase())
  );

  /**
   * Handles keyboard navigation in the branch dropdown
   * - Arrow keys: Navigate up/down (skips blocked branches)
   * - Enter: Select current branch (if not blocked)
   * - Escape: Close dropdown
   */
  const handleBranchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showBranchSuggestions || filteredBranches.length === 0) return;

    // Helper to find next selectable (non-blocked) branch
    const findNextSelectableIndex = (currentIndex: number, direction: 'up' | 'down'): number => {
      let newIndex = currentIndex;
      const maxAttempts = filteredBranches.length;
      let attempts = 0;
      
      do {
        if (direction === 'down') {
          newIndex = newIndex < filteredBranches.length - 1 ? newIndex + 1 : newIndex;
        } else {
          newIndex = newIndex > -1 ? newIndex - 1 : -1;
        }
        attempts++;
        
        // If we've gone through all items or reached the bounds, stop
        if (attempts >= maxAttempts || newIndex === -1 || newIndex === currentIndex) {
          return currentIndex;
        }
      } while (blockedBranches.has(filteredBranches[newIndex]));
      
      return newIndex;
    };

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => findNextSelectableIndex(prev, 'down'));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => findNextSelectableIndex(prev, 'up'));
        break;
      case 'Enter':
        if (selectedSuggestionIndex >= 0 && !blockedBranches.has(filteredBranches[selectedSuggestionIndex])) {
          e.preventDefault();
          setFormData(prev => ({ 
            ...prev, 
            existingBranch: filteredBranches[selectedSuggestionIndex] 
          }));
          setShowBranchSuggestions(false);
          setSelectedSuggestionIndex(-1);
        }
        break;
      case 'Escape':
        setShowBranchSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate based on branch mode
    if (!formData.name.trim()) return;
    if (branchMode === 'new' && !formData.branch.trim()) return;
    if (branchMode === 'existing') {
      if (!formData.existingBranch) return;
      // Prevent submitting blocked branches
      if (blockedBranches.has(formData.existingBranch)) {
        alert(`Cannot use branch "${formData.existingBranch}" - it is already in use or protected.`);
        return;
      }
    }
    
    onSubmit({
      name: formData.name,
      description: formData.description,
      branch: branchMode === 'new' 
        ? formData.branch.replace(/-+$/, '') // Clean up trailing dashes on submit
        : formData.existingBranch,
      branchPrefix: branchMode === 'new' ? formData.branchPrefix : undefined,
      useExistingBranch: branchMode === 'existing'
    });
    
    // Reset form
    setFormData({
      name: '',
      description: '',
      branch: '',
      branchPrefix: 'feat/',
      existingBranch: ''
    });
    setBranchMode('new');
    setBranchManuallyEdited(false);
    setHasToggledBranchMode(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Create New Task</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Add user authentication"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Goal
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="What should be accomplished? Be specific about the desired outcome..."
            />
            <p className="mt-1 text-xs text-gray-500">
              You can work on this task across multiple sessions
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Branch
            </label>
            
            {/* Branch Mode Toggle */}
            <div className="flex gap-4 mb-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="new"
                  checked={branchMode === 'new'}
                  onChange={(e) => {
                    setBranchMode(e.target.value as 'new' | 'existing');
                    setHasToggledBranchMode(true);
                    // Don't clear the branch names or reset the manually edited flag
                    // This preserves user input if they accidentally switch modes
                  }}
                  className="mr-2"
                />
                <span className="text-sm">Create new branch</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="existing"
                  checked={branchMode === 'existing'}
                  onChange={(e) => {
                    setBranchMode(e.target.value as 'new' | 'existing');
                    setHasToggledBranchMode(true);
                    // Don't clear the branch names - preserve user input
                  }}
                  className="mr-2"
                />
                <span className="text-sm">Use existing branch</span>
              </label>
            </div>

            {/* Branch Input Container - Fixed Height */}
            <div className="h-20">
              {/* New Branch Input */}
              {branchMode === 'new' && (
                <div>
                  <div className="flex gap-2">
                    <select
                      value={formData.branchPrefix}
                      onChange={(e) => setFormData(prev => ({ ...prev, branchPrefix: e.target.value as any }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="feat/">feat/</option>
                      <option value="fix/">fix/</option>
                      <option value="chore/">chore/</option>
                      <option value="">no prefix</option>
                    </select>
                    <input
                      ref={newBranchRef}
                      type="text"
                      value={formData.branch}
                      onChange={(e) => handleBranchChange(e.target.value)}
                      onBlur={handleBranchBlur}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="add-authentication"
                      required
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Will be created from the project base branch: <span className="font-medium">{baseBranch}</span>
                  </p>
                </div>
              )}

              {/* Existing Branch Select */}
              {branchMode === 'existing' && (
                <div>
                  <div className="relative">
                    <input
                      ref={existingBranchRef}
                      type="text"
                      value={formData.existingBranch}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, existingBranch: e.target.value }));
                        setShowBranchSuggestions(true);
                        setSelectedSuggestionIndex(-1);
                      }}
                      onKeyDown={handleBranchKeyDown}
                      onFocus={() => {
                        setShowBranchSuggestions(true);
                        setSelectedSuggestionIndex(-1);
                      }}
                      onBlur={() => setTimeout(() => {
                        setShowBranchSuggestions(false);
                        setSelectedSuggestionIndex(-1);
                      }, 200)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Type to search branches..."
                      required
                    />
                    
                    {/* Custom dropdown */}
                    {showBranchSuggestions && existingBranches.length > 0 && (
                      <div 
                        ref={dropdownRef}
                        className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                        {filteredBranches.map((branch, index) => {
                          const isBlocked = blockedBranches.has(branch);
                          const isOccupied = occupiedBranches.includes(branch);
                          const isBaseBranch = branch === baseBranch;
                          const isMainBranch = branch === 'main' || branch === 'master';
                          
                          return (
                            <button
                              key={branch}
                              type="button"
                              disabled={isBlocked}
                              onClick={() => {
                                if (!isBlocked) {
                                  setFormData(prev => ({ ...prev, existingBranch: branch }));
                                  setShowBranchSuggestions(false);
                                  setSelectedSuggestionIndex(-1);
                                }
                              }}
                              className={`w-full px-3 py-2 text-left focus:outline-none text-sm transition-colors flex items-center justify-between ${
                                isBlocked 
                                  ? 'opacity-50 cursor-not-allowed bg-gray-50' 
                                  : index === selectedSuggestionIndex 
                                    ? 'bg-blue-50 text-blue-700' 
                                    : 'hover:bg-gray-50 cursor-pointer'
                              }`}
                            >
                              <span>{branch}</span>
                              {isBlocked && (
                                <span className="text-xs text-gray-500">
                                  {isOccupied ? 'In use' : isBaseBranch ? 'Base branch' : isMainBranch ? 'Protected' : 'Unavailable'}
                                </span>
                              )}
                            </button>
                          );
                        })}
                        {filteredBranches.length === 0 && formData.existingBranch !== '' && (
                          <div className="px-3 py-2 text-sm text-gray-500">
                            No matching branches
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    This will create a new worktree for the existing branch
                  </p>
                </div>
              )}
            </div>
          </div>


          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
            >
              Create Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};