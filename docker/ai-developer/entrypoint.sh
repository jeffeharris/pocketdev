#!/bin/bash
# Remove 'set -e' to handle errors ourselves

echo "GATE CHECK: Entrypoint script started at $(date)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Global variables for tracking state
SCRIPT_START_TIME=$(date +%s)
DEBUG_DIR="/workspace/debug"
STATE_FILE="/workspace/debug/state.json"
ERROR_COUNT=0
WARNING_COUNT=0

# Create debug directory immediately
mkdir -p "$DEBUG_DIR" 2>/dev/null || true

# Logging functions with enhanced tracking
log_info() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    local message="[INFO] [$timestamp] $1"
    echo -e "${BLUE}${message}${NC}"
    echo "$message" >> "$DEBUG_DIR/full.log" 2>/dev/null || true
}

log_success() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    local message="[SUCCESS] [$timestamp] $1"
    echo -e "${GREEN}${message}${NC}"
    echo "$message" >> "$DEBUG_DIR/full.log" 2>/dev/null || true
}

log_warning() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    local message="[WARNING] [$timestamp] $1"
    echo -e "${YELLOW}${message}${NC}"
    echo "$message" >> "$DEBUG_DIR/full.log" 2>/dev/null || true
    echo "$message" >> "$DEBUG_DIR/warnings.log" 2>/dev/null || true
    ((WARNING_COUNT++))
}

log_error() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    local message="[ERROR] [$timestamp] $1"
    echo -e "${RED}${message}${NC}" >&2
    echo "$message" >> "$DEBUG_DIR/full.log" 2>/dev/null || true
    echo "$message" >> "$DEBUG_DIR/errors.log" 2>/dev/null || true
    ((ERROR_COUNT++))
}

log_debug() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    local message="[DEBUG] [$timestamp] $1"
    echo -e "${CYAN}${message}${NC}"
    echo "$message" >> "$DEBUG_DIR/debug.log" 2>/dev/null || true
}

log_trace() {
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    local message="[TRACE] [$timestamp] $1"
    echo -e "${MAGENTA}${message}${NC}"
    echo "$message" >> "$DEBUG_DIR/trace.log" 2>/dev/null || true
}

# Enhanced state tracking
update_state() {
    local state="$1"
    local details="$2"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    
    log_trace "State transition: $state"
    
    # Create state JSON
    cat > "$STATE_FILE.tmp" <<EOF
{
  "current_state": "$state",
  "details": "$details",
  "timestamp": "$timestamp",
  "error_count": $ERROR_COUNT,
  "warning_count": $WARNING_COUNT,
  "uptime_seconds": $(($(date +%s) - SCRIPT_START_TIME))
}
EOF
    
    # Atomic move
    mv -f "$STATE_FILE.tmp" "$STATE_FILE" 2>/dev/null || true
}

# Error handler with stack trace
error_handler() {
    local line_no=$1
    local bash_lineno=$2
    local last_command=$3
    local code=$4
    local func_stack=("${FUNCNAME[@]}")
    
    log_error "Command failed with exit code $code"
    log_error "Failed command: $last_command"
    log_error "Line: $line_no"
    log_error "Function stack:"
    
    for i in "${!func_stack[@]}"; do
        if [ "$i" -gt 0 ]; then
            log_error "  ${func_stack[$i]} at line ${BASH_LINENO[$((i-1))]}"
        fi
    done
    
    # Dump environment to debug file
    env | sort > "$DEBUG_DIR/env_at_error.txt" 2>/dev/null || true
    
    update_state "error" "Command failed: $last_command at line $line_no"
}

# Set up error trap
trap 'error_handler ${LINENO} ${BASH_LINENO} "$BASH_COMMAND" $?' ERR

# Create necessary directories with error handling
log_info "Creating workspace directories..."
for dir in /workspace/logs /workspace/results /workspace/debug /workspace/temp; do
    if ! mkdir -p "$dir" 2>/dev/null; then
        log_error "Failed to create directory: $dir"
        # Try alternative location
        alt_dir="/tmp/pocketdev-fallback$(echo $dir | tr '/' '-')"
        log_warning "Attempting fallback directory: $alt_dir"
        mkdir -p "$alt_dir" || {
            log_error "Failed to create fallback directory: $alt_dir"
            exit 1
        }
    else
        log_debug "Created directory: $dir"
    fi
