#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create necessary directories
mkdir -p /workspace/logs
mkdir -p /workspace/results

# Start logging
LOG_FILE="/workspace/logs/session_$(date +%Y%m%d_%H%M%S).log"
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

log_info "Starting AI Developer Container"
log_info "Task ID: ${TASK_ID:-unknown}"
log_info "Engineer Role: ${ENGINEER_ROLE:-fullstack}"
log_info "Model: ${MODEL:-claude-3-5-sonnet-latest}"
ENGINE_TYPE="${ENGINE_TYPE:-claude}"
log_info "Engine type: $ENGINE_TYPE"

# Validate required environment variables
if [ -z "$REPO_URL" ]; then
    log_error "REPO_URL environment variable is required"
    exit 1
fi

if [ -z "$TASK_DESCRIPTION" ]; then
    log_error "TASK_DESCRIPTION environment variable is required"
    exit 1
fi

if [ "$ENGINE_TYPE" = "codex" ]; then
    if [ -z "$OPENAI_API_KEY" ]; then
        log_error "OPENAI_API_KEY environment variable is required"
        exit 1
    fi
else
    if [ -z "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
        log_error "CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable is required"
        exit 1
    fi
    export ANTHROPIC_API_KEY="${CLAUDE_API_KEY:-$ANTHROPIC_API_KEY}"
fi

# Function to handle Git authentication
setup_git_auth() {
    if [ -n "$GIT_USERNAME" ] && [ -n "$GIT_TOKEN" ]; then
        log_info "Configuring Git authentication"
        git config --global credential.helper store
        echo "https://${GIT_USERNAME}:${GIT_TOKEN}@github.com" > ~/.git-credentials
    fi
}

# Function to run Claude with proper session management
run_claude() {
    local prompt="$1"
    local output_file="$2"
    local continue_session="${3:-false}"
    
    local claude_args=(
        "-p"
        "$prompt"
        "--output-format" "json"
        "--model" "${MODEL:-claude-3-5-sonnet-latest}"
    )
    
    # Add session continuation if available
    if [ "$continue_session" = "true" ] && [ -n "$CLAUDE_SESSION_ID" ]; then
        claude_args+=("--resume" "$CLAUDE_SESSION_ID")
    elif [ "$continue_session" = "true" ] && [ -f "/workspace/results/last_session_id" ]; then
        CLAUDE_SESSION_ID=$(cat /workspace/results/last_session_id)
        claude_args+=("--resume" "$CLAUDE_SESSION_ID")
    fi
    
    # Add role-specific system prompt
    case "$ENGINEER_ROLE" in
        frontend)
            claude_args+=("--system-prompt" "You are a senior frontend engineer specializing in React and TypeScript. Focus on component architecture, accessibility, and user experience. Write comprehensive tests using Jest and React Testing Library.")
            ;;
        backend)
            claude_args+=("--system-prompt" "You are a backend architect specializing in scalable APIs. Focus on security, performance, and proper error handling. Write integration tests and ensure proper data validation.")
            ;;
        devops)
            claude_args+=("--system-prompt" "You are a DevOps specialist focusing on automation and infrastructure. Create reproducible deployments and comprehensive monitoring. Document all infrastructure changes.")
            ;;
    esac
    
    # Add allowed tools
    claude_args+=("--allowedTools" "View,Edit,Write,Bash,mcp__filesystem__*,mcp__git__*")
    
    log_info "Running Claude with args: ${claude_args[*]}"
    
    # Execute Claude and capture output
    if claude "${claude_args[@]}" > "$output_file" 2>&1; then
        # Extract session ID from response
        local session_id=$(jq -r '.session_id // empty' "$output_file" 2>/dev/null)
        if [ -n "$session_id" ]; then
            echo "$session_id" > /workspace/results/last_session_id
            export CLAUDE_SESSION_ID="$session_id"
            log_info "Session ID: $session_id"
        fi
        return 0
    else
        log_error "Claude execution failed"
        cat "$output_file"
        return 1
    fi
}

# Function to run Codex
run_codex() {
    local prompt="$1"
    local output_file="$2"

    local codex_args=("--model" "${MODEL:-codex-mini-latest}" -q "$prompt")
    if codex "${codex_args[@]}" > "$output_file" 2>&1; then
        return 0
    else
        log_error "Codex execution failed"
        cat "$output_file"
        return 1
    fi
}

# Wrapper to run the selected engine
run_agent() {
    if [ "$ENGINE_TYPE" = "codex" ]; then
        run_codex "$1" "$2" "$3"
    else
        run_claude "$1" "$2" "$3"
    fi
}

# Function to run tests based on framework
run_tests() {
    local test_framework="${TEST_FRAMEWORK:-jest}"
    
    log_info "Running tests with $test_framework"
    
    case "$test_framework" in
        jest)
            if npm test 2>&1; then
                return 0
            else
                return 1
            fi
            ;;
        pytest)
            if python -m pytest 2>&1; then
                return 0
            else
                return 1
            fi
            ;;
        mocha)
            if npm run test 2>&1; then
                return 0
            else
                return 1
            fi
            ;;
        *)
            log_warning "Unknown test framework: $test_framework"
            return 0
            ;;
    esac
}

