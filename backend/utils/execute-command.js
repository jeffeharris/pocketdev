/**
 * Execute a command in a Shelltender session
 * 
 * IMPORTANT: This now uses the existing WebSocket connection from the monitor
 * to avoid creating duplicate connections that cause buffer replay
 */

export async function executeCommandViaWebSocket(sessionId, command) {
  // This function should not be used anymore - use executeCommandViaMonitor instead
  console.warn('[executeCommand] Using deprecated executeCommandViaWebSocket - this creates duplicate output!');
  
  // For backward compatibility, just resolve immediately
  // The actual command execution should happen through the monitor
  return { success: true, command, sessionId, warning: 'Use monitor connection instead' };
}

// Alternative: Use the existing session monitor if available
export async function executeCommandViaMonitor(sessionId, command, monitor) {
  if (!monitor) {
    throw new Error('Session monitor not available');
  }
  
  // Ensure we're connected to the session
  if (!monitor.sessions.has(sessionId)) {
    await monitor.connectToSession(sessionId);
    // Wait a bit for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Send the input
  monitor.sendInput(sessionId, command + '\n');
  
  return { success: true, command, sessionId };
}