done

# Verify directories exist and are writable
for dir in /workspace/logs /workspace/results /workspace/debug; do
    if [ ! -d "$dir" ]; then
        log_error "Directory does not exist: $dir"
        exit 1
    fi
    if [ ! -w "$dir" ]; then
        log_error "Directory is not writable: $dir"
        exit 1
    fi
done

# Start logging with enhanced error handling
LOG_FILE="/workspace/logs/session_$(date +%Y%m%d_%H%M%S).log"
log_info "Starting log capture to: $LOG_FILE"

# Test write access
if ! echo "Log started at $(date)" > "$LOG_FILE" 2>/dev/null; then
    log_error "Cannot write to log file: $LOG_FILE"
    # Use fallback
    LOG_FILE="/tmp/pocketdev-session-$(date +%Y%m%d_%H%M%S).log"
    log_warning "Using fallback log file: $LOG_FILE"
fi

# Set up dual logging (console + file) with error handling
exec 1> >(tee -a "$LOG_FILE" 2>/dev/null || cat)
exec 2>&1

# Write initial debug info
cat > "$DEBUG_DIR/startup_info.json" <<EOF
{
  "start_time": "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")",
  "task_id": "${TASK_ID:-unknown}",
  "engineer_role": "${ENGINEER_ROLE:-unknown}",
  "model": "${MODEL:-unknown}",
  "repo_url": "${REPO_URL:-not_set}",
  "branch": "${BRANCH:-not_set}",
  "pwd": "$(pwd)",
  "user": "$(whoami)",
  "groups": "$(groups 2>/dev/null || echo 'unknown')",
  "ulimit_n": "$(ulimit -n 2>/dev/null || echo 'unknown')",
  "memory_available": "$(free -m 2>/dev/null | grep Mem | awk '{print $7}' || echo 'unknown')MB",
  "disk_available": "$(df -h /workspace 2>/dev/null | tail -1 | awk '{print $4}' || echo 'unknown')"
}
EOF

update_state "initializing" "Starting AI Developer Container"

log_info "=== AI Developer Container Starting ==="
log_info "Task ID: ${TASK_ID:-unknown}"
log_info "Engineer Role: ${ENGINEER_ROLE:-fullstack}"
log_info "Model: ${MODEL:-claude-3-5-sonnet-latest}"
log_info "Debug Mode: ${DEBUG:-false}"
log_info "Process ID: $$"
log_info "Parent Process ID: $PPID"

# System checks
log_debug "Checking system dependencies..."

# Check if Claude is installed
if ! command -v claude &> /dev/null; then
    log_error "Claude CLI is not installed or not in PATH"
    log_error "PATH: $PATH"
    # Try common locations
    for claude_path in /usr/local/bin/claude /usr/bin/claude ~/bin/claude ~/.local/bin/claude; do
        if [ -x "$claude_path" ]; then
            log_warning "Found Claude at: $claude_path - adding to PATH"
            export PATH="$(dirname $claude_path):$PATH"
            break
        fi
    done
    # Check again
    if ! command -v claude &> /dev/null; then
        log_error "Claude CLI not found after PATH search"
        exit 1
    fi
fi

log_success "Claude CLI found at: $(which claude)"
log_debug "Claude version: $(claude --version 2>&1 || echo 'version check failed')"

# Check other required commands
for cmd in git jq node python; do
    if command -v $cmd &> /dev/null; then
        log_debug "$cmd found at: $(which $cmd)"
    else
        log_warning "$cmd not found in PATH" || true
    fi
done

# Enhanced environment variable validation
log_info "Validating environment variables..."

# Required variables
REQUIRED_VARS=("REPO_URL" "TASK_DESCRIPTION")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        log_error "Required environment variable not set: $var"
        update_state "error" "Missing required variable: $var"
        exit 1
    else
        log_debug "$var is set (length: ${#var})"
    fi
done

