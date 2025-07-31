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

        {/* Toggle Tab - Attached to panel edge */}
        <button
          onClick={() => handlePhaseSwitch(activePhase === 'validate' ? 'merge' : 'validate')}
          className={`absolute top-1/2 -translate-y-1/2 w-12 h-32 transition-all duration-300 shadow-lg hover:shadow-xl ${
            activePhase === 'validate' 
              ? 'right-0 bg-gradient-to-r from-purple-600 to-green-600 hover:from-purple-700 hover:to-green-700' 
              : 'left-0 bg-gradient-to-l from-green-600 to-purple-600 hover:from-green-700 hover:to-purple-700'
          } ${isTransitioning ? 'pointer-events-none' : ''}`}
          style={{ 
            writingMode: 'vertical-rl', 
            textOrientation: 'mixed',
            borderRadius: activePhase === 'validate' ? '0 8px 8px 0' : '8px 0 0 8px'
          }}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <span className={`text-xs font-bold tracking-wider ${activePhase === 'validate' ? 'text-white' : 'text-white/60'}`}>
              VALIDATE
            </span>
            <div className="w-4 h-0.5 bg-white/30 my-1"></div>
            <span className={`text-xs font-bold tracking-wider ${activePhase === 'merge' ? 'text-white' : 'text-white/60'}`}>
              MERGE
            </span>
          </div>
        </button>
        
        {/* Sliding Divider Line */}
        <div 
          className="absolute top-0 bottom-0 w-1 bg-blue-500 shadow-lg transition-all duration-700 ease-in-out z-10"
          style={{ 
            left: activePhase === 'validate' ? 'calc(100% - 0.5px)' : '-0.5px'
          }}
        />
      </div>
    </div>
  );
};