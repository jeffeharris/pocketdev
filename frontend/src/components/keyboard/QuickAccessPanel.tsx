import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, Command } from 'lucide-react';
import { useKeyboard } from '../../contexts/KeyboardContext';
import type { KeyboardShortcut } from '../../types/keyboard';

interface QuickAccessPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickAccessPanel: React.FC<QuickAccessPanelProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { getActiveShortcuts } = useKeyboard();
  
  // Get active shortcuts
  const activeShortcuts = useMemo(() => {
    return getActiveShortcuts().filter(shortcut => !shortcut.hidden);
  }, [getActiveShortcuts]);
  
  // Filter shortcuts based on search term
  const filteredShortcuts = useMemo(() => {
    if (!searchTerm) return activeShortcuts;
    
    const search = searchTerm.toLowerCase();
    return activeShortcuts.filter(shortcut => 
      shortcut.description.toLowerCase().includes(search) ||
      shortcut.key.toLowerCase().includes(search) ||
      shortcut.category.toLowerCase().includes(search)
    );
  }, [activeShortcuts, searchTerm]);
  
  // Group shortcuts by category
  const groupedShortcuts = useMemo(() => {
    const groups: Record<string, KeyboardShortcut[]> = {};
    
    filteredShortcuts.forEach(shortcut => {
      const category = shortcut.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(shortcut);
    });
    
    return groups;
  }, [filteredShortcuts]);
  
  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedIndex(0);
      // Focus search input after a small delay to ensure modal is rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);
  
  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredShortcuts.length - 1 ? prev + 1 : prev
          );
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
          
        case 'Enter':
          e.preventDefault();
          if (filteredShortcuts[selectedIndex]) {
            executeShortcut(filteredShortcuts[selectedIndex]);
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredShortcuts, selectedIndex, onClose]);
  
  const executeShortcut = (shortcut: KeyboardShortcut) => {
    onClose();
    // Create a synthetic keyboard event
    const event = new KeyboardEvent('keydown', {
      key: shortcut.key.split('+').pop() || '',
      ctrlKey: shortcut.key.includes('ctrl'),
      shiftKey: shortcut.key.includes('shift'),
      altKey: shortcut.key.includes('alt'),
      metaKey: shortcut.key.includes('cmd'),
      bubbles: true,
      cancelable: true
    });
    shortcut.handler(event);
  };
  
  const formatKeyCombo = (key: string) => {
    const parts = key.split('+');
    return parts.map((part, index) => {
      const formatted = part.charAt(0).toUpperCase() + part.slice(1);
      return (
        <kbd
          key={index}
          className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded"
        >
          {formatted === 'Ctrl' ? '⌃' : 
           formatted === 'Cmd' ? '⌘' : 
           formatted === 'Alt' ? '⌥' : 
           formatted === 'Shift' ? '⇧' : 
           formatted === 'Enter' ? '↵' : 
           formatted === 'Escape' ? 'Esc' : 
           formatted === 'Arrowup' ? '↑' : 
           formatted === 'Arrowdown' ? '↓' : 
           formatted === 'Arrowleft' ? '←' : 
           formatted === 'Arrowright' ? '→' : 
           formatted === 'Tab' ? '⇥' : 
           formatted === 'Space' ? '␣' : 
           formatted}
        </kbd>
      );
    });
  };
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'terminal':
        return '🖥️';
      case 'navigation':
        return '🧭';
      case 'actions':
        return '⚡';
      case 'editor':
        return '✏️';
      case 'global':
        return '🌐';
      default:
        return '📌';
    }
  };
  
  const getCategoryLabel = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };
  
  if (!isOpen) return null;
  
  let currentIndex = 0;
  
  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-24"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type to filter commands..."
              className="flex-1 outline-none text-sm"
              autoFocus
            />
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {filteredShortcuts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchTerm ? 'No commands match your search' : 'No commands available in this context'}
            </div>
          ) : (
            <div className="py-2">
              {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                <div key={category} className="mb-4">
                  <div className="px-4 py-1 text-xs font-medium text-gray-500 flex items-center gap-2">
                    <span>{getCategoryIcon(category)}</span>
                    <span>{getCategoryLabel(category)}</span>
                  </div>
                  <div>
                    {shortcuts.map((shortcut) => {
                      const isSelected = currentIndex === selectedIndex;
                      const index = currentIndex++;
                      
                      return (
                        <button
                          key={shortcut.id}
                          onClick={() => executeShortcut(shortcut)}
                          onMouseEnter={() => setSelectedIndex(index)}
                          className={`w-full px-4 py-2 text-left flex items-center justify-between hover:bg-gray-50 transition-colors ${
                            isSelected ? 'bg-blue-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {shortcut.icon && (
                              <span className="text-gray-400">
                                {typeof shortcut.icon === 'string' ? shortcut.icon : <shortcut.icon className="w-4 h-4" />}
                              </span>
                            )}
                            <span className="text-sm text-gray-700">{shortcut.description}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {formatKeyCombo(shortcut.key)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">↑</kbd>
              <kbd className="px-1 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">↵</kbd>
              Execute
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">Esc</kbd>
              Close
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Command className="w-3 h-3" />
            <span>Quick Access</span>
          </div>
        </div>
      </div>
    </div>
  );
};