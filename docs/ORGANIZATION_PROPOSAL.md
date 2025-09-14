# Documentation Organization Proposal

## Current Scattered Files to Move

### Root Directory Files
1. **Keep in root** (essential project files):
   - `README.md` - Project overview
   - `CHANGELOG.md` - Version history
   - `CLAUDE.md` - AI assistant instructions
   - `DEPLOYMENT.md` - Deployment guide

2. **Move to organized locations**:
   - `bash-profile-investigation-report.md` → `/docs/investigations/`
   - `horizontal-split-bug-investigation.md` → `/docs/investigations/`
   - `philosophy-of-software-design-review.md` → `/plan-pocketdev/steering/`
   - `philosophy-review-findings.md` → `/plan-pocketdev/steering/`
   - `test-shelltender-README.md` → `/docs/shelltender/` or delete if outdated

### Backend Directory Files
1. **Keep in backend/**:
   - `OBSERVABILITY.md` - Backend-specific observability docs
   - `API_RESPONSE_PATTERNS.md` - API documentation
   
2. **Move to organized locations**:
   - `refactoring-summary-2025-08-17.md` → `/docs/refactoring-history/`
   - `BUG-021-REVIEW.md` → `/plan-pocketdev/bugs/reviews/`
   - `service-registry-removal-test-plan.md` → `/docs/refactoring-history/`

## Proposed Structure

```
/docs/
├── investigations/          # Bug investigations, research reports
│   ├── bash-profile-investigation-report.md
│   └── horizontal-split-bug-investigation.md
├── refactoring-history/     # Historical refactoring records
│   ├── 2025-08-17-refactoring-summary.md
│   └── service-registry-removal-test-plan.md
├── architecture/           # Current architecture docs (exists)
├── shelltender/           # Shelltender docs (exists)
├── agent-review-0825/     # Agent reviews (exists)
└── ...existing folders...

/plan-pocketdev/
├── steering/              # Architecture philosophy & guidance (exists)
│   ├── philosophy-of-software-design-review.md (moved)
│   └── philosophy-review-findings.md (moved)
├── bugs/
│   └── reviews/          # Bug review documents
│       └── BUG-021-REVIEW.md
└── ...existing folders...
```

## Benefits
- **Clear categories** for different documentation types
- **Historical records** preserved in refactoring-history
- **Investigations** grouped together for reference
- **Essential files** remain in root for visibility
- **Backend-specific** docs stay with the code they document