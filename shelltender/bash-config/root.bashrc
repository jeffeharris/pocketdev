# ~/.bashrc for root user in Shelltender

# Source the system-wide bashrc first
if [ -f /etc/bash.bashrc ]; then
    . /etc/bash.bashrc
fi

# The system bashrc should have already set everything we need
# This file exists to ensure root gets the same shell configuration as pocketdev