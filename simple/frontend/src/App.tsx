import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { Projects } from './pages/Projects';
import { ProjectDetail } from './pages/ProjectDetail';
import { TaskWorkspace } from './pages/TaskWorkspace';
import { ModalDemo } from './pages/ModalDemo';

function App() {
  return (
    <WebSocketProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/projects" replace />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/projects/:projectId/tasks/:taskId" element={<TaskWorkspace />} />
          <Route path="/modal-demo" element={<ModalDemo />} />
        </Routes>
      </Router>
    </WebSocketProvider>
  );
}

export default App;