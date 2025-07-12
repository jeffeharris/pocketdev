import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller.js';

const router = Router();

// Settings management
router.get('/', settingsController.getSettings);
router.put('/', settingsController.updateSettings);

// GitHub token testing
router.post('/test-github', settingsController.testGithubToken);

// System info
router.get('/system-info', settingsController.getSystemInfo);

export default router;