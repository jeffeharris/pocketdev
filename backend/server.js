import 'dotenv/config';
import config from './config/index.js';
import app from './app.js';
import { ServerOrchestrator } from './services/server-orchestrator.js';

// Create orchestrator
const orchestrator = new ServerOrchestrator(app, config);

// Start server
async function start() {
  try {
    // Initialize all systems
    const { success, error } = await orchestrator.initialize();
    if (!success) {
      console.error('Failed to initialize server:', error);
      process.exit(1);
    }
    
    // Start listening
    await orchestrator.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  
  const { db, sessionCleanupService } = orchestrator.getServices();
  
  // Stop session cleanup service
  if (sessionCleanupService) {
    sessionCleanupService.stop();
    console.log('Session cleanup service stopped');
  }
  
  // Close database
  if (db) {
    await db.close();
    console.log('Database connection closed');
  }
  
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
start();