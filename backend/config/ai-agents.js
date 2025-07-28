/**
 * AI Agent Configuration
 * 
 * Defines the capabilities and behavior of each AI agent supported by PocketDev.
 * This configuration is used by both the backend (for session monitoring) and
 * frontend (for UI display and command generation).
 */

export const AI_AGENTS = {
  claude: {
    id: 'claude',
    name: 'Claude',
    command: 'claude',
    description: 'Anthropic\'s Claude AI assistant',
    installed: true, // Claude is always installed in our containers
    verified: true,
    capabilities: {
      acceptsPrompt: true,
      promptSyntax: 'claude "prompt here"',
      interactiveMode: true,
      streamingOutput: true,
      codeGeneration: true,
      fileEditing: true,
      webBrowsing: false,
      imageAnalysis: true
    },
    statePatterns: {
      // These patterns are used by ai-session-monitor.js
      thinking: /([✻●◉◎✢✶✽✺○·])\s+\w+ing….*\d+s.*tokens/,
      idle: /│\s*>\s*│/,
      welcome: /Welcome to.*Claude|Claude Code/i,
      humanPrompt: /Human:/
    },
    launchDelay: 500, // milliseconds to wait before sending commands
    requiresAuth: false // Claude uses API key from environment
  },
  
  aider: {
    id: 'aider',
    name: 'Aider',
    command: 'aider',
    description: 'AI pair programming in your terminal',
    installed: false, // Need to check if installed
    verified: true,
    capabilities: {
      acceptsPrompt: true,
      promptSyntax: 'aider --message "prompt here"',
      interactiveMode: true,
      streamingOutput: true,
      codeGeneration: true,
      fileEditing: true,
      webBrowsing: false,
      imageAnalysis: false
    },
    statePatterns: {
      // TODO: Verify Aider-specific patterns through testing
      thinking: '?',
      idle: '?', 
      welcome: '?'
    },
    launchDelay: 1000,
    requiresAuth: true, // Needs OpenAI/Anthropic API key
    installCommand: 'pip install aider-chat'
  },
  
  codex: {
    id: 'codex',
    name: 'OpenAI Codex CLI',
    command: 'codex',
    description: 'OpenAI\'s local terminal-based AI agent',
    installed: false,
    verified: true,
    capabilities: {
      acceptsPrompt: true,
      promptSyntax: 'codex "prompt here"',
      interactiveMode: true,
      streamingOutput: true,
      codeGeneration: true,
      fileEditing: true,
      webBrowsing: true, // Can be enabled during task execution
      imageAnalysis: true // Supports multimodal inputs
    },
    statePatterns: {
      thinking: null, // TODO: Identify from actual output
      idle: null, // TODO: Identify from actual output
      welcome: null // TODO: Identify from actual output
    },
    modes: {
      suggest: 'default - prompts for approval',
      autoEdit: '--auto-edit - auto-approves file edits',
      fullAuto: '--full-auto - runs everything automatically'
    },
    launchDelay: 500,
    requiresAuth: true, // Needs OPENAI_API_KEY
    installCommand: 'npm i -g @openai/codex',
    systemRequirements: {
      os: 'macOS 12+, Ubuntu 20.04+/Debian 10+, Windows via WSL2',
      ram: '4-8 GB recommended',
      git: '2.23+ suggested'
    },
    defaultModel: 'o4-mini',
    note: 'Local CLI tool, different from cloud-based Codex at chatgpt.com/codex'
  },
  
  gemini: {
    id: 'gemini',
    name: 'Google Gemini CLI',
    command: 'gemini',
    description: 'Google\'s Gemini AI with official CLI',
    installed: false,
    verified: true,
    capabilities: {
      acceptsPrompt: true,
      promptSyntax: 'gemini -p "prompt here"', // -p for prompt
      interactiveMode: true,
      streamingOutput: true,
      codeGeneration: true,
      fileEditing: true,
      webBrowsing: true, // Through Google Search integration
      imageAnalysis: true,
      multimodal: true
    },
    statePatterns: {
      thinking: null, // TODO: Identify from actual output
      idle: /^> /, // Interactive prompt indicator
      welcome: null // TODO: Identify from actual output
    },
    specialFeatures: {
      slashCommands: true, // /command [args]
      atCommands: true, // @file.txt for context
      shellCommands: true // !command for shell execution
    },
    launchDelay: 500,
    requiresAuth: true, // GEMINI_API_KEY or GOOGLE_API_KEY
    installCommand: 'npm install -g @google/gemini-cli',
    alternativeInstall: 'brew install gemini-cli',
    systemRequirements: {
      node: '20+',
      envVars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY (for Vertex AI)']
    },
    freeQuota: {
      requestsPerMinute: 60,
      requestsPerDay: 1000,
      contextWindow: 1000000 // 1M tokens
    },
    note: 'Official Google CLI. Can use npx or global install.'
  }
};

/**
 * Get agent configuration by ID
 */
export function getAgentConfig(agentId) {
  return AI_AGENTS[agentId] || AI_AGENTS.claude;
}

/**
 * Get all available agents (installed or not)
 */
export function getAllAgents() {
  return Object.values(AI_AGENTS);
}

/**
 * Get only installed agents
 */
export function getInstalledAgents() {
  return Object.values(AI_AGENTS).filter(agent => agent.installed);
}

/**
 * Check if an agent supports initial prompts
 */
export function agentSupportsPrompts(agentId) {
  const agent = AI_AGENTS[agentId];
  return agent && agent.capabilities.acceptsPrompt;
}

/**
 * Get the command to launch an agent with or without a prompt
 */
export function getAgentLaunchCommand(agentId, prompt = null) {
  const agent = AI_AGENTS[agentId];
  if (!agent) return null;
  
  if (prompt && agent.capabilities.acceptsPrompt) {
    // Use the agent's specific prompt syntax
    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    
    switch (agentId) {
      case 'claude':
        return `claude "${escapedPrompt}"`;
      case 'aider':
        return `aider --message "${escapedPrompt}"`;
      case 'codex':
        return `codex "${escapedPrompt}"`;
      case 'gemini':
        // Use -p for prompt
        return `gemini -p "${escapedPrompt}"`;
      default:
        return agent.command;
    }
  }
  
  return agent.command;
}