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

# Validate required environment variables
if [ -z "$REPO_URL" ]; then
    log_error "REPO_URL environment variable is required"
    exit 1
fi

if [ -z "$TASK_DESCRIPTION" ]; then
    log_error "TASK_DESCRIPTION environment variable is required"
    exit 1
fi

if [ -z "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    log_error "CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable is required"
    exit 1
fi

# Set API key for Claude
export ANTHROPIC_API_KEY="${CLAUDE_API_KEY:-$ANTHROPIC_API_KEY}"

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
    
    # Add role-specific system prompt with memory context
    local memory_context="

You are working in a containerized environment with access to project memory:
- Team memory: /workspace/repo/.pocketdev/team-memory.md (read this for project context)
- Your personal memory: /workspace/repo/.pocketdev/engineers/${ENGINEER_ROLE}-${ENGINEER_ID:-1}.md
  
At the start of your task, read the team memory to understand the project.
If your personal memory file doesn't exist, create it with your first learnings.
Update your memory file with important discoveries as you work.
Add significant findings to the team memory for other engineers."

    case "$ENGINEER_ROLE" in
        frontend)
            claude_args+=("--system-prompt" "You are a senior frontend engineer specializing in React and TypeScript. Focus on component architecture, accessibility, and user experience.$memory_context")
            ;;
        backend)
            claude_args+=("--system-prompt" "You are a backend architect specializing in scalable APIs. Focus on security, performance, and proper error handling.$memory_context")
            ;;
        devops)
            claude_args+=("--system-prompt" "You are a DevOps specialist focusing on automation and infrastructure. Create reproducible deployments and comprehensive monitoring.$memory_context")
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

# Main execution flow
main() {
    local start_time=$(date +%s)
    local success=false
    local error_message=""
    local summary=""
    local files_changed=()
    local test_results=""
    local suggested_next_steps=()
    
    # Setup Git authentication
    setup_git_auth
    
    # Clone repository
    log_info "Cloning repository: $REPO_URL"
    if ! git clone "$REPO_URL" /workspace/repo 2>&1; then
        error_message="Failed to clone repository"
        log_error "$error_message"
        save_results "$success" "$error_message" "$summary" "$start_time"
        exit 1
    fi
    
    cd /workspace/repo
    
    # Checkout branch if specified
    if [ -n "$BRANCH" ]; then
        log_info "Checking out branch: $BRANCH"
        git checkout "$BRANCH"
    else
        # Use the default branch
        DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@')
        log_info "Using default branch: $DEFAULT_BRANCH"
    fi
    
    # Create feature branch
    FEATURE_BRANCH="ai/${ENGINEER_ROLE}/$(echo "$TASK_DESCRIPTION" | tr ' ' '-' | tr '[:upper:]' '[:lower:]' | cut -c1-50)-$(date +%s)"
    log_info "Creating feature branch: $FEATURE_BRANCH"
    git checkout -b "$FEATURE_BRANCH"
    
    # Main development task - Single comprehensive prompt
    log_info "Starting development task: $TASK_DESCRIPTION"
    
    # Combined prompt for analysis, planning, implementation, and testing
    local development_prompt="You are tasked with implementing: $TASK_DESCRIPTION

Acceptance Criteria:
$ACCEPTANCE_CRITERIA

Please follow these steps:
1. Analyze the codebase structure and understand existing patterns
2. Create an implementation plan
3. Write a simple verification script (verify.js, test.py, or test.html) that tests the implementation
   - The script should exit with code 0 on success, non-zero on failure
   - It should test all acceptance criteria
   - Keep it simple - direct checks, no framework required
4. Implement the feature following the project's patterns
5. Run your verification script using 'node', 'python', or by checking the output
6. Fix any issues until the verification passes

Important: Create a standalone test script that can be run without any test framework.
For React components, you might create a simple test.html that loads the component.
For Node.js code, create a verify.js that imports and tests the functionality.

Please implement everything in one session, running your verification at the end."

    if ! run_claude "$development_prompt" "/workspace/logs/implementation.json"; then
        error_message="Failed to implement feature"
        save_results "$success" "$error_message" "$summary" "$start_time"
        exit 1
    fi
    
    # Extract implementation details from Claude's response
    local claude_result=$(jq -r '.result // ""' /workspace/logs/implementation.json 2>/dev/null)
    
    # Get list of changed files
    mapfile -t files_changed < <(git diff --name-only)
    
    # Check if verification script exists and run it
    log_info "Looking for verification script..."
    
    local verification_passed=false
    local verification_output=""
    
    # Check for common verification script names
    if [ -f "verify.js" ]; then
        log_info "Running verify.js..."
        if verification_output=$(node verify.js 2>&1); then
            verification_passed=true
            test_results="verify.js passed successfully"
        else
            test_results="verify.js failed: $verification_output"
        fi
    elif [ -f "test.py" ]; then
        log_info "Running test.py..."
        if verification_output=$(python test.py 2>&1); then
            verification_passed=true
            test_results="test.py passed successfully"
        else
            test_results="test.py failed: $verification_output"
        fi
    elif [ -f "verify.py" ]; then
        log_info "Running verify.py..."
        if verification_output=$(python verify.py 2>&1); then
            verification_passed=true
            test_results="verify.py passed successfully"
        else
            test_results="verify.py failed: $verification_output"
        fi
    else
        log_warning "No verification script found, assuming implementation is complete"
        verification_passed=true
        test_results="No verification script created"
    fi
    
    # Set success based on verification
    if [ "$verification_passed" = "true" ]; then
        success=true
        summary="Successfully implemented: $TASK_DESCRIPTION"
        log_success "Implementation completed and verified"
        
        # Suggest next steps based on what was implemented
        suggested_next_steps=("Review the implementation" "Test in different scenarios" "Add more test cases")
    else
        summary="Implementation completed but verification failed"
        log_warning "$summary"
        suggested_next_steps=("Fix verification failures" "Debug the implementation" "Review error messages")
    fi
    
    # Always stage changes (user will decide whether to commit)
    git add -A
    
    # Save results
    save_results "$success" "$error_message" "$summary" "$start_time"
}