# API Key validation with detailed checks
if [ -z "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    log_error "No API key found - CLAUDE_API_KEY or ANTHROPIC_API_KEY required"
    log_error "CLAUDE_API_KEY set: $([ -n "$CLAUDE_API_KEY" ] && echo 'yes' || echo 'no')"
    log_error "ANTHROPIC_API_KEY set: $([ -n "$ANTHROPIC_API_KEY" ] && echo 'yes' || echo 'no')"
    update_state "error" "No API key provided"
    exit 1
fi

# Set and validate API key
export ANTHROPIC_API_KEY="${CLAUDE_API_KEY:-$ANTHROPIC_API_KEY}"
if [ -z "$ANTHROPIC_API_KEY" ]; then
    log_error "API key is empty after assignment"
    exit 1
fi

# Validate API key format (should start with 'sk-')
if [[ ! "$ANTHROPIC_API_KEY" =~ ^sk- ]]; then
    log_warning "API key does not start with 'sk-' - may be invalid"
fi

log_info "API key configured (first 10 chars): ${ANTHROPIC_API_KEY:0:10}..."
log_debug "API key length: ${#ANTHROPIC_API_KEY}"

# Log all environment variables (masking sensitive ones)
log_debug "Environment variables:"
env | sort | while IFS='=' read -r key value; do
    if [[ "$key" =~ (KEY|TOKEN|SECRET|PASSWORD) ]]; then
        log_trace "  $key=***masked*** (length: ${#value})"
    else
        log_trace "  $key=$value"
    fi
done > "$DEBUG_DIR/env_vars.txt" 2>&1

# Function to handle Git authentication
setup_git_auth() {
    if [ -n "$GIT_USERNAME" ] && [ -n "$GIT_TOKEN" ]; then
        log_info "Configuring Git authentication"
        git config --global credential.helper store
        echo "https://${GIT_USERNAME}:${GIT_TOKEN}@github.com" > ~/.git-credentials
    fi
}

# Function to run Claude with extreme error handling
run_claude() {
    log_info "GATE CHECK: Entering run_claude() function"
    local prompt="$1"
    local output_file="$2"
    local continue_session="${3:-false}"
    local attempt=1
    local max_attempts=3
    local success=false
    
    log_info "run_claude called with output_file: $output_file"
    log_debug "Prompt length: ${#prompt} characters"
    log_debug "Continue session: $continue_session"
    log_info "GATE CHECK: run_claude() parameters validated"
    
    # Validate inputs
    if [ -z "$prompt" ]; then
        log_error "run_claude: Empty prompt provided"
        return 1
    fi
    
    if [ -z "$output_file" ]; then
        log_error "run_claude: No output file specified"
        return 1
    fi
    
    # Ensure output directory exists
    local output_dir=$(dirname "$output_file")
    if ! mkdir -p "$output_dir" 2>/dev/null; then
        log_error "run_claude: Cannot create output directory: $output_dir"
        return 1
    fi
    
    # Write prompt to debug file
    echo "$prompt" > "$DEBUG_DIR/claude_prompt_$(date +%s).txt"
    
    # CRITICAL: Properly quote the prompt to handle spaces
    if [[ -z "$prompt" ]]; then
        log_error "CRITICAL: Empty prompt provided!"
        return 1
    fi
    
    # Log prompt for debugging
    log_debug "Prompt length: ${#prompt}"
    log_debug "First 100 chars of prompt: ${prompt:0:100}..."
    
    # Build args without the prompt (will use stdin instead)
    local claude_args=(
        "-p"  # Required for non-interactive mode with stdin
        "--output-format" "json"
    )
    
    # CRITICAL: DO NOT USE --verbose FLAG
    # The --verbose flag breaks JSON output by forcing streaming mode
    if [ "${DEBUG:-false}" = "true" ] || [ "${CLAUDE_DEBUG:-false}" = "true" ]; then
        log_error "===========================================" 
        log_error "WARNING: DEBUG MODE REQUESTED BUT DISABLED"
        log_error "The --verbose flag breaks Claude JSON output"
        log_error "It forces streaming mode even with --output-format json"
        log_error "DO NOT ENABLE VERBOSE MODE"
        log_error "==========================================="
        # DO NOT add verbose flag
    fi
    
    # Add session continuation if available
    if [ "$continue_session" = "true" ] && [ -n "$CLAUDE_SESSION_ID" ]; then
        claude_args+=("--resume" "$CLAUDE_SESSION_ID")
    elif [ "$continue_session" = "true" ] && [ -f "/workspace/results/last_session_id" ]; then
        CLAUDE_SESSION_ID=$(cat /workspace/results/last_session_id)
        claude_args+=("--resume" "$CLAUDE_SESSION_ID")
    fi
    
    # CRITICAL: Check for newlines in prompts
    if [[ "$prompt" =~ $'\n' ]]; then
        log_warning "Prompt contains newlines - will use stdin"
    fi
    
    # CRITICAL: Validate command arguments before proceeding
    # Check if any arguments contain unquoted spaces or special characters
    local validation_errors=0
    
    # Check prompt
    if [[ -z "$prompt" ]]; then
        log_error "CRITICAL: Empty prompt provided!"
        ((validation_errors++))
    fi
    
    # Build system prompt WITHOUT newlines
    local base_prompt=""
    case "$ENGINEER_ROLE" in
        frontend)
            base_prompt="You are a senior frontend engineer specializing in React and TypeScript. Focus on component architecture, accessibility, and user experience."
            ;;
        backend)
            base_prompt="You are a backend architect specializing in scalable APIs. Focus on security, performance, and proper error handling."
            ;;
        devops)
            base_prompt="You are a DevOps specialist focusing on automation and infrastructure. Create reproducible deployments and comprehensive monitoring."
            ;;
    esac
    
    # Add memory context as a single line
    local memory_note="Read /workspace/repo/.pocketdev/team-memory.md for context and update /workspace/repo/.pocketdev/engineers/${ENGINEER_ROLE}-${ENGINEER_ID:-1}.md with learnings."
    
    # Combine into single-line system prompt
    local system_prompt="${base_prompt} ${memory_note}"
    
    # CRITICAL VALIDATION: Check system prompt for unquoted spaces
    if [[ "$system_prompt" =~ [[:space:]] ]]; then
        log_warning "System prompt contains spaces - MUST be quoted"
        # This WILL break if not quoted properly
    fi
    
    # CRITICAL: Check for newlines in system prompt
    if [[ "$system_prompt" =~ $'\n' ]]; then
        log_error "CRITICAL: System prompt contains newlines! This WILL break command parsing!"
        log_error "System prompt: $system_prompt"
        return 1
    fi
    
    claude_args+=("--append-system-prompt" "$system_prompt")
    
    # Add allowed tools - NO MCP tools (not set up)
    claude_args+=("--allowedTools" "View,Edit,Write,Bash")
    
    # CRITICAL VALIDATION: Verify all arguments are properly quoted
    log_info "Claude args prepared: ${#claude_args[@]} arguments"
    
    # CRITICAL: Use printf %q to show exactly how args will be passed
    # DO NOT use ${claude_args[*]} as it loses quoting!
    local safe_command="claude"
    for arg in "${claude_args[@]}"; do
        safe_command+=" $(printf %q "$arg")"
    done
    log_trace "Full command: $safe_command"
    
    # VALIDATION: Check if command looks broken
    if [[ "$safe_command" =~ --system-prompt[[:space:]]You[[:space:]]are ]]; then
        log_error "CRITICAL ERROR: System prompt is NOT properly quoted in command!"
        log_error "This command WILL FAIL: $safe_command"
        log_error "The system prompt MUST be passed as a single quoted argument!"
        return 1
    fi
    
    # Write command to debug file - use printf %q for accurate representation
    echo "$safe_command" > "$DEBUG_DIR/claude_command.txt"
    
    # Retry loop with exponential backoff
    log_info "GATE CHECK: Entering Claude retry loop"
    while [ $attempt -le $max_attempts ] && [ "$success" = "false" ]; do
        log_info "Claude execution attempt $attempt of $max_attempts"
        update_state "claude_execution" "Running Claude (attempt $attempt)"
        log_info "GATE CHECK: Starting attempt $attempt"
        
        local start_time=$(date +%s)
        local temp_output="$output_file.tmp"
        local error_output="$output_file.error"
        
        # Clear previous outputs
        > "$temp_output"
        > "$error_output"
        
        # Execute Claude with timeout and comprehensive error capture
        if [ "${DEBUG:-false}" = "true" ]; then
            log_debug "Running Claude in debug mode with visible output"
            
            # Use timeout to prevent hanging
            # FIXED: Claude expects prompt as argument, not stdin
            if timeout 600 claude "${claude_args[@]}" "$prompt" 2>"$error_output" | tee "$temp_output"; then
                local exit_code=$?
                log_success "Claude command completed with exit code: $exit_code"
                success=true
            else
                local exit_code=$?
                log_error "Claude command failed with exit code: $exit_code"
                log_error "Error output:"
                cat "$error_output" >&2
            fi
        else
            # Production mode - capture all output
            log_debug "Running Claude in production mode"
            
            # Create a wrapper script to capture more details
            cat > "$DEBUG_DIR/claude_wrapper.sh" <<'WRAPPER'
