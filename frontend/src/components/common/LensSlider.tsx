import React, { useState } from 'react';
import { ValidationPanel } from '../validation/ValidationPanel';
import { MergePanel } from '../merge/MergePanel';

interface LensSliderProps {
  taskId: string;
  validationMode: boolean;
  activePhase: 'validate' | 'merge';
  onPhaseChange: (phase: 'validate' | 'merge') => void;
  onClose: () => void;
  panelHeight?: number;
  onHeightChange?: (height: number) => void;
  isDragging?: boolean;
  onDraggingChange?: (dragging: boolean) => void;
}

export const LensSlider: React.FC<LensSliderProps> = ({
  taskId,
  validationMode,
  activePhase,
  onPhaseChange,
  onClose,
  panelHeight = 40,
  onHeightChange,
  isDragging = false,
  onDraggingChange
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [localPanelHeight, setLocalPanelHeight] = useState(panelHeight);
  const [localIsDragging, setLocalIsDragging] = useState(false);
  
  // Use props if provided, otherwise use local state
  const effectivePanelHeight = onHeightChange ? panelHeight : localPanelHeight;
  const effectiveIsDragging = onDraggingChange ? isDragging : localIsDragging;

  const handlePhaseSwitch = (newPhase: 'validate' | 'merge') => {
    if (newPhase === activePhase || isTransitioning) return;
    
    setIsTransitioning(true);
    onPhaseChange(newPhase);
    setTimeout(() => {
      setIsTransitioning(false);
    }, 1000);
  };

  if (!validationMode) return null;

  return (
    <div 
      className="flex-shrink-0 flex flex-col"
      style={{ height: `${effectivePanelHeight}%` }}
    >
      {/* Resize Handle */}
      <div 
        className={`relative h-2 cursor-row-resize transition-all flex items-center justify-center flex-shrink-0 group ${
          effectiveIsDragging ? 'bg-blue-500' : 'bg-gray-700 hover:bg-blue-500'
        }`}
        onMouseDown={(e) => {
          e.preventDefault();
          if (onDraggingChange) {
            onDraggingChange(true);
          } else {
            setLocalIsDragging(true);
          }
          const startY = e.clientY;
          const startHeight = effectivePanelHeight;
          const containerHeight = window.innerHeight;
          
          const handleMouseMove = (e: MouseEvent) => {
            const deltaY = startY - e.clientY; // Inverted because we're measuring from bottom
            const deltaPercent = (deltaY / containerHeight) * 100;
            const newHeight = Math.max(20, Math.min(80, startHeight + deltaPercent));
            if (onHeightChange) {
              onHeightChange(newHeight);
            } else {
              setLocalPanelHeight(newHeight);
            }
          };
          
          const handleMouseUp = () => {
            if (onDraggingChange) {
              onDraggingChange(false);
            } else {
              setLocalIsDragging(false);
            }
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      >
        <div className={`w-12 h-1 rounded transition-all ${effectiveIsDragging ? 'bg-white' : 'bg-gray-400 group-hover:bg-gray-300'}`}></div>
        {effectiveIsDragging && (
          <div className="absolute left-1/2 -translate-x-1/2 -top-8 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg">
            {Math.round(effectivePanelHeight)}%
          </div>
        )}
      </div>
      
      {/* Panel Content */}
      <div className="relative overflow-hidden flex-1">
        {/* Base layer - Merge Panel (always rendered) */}
        <MergePanel taskId={taskId} onClose={onClose} />

        {/* Sliding layer - Validation Panel */}
        <div 
          className="absolute inset-0 transition-all duration-1000 ease-in-out"
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
          className="absolute top-0 bottom-0 transition-all duration-1000 ease-in-out z-10"
          style={{ 
            left: activePhase === 'validate' ? 'calc(100% - 0.5px)' : '-0.5px'
          }}
        >
          {/* Main Divider Line */}
          <div className="absolute top-0 bottom-0 w-1 bg-blue-500 shadow-lg" />
          
          {/* Toggle Tab */}
          <button
            onClick={() => handlePhaseSwitch(activePhase === 'validate' ? 'merge' : 'validate')}
            className={`absolute top-1/2 -translate-y-1/2 transition-all duration-300 shadow-lg hover:shadow-xl opacity-70 hover:opacity-100 ${
              activePhase === 'validate'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            } ${isTransitioning ? 'pointer-events-none' : ''}`}
            style={{ 
              writingMode: 'vertical-rl', 
              textOrientation: 'mixed',
              width: '2rem',
              height: '6rem',
              left: activePhase === 'validate' ? '-2rem' : 'auto',
              right: activePhase === 'validate' ? 'auto' : '-2rem',
              borderRadius: activePhase === 'validate' ? '0.5rem 0 0 0.5rem' : '0 0.5rem 0.5rem 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem 0.25rem'
            }}
          >
            <span className="text-sm font-bold tracking-wider">
              {activePhase === 'validate' ? 'MERGE' : 'VALIDATE'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};