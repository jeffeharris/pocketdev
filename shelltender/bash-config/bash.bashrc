# System-wide .bashrc file for interactive bash(1) shells in Shelltender
# This configuration is loaded for all terminal sessions

# Function to show relative path from worktree root
pocketdev_relative_path() {
    if [ -n "$WORKTREE_PATH" ]; then
        local current_dir=$(pwd)
        if [[ "$current_dir" == "$WORKTREE_PATH"* ]]; then
            local rel_path="${current_dir#$WORKTREE_PATH}"
            echo "${rel_path:-/}"
        else
            echo "$current_dir"
        fi
    else
        echo "\w"
    fi
}

# Track directory changes and commands that fill the screen
LAST_PWD=""
SHOW_CONTEXT_NEXT=0

pocketdev_smart_prompt() {
    local current_pwd=$(pwd)
    
    # Check if we should show context
    if [ "$current_pwd" != "$LAST_PWD" ] || [ "$SHOW_CONTEXT_NEXT" -eq 1 ]; then
        # Show the context line
        echo -e "\033[1;35m[$TASK_NAME]\033[0m \033[33m$(pocketdev_relative_path)\033[0m"
        LAST_PWD="$current_pwd"
        SHOW_CONTEXT_NEXT=0
    fi
}

# Function to request context on next prompt (can be called by user)
context() {
    SHOW_CONTEXT_NEXT=1
}

# Common commands that tend to fill the screen
claude() {
    command claude "$@"
    SHOW_CONTEXT_NEXT=1
}

npm() {
    command npm "$@"
    # npm install/test/build tend to have lots of output
    if [[ "$1" =~ ^(install|i|test|build|run)$ ]]; then
        SHOW_CONTEXT_NEXT=1
    fi
}

docker() {
    command docker "$@"
    # docker logs and build have lots of output
    if [[ "$1" =~ ^(logs|build)$ ]]; then
        SHOW_CONTEXT_NEXT=1
    fi
}

make() {
    command make "$@"
    SHOW_CONTEXT_NEXT=1
}

# Set PROMPT_COMMAND to run our function before each prompt
PROMPT_COMMAND="pocketdev_smart_prompt${PROMPT_COMMAND:+; $PROMPT_COMMAND}"

# Simple prompt - just username and $
PS1='\[\033[32m\]\u\[\033[0m\]\$ '

# If PS1 was passed from environment, use it instead
if [ -n "$PS1" ] && [ "$PS1" != '\[\033[32m\]\u\[\033[0m\]\$ ' ]; then
    PS1="$PS1"
fi

# If not running interactively, skip the rest
case $- in
    *i*) ;;
      *) return;;
esac

# Enable color support for ls and grep
if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval "$(dircolors -b ~/.dircolors)" || eval "$(dircolors -b)"
    alias ls='ls --color=auto'
    alias grep='grep --color=auto'
fi

# Common aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'

# Alias to show context
alias where='context; :'

# Git aliases
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline -10'
alias gd='git diff'
alias gb='git branch'
alias gco='git checkout'

# History settings
HISTSIZE=10000
HISTFILESIZE=20000
HISTCONTROL=ignoreboth:erasedups
shopt -s histappend

# Append to history after each command
PROMPT_COMMAND="${PROMPT_COMMAND:+$PROMPT_COMMAND; }history -a"

# Configure git if environment variables are set
if [ -n "$GIT_USER_NAME" ] && [ -n "$GIT_USER_EMAIL" ]; then
    if ! git config --global user.name >/dev/null 2>&1; then
        git config --global user.name "$GIT_USER_NAME" 2>/dev/null || true
    fi
    if ! git config --global user.email >/dev/null 2>&1; then
        git config --global user.email "$GIT_USER_EMAIL" 2>/dev/null || true
    fi
fi

# Welcome message for PocketDev terminals
if [ -n "$TASK_ID" ]; then
    echo "🚀 PocketDev Terminal Ready"
    echo "📁 Working directory: $(pwd)"
    if [ -n "$HISTFILE" ] && [ -f "$HISTFILE" ] && [ -s "$HISTFILE" ]; then
        echo "📜 History: $(wc -l < "$HISTFILE" 2>/dev/null || echo "0") commands available"
    fi
    echo ""
    # Show initial location
    echo -e "\033[1;35m[$TASK_NAME]\033[0m \033[33m$(pocketdev_relative_path)\033[0m"
    LAST_PWD=$(pwd)
fi