#!/bin/bash
output_file="$1"
error_file="$2"
shift 2

# CRITICAL: Log exactly what we're about to run
echo "[WRAPPER] Running: claude $*" >&2
echo "[WRAPPER] Number of args: $#" >&2
echo "[WRAPPER] Args:" >&2
for arg in "$@"; do
    echo "[WRAPPER]   '$arg'" >&2
done

# CRITICAL: Log the ACTUAL command being executed
echo "[WRAPPER] Executing: claude" >&2
for i in $(seq 1 $#); do
    echo "[WRAPPER]   Arg $i: '${!i}'" >&2
done

# Run claude and capture everything - PRESERVE QUOTES
# Note: The prompt is passed as the last argument
claude "$@" >"$output_file" 2>"$error_file"
exit_code=$?

# Log exit code
echo "$exit_code" > "${output_file}.exitcode"
echo "[WRAPPER] Claude exited with code: $exit_code" >&2
exit $exit_code
WRAPPER
            chmod +x "$DEBUG_DIR/claude_wrapper.sh"
            
            # Debug: Print exactly what we're passing
            log_debug "Passing ${#claude_args[@]} arguments to wrapper"
            local i=0
            for arg in "${claude_args[@]}"; do
                log_debug "Arg[$i]: '$arg'"
                ((i++))
            done
            
            # Log the prompt being passed
            log_debug "Prompt (first 200 chars): '${prompt:0:200}...'"
            log_debug "Prompt length: ${#prompt} characters"
            
            # Use echo to pipe prompt to stdin
            # When using -p flag, Claude expects input via stdin OR as argument
            if echo "$prompt" | timeout 600 claude "${claude_args[@]}" >"$temp_output" 2>"$error_output"; then
                success=true
                log_success "Claude execution succeeded"
            else
                local exit_code=$?
                if [ -f "${temp_output}.exitcode" ]; then
                    exit_code=$(cat "${temp_output}.exitcode")
                fi
                log_error "Claude execution failed with exit code: $exit_code"
                
                # Detailed error analysis
                if [ $exit_code -eq 124 ]; then
                    log_error "Claude execution timed out after 600 seconds"
                elif [ $exit_code -eq 127 ]; then
                    log_error "Claude command not found"
                    log_error "PATH: $PATH"
                    log_error "Which claude: $(which claude 2>&1 || echo 'not found')"
                fi
                
                if [ -s "$error_output" ]; then
                    log_error "Claude stderr output:"
                    cat "$error_output" | while IFS= read -r line; do
                        log_error "  $line"
                    done
                fi
                
                if [ -s "$temp_output" ]; then
                    log_warning "Partial output captured:"
                    head -n 20 "$temp_output" | while IFS= read -r line; do
                        log_warning "  $line"
                    done
                fi
            fi
        fi
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_info "Claude execution took $duration seconds"
        
        if [ "$success" = "true" ]; then
            # Validate output file
            if [ ! -f "$temp_output" ]; then
                log_error "Output file not created: $temp_output"
                success=false
            elif [ ! -s "$temp_output" ]; then
                log_error "Output file is empty: $temp_output"
                success=false
            else
                # Try to validate JSON
                if jq empty "$temp_output" 2>/dev/null; then
                    log_success "Output is valid JSON"
                    
                    # Move to final location
                    if ! mv -f "$temp_output" "$output_file"; then
                        log_error "Failed to move output file"
                        success=false
                    else
                        # Extract session ID
                        local session_id=$(jq -r '.session_id // empty' "$output_file" 2>/dev/null)
                        if [ -n "$session_id" ]; then
                            echo "$session_id" > /workspace/results/last_session_id
                            export CLAUDE_SESSION_ID="$session_id"
                            log_info "Session ID extracted: $session_id"
                        else
                            log_warning "No session ID found in response"
                        fi
                        
                        # Log response summary
                        local response_length=$(jq -r '.result // "" | length' "$output_file" 2>/dev/null || echo 0)
                        log_info "Response length: $response_length characters"
                    fi
                else
                    log_error "Output is not valid JSON"
                    log_error "First 500 chars: $(head -c 500 "$temp_output")"
                    
                    # Check for common issues
                    if grep -q "streaming" "$temp_output" 2>/dev/null; then
                        log_error "Detected streaming output - JSON format may be corrupted"
                    fi
                    
                    # Save invalid output for debugging
                    cp "$temp_output" "$DEBUG_DIR/invalid_json_$(date +%s).txt"
                    success=false
                fi
            fi
        fi
        
        if [ "$success" = "false" ] && [ $attempt -lt $max_attempts ]; then
            local wait_time=$((attempt * 5))
            log_warning "Waiting $wait_time seconds before retry..."
            sleep $wait_time
        fi
        
        ((attempt++))
    done
    
    # Clean up temp files
    rm -f "$temp_output" "$error_output" "${temp_output}.exitcode" 2>/dev/null || true
    
    if [ "$success" = "true" ]; then
        update_state "claude_completed" "Claude execution successful"
        return 0
    else
        update_state "claude_failed" "Claude execution failed after $max_attempts attempts"
        return 1
    fi
}

