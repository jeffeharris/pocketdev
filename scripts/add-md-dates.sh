#!/bin/bash

# Add creation and modification dates to Markdown files
# Usage: ./add-md-dates.sh [--dry-run|--apply] [file-pattern]

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Parse arguments
MODE="dry-run"
PATTERN="*.md"

if [ "$1" = "--apply" ]; then
    MODE="apply"
    shift
elif [ "$1" = "--dry-run" ]; then
    shift
fi

if [ -n "$1" ]; then
    PATTERN="$1"
fi

echo -e "${BLUE}=== Adding Dates to Markdown Documentation ===${NC}"
echo -e "Mode: ${YELLOW}$MODE${NC}"
echo ""

# Function to get dates from Git
get_git_dates() {
    local file="$1"
    local created=$(git log --format="%ad" --date=short --diff-filter=A -- "$file" 2>/dev/null | tail -1)
    local modified=$(git log -1 --format="%ad" --date=short -- "$file" 2>/dev/null)
    
    # If file not in git yet, use today's date
    if [ -z "$created" ]; then
        created=$(date +%Y-%m-%d)
        modified=$(date +%Y-%m-%d)
    fi
    
    echo "$created|$modified"
}

# Function to determine document status based on age
get_status() {
    local modified="$1"
    local days_old=$(( ($(date +%s) - $(date -d "$modified" +%s)) / 86400 ))
    
    if [ $days_old -lt 30 ]; then
        echo "active"
    else
        echo "????"
    fi
}

# Function to check if file already has metadata
has_metadata() {
    local file="$1"
    if head -20 "$file" 2>/dev/null | grep -q "<!-- Document Metadata"; then
        return 0
    fi
    return 1
}

# Function to add metadata to file
add_metadata() {
    local file="$1"
    local created="$2"
    local modified="$3"
    local status="$4"
    
    # Create metadata block
    local metadata="<!-- Document Metadata
Created: $created
Modified: $modified
Status: $status
-->"
    
    # Create temp file
    local temp_file=$(mktemp)
    
    # Check if file starts with a header
    if head -1 "$file" | grep -q "^#"; then
        # Insert after first header line
        head -1 "$file" > "$temp_file"
        echo "" >> "$temp_file"
        echo "$metadata" >> "$temp_file"
        echo "" >> "$temp_file"
        tail -n +2 "$file" >> "$temp_file"
    else
        # Insert at beginning
        echo "$metadata" > "$temp_file"
        echo "" >> "$temp_file"
        cat "$file" >> "$temp_file"
    fi
    
    if [ "$MODE" = "apply" ]; then
        mv "$temp_file" "$file"
        echo -e "${GREEN}✓${NC} Updated: $file"
    else
        echo -e "${YELLOW}Would update:${NC} $file"
        echo -e "${BLUE}  Created: $created, Modified: $modified, Status: $status${NC}"
        rm "$temp_file"
    fi
}

# Process files
processed=0
skipped=0
errors=0

find . -name "$PATTERN" -type f | grep -v node_modules | grep -v ".git" | while read -r file; do
    # Skip if already has metadata
    if has_metadata "$file"; then
        echo -e "${BLUE}⊘${NC} Skipping (has metadata): $file"
        ((skipped++)) || true
        continue
    fi
    
    # Get dates
    dates=$(get_git_dates "$file")
    created=$(echo "$dates" | cut -d'|' -f1)
    modified=$(echo "$dates" | cut -d'|' -f2)
    status=$(get_status "$modified")
    
    # Add metadata
    add_metadata "$file" "$created" "$modified" "$status"
    ((processed++)) || true
done

echo ""
echo -e "${GREEN}=== Summary ===${NC}"
echo "Processed: $processed files"
echo "Skipped: $skipped files (already have metadata)"

if [ "$MODE" = "dry-run" ]; then
    echo ""
    echo -e "${YELLOW}This was a dry run. No files were modified.${NC}"
    echo "To apply changes, run: $0 --apply"
fi

# Suggest next steps
if [ "$MODE" = "apply" ] && [ $processed -gt 0 ]; then
    echo ""
    echo -e "${BLUE}=== Next Steps ===${NC}"
    echo "1. Review changes with: git diff"
    echo "2. Commit changes: git commit -am 'docs: Add metadata to Markdown files'"
    echo "3. Consider adding a pre-commit hook to keep dates updated"
    echo ""
    echo "To create a pre-commit hook, add to .git/hooks/pre-commit:"
    echo "  # Update modified dates in staged MD files"
    echo "  git diff --cached --name-only --diff-filter=M | grep '\.md$' | while read file; do"
    echo "    sed -i \"s/^Modified: .*/Modified: \$(date +%Y-%m-%d)/\" \"\$file\""
    echo "    git add \"\$file\""
    echo "  done"
fi