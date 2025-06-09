// Test script to verify streaming flag is passed correctly
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000';

async function testStreamingTask() {
  console.log('Testing streaming task assignment...\n');
  
  // Get engineers
  const engineersRes = await fetch(`${API_BASE}/api/container/engineers`);
  const engineers = await engineersRes.json();
  console.log('Available engineers:', engineers.length);
  
  const availableEngineer = engineers.find(e => e.status === 'idle');
  if (!availableEngineer) {
    console.error('No available engineers!');
    return;
  }
  
  console.log('Using engineer:', availableEngineer.name, '(' + availableEngineer.id + ')');
  
  // Create a simple task with streaming enabled
  const task = {
    engineerId: availableEngineer.id,
    repository: 'https://github.com/octocat/Hello-World.git',
    branch: 'main',
    description: 'Add a simple README file with "Hello from streaming mode!"',
    acceptanceCriteria: ['Create README.md file'],
    streamingEnabled: true,  // This is the key flag
    model: 'claude-3-5-sonnet-latest',
    gitUsername: process.env.GIT_USERNAME || 'test',
    gitToken: process.env.GIT_TOKEN || 'test-token'
  };
  
  console.log('\nSending task with streamingEnabled:', task.streamingEnabled);
  console.log('Full request:', JSON.stringify(task, null, 2));
  
  try {
    const response = await fetch(`${API_BASE}/api/container/assign-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(task)
    });
    
    const result = await response.json();
    console.log('\nResponse:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\nTask assigned successfully!');
      console.log('Task ID:', result.task.id);
      console.log('\nNow check the server logs to see if streaming flag was passed through.');
      console.log('Look for:');
      console.log('  - Container route: Streaming enabled: true');
      console.log('  - [ContainerTaskManager] assignTask called with: streaming: true');
      console.log('  - Checking streaming mode - STREAMING_MODE=\'true\'');
      console.log('  - Streaming mode enabled - using stream-json output format');
    } else {
      console.error('Task assignment failed:', result.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the test
console.log('Starting streaming flag test...\n');
testStreamingTask().catch(console.error);