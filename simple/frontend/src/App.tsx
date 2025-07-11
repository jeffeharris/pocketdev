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
    // Check server mode like the demo does
    fetch('/shelltender-api/health')
      .then(res => res.json())
      .then(health => {
        console.log('[App] Shelltender health:', health);
        
        // In single-port mode, use the proxied WebSocket path
        if (health.mode === 'single-port') {
          setShelltenderConfig({ url: '/shelltender-ws' });
        } else {
          // Dual port mode would use different config
          setShelltenderConfig({ port: '8081' });
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('[App] Failed to check health, using default config:', err);
        setShelltenderConfig({ url: '/shelltender-ws' });
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <ToastProvider>
      <ShelltenderWSProvider config={shelltenderConfig}>
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