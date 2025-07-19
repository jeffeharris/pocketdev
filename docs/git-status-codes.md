# Git Status Codes Reference

This document provides a comprehensive reference for all two-letter status codes from `git status --porcelain`.

## Status Code Format

Git status codes consist of two characters:
- **First character (X)**: Status in the staging area (index)
- **Second character (Y)**: Status in the working tree

## Single-Letter Codes and Their Meanings

### Basic File States
- **` ` (space)**: Unmodified
- **`M`**: Modified
- **`A`**: Added
- **`D`**: Deleted
- **`R`**: Renamed
- **`C`**: Copied
- **`U`**: Updated but unmerged (conflict)
- **`?`**: Untracked
- **`!`**: Ignored

## All Possible Two-Letter Combinations

### 1. Clean/Unmodified States
- **`  `** (two spaces): File is unmodified and tracked

### 2. Staged Changes (Ready to Commit)
- **`M `**: Modified in index, unmodified in working tree
- **`A `**: Added to index, unmodified in working tree
- **`D `**: Deleted from index, unmodified in working tree
- **`R `**: Renamed in index, unmodified in working tree
- **`C `**: Copied in index, unmodified in working tree

### 3. Unstaged Changes (Working Directory)
- **` M`**: Unmodified in index, modified in working tree
- **` D`**: Unmodified in index, deleted from working tree

### 4. Both Staged and Unstaged Changes
- **`MM`**: Modified in index, also modified in working tree (different changes)
- **`MD`**: Modified in index, deleted from working tree
- **`AM`**: Added to index, modified in working tree
- **`AD`**: Added to index, deleted from working tree
- **`RM`**: Renamed in index, modified in working tree
- **`RD`**: Renamed in index, deleted from working tree
- **`CM`**: Copied in index, modified in working tree
- **`CD`**: Copied in index, deleted from working tree

### 5. Merge Conflicts
- **`DD`**: Deleted by both sides
- **`AU`**: Added by us (our branch)
- **`UD`**: Deleted by them (their branch)
- **`UA`**: Added by them (their branch)
- **`DU`**: Deleted by us (our branch)
- **`AA`**: Added by both sides (conflict)
- **`UU`**: Modified by both sides (conflict)

### 6. Special States
- **`??`**: Untracked file
- **`!!`**: Ignored file (only shown with --ignored flag)

## User-Friendly Categories

### 🟢 Ready to Commit (Staged)
These changes are in the staging area and will be included in the next commit:
- `M ` - File modified
- `A ` - New file added
- `D ` - File deleted
- `R ` - File renamed
- `C ` - File copied

### 🟡 Working Directory Changes (Unstaged)
These changes exist in your working directory but haven't been staged:
- ` M` - File modified
- ` D` - File deleted
- `??` - New untracked file

### 🔵 Mixed States (Staged + Unstaged)
These files have some changes staged and other changes unstaged:
- `MM` - Modified (staged) + more modifications (unstaged)
- `MD` - Modified (staged) + deleted (unstaged)
- `AM` - Added (staged) + modified (unstaged)
- `AD` - Added (staged) + deleted (unstaged)

### 🔴 Merge Conflicts
These require manual resolution:
- `UU` - Both sides modified the same file
- `AA` - Both sides added the same file
- `DD` - Both sides deleted the file
- `AU` - We added, they didn't have
- `UA` - They added, we didn't have
- `DU` - We deleted, they modified
- `UD` - They deleted, we modified

### ⚪ Clean
- `  ` - No changes (file is tracked and unmodified)

### 🟣 Untracked/Ignored
- `??` - Untracked file (not in Git)
- `!!` - Ignored file (matches .gitignore)

## Common Scenarios

### Typical Development Workflow
1. `??` → `A ` - Add new file to staging
2. `  ` → ` M` → `M ` - Modify file, then stage it
3. `M ` → `MM` - Stage changes, then make more changes
4. `  ` → ` D` → `D ` - Delete file, then stage deletion

### During Merge/Rebase
- `UU` - Edit file to resolve conflict, then `git add`
- `DD` - Decide whether to keep deletion
- `AA` - Choose which version to keep

## Important Notes

1. **Rename Detection**: Git automatically detects renames based on file similarity. A delete + add might show as `R ` if the files are similar enough.

2. **Submodules**: Submodules have additional status codes not covered here.

3. **Case Sensitivity**: On case-insensitive file systems, renaming with only case changes might not be detected properly.

4. **Binary Files**: Binary files show the same status codes but conflict resolution is different.

## Quick Reference Table

| Code | Staged | Working | Meaning | Action Needed |
|------|--------|---------|---------|---------------|
| `  ` | - | - | Unmodified | None |
| `M ` | ✓ | - | Modified (staged) | Can commit |
| ` M` | - | ✓ | Modified (unstaged) | Stage with `git add` |
| `MM` | ✓ | ✓ | Modified in both | Stage additional changes |
| `A ` | ✓ | - | Added | Can commit |
| `D ` | ✓ | - | Deleted | Can commit |
| `??` | - | - | Untracked | Add or ignore |
| `UU` | 🔥 | 🔥 | Conflict | Resolve and stage |