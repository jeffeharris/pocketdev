# Git Diff Viewer Enhancement Requirements

## Introduction

The Git Diff Viewer Modal is a critical component of the PocketDev system that allows developers to review code changes across different comparison contexts. This enhancement aims to improve the user experience by providing more comprehensive view options, better visual organization, enhanced filtering capabilities, and integrated git operations - creating a more intuitive and efficient code review workflow.

## Requirements

### Requirement 1: Combined View Mode

**User Story:** As a developer, I want to view all my changes (both committed and uncommitted) in a single combined view, so that I can understand the complete scope of my work without switching between modes.

#### Acceptance Criteria

1. WHEN the user opens the diff viewer THEN the system SHALL display a three-state toggle with options: "Working Tree", "All Changes", and "Base Branch"
2. WHEN "All Changes" is selected THEN the system SHALL display both uncommitted changes (staged/unstaged/untracked) AND committed changes not yet in the base branch
3. WHEN displaying combined changes THEN the system SHALL group files by their status (uncommitted first, then committed)
4. IF the working directory is clean THEN the system SHALL disable the "Working Tree" option and default to "All Changes"
5. WHEN hovering over toggle options THEN the system SHALL display tooltips explaining each view mode

### Requirement 2: File Status Indicators

**User Story:** As a developer, I want to see visual indicators for file states, so that I can quickly identify whether files are staged, unstaged, untracked, or committed.

#### Acceptance Criteria

1. WHEN displaying files in the list THEN the system SHALL show status badges/icons for four states: staged (S), unstaged (M), untracked (U), and committed (C)
2. WHEN a file has both staged and unstaged changes THEN the system SHALL display both indicators
3. WHEN rendering status indicators THEN the system SHALL use distinct colors: staged (green), unstaged (orange), untracked (gray), committed (blue)
4. IF using icon fonts THEN the system SHALL ensure icons are accessible with proper aria-labels

### Requirement 3: Contextual Information

**User Story:** As a developer, I want to see contextual information about each view mode, so that I understand what changes I'm looking at and what git commands are being used.

#### Acceptance Criteria

1. WHEN a view mode is active THEN the system SHALL display subtitle text showing the count of changes (e.g., "Working Tree (3 uncommitted)")
2. WHEN hovering over the help icon THEN the system SHALL display the underlying git command used (e.g., "git diff --cached" for staged changes)
3. WHEN the Base Branch view is active THEN the subtitle SHALL show "Comparing with origin/[branch-name]"
4. IF the comparison involves multiple git commands THEN the help tooltip SHALL list all relevant commands

### Requirement 4: Search and Filter

**User Story:** As a developer working with many changed files, I want to search and filter the file list, so that I can quickly find specific files I need to review.

#### Acceptance Criteria

1. WHEN the file list contains more than 5 files THEN the system SHALL display a search input above the file list
2. WHEN typing in the search box THEN the system SHALL filter files in real-time matching any part of the file path
3. WHEN searching THEN the system SHALL highlight the matching portion of the file path
4. IF no files match the search THEN the system SHALL display "No files match '[search term]'"
5. WHEN clearing the search THEN the system SHALL restore the full file list immediately

### Requirement 5: File Staging Integration

**User Story:** As a developer, I want to stage individual files directly from the diff viewer, so that I can selectively prepare commits while reviewing changes.

#### Acceptance Criteria

1. WHEN viewing an unstaged or untracked file THEN the system SHALL display a "Stage File" button in the diff header
2. WHEN clicking "Stage File" THEN the system SHALL execute git add for that specific file and update the UI within 500ms
3. WHEN viewing a staged file THEN the system SHALL display an "Unstage File" button instead
4. IF the staging operation fails THEN the system SHALL display an error message with the git error details
5. WHEN a file is staged/unstaged THEN the system SHALL update the file's status indicator and move it to the appropriate group if grouping is active

### Requirement 6: Enhanced Empty States

**User Story:** As a developer, I want to see friendly and informative empty state messages, so that I understand the current state of my repository and what actions I can take.

#### Acceptance Criteria

