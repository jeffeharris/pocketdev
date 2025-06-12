const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.SESSION_API_PORT || 3006;

// CORS middleware for cross-container communication
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ttyd-session-api' });
});

// List sessions for a specific task
app.get('/api/sessions/:encodedPath', async (req, res) => {
  try {
    const { encodedPath } = req.params;
    const claudeProjectDir = path.join(os.homedir(), '.claude', 'projects', encodedPath);
    
    console.log(`Checking sessions in: ${claudeProjectDir}`);
    
    // Check if directory exists
    try {
      await fs.access(claudeProjectDir);
    } catch (error) {
      return res.json({
        success: true,
        sessions: [],
        path: claudeProjectDir,
        exists: false
      });
    }
    
    // List all .jsonl files
    const files = await fs.readdir(claudeProjectDir);
    const sessionFiles = files.filter(f => f.endsWith('.jsonl'));
    
    const sessions = await Promise.all(sessionFiles.map(async (filename) => {
      const filePath = path.join(claudeProjectDir, filename);
      const stats = await fs.stat(filePath);
      
      return {
        sessionId: filename.replace('.jsonl', ''),
        filename,
        sizeBytes: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };
    }));
    
    res.json({
      success: true,
      sessions: sessions.sort((a, b) => b.modifiedAt - a.modifiedAt),
      path: claudeProjectDir,
      exists: true
    });
    
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get session content and analytics
app.get('/api/sessions/:encodedPath/:sessionId', async (req, res) => {
  try {
    const { encodedPath, sessionId } = req.params;
    const filePath = path.join(os.homedir(), '.claude', 'projects', encodedPath, `${sessionId}.jsonl`);
    
    // Read file content
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line);
    
    // Parse analytics
    const analytics = {
      messageCount: lines.length,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
      totalTokens: 0,
      toolUsage: {},
      model: null,
      errors: 0,
      isSummaryOnly: true,  // Assume summary-only until we find actual messages
      messageTypes: new Set(),
      summaries: [],  // Collect all summaries
      parentSessionId: null,  // Track if this continues another session
      firstUserMessage: null,  // First thing user said
      lastAssistantMessage: null  // Last thing assistant said
    };
    
    lines.forEach((line, idx) => {
      try {
        const msg = JSON.parse(line);
        
        // Track message types
        if (msg.type) {
          analytics.messageTypes.add(msg.type);
          
          // If we see user or assistant messages, it's not summary-only
          if (msg.type === 'user' || msg.type === 'assistant') {
            analytics.isSummaryOnly = false;
          }
          
          // Collect summaries
          if (msg.type === 'summary' && msg.summary) {
            analytics.summaries.push(msg.summary);
          }
          
          // Track first user message
          if (msg.type === 'user' && !analytics.firstUserMessage && msg.message && msg.message.content) {
            const content = msg.message.content;
            analytics.firstUserMessage = typeof content === 'string' ? content : content.text || 'User message';
          }
          
          // Track last assistant message
          if (msg.type === 'assistant' && msg.message && msg.message.content) {
            const content = msg.message.content;
            if (Array.isArray(content) && content[0] && content[0].text) {
              analytics.lastAssistantMessage = content[0].text.substring(0, 200) + (content[0].text.length > 200 ? '...' : '');
            }
          }
        }
        
        // Check for parent session
        if (msg.parentUuid) {
          analytics.parentSessionId = msg.parentUuid;
        }
        
        // Token usage
        if (msg.message && msg.message.usage) {
          analytics.inputTokens += msg.message.usage.input_tokens || 0;
          analytics.outputTokens += msg.message.usage.output_tokens || 0;
          analytics.cacheCreationInputTokens += msg.message.usage.cache_creation_input_tokens || 0;
          analytics.cacheReadInputTokens += msg.message.usage.cache_read_input_tokens || 0;
        }
        
        // Tool usage
        if (msg.message && msg.message.content && Array.isArray(msg.message.content)) {
          msg.message.content.forEach(item => {
            if (item.type === 'tool_use' && item.name) {
              analytics.toolUsage[item.name] = (analytics.toolUsage[item.name] || 0) + 1;
            }
          });
        }
        
        // Model
        if (msg.message && msg.message.model && !analytics.model) {
          analytics.model = msg.message.model;
        }
        
        // Errors
        if (msg.error) {
          analytics.errors++;
        }
      } catch (e) {
        console.error('Error parsing line:', e);
      }
    });
    
    analytics.totalTokens = analytics.inputTokens + analytics.outputTokens;
    analytics.messageTypes = Array.from(analytics.messageTypes);  // Convert Set to Array for JSON
    
    const stats = await fs.stat(filePath);
    
    res.json({
      success: true,
      session: {
        sessionId,
        analytics,
        sizeBytes: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        lineCount: lines.length
      }
    });
    
  } catch (error) {
    console.error('Error reading session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List all available session directories
app.get('/api/session-dirs', async (req, res) => {
  try {
    const claudeDir = path.join(os.homedir(), '.claude', 'projects');
    
    try {
      await fs.access(claudeDir);
    } catch (error) {
      return res.json({
        success: true,
        directories: []
      });
    }
    
    const dirs = await fs.readdir(claudeDir);
    const dirStats = await Promise.all(dirs.map(async (dir) => {
      const dirPath = path.join(claudeDir, dir);
      const stats = await fs.stat(dirPath);
      
      if (stats.isDirectory()) {
        const files = await fs.readdir(dirPath);
        const sessionCount = files.filter(f => f.endsWith('.jsonl')).length;
        
        return {
          name: dir,
          sessionCount,
          modifiedAt: stats.mtime
        };
      }
      return null;
    }));
    
    res.json({
      success: true,
      directories: dirStats.filter(d => d !== null)
    });
    
  } catch (error) {
    console.error('Error listing directories:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`TTyd Session API listening on port ${PORT}`);
});