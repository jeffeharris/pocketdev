import React from 'react';
import { ArrowRight, GitBranch, AlertCircle, CheckCircle, GitMerge, GitPullRequest, RefreshCw } from 'lucide-react';

export const MergeStatesDiagram: React.FC = () => {
  const states = [
    {
      name: 'Development',
      description: 'AI is working on the task',
      icon: GitBranch,
      color: 'blue',
      gitConditions: 'Any state',
      actions: [
        { label: 'Continue coding', next: 'Development' },
        { label: 'Check merge readiness', next: 'Checking' }
      ]
    },
    {
      name: 'Checking',
      description: 'Evaluating merge readiness',
      icon: RefreshCw,
      color: 'gray',
      gitConditions: 'Fetching latest',
      actions: [
        { label: 'If up-to-date & no conflicts', next: 'Ready to Merge' },
        { label: 'If behind main', next: 'Needs Update' },
        { label: 'If has conflicts', next: 'Has Conflicts' }
      ]
    },
    {
      name: 'Ready to Merge',
      description: 'Can be merged cleanly',
      icon: CheckCircle,
      color: 'green',
      gitConditions: 'ahead &gt; 0, behind = 0, conflicts = false',
      actions: [
        { label: 'Create PR', next: 'PR Created' },
        { label: 'Direct merge', next: 'Merged' },
        { label: 'Continue work', next: 'Development' }
      ]
    },
    {
      name: 'Needs Update',
      description: 'Behind main branch',
      icon: ArrowRight,
      color: 'orange',
      gitConditions: 'behind &gt; 0, conflicts = false',
      actions: [
        { label: 'Update branch (merge)', next: 'Updating' },
        { label: 'Update branch (rebase)', next: 'Updating' },
        { label: 'Merge anyway', next: 'Ready to Merge', note: 'if allowed' }
      ]
    },
    {
      name: 'Has Conflicts',
      description: 'Merge conflicts detected',
      icon: AlertCircle,
      color: 'red',
      gitConditions: 'conflicts = true',
      actions: [
        { label: 'AI resolve conflicts', next: 'Development' },
        { label: 'Manual resolve', next: 'Development' },
        { label: 'Abort merge', next: 'Development' }
      ]
    },
    {
      name: 'Updating',
      description: 'Pulling latest changes',
      icon: RefreshCw,
      color: 'yellow',
      gitConditions: 'In progress',
      actions: [
        { label: 'If successful', next: 'Ready to Merge' },
        { label: 'If conflicts', next: 'Has Conflicts' }
      ]
    },
    {
      name: 'PR Created',
      description: 'Pull request open',
      icon: GitPullRequest,
      color: 'purple',
      gitConditions: 'PR exists',
      actions: [
        { label: 'Merge PR', next: 'Merged' },
        { label: 'Update PR', next: 'Development' },
        { label: 'Close PR', next: 'Development' }
      ]
    },
    {
      name: 'Merged',
      description: 'Code merged to main',
      icon: GitMerge,
      color: 'green',
      gitConditions: 'Merged to base branch',
      actions: [
        { label: 'Archive task', next: 'Archived' },
        { label: 'Continue with new task', next: 'New Task' },
        { label: 'Make more changes', next: 'Post-Merge Development' }
      ]
    },
    {
      name: 'Post-Merge Development',
      description: 'Making changes after merge',
      icon: GitBranch,
      color: 'amber',
      gitConditions: 'has_commits_since_merge = true',
      actions: [
        { label: 'Create new PR', next: 'PR Created' },
        { label: 'Merge again', next: 'Checking' },
        { label: 'Continue as hotfix', next: 'Development' }
      ]
    }
  ];

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">Task Merge States & Transitions</h1>
        
        {/* State Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {states.map((state) => {
            const Icon = state.icon;
            return (
              <div key={state.name} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className={`p-2 rounded-lg bg-${state.color}-50`}>
                    <Icon className={`w-6 h-6 text-${state.color}-600`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{state.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{state.description}</p>
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-500 mb-1">Git Conditions:</p>
                  <p className="text-xs text-gray-700 font-mono bg-gray-50 p-2 rounded">
                    {state.gitConditions}
                  </p>
                </div>
                
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Available Actions:</p>
                  <div className="space-y-2">
                    {state.actions.map((action, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">{action.label}</span>
                        <span className="text-gray-500">→ {action.next}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Key Scenarios */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Common Merge Scenarios</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Scenario 1: Happy Path</h3>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">Development</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-gray-50 text-gray-700 rounded">Checking</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded">Ready to Merge</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded font-medium">Merged</span>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Scenario 2: Needs Update</h3>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">Development</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-gray-50 text-gray-700 rounded">Checking</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded">Needs Update</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded">Updating</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded">Ready to Merge</span>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Scenario 3: Conflict Resolution</h3>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">Development</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded">Needs Update</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-yellow-50 text-yellow-700 rounded">Updating</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-red-50 text-red-700 rounded">Has Conflicts</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">Development</span>
                <span className="text-xs text-gray-500">(resolve)</span>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Scenario 4: Post-Merge Changes</h3>
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded">Merged</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded">Post-Merge Dev</span>
                <span className="text-xs text-gray-500">(bug fix needed)</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-gray-50 text-gray-700 rounded">Checking</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded">Ready to Merge</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded font-medium">Merged</span>
                <span className="text-xs text-gray-500">(again)</span>
              </div>
            </div>
          </div>
        </div>

        {/* State to Status Mapping */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Merge State to Status Display Mapping</h2>
          <p className="text-sm text-gray-600 mb-4">Shows only merge-related status badges. Worker status (Idle, Working, Needs Input) is displayed separately.</p>
          
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="font-medium text-gray-700">Task State</div>
              <div className="font-medium text-gray-700">Git Condition</div>
              <div className="font-medium text-gray-700">Merge Status Display</div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm py-2 border-t">
              <div>Development</div>
              <div className="text-gray-600">Any</div>
              <div className="flex gap-2">
                <span className="text-xs text-gray-500">No merge status shown</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm py-2 border-t">
              <div>Development</div>
              <div className="text-gray-600">behind &gt; 0</div>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs" title="X commits behind main">↓X</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm py-2 border-t">
              <div>Development</div>
              <div className="text-gray-600">ahead &gt; 0, behind &gt; 0</div>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs" title="X commits ahead of main">↑X</span>
                <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs" title="Y commits behind main">↓Y</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm py-2 border-t">
              <div>Has Conflicts</div>
              <div className="text-gray-600">conflicts = true</div>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs">Conflicts</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm py-2 border-t">
              <div>Ready to Merge</div>
              <div className="text-gray-600">up to date, no conflicts</div>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">Ready</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm py-2 border-t">
              <div>Merged</div>
              <div className="text-gray-600">merged = true</div>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">Merged</span>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-sm py-2 border-t">
              <div>Post-Merge Development</div>
              <div className="text-gray-600">has_commits_since_merge = true</div>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">Merged</span>
                <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs">+Changes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions by State */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-8">
          <h2 className="text-lg font-semibold mb-4">Primary Actions by State</h2>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h3 className="font-medium mb-2">When Behind Main:</h3>
                <div className="space-y-2">
                  <button className="w-full text-left px-3 py-2 bg-orange-50 text-orange-700 rounded text-sm hover:bg-orange-100">
                    🔄 Update Branch (merge main)
                  </button>
                  <button className="w-full text-left px-3 py-2 bg-orange-50 text-orange-700 rounded text-sm hover:bg-orange-100">
                    📐 Rebase on Main
                  </button>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">When Has Conflicts:</h3>
                <div className="space-y-2">
                  <button className="w-full text-left px-3 py-2 bg-red-50 text-red-700 rounded text-sm hover:bg-red-100">
                    🤖 Let AI Resolve
                  </button>
                  <button className="w-full text-left px-3 py-2 bg-red-50 text-red-700 rounded text-sm hover:bg-red-100">
                    ✏️ Open Terminal
                  </button>
                  <button className="w-full text-left px-3 py-2 bg-gray-50 text-gray-700 rounded text-sm hover:bg-gray-100">
                    ❌ Abort & Reset
                  </button>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-8 mt-4">
              <div>
                <h3 className="font-medium mb-2">When Ready to Merge:</h3>
                <div className="space-y-2">
                  <button className="w-full text-left px-3 py-2 bg-green-50 text-green-700 rounded text-sm hover:bg-green-100">
                    🔀 Create Pull Request
                  </button>
                  <button className="w-full text-left px-3 py-2 bg-green-50 text-green-700 rounded text-sm hover:bg-green-100">
                    ✅ Direct Merge
                  </button>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">When Merged but Has New Changes:</h3>
                <div className="space-y-2">
                  <button className="w-full text-left px-3 py-2 bg-amber-50 text-amber-700 rounded text-sm hover:bg-amber-100">
                    🔀 Create Follow-up PR
                  </button>
                  <button className="w-full text-left px-3 py-2 bg-amber-50 text-amber-700 rounded text-sm hover:bg-amber-100">
                    🔄 Re-merge to Main
                  </button>
                  <button className="w-full text-left px-3 py-2 bg-gray-50 text-gray-700 rounded text-sm hover:bg-gray-100">
                    🆕 Start Fresh Task
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-6 mt-8">
          <h2 className="text-lg font-semibold mb-4 text-amber-900">Post-Merge Considerations</h2>
          
          <div className="space-y-3 text-sm text-amber-800">
            <div className="flex gap-3">
              <span className="text-amber-600">⚠️</span>
              <div>
                <strong>Branch Divergence:</strong> After merging, if you continue making changes on the feature branch, 
                it diverges from main again. The task shows as "Merged +Changes" to indicate this state.
              </div>
            </div>
            
            <div className="flex gap-3">
              <span className="text-amber-600">💡</span>
              <div>
                <strong>Best Practice:</strong> After merging, either archive the task or create a new task for follow-up work. 
                This keeps the git history clean and makes it clear what work relates to which merge.
              </div>
            </div>
            
            <div className="flex gap-3">
              <span className="text-amber-600">🔍</span>
              <div>
                <strong>Detection:</strong> The backend tracks this with the <code className="bg-amber-100 px-1 rounded">has_commits_since_merge</code> flag, 
                which gets set to true when new commits are detected after a merge.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};