1. WHEN Working Tree view is empty THEN the system SHALL display "✓ Working tree is clean - all changes have been committed"
2. WHEN All Changes view is empty THEN the system SHALL display "✓ Your branch is up to date with '[base-branch]'"
3. WHEN Base Branch view is empty and working tree is clean THEN the system SHALL display "✓ No changes to merge - your branch matches '[base-branch]'"
4. WHEN any empty state is shown THEN the system SHALL suggest the next logical action (e.g., "View commit history" or "Switch to another branch")
5. IF the branch has unpushed commits THEN the empty state message SHALL indicate this with "You have [n] unpushed commits"

## Implementation Notes

### Technical Considerations

1. **Performance**: File grouping and status indicators should not degrade performance for large changesets (100+ files)
2. **Real-time Updates**: Status changes from staging/unstaging should be reflected immediately via existing polling/trigger mechanisms
3. **Backend Changes**: Use existing gitOperation endpoint for staging/unstaging operations
4. **Git Commands**: 
   - Working Tree: `git status --porcelain --untracked-files=all` + `git diff --numstat`
   - All Changes: Combination of working tree + `git diff --numstat origin/[base]...HEAD`
   - Base Branch: `git diff --numstat origin/[base]...HEAD`

### UI/UX Guidelines

1. **Icons**: Use Lucide React icons for consistency with existing UI
2. **Colors**: Follow existing color scheme (green for success, orange for warning, etc.)
3. **Transitions**: Smooth animations when files move between groups after staging
4. **Responsive**: Ensure search box and controls adapt to modal width

## Tasks

### Phase 1: Backend Infrastructure ✅

[x] 1. Set up backend data structures and endpoints
- [x] 1.1 Create git service enhancements
  - Add method to get all changes (working + committed not in base)
  - Add method to stage/unstage individual files
  - Add method to check for unpushed commits
  - Ensure all methods properly handle file status metadata

- [x] 1.2 Create combined changes endpoint
  - Implement `/api/projects/:projectId/tasks/:taskId/git/all-changes`
  - Return categorized files: staged, unstaged, untracked, committed
  - Include line counts for all file types
  - Add proper error handling for edge cases
  - _Requirements: 1.2_

- [x] 1.3 Update gitOperation endpoint for staging/unstaging
  - Add 'unstage' operation to existing gitOperation endpoint
  - Use 'add' operation for staging (already exists)
  - Return updated file status after operation
  - Trigger status updates via existing mechanisms
  - _Requirements: 5.2_

**Checkpoint 1: Backend API Testing** ✅
- Test all new endpoints with curl/Postman
- Verify proper file categorization in all-changes endpoint
- Confirm status updates trigger after staging operations
- _Validates partial Requirements: 1.2, 5.2_

### Phase 2: Frontend Data Layer

[ ] 2. Update frontend API service and types
- [ ] 2.1 Add TypeScript types for enhanced file status
  - Create FileStatus enum: Staged, Unstaged, Untracked, Committed
  - Update DiffFile type to include status field
  - Add AllChangesResponse type for combined view
  - _Requirements: 2.1_

- [ ] 2.2 Update API service methods
  - Add getAllChanges method for combined view
  - Add stageFile and unstageFile methods
  - Update existing methods to handle new file metadata
  - Add proper TypeScript typing for all responses

- [ ] 2.3 Create file status utility functions
  - Helper to determine which badge(s) to show
  - Helper to group files by status
  - Helper to count files by category
  - _Requirements: 1.3, 3.1_

**Checkpoint 2: Frontend Data Integration**
- Verify API calls work with mock data
- Test utility functions with various file states
- Ensure TypeScript compilation passes
- _Validates data flow for Requirements: 1.2, 1.3_

### Phase 3: UI Components Foundation

[ ] 3. Build reusable UI components
- [ ] 3.1 Create StatusBadge component
  - Build badge component with proper styling
  - Support all four states with correct colors
  - Add accessibility attributes
  - Create component playground page for testing
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 3.2 Create ThreeStateToggle component
  - Extend current toggle to support three states
  - Add smooth transitions between states
  - Make it reusable with proper props interface
  - _Requirements: 1.1_

- [ ] 3.3 Create SearchInput component
  - Build reusable search component with clear button
  - Add debouncing for performance
  - Support placeholder and auto-focus props
  - _Requirements: 4.1, 4.2_

