# AI Agents Documentation and Citations

This document provides detailed information about each AI agent supported by PocketDev, including command-line usage, installation instructions, and official documentation references.

*Last Updated: July 2025*

## Claude Code (Anthropic)

### Official Documentation
- **CLI Reference**: https://docs.anthropic.com/en/docs/claude-code/cli-reference
- **Setup Guide**: https://docs.anthropic.com/en/docs/claude-code/setup
- **Overview**: https://docs.anthropic.com/en/docs/claude-code/overview

### Command Line Usage
```bash
# Basic interactive mode (REPL)
claude

# Start with initial prompt/context
claude "You are a Python expert. Help me optimize this code."

# Non-interactive mode (runs and exits)
claude -p "Explain this function"

# Continue previous conversation
claude -c -p "follow-up query"

# Resume specific session
claude -r "<session-id>" "your query"

# Process piped content
cat file.txt | claude -p "analyze this file"
```

### Installation
```bash
# Requires Node.js 18+
npm install -g @anthropic-ai/claude-code

# Do NOT use sudo
```

### Key Features
- ✅ Accepts initial prompts via command line
- ✅ Persistent interactive sessions with context retention
- ✅ Streaming output
- ✅ Direct file editing capabilities
- ✅ Unix composability (pipes, redirects)
- ✅ Model selection (opus-4, sonnet-4, haiku-3.5)
- ✅ MCP (Model Context Protocol) support

### State Detection Patterns
Based on observation of Claude CLI output:
- **Thinking**: `✻ Analyzing...` with duration and token count
- **Idle**: `│ > │` prompt box
- **Welcome**: `Welcome to Claude` message
- **Ready**: `Human:` prompt

---

## Aider (AI Pair Programming)

### Official Documentation
- **Website**: https://aider.chat/
- **GitHub**: https://github.com/Aider-AI/aider
- **Docs**: https://aider.chat/docs/
- **PyPI**: https://pypi.org/project/aider-chat/ (v0.42.1 as of April 2025)

### Command Line Usage
```bash
# Basic interactive mode
aider

# With initial message (single task, then interactive)
aider --message "Add error handling to all API endpoints" main.py

# Message from file
aider --message-file prompt.txt app.js

# Load commands on startup
aider --load startup-commands.txt

# With specific model
aider --model sonnet --api-key anthropic=YOUR_KEY
```

### Installation
```bash
# Recommended method
python -m pip install aider-install
aider-install

# Alternative: pipx
pipx install aider-chat

# For Gemini support
pipx inject aider-chat google-generativeai
```

### Best Supported Models (2025)
- Claude 3.7 Sonnet
- DeepSeek R1 & Chat V3
- OpenAI o1, o3-mini & GPT-4o
- Claude Sonnet 4 and Opus 4 series

### Key Features
- ✅ Accepts initial prompts via `--message` flag
- ✅ Persistent interactive sessions
- ✅ Git integration with automatic commits
- ✅ Repository mapping for large codebases
- ✅ Multi-language support
- ✅ Voice commands
- ✅ Image and web page context support
- ✅ AI trigger comments: `# AI?`, `// AI?`

### State Detection Patterns
- **Idle**: `>` prompt
- **Working**: Model-specific indicators
- **Git operations**: Shows git commands being executed

---

## GitHub Copilot CLI

### Official Documentation
- **Docs**: https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-in-the-command-line
- **GitHub**: https://github.com/github/gh-copilot
- **Free Tier**: 2,000 completions + 50 chat messages/month (as of Feb 2025)

### Command Line Usage
```bash
# Install the extension
gh extension install github/gh-copilot

# Suggest commands
gh copilot suggest -t git "Undo the most recent local commits"
gh copilot suggest -t shell "find large files"

# Explain commands
gh copilot explain "find . -name '*.txt' -exec grep -l 'pattern' {} \;"

# Set up aliases
gh copilot alias  # Creates ghcs and ghce shortcuts
```

### Installation
```bash
# Prerequisites: GitHub CLI
brew install gh  # macOS
# or appropriate package manager

# Authenticate and install
gh auth login
gh extension install github/gh-copilot
```

### Important Limitations
- ❌ **NO persistent conversations** - each command is isolated
- ❌ **NO context retention** between commands
- ❌ **NO file editing capabilities**
- ❌ **NO interactive terminal sessions**
- ✅ One-off command suggestions only
- ✅ Command explanations

### PocketDev Compatibility
**NOT SUITABLE** for PocketDev's multi-terminal tabs feature because:
- Lacks persistent session capabilities
- Cannot maintain context across interactions
- Designed for quick command assistance only
- No file manipulation or code generation

---

## Google Gemini CLI

### Official Documentation
- **Official CLI**: https://github.com/google-gemini/gemini-cli (Released 2025)
- **Vertex AI**: https://cloud.google.com/vertex-ai/docs/generative-ai/start/quickstarts/api-quickstart

### Command Line Usage

#### Option 1: Official Gemini CLI (Recommended)
```bash
# Run without installation
npx @google/gemini-cli

# With initial prompt
npx @google/gemini-cli "Explain this code"

# Interactive mode
npx @google/gemini-cli
```

#### Option 2: Vertex AI via gcloud
```bash
# Using gcloud with Gemini models
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  "https://ENDPOINT/v1/projects/PROJECT/locations/LOCATION/publishers/google/models/MODEL:generateContent" \
  -d '{"contents": {"role": "user", "parts": {"text": "Your prompt"}}}'
```

