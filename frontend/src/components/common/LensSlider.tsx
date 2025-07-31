import React, { useState } from 'react';
import { ValidationPanel } from '../validation/ValidationPanel';
import { MergePanel } from '../merge/MergePanel';

interface LensSliderProps {
  taskId: string;
  validationMode: boolean;
  activePhase: 'validate' | 'merge';
  onPhaseChange: (phase: 'validate' | 'merge') => void;
  onClose: () => void;
}

export const LensSlider: React.FC<LensSliderProps> = ({
  taskId,
  validationMode,
  activePhase,
  onPhaseChange,
  onClose
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handlePhaseSwitch = (newPhase: 'validate' | 'merge') => {
    if (newPhase === activePhase || isTransitioning) return;
    
    setIsTransitioning(true);
    onPhaseChange(newPhase);
    setTimeout(() => {
      setIsTransitioning(false);
    }, 700);
  };

  if (!validationMode) return null;

  return (
    <div 
      className="flex-shrink-0 flex flex-col"
      style={{ height: '40%' }}
    >
      {/* Resize Handle */}
      <div className="h-1 bg-gray-600 cursor-row-resize hover:bg-blue-500 transition-colors flex items-center justify-center flex-shrink-0">
        <div className="w-8 h-0.5 bg-gray-400 rounded"></div>
      </div>
      
      {/* Panel Content */}
      <div className="relative overflow-hidden flex-1">
        {/* Base layer - Merge Panel (always rendered) */}
        <MergePanel taskId={taskId} onClose={onClose} />

        {/* Sliding layer - Validation Panel */}
        <div 
          className="absolute inset-0 transition-clip-path"
          style={{ 
            clipPath: activePhase === 'validate' 
              ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' // Full coverage
              : 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)'      // No coverage
          }}
        >
          <ValidationPanel taskId={taskId} onClose={onClose} />
        </div>

        {/* Sliding Divider Line with Toggle */}
        <div 
          className="absolute top-0 bottom-0 transition-all duration-700 ease-in-out z-10"
          style={{ 
            left: activePhase === 'validate' ? 'calc(100% - 0.5px)' : '-0.5px'
          }}
        >
          {/* Main Divider Line */}
          <div className="absolute top-0 bottom-0 w-1 bg-blue-500 shadow-lg" />
          
          {/* Toggle Tab - moves with the divider */}
          <button
            onClick={() => handlePhaseSwitch(activePhase === 'validate' ? 'merge' : 'validate')}
            className={`absolute top-1/2 -translate-y-1/2 px-2 py-8 transition-all duration-300 shadow-lg hover:shadow-xl ${
              activePhase === 'validate' 
                ? 'bg-green-600 hover:bg-green-700 -right-8 rounded-l-none' 
                : 'bg-purple-600 hover:bg-purple-700 -left-8 rounded-r-none'
            } ${isTransitioning ? 'pointer-events-none' : ''}`}
            style={{ 
              writingMode: 'vertical-rl', 
              textOrientation: 'mixed',
              borderRadius: activePhase === 'validate' ? '8px 0 0 8px' : '0 8px 8px 0'
            }}
          >
            <span className="text-xs font-bold tracking-wider text-white">
              {activePhase === 'validate' ? 'MERGE' : 'VALIDATE'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};