import WebSocket from 'ws';
import chalk from 'chalk';

// Test configuration
const SHELLTENDER_URL = 'ws://localhost:8080/ws';
const SHELLTENDER_API_URL = 'http://localhost:8080';
const NUM_CONNECTIONS = 4;
const TEST_DURATION = 30 * 1000; // 30 seconds (can be changed to 10 * 60 * 1000 for full test)
const MESSAGE_INTERVAL = 100; // Send message every 100ms

class WebSocketScalingTest {
  constructor() {
    this.connections = [];
    this.metrics = {
      totalMessages: 0,
      totalBytes: 0,
      errors: 0,
      latencies: [],
      connectionStates: new Map(),
      startTime: null,
      endTime: null,
    };
  }

  async createSession() {
    // First create a session via HTTP
    const sessionId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const response = await fetch(`${SHELLTENDER_API_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: '/bin/bash',
        sessionId: sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const data = await response.json();
    return data.sessionId || sessionId;
  }

  async connectWebSocket(sessionId, index) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(SHELLTENDER_URL);
      const connectionMetrics = {
        sessionId,
        index,
        connected: false,
        messageCount: 0,
        bytesReceived: 0,
        latencies: [],
        lastPingTime: null,
      };

      ws.on('open', () => {
        console.log(chalk.blue(`WebSocket ${index} opened, creating session ${sessionId}...`));
        
        // Create the session via WebSocket (even though it exists via HTTP)
        ws.send(JSON.stringify({
          type: 'create',
          sessionId: sessionId
        }));
      });

      ws.on('message', (data) => {
        const now = Date.now();
        let message;
        try {
          message = JSON.parse(data.toString());
        } catch (e) {
          // Handle non-JSON messages
          connectionMetrics.messageCount++;
          connectionMetrics.bytesReceived += data.length;
          this.metrics.totalBytes += data.length;
          return;
        }

        // Handle create success
        if (message.type === 'created' || (message.type === 'output' && !connectionMetrics.connected)) {
          console.log(chalk.green(`✓ WebSocket ${index} connected to session ${sessionId}`));
          connectionMetrics.connected = true;
          this.metrics.connectionStates.set(sessionId, connectionMetrics);
          
          // Start sending periodic messages
          const interval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN && connectionMetrics.connected) {
              const timestamp = Date.now();
              const inputMessage = JSON.stringify({
                type: 'input',
                sessionId: sessionId,
                data: `echo "Test message ${timestamp} from connection ${index}"\n`,
              });
              
              connectionMetrics.lastPingTime = timestamp;
              ws.send(inputMessage);
              this.metrics.totalMessages++;
            }
          }, MESSAGE_INTERVAL);

          resolve({ ws, interval, metrics: connectionMetrics });
        }

        // Handle output messages
        if (message.type === 'output') {
          connectionMetrics.messageCount++;
          connectionMetrics.bytesReceived += JSON.stringify(message).length;
          this.metrics.totalBytes += JSON.stringify(message).length;

          // Calculate latency if this is a response to our input
          if (connectionMetrics.lastPingTime && message.data && message.data.includes('Test message')) {
            const latency = now - connectionMetrics.lastPingTime;
            connectionMetrics.latencies.push(latency);
            this.metrics.latencies.push(latency);
            connectionMetrics.lastPingTime = null;
          }
        }

        // Handle errors
        if (message.type === 'error') {
          console.error(chalk.red(`WebSocket ${index} error: ${message.data}`));
          this.metrics.errors++;
          // Don't reject if it's just about attach not being supported
          if (!message.data.includes('Unknown message type')) {
            reject(new Error(message.data));
          }
        }
      });


      ws.on('error', (error) => {
        console.error(chalk.red(`✗ WebSocket ${index} error: ${error.message}`));
        this.metrics.errors++;
        reject(error);
      });

      ws.on('close', () => {
        console.log(chalk.yellow(`WebSocket ${index} closed`));
        connectionMetrics.connected = false;
      });
    });
  }

  async runTest() {
    console.log(chalk.blue('\n=== WebSocket Scaling Test ===\n'));
    console.log(`Creating ${NUM_CONNECTIONS} concurrent connections...`);

    this.metrics.startTime = Date.now();

    try {
      // Create sessions and connect WebSockets
      for (let i = 0; i < NUM_CONNECTIONS; i++) {
        const sessionId = await this.createSession();
        const connection = await this.connectWebSocket(sessionId, i);
        this.connections.push(connection);
        
        // Small delay between connections
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(chalk.green(`\n✓ All ${NUM_CONNECTIONS} connections established\n`));

      // Monitor performance during test
      const monitorInterval = setInterval(() => {
        this.printMetrics();
      }, 5000); // Print metrics every 5 seconds

      // Run test for specified duration
      console.log(`Running test for ${TEST_DURATION / 1000} seconds...\n`);
      await new Promise(resolve => setTimeout(resolve, TEST_DURATION));

      // Clean up
      clearInterval(monitorInterval);
      this.metrics.endTime = Date.now();

      // Close all connections
      console.log('\nClosing connections...');
      for (const { ws, interval } of this.connections) {
        clearInterval(interval);
        ws.close();
      }

      // Wait for connections to close
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clean up sessions
      console.log('Cleaning up sessions...');
      for (const [sessionId] of this.metrics.connectionStates) {
        try {
          await fetch(`${SHELLTENDER_API_URL}/api/sessions/${sessionId}`, {
            method: 'DELETE'
          });
        } catch (error) {
          console.error(`Failed to delete session ${sessionId}:`, error.message);
        }
      }

      // Print final results
      this.printFinalResults();

    } catch (error) {
      console.error(chalk.red(`Test failed: ${error.message}`));
      process.exit(1);
    }
  }

  printMetrics() {
    const duration = (Date.now() - this.metrics.startTime) / 1000;
    const avgLatency = this.calculateAverageLatency();
    const activeConnections = Array.from(this.metrics.connectionStates.values())
      .filter(m => m.connected).length;

    console.log(chalk.cyan('--- Current Metrics ---'));
    console.log(`Duration: ${duration.toFixed(1)}s`);
    console.log(`Active Connections: ${activeConnections}/${NUM_CONNECTIONS}`);
    console.log(`Total Messages Sent: ${this.metrics.totalMessages}`);
    console.log(`Total Bytes Received: ${(this.metrics.totalBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Average Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`Errors: ${this.metrics.errors}`);
    console.log('');
  }

  calculateAverageLatency() {
    if (this.metrics.latencies.length === 0) return 0;
    const sum = this.metrics.latencies.reduce((a, b) => a + b, 0);
    return sum / this.metrics.latencies.length;
  }

  printFinalResults() {
    const duration = (this.metrics.endTime - this.metrics.startTime) / 1000;
    const avgLatency = this.calculateAverageLatency();
    const bandwidth = (this.metrics.totalBytes / duration) / 1024; // KB/s

    console.log(chalk.green('\n=== Test Results ===\n'));
    
    // Success criteria check
    const allConnectionsStable = this.metrics.errors === 0;
    const latencyAcceptable = avgLatency < 100;
    const bandwidthReasonable = bandwidth < 1024; // Less than 1MB/s

    console.log('Success Criteria:');
    console.log(`✓ All connections stable: ${allConnectionsStable ? chalk.green('PASS') : chalk.red('FAIL')} (${this.metrics.errors} errors)`);
    console.log(`✓ Latency < 100ms: ${latencyAcceptable ? chalk.green('PASS') : chalk.red('FAIL')} (${avgLatency.toFixed(2)}ms average)`);
    console.log(`✓ Bandwidth < 1MB/s: ${bandwidthReasonable ? chalk.green('PASS') : chalk.red('FAIL')} (${(bandwidth / 1024).toFixed(2)}MB/s)`);

    console.log('\nDetailed Metrics:');
    console.log(`- Test Duration: ${duration.toFixed(1)} seconds`);
    console.log(`- Total Messages: ${this.metrics.totalMessages}`);
    console.log(`- Total Data Received: ${(this.metrics.totalBytes / 1024 / 1024).toFixed(2)} MB`);
    console.log(`- Messages per Second: ${(this.metrics.totalMessages / duration).toFixed(2)}`);
    
    // Per-connection breakdown
    console.log('\nPer-Connection Stats:');
    this.metrics.connectionStates.forEach((metrics, sessionId) => {
      const connAvgLatency = metrics.latencies.length > 0 
        ? metrics.latencies.reduce((a, b) => a + b, 0) / metrics.latencies.length 
        : 0;
      
      console.log(`  Connection ${metrics.index}:`);
      console.log(`    - Messages: ${metrics.messageCount}`);
      console.log(`    - Data: ${(metrics.bytesReceived / 1024).toFixed(2)} KB`);
      console.log(`    - Avg Latency: ${connAvgLatency.toFixed(2)}ms`);
    });

    // Overall verdict
    const allTestsPassed = allConnectionsStable && latencyAcceptable && bandwidthReasonable;
    console.log(`\nOverall Result: ${allTestsPassed ? chalk.green('✓ ALL TESTS PASSED') : chalk.red('✗ SOME TESTS FAILED')}`);
    
    if (!allTestsPassed) {
      console.log(chalk.yellow('\nRecommendations:'));
      if (!allConnectionsStable) {
        console.log('- Investigate connection stability issues');
        console.log('- Consider implementing connection pooling or multiplexing');
      }
      if (!latencyAcceptable) {
        console.log('- High latency detected, may need to optimize message handling');
        console.log('- Consider batching messages or using compression');
      }
      if (!bandwidthReasonable) {
        console.log('- High bandwidth usage, consider:');
        console.log('  - Throttling output from AI sessions');
        console.log('  - Implementing delta updates instead of full content');
        console.log('  - Using compression for WebSocket messages');
      }
    }
  }
}

// Run the test
const test = new WebSocketScalingTest();
test.runTest().catch(error => {
  console.error(chalk.red(`Unexpected error: ${error.message}`));
  process.exit(1);
});