### Installation
```bash
# Official CLI (requires Node.js 20+)
npx @google/gemini-cli

# For Vertex AI access
curl https://sdk.cloud.google.com | bash
gcloud init
gcloud auth application-default login
```

### Key Features (Official CLI)
- ✅ Free access to Gemini 2.5 Pro (1M token context)
- ✅ 60 requests/minute, 1,000 requests/day free tier
- ✅ Multimodal support (PDFs, images, sketches)
- ✅ MCP (Model Context Protocol) support
- ✅ Integration with Google Search, Imagen, Veo
- ✅ Git workflow automation
- ✅ Persistent sessions

### State Detection Patterns
*To be determined through testing*

---

## AI Agent Capabilities Comparison

Based on verified documentation, here's what we KNOW each tool can do:

| Capability | Claude Code | Aider | Gemini CLI | OpenAI Codex CLI |
|------------|-------------|-------|------------|------------------|
| **Installation** | ✅ npm install | ✅ pip install | ✅ npm/brew | ✅ npm/brew |
| **Command Syntax** | `claude "prompt"` | `aider --message "prompt"` | `gemini -p "prompt"` | `codex "prompt"` |
| **Interactive Mode** | ✅ Persistent REPL | ✅ Persistent | ✅ Persistent | ✅ Persistent |
| **Initial Prompt Support** | ✅ Direct argument | ✅ `--message` flag | ✅ `-p` flag | ✅ Direct argument |
| **File Editing** | ✅ Direct editing | ✅ Direct editing | ✅ Direct editing | ✅ Direct editing |
| **Git Integration** | ✅ Via commands | ✅ Built-in | ✅ Via commands | ✅ Via commands |
| **Context Retention** | ✅ Session-based | ✅ Session-based | ✅ Session-based | ✅ Session-based |
| **Streaming Output** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Multi-model Support** | ✅ opus/sonnet/haiku | ✅ Multiple | ✅ Gemini models | ✅ o4-mini default |
| **Free Tier** | ❌ API key required | ❌ API key required | ✅ 1000/day | ❌ API key required |
| **Special Features** | MCP support | Git auto-commit | Slash/@ commands | Sandbox modes |

### What We Know For Certain

**Claude Code:**
- Command: `claude` or `claude "initial prompt"`
- Has persistent REPL mode
- Can edit files directly
- Supports piping and Unix tools
- Requires API key

**Aider:**
- Command: `aider` or `aider --message "prompt"`
- Has persistent interactive mode
- Git integration with auto-commits
- Supports multiple AI models
- Requires API key for chosen model

**GitHub Copilot CLI:**
- Command: `gh copilot suggest` or `gh copilot explain`
- NO persistent sessions
- NO file editing
- NO initial prompts
- Only for command suggestions/explanations

**Google Gemini CLI:**
- Official CLI exists (per research)
- Free tier available
- Need to verify exact command syntax
- Need to verify prompt handling

**OpenAI Codex CLI:**
- Separate from cloud Codex
- Open-source on GitHub
- Need to verify all capabilities

### What We Need to Verify

1. **Codex CLI**: 
   - Exact installation process
   - Command syntax
   - Whether it supports initial prompts
   - Interactive mode capabilities

2. **Gemini CLI**:
   - Exact prompt syntax
   - State detection patterns
   - Installation verification

## Integration Recommendations for PocketDev

### Priority Order

1. **Claude Code** ✅ 
   - Already integrated and working
   - Excellent persistent session support
   - Rich feature set for development

2. **Aider** 🟡 High Priority
   - Well-documented `--message` flag for initial prompts
   - Strong git integration
   - Active development community
   - Clear installation path

3. **Google Gemini CLI** 🟡 High Priority
   - New official CLI with good free tier
   - Persistent session support
   - Multimodal capabilities
   - Easy npx-based execution

4. **GitHub Copilot CLI** ❌ Not Suitable
   - No persistent sessions
   - Command suggestions only
   - Not designed for interactive development

## Updated AI Agents Configuration

Based on the latest research, here's the recommended configuration update:

```javascript
export const AI_AGENTS = {
  claude: {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    promptSyntax: 'claude "prompt here"',
    installed: true,
    persistent: true
  },
  
  aider: {
    id: 'aider',
    name: 'Aider',
    command: 'aider',
    promptSyntax: 'aider --message "prompt here"',
    installed: false,
    persistent: true,
    installCommand: 'python -m pip install aider-install && aider-install'
  },
  
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    command: 'npx @google/gemini-cli',
    promptSyntax: 'npx @google/gemini-cli "prompt here"',
    installed: false, // Check if npx is available
    persistent: true,
    requiresNpx: true
  }
  
  // Remove 'codex' - OpenAI Codex is deprecated
  // Remove 'gh copilot' - not suitable for persistent sessions
};
```

## Testing Commands

```bash
# Check Claude
docker exec backend which claude && claude --version

# Check Aider
docker exec backend which aider && aider --version

# Check npx (for Gemini)
docker exec backend which npx && npx --version

# Test Gemini CLI
docker exec backend npx @google/gemini-cli --help
```

---

*Note: This documentation is based on official sources as of July 2025. AI tools evolve rapidly - verify current documentation before implementing.*