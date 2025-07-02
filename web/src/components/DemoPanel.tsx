import React from 'react';
import { Sparkles, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

interface DemoScenario {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  data: {
    repository: string;
    description: string;
    acceptanceCriteria: string[];
    gitUsername?: string;
    gitToken?: string;
  };
}

const demoScenarios: DemoScenario[] = [
  {
    id: 'all-wrong',
    name: 'Everything Wrong',
    description: 'Multiple validation errors to showcase supervisor',
    icon: <AlertCircle className="h-5 w-5 text-red-500" />,
    data: {
      repository: 'not-a-url',
      description: 'Fix',
      acceptanceCriteria: [],
      gitUsername: 'wrong',
      gitToken: 'wrong'
    }
  },
  {
    id: 'missing-creds',
    name: 'Missing Credentials',
    description: 'Valid task but no API/Git credentials',
    icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
    data: {
      repository: 'https://github.com/octocat/Hello-World',
      description: 'Add a React component that displays current date and time, updating every second',
      acceptanceCriteria: [
        'Component shows date in readable format',
        'Time updates every second',
        'Has clean, modern styling'
      ]
    }
  },
  {
    id: 'vague-task',
    name: 'Vague Task',
    description: 'Too brief description, no acceptance criteria',
    icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
    data: {
      repository: 'https://github.com/facebook/react',
      description: 'Add feature',
      acceptanceCriteria: [],
      gitUsername: 'demo-user',
      gitToken: 'demo-token'
    }
  },
  {
    id: 'perfect-task',
    name: 'Perfect Task',
    description: 'Everything correct (needs real credentials)',
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
    data: {
      repository: 'https://github.com/octocat/Hello-World',
      description: 'Add a footer component that displays copyright notice with current year',
      acceptanceCriteria: [
        'Footer sticks to bottom of page',
        'Shows "© 2024 Your Company" with current year',
        'Uses same styling as header',
        'Updates year automatically on Jan 1st'
      ],
      gitUsername: import.meta.env.VITE_DEMO_GIT_USER || '',
      gitToken: import.meta.env.VITE_DEMO_GIT_TOKEN || ''
    }
  }
];

interface Props {
  onRunScenario: (scenario: DemoScenario) => void;
}

export function DemoPanel({ onRunScenario }: Props) {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  
  if (!isDemoMode) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow-xl border border-purple-200 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <h3 className="font-semibold text-purple-900">Demo Scenarios</h3>
        <span className="ml-auto text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">DEMO MODE</span>
      </div>
      
      <div className="space-y-2">
        {demoScenarios.map(scenario => (
          <button
            key={scenario.id}
            onClick={() => {
              onRunScenario(scenario);
              toast.success(`Running demo: ${scenario.name}`);
            }}
            className="w-full flex items-start gap-3 p-3 bg-white rounded-lg hover:shadow-md transition-shadow text-left group"
          >
            <div className="flex-shrink-0 mt-0.5">{scenario.icon}</div>
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 group-hover:text-purple-700 transition-colors">
                {scenario.name}
              </h4>
              <p className="text-sm text-gray-600">{scenario.description}</p>
            </div>
            <Zap className="h-4 w-4 text-gray-400 group-hover:text-purple-600 transition-colors mt-0.5" />
          </button>
        ))}
      </div>
      
      <div className="mt-4 p-3 bg-purple-100 rounded-lg">
        <p className="text-xs text-purple-800">
          <strong>Tip:</strong> Start with "Everything Wrong" to show the supervisor's full capabilities
        </p>
      </div>
    </div>
  );
}