import React, { useState, useEffect } from 'react';
import { Terminal, SessionTabs } from '@shelltender/client';
import { Plus, X, Terminal as TerminalIcon, GitBranch, User } from 'lucide-react';
import axios from 'axios';

function App() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showNewTask, setShowNewTask] = useState(false);

  // Fetch tasks on mount
  useEffect(() => {
    fetchTasks();
    fetchProjects();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get('/api/tasks');
      setTasks(response.data);
      
      // For each active task, fetch its shelltender session ID
      const taskSessions = [];
      for (const task of response.data.filter(t => t.status === 'in_progress')) {
        try {
          const sessionResponse = await axios.get(`/api/tasks/${task.id}/shelltender-session`);
          taskSessions.push({
            id: sessionResponse.data.sessionId,
            name: `Task ${task.id}: ${task.branch_name}`,
            taskId: task.id,
            projectId: task.project_id,
            branchName: task.branch_name,
            description: task.description,
            metadata: sessionResponse.data.metadata
          });
        } catch (error) {
          console.warn(`No shelltender session found for task ${task.id}`);
        }
      }
      
      setSessions(taskSessions);
      if (taskSessions.length > 0 && !currentSessionId) {
        setCurrentSessionId(taskSessions[0].id);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/projects');
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const createNewTask = async (projectId, branchName, description) => {
    try {
      const response = await axios.post('/api/tasks', {
        projectId,
        branchName,
        description
      });
      
      const newTask = response.data;
      
      // Wait a moment for the task to be fully created and then fetch tasks
      // This will also create the shelltender session
      setTimeout(() => {
        fetchTasks();
      }, 1000);
      
      setShowNewTask(false);
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task: ' + error.message);
    }
  };

  const closeSession = async (sessionId) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session && session.taskId) {
      try {
        await axios.post(`/api/tasks/${session.taskId}/complete`);
      } catch (error) {
        console.error('Error completing task:', error);
      }
    }
    
    setSessions(sessions.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      setCurrentSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <TerminalIcon className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-semibold text-white">PocketDev Terminal Manager</h1>
          </div>
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Task Info Bar */}
      {currentSession && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              <GitBranch className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300">{currentSession.branchName}</span>
            </div>
            <div className="text-gray-500">•</div>
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-300">Claude</span>
            </div>
            <div className="text-gray-500">•</div>
            <div className="text-gray-300 flex-1">{currentSession.description}</div>
          </div>
        </div>
      )}

      {/* Session Tabs */}
      <div className="bg-gray-900 border-b border-gray-700">
        <SessionTabs
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={setCurrentSessionId}
          onCloseSession={closeSession}
          onNewSession={() => setShowNewTask(true)}
        />
      </div>

      {/* Terminal */}
      <div className="flex-1 bg-black p-4">
        {currentSessionId ? (
          <Terminal
            sessionId={currentSessionId}
            websocketUrl={window.SHELLTENDER_WS_URL || `ws://localhost:8080`}
            className="h-full"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <TerminalIcon className="w-16 h-16 mx-auto mb-4 text-gray-600" />
              <p className="text-lg">No active sessions</p>
              <p className="text-sm mt-2">Create a new task to start a terminal session</p>
            </div>
          </div>
        )}
      </div>

      {/* New Task Modal */}
      {showNewTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Create New Task</h2>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              createNewTask(
                formData.get('projectId'),
                formData.get('branchName'),
                formData.get('description')
              );
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Project
                  </label>
                  <select
                    name="projectId"
                    required
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Select a project</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    name="branchName"
                    required
                    placeholder="feature/new-feature"
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    required
                    rows="3"
                    placeholder="What should Claude work on?"
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Create Task
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewTask(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;