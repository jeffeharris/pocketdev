# Service Extraction Summary

## Overview
Analysis of `api.ts` (49 methods) for extraction into domain services following deep modules principle.

## Service Breakdown

| Service | Methods | Domain | Dependencies |
|---------|---------|--------|--------------|
| **SettingsService** | 4 | App settings, GitHub config | None |
| **UploadService** | 3 | File uploads | None |
| **GitService** | 6 | Git operations, diffs | None |
| **TerminalService** | 6 | Terminal sessions, commands | None |
| **ContainerService** | 3 | Docker containers | None |
| **PullRequestService** | 2 | GitHub PRs, conflicts | None |
| **ProjectService** | 8 | Project CRUD, planning | None |
| **TaskService** | 8 | Task lifecycle | None |

**Total: 40 methods** (9 methods reduced through consolidation)

## Extraction Order (Risk-Based)

### Phase 1: Low Risk ✅ Complete
1. **SettingsService** - Independent, minimal usage ✅ Implemented & Wired
2. **UploadService** - Independent, specific components only ✅ Implemented & Wired

### Phase 2: Medium Risk 
3. **GitService** - Used by diff viewers, commit flows
4. **TerminalService** - Used by terminal panels

### Phase 3: High Risk
5. **ContainerService** - Limited usage
6. **PullRequestService** - Simple operations  
7. **ProjectService** - Central to many components
8. **TaskService** - Heavily coupled, extract last

## Key Improvements

### Method Consolidation Examples
- `getProject()` + `getProjectMinimal()` → `getProject(id, { minimal? })`
- `pullBaseBranch()` + `pushBaseBranch()` + `refreshProjectStatus()` → `baseBranchOperation(id, operation)`
- Multiple git operations → `performOperation(id, operation, options)`

### Interface Simplification
- **Before**: 49 methods in one class
- **After**: 8 services with 2-8 methods each
- **Reduction**: 18% fewer total methods through consolidation

### Type Safety Enhancements
- Consistent return types (`GitOperationResult`)
- Options parameters instead of method overloads
- Proper TypeScript interfaces for all operations

## Component Impact Analysis

### High Impact (Need careful migration)
- `TerminalPanel.tsx` - Uses 6+ methods across multiple services
- `ProjectDashboard.tsx` - Heavy ProjectService usage
- `TaskWorkspace.tsx` - Multi-service integration

### Medium Impact
- `DiffViewerModal.tsx` - GitService methods
- `CommitModal.tsx` - GitService operations

### Low Impact
- `ImageUpload.tsx` - UploadService only
- Component migration can be done incrementally

## Migration Strategy

### Backward Compatibility Approach
1. Keep existing `api.ts` during transition
2. Create service instances within `api.ts`
3. Delegate existing methods to new services
4. Migrate components one at a time
5. Remove legacy methods after component migration

### No Breaking Changes
- All existing method signatures preserved
- Response formats unchanged
- Error handling consistent
- Mock data structure maintained

## Implementation Ready

All service interfaces defined in `/services/interfaces/`:
- ✅ Type definitions complete
- ✅ Method signatures finalized  
- ✅ Parameter validation specified
- ✅ Return types documented
- ✅ Dependency analysis complete

## Phase 1 Implementation Results

### ✅ ServiceProvider Wiring Complete
- Imported `SettingsService` and `UploadService` 
- Updated service registry to use actual implementations instead of placeholders
- Services properly initialized with config (baseUrl, mockEnabled)

### ✅ API Delegation Complete  
- Created singleton service instances in `api.ts`
- All settings methods now delegate to `SettingsService`:
  - `getSettings()` → `settingsService.getSettings()`
  - `updateSettings()` → `settingsService.updateSettings()`
  - `testGithubToken()` → `settingsService.testGithubToken()`
  - `getSystemInfo()` → `settingsService.getSystemInfo()`
- All upload methods now delegate to `UploadService`:
  - `getTaskImages()` → `uploadService.getTaskImages()` (with format adaptation)
  - `uploadTaskImage()` → `uploadService.uploadTaskImage()`
  - `deleteTaskImage()` → `uploadService.deleteTaskImage()`

### ✅ Backwards Compatibility Maintained
- All existing method signatures preserved
- No breaking changes to component usage
- Mock data behavior maintained through service layer
- TypeScript compilation clean

**Phase 1 complete. Ready for Phase 2 (GitService & TerminalService) implementation.**