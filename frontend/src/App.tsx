import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { ToastProvider, WebSocketProvider as ShelltenderWSProvider, MobileProvider } from '@shelltender/client';
import { KeyboardProvider } from './contexts/KeyboardContext';
import { ServiceProvider } from './services/service-provider';
import { Projects } from './pages/Projects';
import { ProjectDashboard } from './pages/ProjectDashboard';
import { TaskWorkspace } from './pages/TaskWorkspace';
import { MergeWorkflowPrototype } from './components/prototype/MergeWorkflowPrototype';
import { MergeStatesDiagram } from './components/prototype/MergeStatesDiagram';
import PrototypeDiffViewers from './pages/PrototypeDiffViewers';
import PrototypeMergeConflict from './pages/PrototypeMergeConflict';
import PrototypeMonacoMerge from './pages/PrototypeMonacoMerge';
import { TerminalBufferTest } from './pages/TerminalBufferTest';
import { TerminalRawTest } from './pages/TerminalRawTest';
import { StandaloneTerminal } from './components/terminal/StandaloneTerminal';
// import { ComponentPlayground } from './pages/archive/ComponentPlayground-phase3'; // Archived - Phase 3 UI components

function App() {
  const [shelltenderConfig, setShelltenderConfig] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // For v0.6.0, we just need to point to the WebSocket endpoint
    // The proxy rewrites /shelltender-ws to /ws
    const config = { 
      url: '/shelltender-ws'
    };
    setShelltenderConfig(config);
    setLoading(false);
  }, []);

  if (loading || !shelltenderConfig) {
    return <div>Loading Shelltender configuration...</div>;
  }

  return (
    <ServiceProvider>
      <ToastProvider>
        <MobileProvider>
          <ShelltenderWSProvider config={shelltenderConfig}>
            <WebSocketProvider>
              <KeyboardProvider>
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
                  <Route path="/test/terminal-buffer" element={<TerminalBufferTest />} />
                  <Route path="/test/terminal-raw" element={<TerminalRawTest />} />
                  <Route path="/terminal/:projectId/:taskId" element={<StandaloneTerminal />} />
                  {/* <Route path="/prototype/components" element={<ComponentPlayground />} /> */}
                </Routes>
              </Router>
            </KeyboardProvider>
          </WebSocketProvider>
        </ShelltenderWSProvider>
        </MobileProvider>
      </ToastProvider>
    </ServiceProvider>
  );
}

export default App;