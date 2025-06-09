/**
 * Test script for Claude SDK streaming functionality
 */

async function testStreaming() {
  console.log('🧪 Testing PocketDev Streaming Integration\n');

  const engineerId = '1'; // Claude Frontend engineer ID
  const task = {
    description: 'Create a simple counter component in React that increments when clicked',
    repository: '',
    acceptanceCriteria: [
      'Component should display a count starting at 0',
      'Clicking a button should increment the count',
      'Include proper TypeScript types'
    ]
  };

  console.log('📋 Task:', task.description);
  console.log('🎯 Criteria:', task.acceptanceCriteria);
  console.log('\n🚀 Starting streaming task...\n');

  try {
    const response = await fetch(`http://localhost:3001/api/container/engineers/${engineerId}/stream-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(task),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('\n✅ Stream completed');
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          const eventType = line.slice(6).trim();
          console.log(`\n📨 Event: ${eventType}`);
        } else if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.slice(5).trim());
            
            switch (data.type) {
              case 'connected':
                console.log('✓ Connected to engineer', data.engineerId);
                break;
                
              case 'stream:init':
                console.log('✓ Session initialized');
                console.log(`  Session ID: ${data.data.sessionId}`);
                console.log(`  Tools: ${data.data.tools?.join(', ')}`);
                break;
                
              case 'stream:tool_use':
                console.log(`🔧 Tool: ${data.data.name}`);
                if (data.data.input) {
                  console.log(`  Input: ${JSON.stringify(data.data.input).substring(0, 100)}...`);
                }
                break;
                
              case 'stream:text':
                console.log(`💬 ${data.data.text?.substring(0, 80)}...`);
                break;
                
              case 'stream:complete':
                console.log('\n🏁 Task Complete!');
                console.log(`  Success: ${data.data.success}`);
                console.log(`  Cost: $${data.data.cost}`);
                console.log(`  Duration: ${data.data.duration}ms`);
                console.log(`  Turns: ${data.data.turns}`);
                break;
                
              case 'error':
                console.error('❌ Error:', data.error);
                break;
                
              default:
                console.log('📦 Data:', JSON.stringify(data));
            }
          } catch (e) {
            console.error('Failed to parse data:', e.message);
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
console.log('Make sure the backend is running on http://localhost:3001\n');
testStreaming().catch(console.error);