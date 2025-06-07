# PocketDev - AI Engineering Management Platform

PocketDev enables users to manage AI developers like a team from their mobile devices. The vision is to transform from individual AI assistance to team orchestration.

## Overview

PocketDev allows you to:
- Manage specialized AI developers (frontend, backend, DevOps) working autonomously on tasks
- Maintain persistent context across sessions with workspace isolation
- Monitor real-time progress with live logs and status updates
- Review, accept, or request changes to AI-generated code
- Create GitHub branches and PRs automatically

## Architecture

The platform consists of:
- **Web Frontend**: React/TypeScript dashboard with real-time task monitoring
- **Local Backend**: Node.js server orchestrating Docker containers
- **Containerized AI Developers**: Isolated Docker environments running Claude
- **Workspace Management**: Persistent workspaces for each task with Git integration

## Key Features

### 🚀 One-Shot Task Execution
- AI developers work autonomously to complete tasks in a single session
- Automatic test creation and verification
- No rigid TDD framework - flexible implementation approach

### 📊 Real-Time Monitoring
- Live log streaming from containers
- Task progress visualization
- Cost and duration tracking

### ✅ Review & Accept Workflow
- Review implemented changes before committing
- Accept and push to GitHub with one click
- Request follow-up changes if needed

### 🔄 Git Integration
- Automatic feature branch creation
- Commits with descriptive messages
- Direct GitHub PR creation

## Getting Started

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- Anthropic API key (Claude)
- GitHub account and personal access token (for pushing changes)

### Project Structure

PocketDev creates a `.pocketdev/` directory in your repository root (similar to `.git/` or `.github/`) to store:
- Project configuration (repository URL, default branch)
- Team memory (shared knowledge across AI engineers)
- Individual engineer memories (learnings from past tasks)
- Workspace directories for isolated development

This directory should be committed to your repository so the AI team's knowledge persists and grows over time.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/pocketdev.git
   cd pocketdev
   ```

2. Create `.env` file in the root directory:
   ```env
   ANTHROPIC_API_KEY=your-anthropic-api-key
   GITHUB_TOKEN=your-github-pat
   GITHUB_USERNAME=your-github-username
   ```

3. Build the Docker images:
   ```bash
   ./scripts/build-docker.sh
   ```

### Running the Application

#### Development Mode (Recommended)
```bash
# Start all services with hot reload
./scripts/dev-docker.sh

# Access the web interface at http://localhost:5173
```

#### Production Mode
```bash
# Start with Docker Compose
docker-compose up

# Access at http://localhost:3001
```

## Usage Example

1. **Assign a Task**:
   - Select an engineer (frontend, backend, or DevOps)
   - Enter repository URL and task description
   - Click "Assign Task"

2. **Monitor Progress**:
   - View real-time logs as the AI works
   - See which files are being modified
   - Track time and cost

3. **Review Results**:
   - Examine the changes made
   - Check test results
   - View suggested next steps

4. **Accept or Iterate**:
   - Click "Accept & Commit" to push changes
   - Or "Request Changes" for follow-up work

## Documentation

### 🚀 June 2025 Architecture Update
- [**Architecture Update Overview**](./docs/ARCHITECTURE-UPDATE-JUNE-2025.md) - Major platform evolution (START HERE)
- [Implementation Roadmap](./docs/implementation-roadmap.md) - Phased delivery plan
- [Architecture Summary](./docs/architecture-summary.md) - Visual system overview
- [Phase 1 Database Schema](./docs/phase-1-database-schema.md) - Getting started guide

### Original Documentation
- [Container Architecture](./docs/containerized-ai-developer-plan.md) - Technical design details
- [AI Developer Usage](./docs/containerized-ai-developer-usage.md) - How AI developers work
- [Integration Guide](./docs/containerized-claude-integration.md) - Claude integration specifics
- [Development Workflow](./CHANGELOG.md) - Recent changes and updates

## Project Status

✅ **Implemented**:
- Containerized AI developer execution
- Real-time log streaming
- Task result visualization
- Accept/follow-up workflow
- Git branch creation and pushing
- Multiple engineer roles (frontend, backend, DevOps)

🚧 **Coming Soon**:
- Mobile app interface
- Multi-agent orchestration
- Advanced context persistence
- Team collaboration features

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.