#!/bin/bash

# Fix broken Git worktrees by updating their path references
# This script fixes worktrees that were created with Docker container paths

# Get the actual projects directory from the host system
PROJECTS_DIR="/home/jeffh/projects/pocketdev-simple-server/simple/projects"
# Container path where worktrees are actually created
CONTAINER_PROJECTS_DIR="/projects"

echo "🔧 Fixing broken Git worktrees in $PROJECTS_DIR"
echo "============================================"

fixed_count=0
total_count=0

# Find all directories that look like task worktrees
for worktree_dir in "$PROJECTS_DIR"/*-task-*/; do
    if [ ! -d "$worktree_dir" ]; then
        continue
    fi
    
    total_count=$((total_count + 1))
    worktree_name=$(basename "$worktree_dir")
    
    echo -n "Checking $worktree_name... "
    
    # Check if .git file exists
    if [ ! -f "$worktree_dir/.git" ]; then
        echo "❌ No .git file found"
        continue
    fi
    
    # Read the current gitdir path
    current_gitdir=$(grep "^gitdir:" "$worktree_dir/.git" | cut -d' ' -f2)
    
    # Check if it's using a Docker path
    if [[ "$current_gitdir" == */workspace/projects/* ]] || [[ "$current_gitdir" == */projects/* ]]; then
        # Extract the project and worktree parts
        if [[ "$current_gitdir" == */workspace/projects/* ]]; then
            relative_path=${current_gitdir#*/workspace/projects/}
        elif [[ "$current_gitdir" == "$CONTAINER_PROJECTS_DIR"/* ]]; then
            # Handle exact /projects/ path
            relative_path=${current_gitdir#$CONTAINER_PROJECTS_DIR/}
        else
            # Handle any other /projects/ variant
            relative_path=${current_gitdir#*/projects/}
        fi
        
        # Construct the correct path
        new_gitdir="$PROJECTS_DIR/$relative_path"
        
        # Update the .git file
        echo "gitdir: $new_gitdir" > "$worktree_dir/.git"
        
        # Also update the worktree's gitdir file in the main repo if it exists
        project_name=$(echo "$relative_path" | cut -d'/' -f1)
        worktree_gitdir_file="$PROJECTS_DIR/$project_name/.git/worktrees/$worktree_name/gitdir"
        
        if [ -f "$worktree_gitdir_file" ]; then
            echo "$worktree_dir" > "$worktree_gitdir_file"
        fi
        
        echo "✅ Fixed (was: $current_gitdir)"
        fixed_count=$((fixed_count + 1))
    else
        echo "✓ Already correct"
    fi
done

echo "============================================"
echo "Summary: Fixed $fixed_count out of $total_count worktrees"

# Also check for any orphaned worktree entries in main repos
echo ""
echo "🔍 Checking for orphaned worktree entries..."

for project_dir in "$PROJECTS_DIR"/*/; do
    if [ ! -d "$project_dir/.git/worktrees" ]; then
        continue
    fi
    
    project_name=$(basename "$project_dir")
    
    # Skip if this is itself a worktree
    if [[ "$project_name" == *-task-* ]]; then
        continue
    fi
    
    for worktree_entry in "$project_dir/.git/worktrees"/*/; do
        if [ ! -d "$worktree_entry" ]; then
            continue
        fi
        
        worktree_name=$(basename "$worktree_entry")
        gitdir_file="$worktree_entry/gitdir"
        
        if [ -f "$gitdir_file" ]; then
            worktree_path=$(cat "$gitdir_file")
            
            # Check if the worktree directory exists
            if [ ! -d "$worktree_path" ]; then
                echo "Found orphaned worktree entry: $project_name/$worktree_name"
                echo "  Points to non-existent: $worktree_path"
                
                # Try to find the actual worktree
                expected_path="$PROJECTS_DIR/$worktree_name"
                if [ -d "$expected_path" ]; then
                    echo "  ✅ Fixed: Updated to $expected_path"
                    echo "$expected_path" > "$gitdir_file"
                else
                    echo "  ⚠️  Could not find worktree directory"
                fi
            fi
        fi
    done
done

echo ""
echo "🎉 Worktree fix complete!"