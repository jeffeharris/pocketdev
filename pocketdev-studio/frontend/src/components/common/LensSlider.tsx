import React, { useState } from 'react';
import { ValidationPanel } from '../validation/ValidationPanel.tsx';
import { MergePanel } from '../merge/MergePanel.tsx';

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
      className="relative overflow-hidden"
      style={{ height: '40%' }}
    >
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

      {/* Sliding Divider Line with Edge Toggles */}
      <div 
        className="absolute top-0 bottom-0 transition-all duration-700 ease-in-out z-10"
        style={{ 
          left: activePhase === 'validate' ? 'calc(100% - 0.5px)' : '-0.5px'
        }}
      >
        {/* Main Divider Line */}
        <div className="absolute top-0 bottom-0 w-1 bg-blue-500 shadow-lg" />
        
        {/* Edge Toggle */}
        <button
          onClick={() => handlePhaseSwitch(activePhase === 'validate' ? 'merge' : 'validate')}
          className={`absolute top-1/2 -translate-y-1/2 px-2 py-8 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl ${
            activePhase === 'validate'
              ? 'bg-green-600 text-white hover:bg-green-700 -left-8 rounded-r-none'
              : 'bg-purple-600 text-white hover:bg-purple-700 -right-8 rounded-l-none'
          } ${isTransitioning ? 'pointer-events-none' : ''}`}
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
        >
          <span className="text-xs font-bold tracking-wider">
            {activePhase === 'validate' ? 'MERGE' : 'VALIDATE'}
          </span>
        </button>
      </div>
    </div>
  );
};