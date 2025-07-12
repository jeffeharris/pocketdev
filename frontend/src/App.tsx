import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ToastProvider, WebSocketProvider as ShelltenderWSProvider } from '@shelltender/client';
import { Projects } from './pages/Projects';
import { ProjectDashboard } from './pages/ProjectDashboard';
import { TaskWorkspace } from './pages/TaskWorkspace';
import { MergeWorkflowPrototype } from './components/prototype/MergeWorkflowPrototype';
import { MergeStatesDiagram } from './components/prototype/MergeStatesDiagram';
import PrototypeDiffViewers from './pages/PrototypeDiffViewers';
import PrototypeMergeConflict from './pages/PrototypeMergeConflict';
import PrototypeMonacoMerge from './pages/PrototypeMonacoMerge';

function App() {
  const [shelltenderConfig, setShelltenderConfig] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // For v0.6.0, we just need to point to the WebSocket endpoint
    // The proxy rewrites /shelltender-ws to /ws
    const config = { 
      url: '/shelltender-ws'
    };
    console.log('[App] Setting shelltender v0.6.0 config:', config);
    setShelltenderConfig(config);
    setLoading(false);
  }, []);

  if (loading || !shelltenderConfig) {
    return <div>Loading Shelltender configuration...</div>;
  }

  return (
    <ToastProvider>
      <ShelltenderWSProvider config={shelltenderConfig} debug={true}>
        {/* Add debug output */}
        {console.log('[App] ShelltenderWSProvider rendered with config:', shelltenderConfig)}
        <WebSocketProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Navigate to="/projects" replace />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:projectId" element={<ProjectDashboard />} />
              <Route path="/projects/:projectId/tasks/:taskId" element={<TaskWorkspace />} />
              <Route path="/prototype/merge-workflow" element={<MergeWorkflowPrototype />} />
              <Route path="/prototype/merge-states" element={<MergeStatesDiagram />} />
              <Route path="/prototype/diff-viewers" element={<PrototypeDiffViewers />} />
              <Route path="/prototype/merge-conflict" element={<PrototypeMergeConflict />} />
              <Route path="/prototype/monaco-merge" element={<PrototypeMonacoMerge />} />
            </Routes>
          </Router>
        </WebSocketProvider>
      </ShelltenderWSProvider>
    </ToastProvider>
  );
}

export default App;