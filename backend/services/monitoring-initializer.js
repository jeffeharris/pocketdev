/**
 * MonitoringInitializer - Deep Module for Monitoring System Initialization
 *
 * Handles all monitoring system initialization with a simple interface.
 * Hides the complexity of session monitoring, AI patterns, backward compatibility,
 * and service wiring behind a clean abstraction.
 *
 * Public API (2 methods):
 * - initialize() - Initialize all monitoring systems
 * - getMonitors() - Get initialized monitor instances
 */

import fetch from "node-fetch";
import { createSessionMonitor } from "./monitoring/shelltender-session-monitor.js";
import { AISessionMonitor } from "./monitoring/ai-session-monitor.js";
import { NotificationService } from "./monitoring/notification-service.js";
import { initializeGitStatusMonitor } from "./monitoring/git-status-monitor.js";

export class MonitoringInitializer {
  constructor(config, models, eventEmitterService, githubTokenService) {
    this.config = config;
    this.models = models;
    this.eventEmitterService = eventEmitterService;
    this.githubTokenService = githubTokenService;
    this.monitors = {};
  }

  /**
   * Initialize all monitoring systems
   * @returns {Promise<{success: boolean, monitors: Object}>}
   */
  async initialize() {
    try {
      console.log("Initializing monitoring systems...");

      // Initialize Shelltender session monitor
      const sessionMonitor = await this._initializeSessionMonitor();

      // Initialize notification service (no longer needs WebSocket)
      const notificationService = new NotificationService();

      // Initialize AI monitoring with real sessionMonitor
      const aiMonitor = await this._initializeAIMonitor(
        sessionMonitor,
        notificationService,
      );

      // Register existing sessions
      await this._registerExistingSessions(aiMonitor);

      // Setup session event handlers
      this._setupSessionEventHandlers(sessionMonitor, aiMonitor);

      // Initialize git status monitoring
      const gitStatusMonitor = this._initializeGitStatusMonitor();

      // Store monitors for external access
      this.monitors = {
        sessionMonitor,
        notificationService,
        aiMonitor,
        gitStatusMonitor,
      };

      console.log("All monitoring systems initialized successfully");

      return {
        success: true,
        monitors: this.monitors,
      };
    } catch (error) {
      console.warn("Failed to initialize monitoring:", error.message);
      console.warn("Server will continue without AI monitoring features");

      return {
        success: false,
        monitors: {},
      };
    }
  }

  /**
   * Get initialized monitor instances
   * @returns {Object} Monitor instances
   */
  getMonitors() {
    return this.monitors;
  }

  // Private methods - hidden implementation details

  async _initializeSessionMonitor() {
    console.log("Creating Shelltender session monitor for v0.6.1...");
    const sessionMonitor = await createSessionMonitor({
      wsUrl: this.config.shelltenderWsUrl,
      apiUrl: this.config.shelltenderApiUrl,
    });
    console.log("Shelltender session monitor initialized");
    return sessionMonitor;
  }

  async _initializeAIMonitor(sessionMonitor, notificationService) {
    console.log("Initializing AI session monitor...");

    // Create AI monitor with the session monitor as sessionManager
    const aiMonitor = new AISessionMonitor(
      sessionMonitor,
      notificationService,
      this.models,
      this.eventEmitterService,
    );

    // Register AI patterns
    aiMonitor.registerPatterns();

    return aiMonitor;
  }

  async _registerExistingSessions(aiMonitor) {
    try {
      const response = await fetch(
        `${this.config.shelltenderApiUrl}/api/sessions`,
      );
      if (response.ok) {
        const existingSessions = await response.json();
        console.log(`Found ${existingSessions.length} existing sessions`);

        // In monitor mode, we just need to set up pattern tracking
        // The monitor adapter automatically receives data from ALL sessions
        for (const session of existingSessions) {
          if (session.id && session.id.startsWith("task-")) {
            console.log("Setting up pattern tracking for session:", session.id);
            await aiMonitor.registerSessionPatterns(session.id);
          }
        }
      }
    } catch (error) {
      console.error("Failed to register existing sessions:", error);
      // Non-critical error - continue initialization
    }
  }

  _setupSessionEventHandlers(sessionMonitor, aiMonitor) {
    // Listen for session closure
    sessionMonitor.on("session-closed", (sessionId) => {
      if (sessionId && sessionId.startsWith("task-")) {
        console.log("Session closed, removing pattern tracking:", sessionId);
        aiMonitor.removeSession(sessionId);
        // Monitor mode continues to work for remaining sessions
      }
    });

    // Note: We rely on the task creation endpoint to notify us
    // since Shelltender v0.6.1 doesn't have a global session event system
  }

  _initializeGitStatusMonitor() {
    console.log("Initializing git status monitoring...");
    const gitStatusMonitor = initializeGitStatusMonitor(
      this.models,
      this.eventEmitterService,
      this.githubTokenService,
    );
    console.log("Git status monitoring initialized");
    return gitStatusMonitor;
  }
}
