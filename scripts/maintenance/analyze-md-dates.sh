#!/bin/bash

# Analyze Markdown files for date information and propose updates
# This script extracts creation and modification dates from Git history

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Markdown Documentation Date Analysis ===${NC}\n"

# Count total files
total_files=$(find . -name "*.md" -type f | grep -v node_modules | grep -v ".git" | wc -l)
echo -e "${GREEN}Found ${total_files} Markdown files${NC}\n"

# Function to get dates from Git
get_git_dates() {
    local file="$1"
    local created=$(git log --format="%ad" --date=short --diff-filter=A -- "$file" 2>/dev/null | tail -1)
    local modified=$(git log -1 --format="%ad" --date=short -- "$file" 2>/dev/null)
    
    # If file not in git yet, use filesystem dates
    if [ -z "$created" ]; then
        created="untracked"
        modified="untracked"
    fi
    
    echo "$created|$modified"
}

# Function to check if file has date info
check_existing_dates() {
    local file="$1"
    local has_date="no"
    
    # Check for common date patterns in first 20 lines
    if head -20 "$file" 2>/dev/null | grep -qE "(Last [Uu]pdated|Created|Modified|Date|[0-9]{4}-[0-9]{2}-[0-9]{2})" ; then
        has_date="yes"
    fi
    
    echo "$has_date"
}

# Analyze files
echo -e "${YELLOW}Analyzing date information in files...${NC}\n"

files_with_dates=0
files_without_dates=0
untracked_files=0

# Create temporary file for results
temp_file=$(mktemp)

# Process each MD file
find . -name "*.md" -type f | grep -v node_modules | grep -v ".git" | while read -r file; do
    dates=$(get_git_dates "$file")
    created=$(echo "$dates" | cut -d'|' -f1)
    modified=$(echo "$dates" | cut -d'|' -f2)
    has_date=$(check_existing_dates "$file")
    
    if [ "$created" = "untracked" ]; then
        echo "U|$file" >> "$temp_file"
    elif [ "$has_date" = "yes" ]; then
        echo "Y|$file|$created|$modified" >> "$temp_file"
    else
        echo "N|$file|$created|$modified" >> "$temp_file"
    fi
done

# Count results
files_with_dates=$(grep "^Y|" "$temp_file" 2>/dev/null | wc -l || echo 0)
files_without_dates=$(grep "^N|" "$temp_file" 2>/dev/null | wc -l || echo 0)
untracked_files=$(grep "^U|" "$temp_file" 2>/dev/null | wc -l || echo 0)

echo -e "${GREEN}Summary:${NC}"
echo "  Files with existing date info: $files_with_dates"
echo "  Files without date info: $files_without_dates"
echo "  Untracked files: $untracked_files"
echo ""

# Show sample of files without dates
if [ $files_without_dates -gt 0 ]; then
    echo -e "${YELLOW}Sample files without date information:${NC}"
    grep "^N|" "$temp_file" | head -10 | while IFS='|' read -r status file created modified; do
        echo "  $file (created: $created, modified: $modified)"
    done
    
    if [ $files_without_dates -gt 10 ]; then
        echo "  ... and $((files_without_dates - 10)) more"
    fi
fi

# Clean up
rm -f "$temp_file"

echo ""
echo -e "${BLUE}=== Proposed Solution ===${NC}"
echo ""
echo "1. Add a metadata section to each Markdown file:"
echo "   - Place after the main title (# Header)"
echo "   - Use HTML comments to avoid breaking rendering"
echo "   - Format:"
echo ""
echo "   <!-- Document Metadata"
echo "   Created: YYYY-MM-DD"
echo "   Modified: YYYY-MM-DD"
echo "   Status: active|????"
echo "   -->"
echo ""
echo "2. Benefits of this approach:"
echo "   - Won't affect rendering in GitHub/viewers"
echo "   - Easily parseable by scripts"
echo "   - Can be automatically updated via pre-commit hook"
echo "   - Status field shows if recently edited (active) or not (????)"
echo ""
echo "3. Alternative for user-facing docs:"
echo "   - Use visible metadata block for important docs"
echo "   - Format: *Last Updated: Month DD, YYYY*"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "  1. Run: ./scripts/add-md-dates.sh --dry-run"
echo "  2. Review proposed changes"
echo "  3. Run: ./scripts/add-md-dates.sh --apply"
echo "  4. Consider adding pre-commit hook for auto-updates"