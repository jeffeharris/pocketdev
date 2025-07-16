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
    label: 'Working',
    tooltip: 'Show uncommitted changes in your working directory'
  },
  {
    value: 'all',
    label: 'All',
    tooltip: 'Show everything that would be merged (uncommitted + commits)'
  },
  {
    value: 'base',
    label: 'Branch',
    tooltip: 'Show what this branch adds compared to the base branch'
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
              flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap
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
          </button>
        );
      })}
    </div>
  );
};

