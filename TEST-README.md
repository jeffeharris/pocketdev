# Test Files Guide

This directory contains test files for validating PocketDev features. These are development tests and should be moved to a proper test directory before production.

## Test Files

### `test-all-features.js`
Comprehensive test suite that validates:
- Pre-flight validation system
- Progress monitoring
- Error recovery
- API response formats

**Usage**:
```bash
# Make sure server is running first
cd local-backend && npm start

# In another terminal
node test-all-features.js
```

### `test-preflight-validation.js`
Focused tests for pre-flight validation scenarios.

**Usage**:
```bash
node test-preflight-validation.js
```

### `test-supervisor-e2e.js`
End-to-end test for AI Supervisor system (requires supervisor integration).

**Usage**:
```bash
./run-e2e-test.sh
```

## Cleanup TODO

Before merging to main:
1. Move test files to `local-backend/tests/` or `tests/`
2. Update imports to use proper test framework (Jest/Vitest)
3. Add to CI/CD pipeline
4. Remove this TEST-README.md

## Test Results

Test results are saved to `test-results.json` with format:
```json
{
  "timestamp": "2024-...",
  "summary": {
    "total": 6,
    "passed": 5,
    "failed": 1
  },
  "results": [...]
}
```