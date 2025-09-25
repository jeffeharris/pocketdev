#!/bin/bash
# Secure entrypoint script for PocketDev containers
# Handles UID/GID mapping and permission fixes without requiring root

set -e

# Get host UID/GID from environment or use defaults
HOST_UID=${HOST_UID:-1000}
HOST_GID=${HOST_GID:-1000}
USERNAME=${USERNAME:-pocketdev}

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# If running as root (build time), create user with matching UID/GID
if [ "$(id -u)" = "0" ]; then
    log "Running as root, setting up user mapping..."
    
    # Check if group exists, create if not
    if ! getent group $HOST_GID >/dev/null 2>&1; then
        groupadd -g $HOST_GID $USERNAME
    fi
    
    # Check if user exists
    if id -u $USERNAME >/dev/null 2>&1; then
        # User exists, update UID/GID if needed
        current_uid=$(id -u $USERNAME)
        current_gid=$(id -g $USERNAME)
        
        if [ "$current_uid" != "$HOST_UID" ] || [ "$current_gid" != "$HOST_GID" ]; then
            log "Updating $USERNAME to UID=$HOST_UID, GID=$HOST_GID"
            usermod -u $HOST_UID -g $HOST_GID $USERNAME
        fi
    else
        # Create user with specific UID/GID
        log "Creating user $USERNAME with UID=$HOST_UID, GID=$HOST_GID"
        useradd -m -u $HOST_UID -g $HOST_GID -s /bin/bash $USERNAME
    fi
    
    # Fix ownership of home directory
    chown -R $HOST_UID:$HOST_GID /home/$USERNAME
    
    # Fix ownership of app directory if it exists
    if [ -d "/app" ]; then
        chown -R $HOST_UID:$HOST_GID /app
    fi
    
    # Create required directories with proper ownership
    for dir in /app/data /projects; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
        fi
        chown -R $HOST_UID:$HOST_GID "$dir"
    done
    
    # Drop privileges and run as the mapped user
    log "Switching to user $USERNAME (UID=$HOST_UID)"
    exec gosu $USERNAME "$@"
else
    # Already running as non-root user
    log "Running as $(whoami) (UID=$(id -u), GID=$(id -g))"
    
    # Handle git config without global modifications
    # Only configure for specific directories that need it
    if [ -d "/app" ] && [ -d "/app/.git" ]; then
        git config --local safe.directory /app
    fi
    
    if [ -d "/projects" ]; then
        # Configure git for each project directory individually
        find /projects -maxdepth 2 -type d -name ".git" -exec dirname {} \; | while read -r repo; do
            log "Configuring git safe.directory for $repo"
            cd "$repo" && git config --local safe.directory "$repo"
        done
    fi
    
    # Clean up bloated .gitconfig if it exists (legacy cleanup)
    if [ -f "$HOME/.gitconfig" ]; then
        gitconfig_size=$(stat -c%s "$HOME/.gitconfig" 2>/dev/null || echo 0)
        if [ "$gitconfig_size" -gt 102400 ]; then
            log "WARNING: Large .gitconfig detected (${gitconfig_size} bytes), backing up and creating new one"
            mv "$HOME/.gitconfig" "$HOME/.gitconfig.backup.$(date +%s)"
            touch "$HOME/.gitconfig"
        fi
    fi
    
    # Execute the main command
    exec "$@"
fi