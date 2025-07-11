import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WebSocketProvider } from './contexts/WebSocketContext.tsx';
import { ToastProvider } from '@shelltender/client';
import { Projects } from './pages/Projects.tsx';
import { ProjectDashboard } from './pages/ProjectDashboard.tsx';
import { TaskWorkspace } from './pages/TaskWorkspace.tsx';
import { MergeWorkflowPrototype } from './components/prototype/MergeWorkflowPrototype.tsx';
import { MergeStatesDiagram } from './components/prototype/MergeStatesDiagram.tsx';
import PrototypeDiffViewers from './pages/PrototypeDiffViewers.tsx';
import PrototypeMergeConflict from './pages/PrototypeMergeConflict.tsx';
import PrototypeMonacoMerge from './pages/PrototypeMonacoMerge.tsx';
import { TestTerminalRef } from './components/terminal/TestTerminalRef.tsx';
import { TestTerminalImport } from './components/terminal/TestTerminalImport.tsx';

function App() {
  return (
    <ToastProvider>
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
            <Route path="/test-terminal-ref" element={<TestTerminalRef />} />
            <Route path="/test-terminal-import" element={<TestTerminalImport />} />
          </Routes>
        </Router>
      </WebSocketProvider>
    </ToastProvider>
  );
}

export default App;