# Function to save results
save_results() {
    local success="$1"
    local error_message="$2"
    local summary="$3"
    local start_time="$4"
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    local result_file="/workspace/results/session_result.json"
    
    # Get cost information from Claude logs
    local cost_usd=0
    if [ -f "/workspace/logs/implementation.json" ]; then
        cost_usd=$(jq -r '.cost_usd // 0' /workspace/logs/implementation.json 2>/dev/null || echo 0)
    fi
    
    # Get changed files
    local files_json=$(git diff --name-only --cached | jq -R . | jq -s . 2>/dev/null || echo '[]')
    
    # Escape strings for JSON
    local summary_json=$(echo "$summary" | jq -Rs .)
    local error_json=$(echo "${error_message:-null}" | jq -Rs .)
    local task_desc_json=$(echo "$TASK_DESCRIPTION" | jq -Rs .)
    local test_results_json=$(echo "$test_results" | jq -Rs .)
    
    # Create result JSON
    cat > "$result_file" <<EOF
{
  "success": $success,
  "sessionId": "${CLAUDE_SESSION_ID:-null}",
  "summary": $summary_json,
  "error": $error_json,
  "duration": $duration,
  "cost_usd": $cost_usd,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "engineerRole": "${ENGINEER_ROLE:-unknown}",
  "model": "${MODEL:-unknown}",
  "taskDescription": $task_desc_json,
  "filesChanged": $files_json,
  "testResults": $test_results_json,
  "suggestedNextSteps": $(printf '%s\n' "${suggested_next_steps[@]}" | jq -R . | jq -s . 2>/dev/null || echo '[]'),
  "featureBranch": "$FEATURE_BRANCH",
  "canContinue": true
}
EOF
    
    log_info "Results saved to $result_file"
    
    if [ "$success" = "true" ]; then
        log_success "Task completed successfully in ${duration}s"
        log_info "Changes are staged but not committed"
        log_info "User can accept and commit or request follow-up tasks"
    else
        log_error "Task failed: $error_message"
    fi
}

