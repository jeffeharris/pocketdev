import { Router } from 'express';
import * as monitoringController from '../controllers/monitoring.controller.js';

const router = Router();

// AI Monitoring status
router.get('/status', monitoringController.getMonitoringStatus);

// Notifications
router.get('/notifications', monitoringController.getNotifications);
router.delete('/notifications', monitoringController.clearNotifications);

// Session monitoring
router.get('/sessions/:sessionId/state', monitoringController.getSessionState);
router.get('/sessions/:sessionId/analytics', monitoringController.getSessionAnalytics);

// Task sessions
router.get('/tasks/:taskId/sessions', monitoringController.getTaskSessions);

export default router;