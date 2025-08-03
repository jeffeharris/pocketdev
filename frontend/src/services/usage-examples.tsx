/**
 * Usage Examples - How to use the service infrastructure
 * 
 * These examples show the intended patterns for using services
 * in React components throughout the application.
 */

import React, { useState, useEffect } from 'react';
import { 
  useService, 
  useSessionAdapter, 
  useServiceConfig,
  type ServiceError 
} from './index';
import type { Project } from '../types/project';
import type { TerminalSession } from '../types/task';

/**
 * Example 1: Basic service usage in a component
 */
export function ProjectListExample() {
  const projectService = useService('project');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ServiceError | null>(null);

  useEffect(() => {
    async function loadProjects() {
      try {
        setLoading(true);
        setError(null);
        
        // Simple, clean service call
        const projectList = await projectService.getAll();
        setProjects(projectList);
      } catch (err) {
        setError(err as ServiceError);
      } finally {
        setLoading(false);
      }
    }

    loadProjects();
  }, [projectService]);

  if (loading) return <div>Loading projects...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Projects</h1>
      {projects.map(project => (
        <div key={project.id}>
          <h2>{project.name}</h2>
          <p>{project.repository}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Example 2: Using SessionAdapter for session management
 */
export function TerminalExample({ taskId }: { taskId: string }) {
  const terminalService = useService('terminal');
  const sessionAdapter = useSessionAdapter();
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  useEffect(() => {
    async function loadSessions() {
      try {
        // Get sessions from API
        const terminalSessions = await terminalService.getTerminalSessions(taskId);
        
        // Register with session adapter and get normalized IDs
        const normalizedIds = sessionAdapter.registerSessions(terminalSessions);
        
        // Use the normalized sessions
        const sessionInfos = normalizedIds.map(id => sessionAdapter.getSessionInfo(id)!);
        setSessions(terminalSessions);
        
        if (sessionInfos.length > 0) {
          setActiveSession(sessionInfos[0].id);
        }
      } catch (error) {
        console.error('Failed to load sessions:', error);
      }
    }

    loadSessions();
  }, [taskId, terminalService, sessionAdapter]);

  const handleCreateSession = async () => {
    try {
      const newSession = await terminalService.createTerminalSession(taskId, {
        tabName: 'New Tab',
        aiAgent: 'claude'
      });
      
      // Register new session and get normalized ID
      const normalizedId = sessionAdapter.registerSession(newSession);
      setActiveSession(normalizedId);
      
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleSwitchSession = (anySessionId: string) => {
    // SessionAdapter handles any ID type
    const normalizedId = sessionAdapter.normalize(anySessionId);
    if (normalizedId) {
      setActiveSession(normalizedId);
    }
  };

  const handleExecuteCommand = async (command: string) => {
    if (!activeSession) return;
    
    try {
      // Get the database session ID for API calls
      const dbSessionId = sessionAdapter.getDbSessionId(activeSession);
      if (dbSessionId) {
        await terminalService.executeCommand(dbSessionId, command);
      }
    } catch (error) {
      console.error('Failed to execute command:', error);
    }
  };

  return (
    <div>
      <h1>Terminal Sessions</h1>
      
      <div className="tabs">
        {sessionAdapter.getAllSessions().map(session => (
          <button
            key={session.id}
            onClick={() => setActiveSession(session.id)}
            className={activeSession === session.id ? 'active' : ''}
          >
            {session.tabName}
          </button>
        ))}
        <button onClick={handleCreateSession}>+ New Tab</button>
      </div>
      
      {activeSession && (
        <div className="terminal">
          <div>Active Session: {activeSession}</div>
          <button onClick={() => handleExecuteCommand('ls -la')}>
            Run Command
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Example 3: Service configuration access
 */
export function ServiceStatusExample() {
  const config = useServiceConfig();
  const projectService = useService('project');
  const [serviceStatus, setServiceStatus] = useState<any>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        // Example of checking if a service has a ping method
        if ('ping' in projectService) {
          const status = await (projectService as any).ping();
          setServiceStatus(status);
        }
      } catch (error) {
        console.error('Service status check failed:', error);
      }
    }

    checkStatus();
  }, [projectService]);

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h2>Service Configuration</h2>
      <ul>
        <li>Base URL: {config.baseUrl}</li>
        <li>Mock Mode: {config.mockEnabled ? 'Enabled' : 'Disabled'}</li>
      </ul>
      
      {serviceStatus && (
        <div className="mt-4">
          <h3>Service Status</h3>
          <pre>{JSON.stringify(serviceStatus, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

/**
 * Example 4: Error handling patterns
 */
export function ErrorHandlingExample({ projectId }: { projectId: string }) {
  const projectService = useService('project');
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProject = async () => {
    try {
      setError(null);
      const projectData = await projectService.getById(projectId);
      setProject(projectData);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred');
      }
    }
  };

  const pullBaseBranch = async () => {
    try {
      setError(null);
      const result = await projectService.pullBaseBranch(projectId);
      
      if (result.success) {
        console.log('Pull successful:', result.data?.message);
        await loadProject(); // Refresh project data
      } else {
        setError(result.error?.message || 'Pull failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pull failed');
    }
  };

  return (
    <div>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {project ? (
        <div>
          <h1>{project.name}</h1>
          <p>Repository: {project.repository}</p>
          <p>Base Branch: {project.baseBranch}</p>
          <button onClick={pullBaseBranch} className="btn-primary">
            Pull Base Branch
          </button>
        </div>
      ) : (
        <div>
          <button onClick={loadProject} className="btn-primary">
            Load Project
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Example 5: Custom hook pattern for reusable service logic
 */
export function useProjectOperations(projectId: string) {
  const projectService = useService('project');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeOperation = async (
    operation: () => Promise<any>,
    successMessage?: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await operation();
      
      if (successMessage) {
        console.log(successMessage, result);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Operation failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const pullBaseBranch = () =>
    executeOperation(
      () => projectService.pullBaseBranch(projectId),
      'Base branch pulled successfully'
    );

  const pushBaseBranch = () =>
    executeOperation(
      () => projectService.pushBaseBranch(projectId),
      'Base branch pushed successfully'
    );

  const refreshStatus = () =>
    executeOperation(
      () => projectService.refreshStatus(projectId),
      'Project status refreshed'
    );

  return {
    loading,
    error,
    clearError: () => setError(null),
    pullBaseBranch,
    pushBaseBranch,
    refreshStatus,
  };
}

/**
 * Example 6: Using the custom hook
 */
export function ProjectOperationsExample({ projectId }: { projectId: string }) {
  const { loading, error, clearError, pullBaseBranch, pushBaseBranch, refreshStatus } = 
    useProjectOperations(projectId);

  return (
    <div>
      <h2>Project Operations</h2>
      
      {error && (
        <div className="error-banner">
          {error}
          <button onClick={clearError}>×</button>
        </div>
      )}
      
      <div className="button-group">
        <button onClick={pullBaseBranch} disabled={loading}>
          {loading ? 'Pulling...' : 'Pull Base Branch'}
        </button>
        
        <button onClick={pushBaseBranch} disabled={loading}>
          {loading ? 'Pushing...' : 'Push Base Branch'}
        </button>
        
        <button onClick={refreshStatus} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Status'}
        </button>
      </div>
    </div>
  );
}