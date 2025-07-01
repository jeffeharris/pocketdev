import React, { useState } from 'react';
import { 
  GitBranch, Clock, CheckCircle, AlertTriangle, User, 
  ExternalLink, RotateCcw, Settings, Eye, Terminal, 
  Code2, Play, Pause, Square, Zap, Monitor, Activity,
  ChevronLeft, MoreHorizontal, RefreshCw, Maximize2,
  Bell, ChevronRight, FileText, TestTube, AlertCircle,
  Plus, Archive
} from 'lucide-react';

// Task Status Components
const TaskStatus = ({ status }) => {
  const statusConfig = {
    idle: { 
      icon: CheckCircle, 
      label: 'Idle',
      colorClass: 'bg-blue-100 text-blue-700 border-blue-300'
    },
    'user-request': { 
      icon: User, 
      label: 'User Request',
      colorClass: 'bg-purple-100 text-purple-700 border-purple-300'
    },
    thinking: { 
      icon: Clock, 
      label: 'Thinking',
      colorClass: 'bg-yellow-100 text-yellow-700 border-yellow-300'
    },
    working: { 
      icon: Activity, 
      label: 'Working',
      colorClass: 'bg-yellow-100 text-yellow-700 border-yellow-300 animate-pulse'
    },
    'not-started': { 
      icon: Clock, 
      label: 'Not Started',
      colorClass: 'bg-gray-100 text-gray-700 border-gray-300'
    }
  };

  const config = statusConfig[status] || statusConfig['not-started'];
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${config.colorClass}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </div>
  );
};

const NotificationBadge = ({ count }) => {
  if (count === 0) return null;
  return (
    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
      {count > 9 ? '9+' : count}
    </div>
  );
};

// Task List Item for Sidebar
const TaskListItem = ({ task, isActive, onSelect, needsAttention }) => {
  const getStatusDisplay = () => {
    return <TaskStatus status={task.status} />;
  };

  return (
    <div 
      className={`relative p-3 rounded-lg cursor-pointer transition-all border ${
        isActive 
          ? 'bg-blue-50 border-blue-200 shadow-sm' 
          : needsAttention
          ? 'bg-yellow-50 border-yellow-200 hover:shadow-sm'
          : 'bg-white border-gray-200 hover:shadow-sm hover:border-gray-300'
      }`}
      onClick={() => onSelect(task)}
    >
      {needsAttention && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        </div>
      )}
      
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900">#{task.id.slice(-3)}</span>
            {getStatusDisplay()}
          </div>
          <h4 className="font-medium text-gray-900 text-sm truncate">{task.title}</h4>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{task.engineer}</span>
        <span>{task.duration}</span>
      </div>
      
      {needsAttention && (
        <div className="mt-2 text-xs text-yellow-700 font-medium">
          {task.status === 'user-request' && 'Needs user input'}
          {task.status === 'thinking' && 'Processing request'}
        </div>
      )}
    </div>
  );
};

