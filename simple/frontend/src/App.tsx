import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { TaskWorkspace } from './pages/TaskWorkspace';
import { MergeWorkflowPrototype } from './components/prototype/MergeWorkflowPrototype';
import { MergeStatesDiagram } from './components/prototype/MergeStatesDiagram';

function App() {
  return (
    <WebSocketProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/projects/:projectId/tasks/:taskId" element={<TaskWorkspace />} />
          <Route path="/prototype/merge-workflow" element={<MergeWorkflowPrototype />} />
          <Route path="/prototype/merge-states" element={<MergeStatesDiagram />} />
        </Routes>
      </Router>
    </WebSocketProvider>
  );
}

export default App;