# Handle follow-up tasks (called when container receives CONTINUE signal)
handle_followup() {
    if [ -f "/workspace/followup_task.txt" ]; then
        local followup_task=$(cat /workspace/followup_task.txt)
        log_info "Handling follow-up task: $followup_task"
        
        cd /workspace/repo
        
        # Run Claude with the follow-up task
        local followup_prompt="Continue working on the previous implementation. New task: $followup_task

Please make any necessary changes or improvements based on this feedback."
        
        if run_claude "$followup_prompt" "/workspace/logs/followup.json" true; then
            # Update results
            git add -A
            save_results true "" "Completed follow-up: $followup_task" $(date +%s)
        else
            save_results false "Failed to complete follow-up task" "" $(date +%s)
        fi
    fi
}

# Handle interrupts gracefully
trap 'log_warning "Interrupted"; save_results false "Task interrupted" "" $(date +%s); exit 130' INT TERM

# Check if this is a follow-up task
if [ -f "/workspace/CONTINUE" ]; then
    handle_followup
else
    # Run main function
    main
fi

# Keep container running if task can continue
if [ "$success" = "true" ] || [ -f "/workspace/results/session_result.json" ]; then
    log_info "Container ready for follow-up tasks or finalization"
    
    # Keep container alive for potential follow-up
    while true; do
        # Check for signals in results directory (mapped volume)
        if [ -f "/workspace/results/SHUTDOWN" ]; then
            log_info "Received SHUTDOWN signal"
            
            # Commit and push changes
            cd /workspace/repo
            git add -A
            git commit -m "feat: completed task - $TASK_DESCRIPTION" -m "Accepted by user"
            
            # Push to remote
            if git push origin "$FEATURE_BRANCH"; then
                log_success "Changes pushed to remote branch: $FEATURE_BRANCH"
                PR_URL="https://github.com/$(echo $REPO_URL | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/pull/new/$FEATURE_BRANCH"
                log_info "PR URL: $PR_URL"
                
                # Update result with PR URL
                if [ -f "/workspace/results/session_result.json" ]; then
                    jq ".prUrl = \"$PR_URL\"" /workspace/results/session_result.json > /tmp/result.json && mv /tmp/result.json /workspace/results/session_result.json
                fi
            else
                log_error "Failed to push changes"
            fi
            
            break
        elif [ -f "/workspace/results/CONTINUE" ]; then
            log_info "Received CONTINUE signal"
            
            # Read follow-up task
            if [ -f "/workspace/results/followup_task.txt" ]; then
                FOLLOWUP_TASK=$(cat /workspace/results/followup_task.txt)
                log_info "Processing follow-up task: $FOLLOWUP_TASK"
                
                # Clean up signal files
                rm -f /workspace/results/CONTINUE /workspace/results/followup_task.txt
                
                # Run follow-up
                cd /workspace/repo
                
                local followup_prompt="Continue working on the previous implementation. New task: $FOLLOWUP_TASK

Please make any necessary changes or improvements based on this feedback."
                
                if run_claude "$followup_prompt" "/workspace/logs/followup.json" true; then
                    # Check for verification script and run it
                    log_info "Looking for verification script..."
                    
                    local verification_passed=false
                    local verification_output=""
                    
                    if [ -f "verify.js" ]; then
                        log_info "Running verify.js..."
                        if verification_output=$(node verify.js 2>&1); then
                            verification_passed=true
                            test_results="verify.js passed successfully"
                        else
                            test_results="verify.js failed: $verification_output"
                        fi
                    elif [ -f "test.py" ] || [ -f "verify.py" ]; then
                        local test_file=$([ -f "test.py" ] && echo "test.py" || echo "verify.py")
                        log_info "Running $test_file..."
                        if verification_output=$(python $test_file 2>&1); then
                            verification_passed=true
                            test_results="$test_file passed successfully"
                        else
                            test_results="$test_file failed: $verification_output"
                        fi
                    else
                        verification_passed=true
                        test_results="No verification script found"
                    fi
                    
                    # Stage changes
                    git add -A
                    
                    # Update results
                    if [ "$verification_passed" = "true" ]; then
                        save_results true "" "Completed follow-up: $FOLLOWUP_TASK" $(date +%s)
                    else
                        save_results false "Verification failed after follow-up" "" $(date +%s)
                    fi
                else
                    save_results false "Failed to complete follow-up task" "" $(date +%s)
                fi
            else
                log_error "No follow-up task provided"
            fi
        fi
        
        sleep 2
    done
fi

# Exit with appropriate code
if [ "$success" = "true" ]; then
    exit 0
else
    exit 1
fi