// Main Header with Task Switching
const MainHeader = ({ project, tasks, activeTaskId, onTaskSelect, notifications }) => {
  const [showTaskSwitcher, setShowTaskSwitcher] = useState(false);
  const activeTask = tasks.find(t => t.id === activeTaskId);
  const pendingValidation = tasks.filter(t => t.phase === 'validate' && t.status === 'ready').length;

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm">
              <ChevronLeft className="w-4 h-4" />
              Back to Projects
            </button>
            
            <div className="h-4 w-px bg-gray-300"></div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">{project.name}</h1>
                <p className="text-xs text-gray-500">{tasks.length} active tasks</p>
              </div>
            </div>

            {/* Quick Task Switcher */}
            <div className="relative">
              <button 
                onClick={() => setShowTaskSwitcher(!showTaskSwitcher)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
              >
                <span>#{activeTask?.id.slice(-3)} {activeTask?.title}</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              {showTaskSwitcher && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-2 max-h-64 overflow-y-auto">
                    {tasks.map(task => (
                      <TaskListItem
                        key={task.id}
                        task={task}
                        isActive={task.id === activeTaskId}
                        onSelect={(task) => {
                          onTaskSelect(task.id);
                          setShowTaskSwitcher(false);
                        }}
                        needsAttention={task.phase === 'validate' && task.status === 'ready'}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Notifications</span>
              </button>
              <NotificationBadge count={pendingValidation} />
            </div>

            {/* Task Actions Menu */}
            <div className="relative">
              <button className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors">
                <MoreHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Task Actions</span>
              </button>
            </div>

            <button className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Attention Bar for Pending User Requests */}
      {pendingValidation > 0 && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">
                {pendingValidation} task{pendingValidation > 1 ? 's' : ''} need{pendingValidation === 1 ? 's' : ''} user input
              </span>
            </div>
            <button className="text-yellow-800 hover:text-yellow-900 text-sm font-medium">
              Review Now →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const TaskWorkspace = () => {
  const [activeTaskId, setActiveTaskId] = useState("7d29e028");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [validationMode, setValidationMode] = useState(true);
  const [splitRatio, setSplitRatio] = useState(60);
  const [activePhase, setActivePhase] = useState('validate');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [containerTimeout, setContainerTimeout] = useState(10); // minutes
  const [showConflictResolution, setShowConflictResolution] = useState(false);
  const [containerError, setContainerError] = useState(null);
  const [containerLogs, setContainerLogs] = useState([]);
  const [showFileChanges, setShowFileChanges] = useState(false);

  // Mock data representing multiple tasks in different phases
  const tasks = [
    {
      id: "7d29e028",
      title: "Update the task view page",
      description: "Improve the task view UI and add better status indicators",
      branch: "feature/task-view-page",
      status: "working",
      engineer: "Claude Code",
      worktree: "/projects/17dbiode-task-7d29e028",
      created: "6/11/2025, 10:27:16 PM",
      duration: "23m",
      hasConflicts: false
    },
    {
      id: "abc12345",
      title: "Add user authentication",
      description: "Implement JWT-based authentication with login/register",
      branch: "feature/add-auth-system",
      status: "user-request",
      engineer: "Claude Frontend",
      worktree: "/projects/17dbiode-task-abc12345",
      created: "6/11/2025, 9:45:12 PM",
      duration: "1h 15m",
      hasConflicts: true
    }
  ];

  const project = {
    name: "pocketdev",
    repository: "https://github.com/jeffeharris/pocketdev",
    baseBranch: "simple-server"
  };

  const activeTask = tasks.find(t => t.id === activeTaskId);
  const pendingValidation = tasks.filter(t => t.status === 'user-request');

  const handlePhaseSwitch = (newPhase) => {
    if (newPhase === activePhase || isTransitioning) return;
    
    setIsTransitioning(true);
    setActivePhase(newPhase); // Move this up - start transition immediately!
    setTimeout(() => {
      setIsTransitioning(false);
    }, 700); // Just for disabling clicks during transition
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      <MainHeader 
        project={project} 
        tasks={tasks} 
        activeTaskId={activeTaskId}
        onTaskSelect={setActiveTaskId}
        notifications={pendingValidation.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Task Context & List */}
        {!sidebarCollapsed && (
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            {/* Current Task Details */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">#{activeTask.id.slice(-3)} {activeTask.title}</h2>
                <TaskStatus status={activeTask.status} />
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">{activeTask.description}</p>
                </div>
              </div>
            </div>

            {/* Repository Status Section */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <GitBranch className="w-4 h-4" />
                {activeTask.branch}
              </h3>
              
              <div className="space-y-3">
                {/* Visual Git Status */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Working Tree</span>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-green-700">Clean</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Branch Status</span>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-green-700">Up to date</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Changes</span>
                    <span className="text-xs text-gray-600">5 files modified</span>
                  </div>
                </div>

                {/* Git Actions */}
                <div className="space-y-2">
                  <button 
                    onClick={() => setShowFileChanges(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    View File Changes
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                    <GitBranch className="w-4 h-4" />
                    Show Git Log
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                    <Activity className="w-4 h-4" />
                    Compare with Base
                  </button>
                </div>
              </div>
            </div>

            {/* All Tasks List */}
            <div className="flex-1 overflow-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">All Tasks</h3>
                  <span className="text-xs text-gray-500">{tasks.length} active</span>
                </div>

                <div className="space-y-2">
                  {tasks.map(task => (
                    <TaskListItem
                      key={task.id}
                      task={task}
                      isActive={task.id === activeTaskId}
                      onSelect={(task) => setActiveTaskId(task.id)}
                      needsAttention={task.status === 'user-request'}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Terminal Area - Split Layout */}
        <div className="flex-1 flex flex-col bg-gray-900">
          {/* Shelltender Terminal - Top Section */}
          <div 
            className="bg-gray-900 flex flex-col"
            style={{ height: validationMode ? `${splitRatio}%` : '100%' }}
          >
            {/* Terminal Header */}
            <div className="bg-gray-800 border-b border-gray-700">
              <div className="px-4 py-2 flex items-center justify-between border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 text-sm font-mono">
                    {activeTask.engineer} - {activeTask.worktree}
                  </span>
                  <TaskStatus phase={activeTask.phase} status={activeTask.status} />
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className="text-gray-400 hover:text-gray-200 p-1"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button className="text-gray-400 hover:text-gray-200 p-1">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button className="text-gray-400 hover:text-gray-200 p-1">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setValidationMode(!validationMode)}
                    className={`p-1 transition-colors ${validationMode ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Session Tabs */}
              <div className="px-4 py-0 flex items-center">
                <div className="flex">
                  <button className="px-4 py-2 bg-gray-700 text-gray-200 text-sm border-r border-gray-600 relative">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span>Implementation</span>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400"></div>
                  </button>
                  <button className="px-4 py-2 bg-gray-800 text-gray-400 text-sm border-r border-gray-600 hover:bg-gray-700 hover:text-gray-300 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                      <span>Planning</span>
                    </div>
                  </button>
                  <button className="px-4 py-2 bg-gray-800 text-gray-400 text-sm border-r border-gray-600 hover:bg-gray-700 hover:text-gray-300 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                      <span>Testing</span>
                    </div>
                  </button>
                  <button className="px-3 py-2 bg-gray-800 text-gray-500 text-sm hover:bg-gray-700 hover:text-gray-400 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Shelltender Content */}
            <div className="flex-1 bg-gray-900 relative overflow-hidden">
              <div className="absolute inset-0 p-4 font-mono text-sm text-green-400 overflow-auto">
                <div className="text-blue-400 mb-2">🌟 Welcome to Claude Code!</div>
                <div className="text-gray-300 text-xs mb-2">/help for help, /status for your current setup</div>
                <div className="text-gray-400 text-xs mb-4">cwd: {activeTask.worktree}</div>
                <div className="text-gray-400 mb-2">💡 Tip: Start with small features or bug fixes</div>
                {activeTask.status === 'working' && (
                  <div className="text-yellow-400 mb-2">⚡ Task in progress...</div>
                )}
                {activeTask.status === 'user-request' && (
                  <div className="text-purple-400 mb-2">💬 Waiting for user input...</div>
                )}
                <div className="text-green-400">{'>'} _</div>
              </div>
            </div>
          </div>

          {/* Resize Handle */}
          {validationMode && (
            <div 
              className="h-1 bg-gray-600 cursor-row-resize hover:bg-blue-500 transition-colors flex items-center justify-center"
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startRatio = splitRatio;
                const container = e.target.closest('.flex-1');
                
                const handleMouseMove = (e) => {
                  const containerHeight = container.offsetHeight;
                  const deltaY = e.clientY - startY;
                  const deltaPercent = (deltaY / containerHeight) * 100;
                  const newRatio = Math.max(20, Math.min(80, startRatio + deltaPercent));
                  setSplitRatio(newRatio);
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              <div className="w-8 h-0.5 bg-gray-400 rounded"></div>
            </div>
          )}

          {/* Validation/Merge Interface - Bottom Section */}
          {validationMode && (
            <div 
              className="relative overflow-hidden"
              style={{ height: `${100 - splitRatio}%` }}
            >
              {/* Merge Panel (Base Layer - Always visible) */}
              <div className="absolute inset-0 bg-white flex flex-col">
                {/* Merge Header */}
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <GitBranch className="w-5 h-5" />
                      <div>
                        <h3 className="font-semibold">Merge: {activeTask.title}</h3>
                        <p className="text-sm text-green-200">Create pull request and manage merge</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setValidationMode(false)}
                      className="px-3 py-1 bg-green-700 hover:bg-green-800 rounded text-sm transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>

                {/* Merge Content */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Left: Merge Controls */}
                  <div className="w-80 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
                    {/* Pull Request Controls */}
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-900 mb-3">Pull Request</h4>
                      <div className="space-y-2">
                        <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors">
                          <Plus className="w-4 h-4" />
                          Create PR
                        </button>
                        <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                          <GitBranch className="w-4 h-4" />
                          Auto-Merge
                        </button>
                      </div>
                    </div>

                    {/* Merge Status with Conflict Detection */}
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-900 mb-3">Status</h4>
                      
                      {activeTask.hasConflicts ? (
                        /* Merge Conflicts UI */
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-600" />
                            <span className="font-medium text-yellow-900">Merge Conflicts Detected</span>
                          </div>
                          <p className="text-sm text-yellow-800 mb-4">
                            This branch has conflicts with {project.baseBranch}
                          </p>
                          
                          <div className="space-y-2">
                            <button 
                              onClick={() => {
                                const gitCommands = `git fetch origin\ngit checkout ${activeTask.branch}\ngit merge origin/${project.baseBranch}\n# Resolve conflicts in your editor\ngit add .\ngit commit\ngit push`;
                                navigator.clipboard.writeText(gitCommands);
                              }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-yellow-300 rounded-lg text-sm hover:bg-yellow-50 transition-colors"
                            >
                              📋 Copy Git Commands
                            </button>
                            <button 
                              onClick={() => {
                                // Launch Shelltender session for conflict resolution
                                console.log('Launch conflict resolution session');
                              }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700 transition-colors"
                            >
                              <Terminal className="w-4 h-4" />
                              Resolve in Terminal (Advanced)
                            </button>
                            <button 
                              onClick={() => window.open(`https://github.com/${project.repository.split('/').slice(-2).join('/')}/compare/${project.baseBranch}...${activeTask.branch}`, '_blank')}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-yellow-300 rounded-lg text-sm hover:bg-yellow-50 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                              View in GitHub
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Normal Merge Status */
                        <div className="bg-white rounded-lg border p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium">Ready to merge</span>
                          </div>
                          <div className="text-xs text-gray-500 mb-2">5 files changed</div>
                          <div className="flex gap-4 text-xs text-gray-600">
                            <span className="text-green-600">+47 additions</span>
                            <span className="text-red-600">-12 deletions</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-2">Target: {project.baseBranch}</div>
                        </div>
                      )}
                    </div>

                    {/* Changed Files */}
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-900 mb-3">Changed Files</h4>
                      <div className="space-y-1">
                        {[
                          { 
                            name: 'src/components/TaskCard.tsx', 
                            additions: 23, 
                            deletions: 5,
                            type: 'modified'
                          },
                          { 
                            name: 'src/components/StatusBadge.tsx', 
                            additions: 18, 
                            deletions: 0,
                            type: 'added'
                          },
                          { 
                            name: 'src/styles/task-view.css', 
                            additions: 6, 
                            deletions: 7,
                            type: 'modified'
                          },
                          { 
                            name: 'src/utils/deprecated.js', 
                            additions: 0, 
                            deletions: 0,
                            type: 'deleted'
                          }
                        ].map((file, index) => (
                          <button 
                            key={file.name}
                            className="w-full p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
                            onClick={() => setSelectedFile(file)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-2 h-2 rounded-full ${
                                file.type === 'added' ? 'bg-green-500' :
                                file.type === 'deleted' ? 'bg-red-500' :
                                'bg-blue-500'
                              }`}></div>
                              <span className="text-sm font-mono text-gray-900 truncate flex-1">{file.name}</span>
                            </div>
                            <div className="flex gap-2 text-xs">
                              {file.additions > 0 && (
                                <span className="text-green-600">+{file.additions}</span>
                              )}
                              {file.deletions > 0 && (
                                <span className="text-red-600">-{file.deletions}</span>
                              )}
                              {file.type === 'deleted' && (
                                <span className="text-red-600">deleted</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Claude Assistance */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Claude Assistance</h4>
                      <div className="space-y-2">
                        <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                          <FileText className="w-4 h-4" />
                          Generate PR Description
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                          <AlertTriangle className="w-4 h-4" />
                          Check for Conflicts
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                          <Activity className="w-4 h-4" />
                          Review Changes
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: Diff Viewer */}
                  <div className="flex-1 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">
                        {selectedFile ? `Diff: ${selectedFile.name}` : 'File Changes'}
                      </h4>
                      {selectedFile && (
                        <div className="flex gap-2">
                          <button 
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                            title="Open file in editor"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Open
                          </button>
                          <button 
                            onClick={() => setSelectedFile(null)}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                          >
                            ✕ Close
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="border border-gray-200 rounded-lg h-full bg-white overflow-hidden">
                      {selectedFile ? (
                        /* Diff View */
                        <div className="h-full flex flex-col">
                          {/* File Header */}
                          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                selectedFile.type === 'added' ? 'bg-green-500' :
                                selectedFile.type === 'deleted' ? 'bg-red-500' :
                                'bg-blue-500'
                              }`}></div>
                              <span className="font-mono text-sm">{selectedFile.name}</span>
                              <span className="text-xs text-gray-500 ml-auto">
                                {selectedFile.type === 'deleted' ? 'Deleted file' :
                                 selectedFile.type === 'added' ? 'New file' : 'Modified'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Diff Content */}
                          <div className="flex-1 overflow-auto font-mono text-sm">
                            {selectedFile.type === 'deleted' ? (
                              <div className="p-4 text-center text-gray-500">
                                <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                                <p>This file was deleted</p>
                              </div>
                            ) : (
                              <div className="p-0">
                                {/* Mock diff content */}
                                <div className="bg-red-50 px-4 py-1 border-l-4 border-red-300">
                                  <span className="text-red-600 mr-4">- 15</span>
                                  <span className="text-red-800">const oldStatusClass = 'status-old';</span>
                                </div>
                                <div className="bg-green-50 px-4 py-1 border-l-4 border-green-300">
                                  <span className="text-green-600 mr-4">+ 15</span>
                                  <span className="text-green-800">const statusClass = getStatusClass(task.status);</span>
                                </div>
                                <div className="px-4 py-1">
                                  <span className="text-gray-400 mr-4">  16</span>
                                  <span>const TaskCard = ({'{'} task {'}'}) => {'{'}</span>
                                </div>
                                <div className="bg-green-50 px-4 py-1 border-l-4 border-green-300">
                                  <span className="text-green-600 mr-4">+ 17</span>
                                  <span className="text-green-800">  const handleTaskClick = () => onTaskSelect(task);</span>
                                </div>
                                <div className="px-4 py-1">
                                  <span className="text-gray-400 mr-4">  18</span>
                                  <span>  return (</span>
                                </div>
                                <div className="bg-green-50 px-4 py-1 border-l-4 border-green-300">
                                  <span className="text-green-600 mr-4">+ 19</span>
                                  <span className="text-green-800">    {'<div className={statusClass} onClick={handleTaskClick}>'}</span>
                                </div>
                                <div className="bg-red-50 px-4 py-1 border-l-4 border-red-300">
                                  <span className="text-red-600 mr-4">- 19</span>
                                  <span className="text-red-800">    {'<div className="status-old">'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Default View */
                        <div className="h-full flex items-center justify-center">
                          <div className="text-center text-gray-500">
                            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p>Select a file to view changes</p>
                            <p className="text-sm mt-1">Click on any file in the list to see its diff</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Panel (Overlay with Clip Path) */}
              <div 
                className="absolute inset-0 bg-white flex flex-col transition-all duration-700 ease-in-out"
                style={{ 
                  clipPath: activePhase === 'validate' 
                    ? 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' // Full coverage
                    : 'polygon(0% 0%, 0% 0%, 0% 100%, 0% 100%)'      // No coverage (reveals merge underneath)
                }}
              >
                {/* Validation Header */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Monitor className="w-5 h-5" />
                      <div>
                        <h3 className="font-semibold">Validation: {activeTask.title}</h3>
                        <p className="text-sm text-purple-200">Test your changes in isolated containers</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setValidationMode(false)}
                      className="px-3 py-1 bg-purple-700 hover:bg-purple-800 rounded text-sm transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>

                {/* Validation Content */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Left: Deploy Controls & Services */}
                  <div className="w-80 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
                    {/* Deploy Controls with Timeout Setting */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Deploy & Test</h4>
                        <button 
                          className="text-xs text-gray-500 hover:text-gray-700"
                          title="Container timeout settings"
                        >
                          <Settings className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                          <Play className="w-4 h-4" />
                          Deploy Containers
                        </button>
                        <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors">
                          <Square className="w-4 h-4" />
                          Stop All
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 mt-2 text-center">
                        Auto-stop after {containerTimeout} minutes
                      </div>
                    </div>

                    {/* Container Error Display */}
                    {containerError && (
                      <div className="mb-6">
                        <h4 className="font-medium text-gray-900 mb-3 text-red-700">Deployment Error</h4>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm text-red-800 mb-3">{containerError}</p>
                          <div className="space-y-2">
                            <button 
                              onClick={() => {
                                // Show container logs
                                console.log('Show logs:', containerLogs);
                              }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-red-300 rounded-lg text-sm hover:bg-red-50 transition-colors"
                            >
                              <FileText className="w-4 h-4" />
                              View Error Logs
                            </button>
                            <button 
                              onClick={() => {
                                // Launch debug container shell
                                console.log('Launch debug session for container');
                              }}
                              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                            >
                              <Terminal className="w-4 h-4" />
                              Debug Container Shell
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Service Status with Auto Port Assignment */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Services</h4>
                      <div className="space-y-2">
                        {[
                          { name: 'web-app', port: 9001, status: 'running', autoAssigned: true },
                          { name: 'api', port: 9002, status: 'running', autoAssigned: true },
                          { name: 'database', port: 9003, status: 'stopped', autoAssigned: true }
                        ].map(service => (
                          <div key={service.name} className="bg-white rounded-lg border p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="p-1 bg-gray-100 rounded">
                                  {service.name === 'web-app' && <Monitor className="w-3 h-3" />}
                                  {service.name === 'api' && <Code2 className="w-3 h-3" />}
                                  {service.name === 'database' && <Activity className="w-3 h-3" />}
                                </div>
                                <span className="font-medium text-gray-900">{service.name}</span>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                service.status === 'running' 
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {service.status}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 mb-2 flex items-center gap-2">
                              <span>Port {service.port}</span>
                              {service.autoAssigned && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">auto</span>
                              )}
                            </div>
                            {service.status === 'running' && (
                              <div className="flex gap-1">
                                <button className="flex-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors">
                                  Preview
                                </button>
                                <button className="flex-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200 transition-colors">
                                  <ExternalLink className="w-3 h-3 inline mr-1" />
                                  Open
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Preview & Logs */}
                  <div className="flex-1 flex">
                    {/* Preview Area */}
                    <div className="flex-1 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Live Preview</h4>
                        <div className="flex gap-2">
                          <button 
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                            title="Open preview in new window"
                            onClick={() => window.open('/worktree-abc123/app', '_blank')}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Pop Out
                          </button>
                          <button 
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                            title="Refresh preview"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Refresh
                          </button>
                        </div>
                      </div>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg h-full bg-gray-50 flex items-center justify-center">
                        <div className="text-center text-gray-500">
                          <Monitor className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p>Deploy containers to see preview</p>
                          <p className="text-sm mt-1">Click "Deploy Containers" to start</p>
                        </div>
                      </div>
                    </div>

                    {/* Container Logs */}
                    <div className="w-80 border-l border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900">Container Logs</h4>
                        <div className="flex gap-2">
                          <button 
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                            title="Open logs in new window"
                            onClick={() => window.open('/validation-logs', '_blank', 'width=800,height=600')}
                          >
                            <ExternalLink className="w-3 h-3" />
                            Pop Out
                          </button>
                          <button 
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                            title="Clear logs"
                          >
                            <Square className="w-3 h-3" />
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="bg-gray-900 rounded-lg overflow-hidden h-full">
                        <div className="bg-gray-800 px-3 py-2 text-gray-300 text-sm font-mono border-b border-gray-700 flex items-center justify-between">
                          <span>validation-logs</span>
                          <div className="flex gap-1">
                            <button 
                              className="text-gray-400 hover:text-gray-200 p-0.5"
                              title="Download logs"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="p-3 h-full overflow-y-auto font-mono text-sm text-green-400">
                          <div>[{new Date().toLocaleTimeString()}] 💤 Waiting for deployment...</div>
                          <div className="text-gray-500">[{new Date().toLocaleTimeString()}] Ready to build containers</div>
                          <div className="text-blue-400">[{new Date().toLocaleTimeString()}] Container orchestrator initialized</div>
                          <div className="text-yellow-400">[{new Date().toLocaleTimeString()}] Checking Docker daemon...</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
                
                {/* Edge Toggle - Shows opposite of current mode */}
                <button
                  onClick={() => handlePhaseSwitch(activePhase === 'validate' ? 'merge' : 'validate')}
                  className={`absolute top-1/2 -translate-y-1/2 px-2 py-8 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl ${
                    activePhase === 'validate'
                      ? 'bg-green-600 text-white hover:bg-green-700 -left-8 rounded-r-none'  // Show MERGE tab on left when in validate mode
                      : 'bg-purple-600 text-white hover:bg-purple-700 -right-8 rounded-l-none' // Show VALIDATE tab on right when in merge mode
                  } ${isTransitioning ? 'pointer-events-none' : ''}`}
                  style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                >
                  <span className="text-xs font-bold tracking-wider">
                    {activePhase === 'validate' ? 'MERGE' : 'VALIDATE'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View File Changes Modal */}
      {showFileChanges && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[80vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">File Changes</h3>
                <p className="text-sm text-gray-500">
                  {activeTask.branch} vs {project.baseBranch}
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowFileChanges(false);
                  setSelectedFile(null);
                }}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: File List */}
              <div className="w-80 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
                <h4 className="font-medium text-gray-900 mb-3">Changed Files</h4>
                <div className="space-y-1">
                  {[
                    { 
                      name: 'src/components/TaskCard.tsx', 
                      additions: 23, 
                      deletions: 5,
                      type: 'modified'
                    },
                    { 
                      name: 'src/components/StatusBadge.tsx', 
                      additions: 18, 
                      deletions: 0,
                      type: 'added'
                    },
                    { 
                      name: 'src/styles/task-view.css', 
                      additions: 6, 
                      deletions: 7,
                      type: 'modified'
                    },
                    { 
                      name: 'src/utils/deprecated.js', 
                      additions: 0, 
                      deletions: 0,
                      type: 'deleted'
                    }
                  ].map((file, index) => (
                    <button 
                      key={file.name}
                      className={`w-full p-3 border rounded-lg text-left transition-colors ${
                        selectedFile?.name === file.name 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedFile(file)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${
                          file.type === 'added' ? 'bg-green-500' :
                          file.type === 'deleted' ? 'bg-red-500' :
                          'bg-blue-500'
                        }`}></div>
                        <span className="text-sm font-mono text-gray-900 truncate flex-1">{file.name}</span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        {file.additions > 0 && (
                          <span className="text-green-600">+{file.additions}</span>
                        )}
                        {file.deletions > 0 && (
                          <span className="text-red-600">-{file.deletions}</span>
                        )}
                        {file.type === 'deleted' && (
                          <span className="text-red-600">deleted</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Diff Viewer */}
              <div className="flex-1 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">
                    {selectedFile ? `Diff: ${selectedFile.name}` : 'Select a file to view changes'}
                  </h4>
                  {selectedFile && (
                    <button 
                      onClick={() => setSelectedFile(null)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                    >
                      ✕ Close
                    </button>
                  )}
                </div>
                
                <div className="border border-gray-200 rounded-lg h-full bg-white overflow-hidden">
                  {selectedFile ? (
                    /* Diff View */
                    <div className="h-full flex flex-col">
                      {/* File Header */}
                      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            selectedFile.type === 'added' ? 'bg-green-500' :
                            selectedFile.type === 'deleted' ? 'bg-red-500' :
                            'bg-blue-500'
                          }`}></div>
                          <span className="font-mono text-sm">{selectedFile.name}</span>
                          <span className="text-xs text-gray-500 ml-auto">
                            {selectedFile.type === 'deleted' ? 'Deleted file' :
                             selectedFile.type === 'added' ? 'New file' : 'Modified'}
                          </span>
                        </div>
                      </div>
                      
                      {/* Diff Content */}
                      <div className="flex-1 overflow-auto font-mono text-sm">
                        {selectedFile.type === 'deleted' ? (
                          <div className="p-4 text-center text-gray-500">
                            <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p>This file was deleted</p>
                          </div>
                        ) : (
                          <div className="p-0">
                            {/* Mock diff content */}
                            <div className="bg-red-50 px-4 py-1 border-l-4 border-red-300">
                              <span className="text-red-600 mr-4">- 15</span>
                              <span className="text-red-800">const oldStatusClass = 'status-old';</span>
                            </div>
                            <div className="bg-green-50 px-4 py-1 border-l-4 border-green-300">
                              <span className="text-green-600 mr-4">+ 15</span>
                              <span className="text-green-800">const statusClass = getStatusClass(task.status);</span>
                            </div>
                            <div className="px-4 py-1">
                              <span className="text-gray-400 mr-4">  16</span>
                              <span>const TaskCard = ({'{'} task {'}'}) => {'{'}</span>
                            </div>
                            <div className="bg-green-50 px-4 py-1 border-l-4 border-green-300">
                              <span className="text-green-600 mr-4">+ 17</span>
                              <span className="text-green-800">  const handleTaskClick = () => onTaskSelect(task);</span>
                            </div>
                            <div className="px-4 py-1">
                              <span className="text-gray-400 mr-4">  18</span>
                              <span>  return (</span>
                            </div>
                            <div className="bg-green-50 px-4 py-1 border-l-4 border-green-300">
                              <span className="text-green-600 mr-4">+ 19</span>
                              <span className="text-green-800">    {'<div className={statusClass} onClick={handleTaskClick}>'}</span>
                            </div>
                            <div className="bg-red-50 px-4 py-1 border-l-4 border-red-300">
                              <span className="text-red-600 mr-4">- 19</span>
                              <span className="text-red-800">    {'<div className="status-old">'}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Default View */
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>Select a file to view changes</p>
                        <p className="text-sm mt-1">Click on any file in the list to see its diff</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskWorkspace;