import { Router } from 'express';
import * as terminalController from '../controllers/terminal.controller.js';

const router = Router();

// Session management
router.get('/sessions', terminalController.getAllSessions);
router.get('/sessions/attention', terminalController.getAttentionSessions);
router.get('/sessions/ai-states', terminalController.getAIStates);
router.get('/sessions/:sessionId', terminalController.getSession);

// Terminal operations
router.post('/projects/:projectId/tasks/:taskId/terminal', 
  terminalController.createTerminalSession
);

router.post('/sessions/:sessionId/execute', 
  terminalController.executeInSession
);

// AI session management
router.post('/sessions/:sessionId/acknowledge', 
  terminalController.acknowledgeSession
);

router.post('/sessions/:sessionId/respond', 
  terminalController.respondToPrompt
);

// Shelltender integration
router.get('/tasks/:taskId/shelltender-session', 
  terminalController.getShelltenderSession
);

export default router;