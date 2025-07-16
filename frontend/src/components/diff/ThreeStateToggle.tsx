import React from 'react';

export type ToggleOption = 'working' | 'all' | 'base';

interface ThreeStateToggleProps {
  value: ToggleOption;
  onChange: (value: ToggleOption) => void;
  disabled?: boolean;
  disabledOptions?: ToggleOption[];
  className?: string;
}

interface OptionConfig {
  value: ToggleOption;
  label: string;
  tooltip: string;
}

const OPTIONS: OptionConfig[] = [
  {
    value: 'working',
    label: 'Working Tree',
    tooltip: 'Show uncommitted changes (staged, unstaged, and untracked files)'
  },
  {
    value: 'all',
    label: 'All Changes',
    tooltip: 'Show all changes including commits not yet in base branch'
  },
  {
    value: 'base',
    label: 'Base Branch',
    tooltip: 'Show only committed changes compared to base branch'
  }
];

export const ThreeStateToggle: React.FC<ThreeStateToggleProps> = ({
  value,
  onChange,
  disabled = false,
  disabledOptions = [],
  className = ''
}) => {
  const activeIndex = OPTIONS.findIndex(opt => opt.value === value);
  const itemWidth = 100 / OPTIONS.length;
  
  return (
    <div className={`flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 ${className}`}>
      {OPTIONS.map((option) => {
        const isActive = value === option.value;
        const isDisabled = disabled || disabledOptions.includes(option.value);
        
        return (
          <button
            key={option.value}
            onClick={() => !isDisabled && onChange(option.value)}
            disabled={isDisabled}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium 
              transition-all duration-200
              ${isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }
              ${isDisabled 
                ? 'cursor-not-allowed opacity-50' 
                : 'cursor-pointer'
              }
            `}
            title={option.tooltip}
            role="radio"
            aria-checked={isActive}
            aria-label={option.label}
          >
            <span>{option.label}</span>
            {isDisabled && !disabled && (
              <span className="text-xs text-gray-400">(disabled)</span>
            )}
          </button>
        );
      })}
    </div>
  );
};

