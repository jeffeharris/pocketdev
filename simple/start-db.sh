#!/bin/bash

# Start the database-backed PocketDev server

echo "Starting PocketDev with SQLite persistence..."
echo "Database will be created at: simple/data/pocketdev.db"
echo ""

# Ensure data directory exists
mkdir -p simple/data

# Start the database-backed project manager
cd simple/server
node project-manager-db.cjs