import React, { useState } from 'react';
import { X } from 'lucide-react';

export interface SessionOptions {
  aiAgent: string;
  workingDirectory?: string;
  initialPrompt?: string;
  tabName?: string;
  template?: 'custom' | 'planning' | 'testing' | 'merge-resolution';
}

interface SessionLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunch: (options: SessionOptions) => void;
  taskPath: string;
}

const AI_AGENTS = [
  { value: 'claude', label: 'Claude', command: 'claude' },
  { value: 'aider', label: 'Aider', command: 'aider' },
  { value: 'codex', label: 'Codex', command: 'codex' },
  { value: 'gemini', label: 'Gemini', command: 'gemini' }
];

const TEMPLATES = {
  custom: {
    label: 'Custom',
    prompts: {}
  },
  planning: {
    label: 'Planning Preset',
    prompts: {
      requirements: 'You are a requirements analyst. Help define and refine requirements in EARS format.',
      design: 'You are a system architect. Help design technical solutions and create design documents.',
      tasks: 'You are a project planner. Help break down work into actionable tasks and implementation steps.'
    }
  },
  testing: {
    label: 'Testing',
    prompts: {
      default: 'You are a test engineer. Help write comprehensive tests, improve test coverage, and ensure code quality.'
    }
  },
  'merge-resolution': {
    label: 'Merge Resolution',
    prompts: {
      default: 'You are helping resolve git conflicts. Show me each conflicted section, explain what would be lost by choosing either version, then suggest a resolution.'
    }
  }
};

export function SessionLauncher({ isOpen, onClose, onLaunch, taskPath }: SessionLauncherProps) {
  const [aiAgent, setAiAgent] = useState('claude');
  const [workingDirectory, setWorkingDirectory] = useState('');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [tabName, setTabName] = useState('');
  const [template, setTemplate] = useState<keyof typeof TEMPLATES>('custom');

  if (!isOpen) return null;

  const handleTemplateChange = (newTemplate: keyof typeof TEMPLATES) => {
    setTemplate(newTemplate);
    
    // Clear prompt for custom template
    if (newTemplate === 'custom') {
      setInitialPrompt('');
      return;
    }

    // Set default prompt for single-prompt templates
    const templateConfig = TEMPLATES[newTemplate];
    if ('default' in templateConfig.prompts) {
      setInitialPrompt(templateConfig.prompts.default);
    }
  };

  const handleLaunch = () => {
    // Handle planning preset - launch multiple tabs
    if (template === 'planning') {
      const planningPrompts = TEMPLATES.planning.prompts;
      
      // Launch Requirements tab
      onLaunch({
        aiAgent,
        workingDirectory: workingDirectory || undefined,
        initialPrompt: planningPrompts.requirements,
        tabName: 'Requirements'
      });

      // Launch Design tab
      setTimeout(() => {
        onLaunch({
          aiAgent,
          workingDirectory: workingDirectory || undefined,
          initialPrompt: planningPrompts.design,
          tabName: 'Design'
        });
      }, 500);

      // Launch Tasks tab
      setTimeout(() => {
        onLaunch({
          aiAgent,
          workingDirectory: workingDirectory || undefined,
          initialPrompt: planningPrompts.tasks,
          tabName: 'Tasks'
        });
      }, 1000);

      onClose();
      return;
    }

    // Single tab launch
    onLaunch({
      aiAgent,
      workingDirectory: workingDirectory || undefined,
      initialPrompt: initialPrompt || undefined,
      tabName: tabName || undefined,
      template
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Launch AI Session</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Template Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Session Template
            </label>
            <select
              value={template}
              onChange={(e) => handleTemplateChange(e.target.value as keyof typeof TEMPLATES)}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              {Object.entries(TEMPLATES).map(([key, config]) => (
                <option key={key} value={key}>{config.label}</option>
              ))}
            </select>
            {template === 'planning' && (
              <p className="text-xs text-yellow-400 mt-1">
                This will create 3 tabs: Requirements, Design, and Tasks
              </p>
            )}
          </div>

          {/* AI Agent Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              AI Agent
            </label>
            <select
              value={aiAgent}
              onChange={(e) => setAiAgent(e.target.value)}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              {AI_AGENTS.map(agent => (
                <option key={agent.value} value={agent.value}>{agent.label}</option>
              ))}
            </select>
          </div>

          {/* Tab Name (if not using preset) */}
          {template !== 'planning' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Tab Name (optional)
              </label>
              <input
                type="text"
                value={tabName}
                onChange={(e) => setTabName(e.target.value)}
                placeholder="e.g., Feature Implementation"
                className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Working Directory */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Working Directory (optional)
            </label>
            <input
              type="text"
              value={workingDirectory}
              onChange={(e) => setWorkingDirectory(e.target.value)}
              placeholder={`e.g., src/components (relative to ${taskPath})`}
              className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Initial Prompt */}
          {template === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Initial Prompt (optional)
              </label>
              <textarea
                value={initialPrompt}
                onChange={(e) => setInitialPrompt(e.target.value)}
                placeholder="Provide context or instructions for the AI..."
                rows={4}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Show readonly prompt for templates */}
          {template !== 'custom' && template !== 'planning' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Template Prompt
              </label>
              <div className="bg-gray-900 p-3 rounded text-sm text-gray-400">
                {initialPrompt}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleLaunch}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {template === 'planning' ? 'Launch 3 Tabs' : 'Launch Session'}
          </button>
        </div>
      </div>
    </div>
  );
}