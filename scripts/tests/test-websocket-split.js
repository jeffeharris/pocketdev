const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3005/ws');

ws.on('open', () => {
  console.log('Connected to WebSocket');
  
  // Subscribe to task channel
  ws.send(JSON.stringify({
    type: 'subscribe',
    taskId: '1dcbda95'
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
  
  if (message.type === 'split-layout-changed') {
    console.log('✅ Split layout change received!');
    console.log('New layout:', message.data.splitLayout);
    process.exit(0);
  }
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

// Wait 30 seconds then timeout
setTimeout(() => {
  console.log('❌ Timeout: No split layout change received');
  process.exit(1);
}, 30000);

console.log('WebSocket test started. Update split layout in another terminal to test...');