**Checkpoint 3: Component Library Testing**
- Test all components in isolation
- Verify accessibility with screen reader
- Check responsive behavior
- _Validates UI building blocks for Requirements: 1.1, 2.1-2.4, 4.1_

### Phase 4: Core Feature Implementation

[ ] 4. Integrate three-state view with real data
- [ ] 4.1 Update DiffViewerModal state management
  - Add state for view mode (working/all/base)
  - Update data fetching logic for each mode
  - Implement file grouping for combined view
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 4.2 Add view mode UI and interactions
  - Integrate ThreeStateToggle into modal header
  - Add loading states for view transitions
  - Implement proper error handling
  - Update empty states for each view
  - _Requirements: 1.1, 1.4, 1.5_

**Checkpoint 4: Three-State View Testing**
- Test switching between all three views
- Verify correct data loads for each view
- Confirm empty states work properly
- _Fully validates Requirements: 1.1-1.5_

[ ] 5. Add file status indicators and counts
- [ ] 5.1 Integrate StatusBadge into file list
  - Add badges next to each file name
  - Handle files with multiple statuses
  - Ensure proper spacing and alignment
  - _Requirements: 2.1, 2.2_

- [ ] 5.2 Add contextual information
  - Add file count to view mode subtitle
  - Update counts dynamically as files change
  - Show base branch name in subtitle
  - _Requirements: 3.1, 3.3_

**Checkpoint 5: Visual Status Testing**
- Verify badges show correct states
- Test files with multiple statuses
- Confirm counts update properly
- _Fully validates Requirements: 2.1-2.4, 3.1, 3.3_

### Phase 5: Enhanced Interactions

[ ] 6. Implement search functionality
- [ ] 6.1 Add search to file list
  - Integrate SearchInput component
  - Show only when file count > 5
  - Implement real-time filtering
  - _Requirements: 4.1, 4.2, 4.5_

- [ ] 6.2 Add search highlighting
  - Highlight matching text in file paths
  - Show "No matches" empty state
  - Maintain selection state during search
  - _Requirements: 4.3, 4.4_

**Checkpoint 6: Search Feature Testing**
- Test search with various queries
- Verify highlighting works correctly
- Confirm performance with 100+ files
- _Fully validates Requirements: 4.1-4.5_

[ ] 7. Add staging/unstaging capability
- [ ] 7.1 Add stage/unstage buttons
  - Add buttons to diff viewer header
  - Show correct button based on file state
  - Disable during operations
  - _Requirements: 5.1, 5.3_

- [ ] 7.2 Implement staging operations
  - Wire buttons to API calls
  - Update UI optimistically
  - Handle errors gracefully
  - Update file groups if active
  - _Requirements: 5.2, 5.4, 5.5_

**Checkpoint 7: Staging Feature Testing**
- Test staging and unstaging files
- Verify real-time updates work
- Test error scenarios
- Confirm status updates work correctly
- _Fully validates Requirements: 5.1-5.5_

### Phase 6: Polish and Edge Cases

[ ] 8. Add help system and enhanced empty states
- [ ] 8.1 Add git command help
  - Add help icon to view toggle
  - Create tooltip with git commands
  - Include all commands for combined view
  - _Requirements: 3.2, 3.4_

- [ ] 8.2 Enhance empty state messages
  - Create contextual messages per view
  - Add unpushed commit detection
  - Include suggested actions
  - Add visual checkmark icons
  - _Requirements: 6.1-6.5_

**Checkpoint 8: Final Polish Testing**
- Test all help tooltips
- Verify empty states in all scenarios
- Check unpushed commit detection
- _Fully validates Requirements: 3.2, 3.4, 6.1-6.5_

### Phase 7: Performance and Testing

[ ] 9. Optimize and add comprehensive tests
- [ ] 9.1 Performance optimization
  - Consider virtualization only if performance issues arise with 100+ files
  - Optimize re-renders during search
  - Add caching for file diffs
  - Profile and fix any bottlenecks

- [ ] 9.2 Add focused test suite
  - Integration tests for git operations using test repositories
  - API endpoint tests for new functionality
  - Component interaction tests (minimal mocking)
  - Manual testing checklist for workflows

**Final Checkpoint: Full System Validation**
- Load test with 500+ files
- Run full test suite
- User acceptance testing
- Performance benchmarking
- _Validates all requirements are met with acceptable performance_