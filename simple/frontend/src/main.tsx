// import { StrictMode } from 'react' // Temporarily disabled - see comment below
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/terminal.css'
import App from './App.tsx'

const root = document.getElementById('root');

if (!root) {
  console.error('Root element not found!');
} else {
  createRoot(root).render(
    // Temporarily disabled StrictMode due to Shelltender WebSocket race condition
    // Will re-enable once Shelltender client fix is released
    // <StrictMode>
      <App />
    // </StrictMode>,
  );
}