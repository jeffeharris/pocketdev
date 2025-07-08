import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { Projects } from './pages/Projects';
import { ProjectDashboard } from './pages/ProjectDashboard';
import { TaskWorkspace } from './pages/TaskWorkspace';
import { MergeWorkflowPrototype } from './components/prototype/MergeWorkflowPrototype';
import { MergeStatesDiagram } from './components/prototype/MergeStatesDiagram';
import PrototypeDiffViewers from './pages/PrototypeDiffViewers';
import PrototypeMergeConflict from './pages/PrototypeMergeConflict';
import PrototypeMonacoMerge from './pages/PrototypeMonacoMerge';
import { TestTerminalRef } from './components/terminal/TestTerminalRef';
import { TestTerminalImport } from './components/terminal/TestTerminalImport';

function App() {
  return (
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
  );
}

export default App;