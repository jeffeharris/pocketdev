import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { EngineerCard } from './components/EngineerCard';
import { ContainerEngineerCardEnhanced } from './components/ContainerEngineerCardEnhanced';
import { TaskModal } from './components/TaskModal';
import { ContainerTaskModal } from './components/ContainerTaskModal';
import { TaskHistory } from './components/TaskHistory';
import { TaskDetailModal } from './components/TaskDetailModal';
import { TaskView } from './components/TaskView';
import Settings from './components/Settings';
import Layout from './components/Layout';
import { supabase, useMockData } from './lib/supabase';
import { Engineer, Task } from './types';
import { Toaster, toast } from 'react-hot-toast';
import { Users, History, Container, Zap, CheckCircle, Settings as SettingsIcon } from 'lucide-react';

// Mock data for local development
const mockEngineers: Engineer[] = [
  {
    id: '1',
    name: 'Claude Frontend',
    role: 'frontend',
    status: 'idle',
    last_update: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Claude Backend',
    role: 'backend',
    status: 'idle',
    last_update: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Claude DevOps',
    role: 'devops',
    status: 'idle',
    last_update: new Date().toISOString(),
    created_at: new Date().toISOString()
  }
];

function Dashboard() {
  const [engineers, setEngineers] = useState<Engineer[]>(mockEngineers);
  const [containerEngineers, setContainerEngineers] = useState<any[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedEngineer, setSelectedEngineer] = useState<Engineer | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'host' | 'container'>('all');
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Initial load
    checkBackendForUpdates();
    checkContainerEngineers();
    
    // Poll for updates every second
    const interval = setInterval(() => {
      checkBackendForUpdates();
      checkContainerEngineers();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const checkBackendForUpdates = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/engineers');
      if (response.ok) {
        const data = await response.json();
        setEngineers(data);
      }
    } catch (error) {
      // Backend might not be running, use mock data
    }
  };

  const checkContainerEngineers = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/container/engineers');
      if (response.ok) {
        const data = await response.json();
        setContainerEngineers(data);
      }
    } catch (error) {
      // Container routes might not be available
    }
  };

  const handleAssignTask = (engineer: Engineer) => {
    if (engineer.status !== 'idle') {
      toast.error(`${engineer.name} is currently busy`);
      return;
    }
    setSelectedEngineer(engineer);
  };

  const handleAssignContainerTask = (engineer: any) => {
    if (engineer.status !== 'idle') {
      toast.error(`${engineer.name} is currently busy`);
      return;
    }
    setSelectedContainerEngineer(engineer);
  };

  const activeEngineers = engineers.filter(e => e.status !== 'idle').length;
  const activeContainers = containerEngineers.filter(e => e.status !== 'idle').length;

  const buildDockerImage = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/container/build-image', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        toast.success('Docker image built successfully!');
      } else {
        toast.error('Failed to build Docker image');
      }
    } catch (error) {
      toast.error('Failed to build Docker image');
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      
      {/* Dashboard Controls */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  viewMode === 'all' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setViewMode('host')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                  viewMode === 'host' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Zap className="h-3 w-3" />
                Host
              </button>
              <button
                onClick={() => setViewMode('container')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors flex items-center gap-1 ${
                  viewMode === 'container' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Container className="h-3 w-3" />
                Container
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={buildDockerImage}
                className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                title="Build Docker Image"
              >
                Build Image
              </button>
              
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <History className="h-4 w-4" />
                Task History
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Engineers</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {engineers.length + containerEngineers.length}
                </p>
              </div>
              <Users className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Tasks</p>
                <p className="text-2xl font-semibold text-blue-600">
                  {activeEngineers + activeContainers}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-blue-600 animate-pulse" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available</p>
                <p className="text-2xl font-semibold text-green-600">
                  {engineers.filter(e => e.status === 'idle').length + 
                   containerEngineers.filter(e => e.status === 'idle').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </div>
        </div>

        {/* Engineers Grid */}
        {(viewMode === 'all' || viewMode === 'host') && engineers.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Host Engineers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {engineers.map((engineer) => (
                <EngineerCard
                  key={engineer.id}
                  engineer={engineer}
                  onAssignTask={() => handleAssignTask(engineer)}
                />
              ))}
            </div>
          </>
        )}

        {/* Container Engineers Grid */}
        {(viewMode === 'all' || viewMode === 'container') && containerEngineers.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Container className="h-5 w-5" />
              Container Engineers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {containerEngineers.map((engineer) => (
                <ContainerEngineerCardEnhanced
                  key={engineer.id}
                  engineer={engineer}
                />
              ))}
            </div>
          </>
        )}

        {engineers.length === 0 && containerEngineers.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No engineers available</h3>
            <p className="text-gray-500">Start the backend server to see your AI engineering team.</p>
          </div>
        )}
      </main>

      {/* Modals */}
      {selectedEngineer && (
        <TaskModal
          engineer={selectedEngineer}
          onClose={() => setSelectedEngineer(null)}
          onTaskAssigned={() => {
            checkBackendForUpdates();
          }}
        />
      )}


      {showHistory && (
        <TaskHistory 
          onClose={() => setShowHistory(false)} 
          onTaskClick={(task) => {
            navigate(`/task/${task.id}`);
            setShowHistory(false);
          }}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/task/:taskId" element={<TaskView />} />
        </Routes>
      </Layout>
    </Router>
  );
}