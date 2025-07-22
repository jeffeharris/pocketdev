# System-wide .bashrc file for interactive bash(1) shells in Shelltender
# This configuration is loaded for all terminal sessions

# Set a nice colored prompt - always set it even if PS1 is empty
export PS1='\[\033[01;32m\]\u@pocketdev\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '

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
    alias fgrep='fgrep --color=auto'
    alias egrep='egrep --color=auto'
fi

# Common aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'

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

# Add node_modules/.bin to PATH if it exists
if [ -d "./node_modules/.bin" ]; then
    export PATH="./node_modules/.bin:$PATH"
fi

# Set default editor
export EDITOR=vim
export VISUAL=vim

# Make less more friendly for non-text input files
[ -x /usr/bin/lesspipe ] && eval "$(SHELL=/bin/sh lesspipe)"

# Enable programmable completion features
if ! shopt -oq posix; then
  if [ -f /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  elif [ -f /etc/bash_completion ]; then
    . /etc/bash_completion
  fi
fi

# Terminal title
case "$TERM" in
xterm*|rxvt*)
    PS1="\[\e]0;\u@\h: \w\a\]$PS1"
    ;;
*)
    ;;
esac

# Welcome message for PocketDev terminals
if [ -n "$TASK_ID" ]; then
    echo "🚀 PocketDev Terminal Ready"
    echo "📁 Working directory: $(pwd)"
    if [ -n "$HISTFILE" ] && [ -f "$HISTFILE" ] && [ -s "$HISTFILE" ]; then
        echo "📜 History: $(wc -l < "$HISTFILE" 2>/dev/null || echo "0") commands available"
    fi
    echo ""
fi