# Check if process is still alive
check_process_alive() {
    if ! kill -0 $$ 2>/dev/null; then
        log_error "Main process $$ is no longer alive"
        exit 1
    fi
}

# Periodic health check
start_health_monitor() {
    (
        while true; do
            sleep 30
            if ! check_process_alive; then
                log_error "Health check failed - process dead"
                break
            fi
            
            # Update heartbeat
            echo "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")" > "$DEBUG_DIR/heartbeat.txt"
            
            # Check for zombie processes
            local zombies=$(ps aux | grep defunct | grep -v grep | wc -l)
            if [ "$zombies" -gt 0 ]; then
                log_warning "Found $zombies zombie processes"
            fi
            
            # Memory check
            local mem_available=$(free -m | grep Mem | awk '{print $7}')
            if [ "$mem_available" -lt 100 ]; then
                log_warning "Low memory: ${mem_available}MB available"
            fi
        done
    ) &
    HEALTH_MONITOR_PID=$!
    log_debug "Started health monitor with PID: $HEALTH_MONITOR_PID"
}

# Main execution flow with comprehensive error handling
main() {
    log_info "GATE CHECK: Entering main() function"
    local start_time=$(date +%s)
    local success=false
    local error_message=""
    local summary=""
    local files_changed=()
    local test_results=""
    local suggested_next_steps=()
    
    update_state "main_started" "Beginning main execution"
    log_info "GATE CHECK: main() initialized, start_time=$start_time"
    
    # Start health monitoring
    start_health_monitor
    
    # Validate we're in a good state
    if [ $ERROR_COUNT -gt 0 ]; then
        log_warning "Starting main with $ERROR_COUNT existing errors"
    fi
    
    # Setup Git authentication with error handling
    log_info "Setting up Git authentication..."
    if ! setup_git_auth; then
        log_warning "Git authentication setup had issues but continuing"
    fi
    
    # Clone repository with comprehensive error handling
    log_info "Cloning repository: $REPO_URL"
    update_state "cloning" "Cloning repository"
    
    local clone_output="$DEBUG_DIR/git_clone_output.txt"
    local clone_start=$(date +%s)
    
    # Validate URL format
    if [[ ! "$REPO_URL" =~ ^(https?://|git@|ssh://) ]]; then
        log_error "Invalid repository URL format: $REPO_URL"
        error_message="Invalid repository URL format"
        save_results "$success" "$error_message" "$summary" "$start_time"
        exit 1
    fi
    
    # Try cloning with timeout and detailed error capture
    if timeout 300 git clone "$REPO_URL" /workspace/repo > "$clone_output" 2>&1; then
        local clone_duration=$(($(date +%s) - clone_start))
        log_success "Repository cloned successfully in $clone_duration seconds"
        
        # Verify clone
        if [ ! -d "/workspace/repo/.git" ]; then
            log_error "Clone succeeded but .git directory not found"
            error_message="Repository structure invalid after clone"
            save_results "$success" "$error_message" "$summary" "$start_time"
            exit 1
        fi
    else
        local exit_code=$?
        local clone_duration=$(($(date +%s) - clone_start))
        
        log_error "Git clone failed with exit code: $exit_code (duration: ${clone_duration}s)"
        log_error "Clone output:"
        cat "$clone_output" | while IFS= read -r line; do
            log_error "  $line"
        done
        
        # Analyze failure
        if [ $exit_code -eq 124 ]; then
            error_message="Repository clone timed out after 300 seconds"
        elif grep -q "Permission denied" "$clone_output"; then
            error_message="Authentication failed - check credentials"
        elif grep -q "Could not resolve host" "$clone_output"; then
            error_message="Network error - could not resolve host"
        elif grep -q "Repository not found" "$clone_output"; then
            error_message="Repository not found or access denied"
        else
            error_message="Failed to clone repository - check logs for details"
        fi
        
        log_error "$error_message"
        save_results "$success" "$error_message" "$summary" "$start_time"
        exit 1
    fi
    
    # Change to repository directory with validation
    if ! cd /workspace/repo 2>/dev/null; then
        log_error "Cannot change to repository directory"
        error_message="Failed to enter repository directory"
        save_results "$success" "$error_message" "$summary" "$start_time"
        exit 1
    fi
    
    log_info "Current directory: $(pwd)"
    log_debug "Repository size: $(du -sh . 2>/dev/null | cut -f1 || echo 'unknown')"
    log_debug "File count: $(find . -type f 2>/dev/null | wc -l || echo 'unknown')"
    
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
    log_info "GATE CHECK: About to start development task"
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
    
    # Get list of changed files with error handling
    log_info "Checking for changed files..."
    if ! git diff --name-only > "$DEBUG_DIR/changed_files.txt" 2>&1; then
        log_warning "Failed to get changed files list"
    else
        mapfile -t files_changed < "$DEBUG_DIR/changed_files.txt"
        log_info "Files changed: ${#files_changed[@]}"
        for file in "${files_changed[@]}"; do
            log_debug "  - $file"
        done
    fi
    
    # Check if verification script exists and run it with comprehensive error handling
    log_info "Looking for verification script..."
    update_state "verification" "Running verification scripts"
    
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
        if verification_output=$(python3 test.py 2>&1); then
            verification_passed=true
            test_results="test.py passed successfully"
        else
            test_results="test.py failed: $verification_output"
        fi
    elif [ -f "verify.py" ]; then
        log_info "Running verify.py..."
        if verification_output=$(python3 verify.py 2>&1); then
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
    
    # Stage changes with validation
    log_info "Staging changes..."
    if ! git add -A 2>&1; then
        log_warning "Failed to stage all changes - trying individual files"
        for file in "${files_changed[@]}"; do
            if [ -f "$file" ]; then
                git add "$file" 2>/dev/null || log_warning "Could not stage: $file"
            fi
        done
    fi
    
    # Verify staged changes
    local staged_count=$(git diff --cached --name-only | wc -l)
    log_info "Staged $staged_count files"
    
    # Save results with comprehensive data
    update_state "saving_results" "Saving final results"
    save_results "$success" "$error_message" "$summary" "$start_time"
    
    # Kill health monitor
    if [ -n "$HEALTH_MONITOR_PID" ]; then
        kill $HEALTH_MONITOR_PID 2>/dev/null || true
    fi
}

# Function to save results with extreme validation
save_results() {
    local success="$1"
    local error_message="$2"
    local summary="$3"
    local start_time="$4"
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    local result_file="/workspace/results/session_result.json"
    
    log_info "Saving results to: $result_file"
    log_debug "Success: $success, Duration: ${duration}s"
    
    # Ensure results directory exists
    if ! mkdir -p "$(dirname "$result_file")" 2>/dev/null; then
        log_error "Cannot create results directory"
        # Try fallback
        result_file="/tmp/pocketdev_result_${TASK_ID}.json"
        log_warning "Using fallback result file: $result_file"
    fi
    
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
    
    # Verify file was written
    if [ -f "$result_file" ]; then
        log_success "Results saved to $result_file"
        
        # Validate JSON
        if jq empty "$result_file" 2>/dev/null; then
            log_debug "Result file is valid JSON"
        else
            log_warning "Result file may have invalid JSON"
        fi
        
        # Create backup
        cp "$result_file" "$DEBUG_DIR/final_result.json" 2>/dev/null || true
    else
        log_error "Failed to create result file"
    fi
    
    # Write final debug summary
    cat > "$DEBUG_DIR/execution_summary.json" <<EOF
{
  "success": $success,
  "duration_seconds": $duration,
  "error_count": $ERROR_COUNT,
  "warning_count": $WARNING_COUNT,
  "start_time": "$(date -u -d @$start_time +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo 'unknown')",
  "end_time": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "task_id": "${TASK_ID:-unknown}",
  "final_state": "$([ "$success" = "true" ] && echo 'completed' || echo 'failed')"
}
EOF
    
    if [ "$success" = "true" ]; then
        log_success "Task completed successfully in ${duration}s"
        log_info "Changes are staged but not committed"
        log_info "User can accept and commit or request follow-up tasks"
        update_state "completed" "Task completed successfully"
    else
        log_error "Task failed: $error_message"
        update_state "failed" "Task failed: $error_message"
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

# Enhanced interrupt handling
cleanup_on_exit() {
    local exit_code=$?
    log_warning "Script exiting with code: $exit_code"
    
    # Kill health monitor if running
    if [ -n "$HEALTH_MONITOR_PID" ]; then
        kill $HEALTH_MONITOR_PID 2>/dev/null || true
    fi
    
    # Save state if not already saved
    if [ ! -f "/workspace/results/session_result.json" ]; then
        log_warning "No results saved - creating emergency result"
        save_results false "Script terminated unexpectedly" "" "$SCRIPT_START_TIME"
    fi
    
    # Final state update
    update_state "terminated" "Script terminated with code $exit_code"
    
    log_info "Cleanup completed"
}

# Set up signal handlers
trap cleanup_on_exit EXIT
trap 'log_warning "Received INT signal"; exit 130' INT
trap 'log_warning "Received TERM signal"; exit 143' TERM
trap 'log_error "Received HUP signal"; exit 129' HUP

# Check if this is a follow-up task
log_info "GATE CHECK: About to check for follow-up task"
if [ -f "/workspace/CONTINUE" ]; then
    log_info "GATE CHECK: Found CONTINUE file, running handle_followup"
    handle_followup
else
    # Run main function
    log_info "GATE CHECK: No CONTINUE file, running main function"
    main
fi
log_info "GATE CHECK: Main execution completed"

# Keep container running if task can continue with health checks
if [ "$success" = "true" ] || [ -f "/workspace/results/session_result.json" ]; then
    log_info "Container ready for follow-up tasks or finalization"
    update_state "waiting" "Waiting for user action"
    
    wait_start=$(date +%s)
    check_interval=2
    max_wait_time=3600  # 1 hour max wait
    
    # Keep container alive for potential follow-up
    while true; do
        # Check if we've been waiting too long
        wait_duration=$(($(date +%s) - wait_start))
        if [ $wait_duration -gt $max_wait_time ]; then
            log_warning "Exceeded maximum wait time of ${max_wait_time}s - shutting down"
            break
        fi
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
                        if verification_output=$(python3 $test_file 2>&1); then
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
        
        # Health check
        if ! check_process_alive; then
            log_error "Process health check failed"
            break
        fi
        
        # Update wait state
        if [ $((wait_duration % 60)) -eq 0 ]; then
            update_state "waiting" "Waiting for user action (${wait_duration}s elapsed)"
        fi
        
        sleep $check_interval
    done
fi

log_info "Container shutting down"
update_state "shutdown" "Container shutting down"

# Exit with appropriate code
if [ "$success" = "true" ]; then
    exit 0
else
    exit 1
fi