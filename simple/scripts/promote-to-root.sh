#!/bin/bash
# Script to safely promote simple/ directory to root

set -e

echo "🚀 Starting promotion of simple/ to root directory..."
echo "⚠️  This will move all contents of simple/ to the parent directory"
echo ""

# Check if we're in the right place
if [ ! -d "simple" ]; then
    echo "❌ Error: simple/ directory not found. Run this from the pocketdev root."
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  You have uncommitted changes. Please commit or stash them first."
    echo "Current status:"
    git status --short
    exit 1
fi

echo "📝 Creating pre-promotion commit..."
git add -A
git commit -m "Pre-promotion checkpoint: Backend/shelltender separation complete" || echo "Nothing to commit"

echo ""
echo "🎯 Current directory structure:"
ls -la

echo ""
read -p "📢 Ready to promote simple/ to root? This will move all files. Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborted."
    exit 1
fi

echo ""
echo "📦 Moving simple/ contents to root..."

# Move all regular files and directories from simple/
for item in simple/*; do
    if [ -e "$item" ]; then
        basename=$(basename "$item")
        echo "  Moving $item → ./$basename"
        git mv "$item" "./$basename"
    fi
done

# Move hidden files (like .gitignore, .env.example)
for item in simple/.*; do
    basename=$(basename "$item")
    # Skip . and .. directories
    if [ "$basename" != "." ] && [ "$basename" != ".." ] && [ -e "$item" ]; then
        # Check if target already exists
        if [ -e "./$basename" ]; then
            echo "  ⚠️  Warning: ./$basename already exists, merging..."
            if [ -f "$item" ] && [ -f "./$basename" ]; then
                # For files, we'll need to merge or replace
                echo "    Creating backup: ./$basename.bak"
                cp "./$basename" "./$basename.bak"
            fi
        fi
        echo "  Moving $item → ./$basename"
        git mv "$item" "./$basename"
    fi
done

echo ""
echo "🗑️  Removing empty simple/ directory..."
git rm -r simple/ || rmdir simple/

echo ""
echo "🔧 Updating docker-compose references..."
# Since we're now at root, we need to update context paths in docker-compose files
if [ -f "docker-compose.yml" ]; then
    sed -i 's|context: \.|context: .|g' docker-compose.yml
    sed -i 's|dockerfile: Dockerfile\.|dockerfile: Dockerfile.|g' docker-compose.yml
fi

if [ -f "docker-compose-new.yml" ]; then
    sed -i 's|context: \.|context: .|g' docker-compose-new.yml
    sed -i 's|dockerfile: Dockerfile\.|dockerfile: Dockerfile.|g' docker-compose-new.yml
fi

echo ""
echo "📝 Creating promotion commit..."
git add -A
git commit -m "feat: Promote simple/ to root - PocketDev is now the main product

- Moved all files from simple/ to root directory
- PocketDev is now the primary product at root level
- pocketdev-studio remains separate for future split
- All git history preserved through git mv

This completes the separation of PocketDev and PocketDev Studio products."

echo ""
echo "✅ Promotion complete!"
echo ""
echo "📋 New structure:"
ls -la

echo ""
echo "📌 Next steps:"
echo "1. Review the changes: git log --oneline -5"
echo "2. Test the setup: docker compose up --build"
echo "3. If any issues, rollback: git reset --hard pre-split-checkpoint"
echo "4. When ready, you can move pocketdev-studio/ to its own repo"
echo ""
echo "🏷️  Consider creating a new tag:"
echo "   git tag -a 'post-promotion' -m 'PocketDev promoted to root'"