# Main execution flow
main() {
    local start_time=$(date +%s)
    local success=false
    local pr_url=""
    local error_message=""
    
    # Setup Git authentication
    setup_git_auth
    
    # Clone repository
    log_info "Cloning repository: $REPO_URL"
    if ! git clone "$REPO_URL" /workspace/repo 2>&1; then
        error_message="Failed to clone repository"
        log_error "$error_message"
        save_results "$success" "$error_message" "" "$start_time"
        exit 1
    fi
    
    cd /workspace/repo
    
    # Checkout branch
    BRANCH="${BRANCH:-main}"
    log_info "Checking out branch: $BRANCH"
    git checkout "$BRANCH"
    
    # Create feature branch
    FEATURE_BRANCH="ai/${ENGINEER_ROLE}/$(echo "$TASK_DESCRIPTION" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-50)-$(date +%s)"
    log_info "Creating feature branch: $FEATURE_BRANCH"
    git checkout -b "$FEATURE_BRANCH"
    
    # Main development loop
    log_info "Starting development task: $TASK_DESCRIPTION"
    
    # Step 1: Analyze codebase and plan approach
    local analyze_prompt="Analyze this codebase and plan how to implement: $TASK_DESCRIPTION

Acceptance Criteria:
$ACCEPTANCE_CRITERIA

First, understand the project structure, then design tests that will validate the implementation."
    
    if ! run_agent "$analyze_prompt" "/workspace/logs/analysis.json"; then
        error_message="Failed to analyze codebase"
        save_results "$success" "$error_message" "" "$start_time"
        exit 1
    fi
    
    # Step 2: Write tests first (TDD)
    local test_prompt="Now write comprehensive tests for the feature. Follow TDD principles - write failing tests first that cover all acceptance criteria."
    
    if ! run_agent "$test_prompt" "/workspace/logs/write_tests.json" true; then
        error_message="Failed to write tests"
        save_results "$success" "$error_message" "" "$start_time"
        exit 1
    fi
    
    # Step 3: Implement the feature
    local implement_prompt="Now implement the feature to make all tests pass. Focus on clean, maintainable code that follows the project's patterns."
    
    if ! run_agent "$implement_prompt" "/workspace/logs/implementation.json" true; then
        error_message="Failed to implement feature"
        save_results "$success" "$error_message" "" "$start_time"
        exit 1
    fi
    
    # Step 4: Run tests and iterate
    local max_iterations="${MAX_ITERATIONS:-5}"
    local iteration=0
    local tests_pass=false
    
    while [ $iteration -lt $max_iterations ] && [ "$tests_pass" = "false" ]; do
        log_info "Running tests (iteration $((iteration + 1))/$max_iterations)"
        
        if run_tests; then
            log_success "All tests passed!"
            tests_pass=true
            success=true
        else
            if [ $iteration -lt $((max_iterations - 1)) ]; then
                log_warning "Tests failed, asking Claude to fix..."
                local fix_prompt="The tests failed. Please analyze the errors and fix the implementation to make all tests pass."
                
                if ! run_agent "$fix_prompt" "/workspace/logs/fix_iteration_$iteration.json" true; then
                    error_message="Failed to fix test failures"
                    break
                fi
            else
                error_message="Tests still failing after $max_iterations iterations"
                log_error "$error_message"
            fi
        fi
        
        ((iteration++))
    done
    
    # Step 5: Commit changes if successful
    if [ "$success" = "true" ]; then
        log_info "Committing changes"
        
        git add -A
        
        # Generate commit message
        local commit_prompt="Generate a concise, descriptive commit message for these changes. Include what was done and why."
        run_agent "$commit_prompt" "/workspace/logs/commit_message.json" true
        
        local commit_message=$(jq -r '.result // "feat: implement requested feature"' /workspace/logs/commit_message.json)
        
        git commit -m "$commit_message" -m "Implemented by AI Developer (${ENGINEER_ROLE})"
        
        # Push to remote
        log_info "Pushing to remote branch"
        if git push origin "$FEATURE_BRANCH"; then
            log_success "Code pushed successfully"
            
            # Create PR (placeholder - implement based on platform)
            pr_url="https://github.com/$(echo $REPO_URL | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/pull/new/$FEATURE_BRANCH"
            log_info "Ready for PR at: $pr_url"
        else
            log_error "Failed to push to remote"
            error_message="Failed to push changes"
            success=false
        fi
    fi
    
    # Save results
    save_results "$success" "$error_message" "$pr_url" "$start_time"
}

# Function to save results
save_results() {
    local success="$1"
    local error_message="$2"
    local pr_url="$3"
    local start_time="$4"
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    local result_file="/workspace/results/session_result.json"
    
    # Get cost information from Claude logs
    local cost_usd=0
    if [ -f "/workspace/logs/implementation.json" ]; then
        cost_usd=$(jq -r '.cost_usd // 0' /workspace/logs/implementation.json 2>/dev/null || echo 0)
    fi
    
    # Create result JSON
    cat > "$result_file" <<EOF
{
  "success": $success,
  "sessionId": "${CLAUDE_SESSION_ID:-null}",
  "prUrl": "${pr_url:-null}",
  "error": "${error_message:-null}",
  "duration": $duration,
  "cost_usd": $cost_usd,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "engineerRole": "${ENGINEER_ROLE:-unknown}",
  "model": "${MODEL:-unknown}",
  "taskDescription": "$TASK_DESCRIPTION"
}
EOF
    
    log_info "Results saved to $result_file"
    
    if [ "$success" = "true" ]; then
        log_success "Task completed successfully in ${duration}s"
    else
        log_error "Task failed: $error_message"
    fi
}

# Handle interrupts gracefully
trap 'log_warning "Interrupted"; save_results false "Task interrupted" "" $(date +%s); exit 130' INT TERM

# Run main function
main

# Exit with appropriate code
if [ "$success" = "true" ]; then
    exit 0
else
    exit 1
fi