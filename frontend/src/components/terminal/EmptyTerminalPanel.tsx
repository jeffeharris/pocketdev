import { useState } from 'react';
import { Sparkles, MoreHorizontal, Terminal, Settings } from 'lucide-react';

interface EmptyTerminalPanelProps {
  onCreateTerminal: (type: 'claude' | 'bash' | 'advanced') => void;
  layout: {
    mode: 'tab' | 'split' | 'split-4';
    orientation?: 'vertical' | 'horizontal';
  };
}

export function EmptyTerminalPanel({ onCreateTerminal, layout }: EmptyTerminalPanelProps) {
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Determine if buttons should be horizontal based on layout
  const isHorizontalLayout = layout.mode === 'split' && layout.orientation === 'horizontal';

  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      <div className={`flex ${isHorizontalLayout ? 'flex-row' : 'flex-col'} gap-4`}>
        {/* Claude button - primary action */}
        <button
          onClick={() => onCreateTerminal('claude')}
          className="flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <Sparkles className="w-6 h-6" />
          <span className="text-lg font-medium">Claude</span>
        </button>

        {/* More Options button with dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowMoreOptions(!showMoreOptions)}
            className="flex items-center justify-center gap-3 px-8 py-4 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <MoreHorizontal className="w-6 h-6" />
            <span className="text-lg font-medium">More Options</span>
          </button>

          {/* Dropdown menu */}
          {showMoreOptions && (
            <div className={`absolute ${isHorizontalLayout ? 'top-full left-0 mt-2' : 'left-full top-0 ml-2'} z-50`}>
              <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[200px]">
                <button
                  onClick={() => {
                    onCreateTerminal('bash');
                    setShowMoreOptions(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors text-left"
                >
                  <Terminal className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-200">Terminal</span>
                </button>
                <button
                  onClick={() => {
                    onCreateTerminal('advanced');
                    setShowMoreOptions(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors text-left border-t border-gray-700"
                >
                  <Settings className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-200">Advanced</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}