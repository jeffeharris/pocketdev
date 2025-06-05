# Unversioned Files Analysis

## Files to Keep and Commit

### Essential Configuration
- `docker-compose.yml` - Docker Compose setup for local development ✅
- `supabase-schema.sql` - Database schema for Supabase ✅
- `local-backend/package-lock.json` - Dependency lock file ✅
- `web/package-lock.json` - Frontend dependency lock file ✅
- `web/tsconfig.node.json` - TypeScript config for Node ✅
- `web/src/vite-env.d.ts` - Vite environment types ✅
- `web/src/components/TaskResult.tsx` - Missing component ✅

### Useful Scripts
- `docker-setup.sh` - Docker setup automation
- `setup-local.sh` - Local environment setup

## Files to Delete

### Test/Debug Files (Temporary)
- All `test-*.sh` files (test-api.sh, test-claude.sh, etc.) ❌
- All `test-*.js` files (test-browser.js, test-spawn-minimal.js, etc.) ❌
- `web/test-page.js` ❌
- `web/test-render.html` ❌
- `web/verify-ui.html` ❌
- `web/index-test.html` ❌
- `web/check-dom.js` ❌
- `local-backend/test-spawn.js` ❌

### Backup/Alternative Versions
- `web/src/App-debug.tsx` ❌
- `web/src/App.backup.tsx` ❌
- `web/src/App.simple.tsx` ❌
- `web/src/TestApp.tsx` ❌

### Old Documentation
- `CLAUDE-FILE-CREATION.md` ❌
- `CLAUDE_CODE_SETUP.md` ❌
- `DOCKER_SETUP.md` ❌
- `SETUP.md` ❌

### Convenience Scripts (Not Essential)
- `run.sh` ❌
- `run-and-open.sh` ❌
- `start-web.sh` ❌

## Directories to Review

### Keep
- `local-backend/prompts/` - May contain useful prompt templates

### Delete/Archive
- `api/` - Old Vercel API attempt ❌
- `bridge/` - Likely experimental ❌
- `demo/` - Demo scripts ❌
- `future/` - Planning documents ❌
- `pocketdev-mobile/` - Mobile app (separate project) ❌
- `test/` - Test files ❌

## Recommended Actions

1. **Commit Essential Files**:
   ```bash
   git add docker-compose.yml supabase-schema.sql
   git add local-backend/package-lock.json web/package-lock.json
   git add web/tsconfig.node.json web/src/vite-env.d.ts
   git add web/src/components/TaskResult.tsx
   ```

2. **Delete Test/Temporary Files**:
   ```bash
   rm -f test-*.sh test-*.js
   rm -f web/test-*.js web/test-*.html web/verify-ui.html web/index-test.html
   rm -f web/src/App-*.tsx web/src/TestApp.tsx
   rm -f CLAUDE*.md DOCKER_SETUP.md SETUP.md
   rm -f run*.sh start-web.sh
   ```

3. **Archive/Remove Old Directories**:
   ```bash
   rm -rf api/ bridge/ demo/ future/ test/
   # Consider moving pocketdev-mobile/ to separate repo
   ```

4. **Review Before Deleting**:
   - Check `local-backend/prompts/` for useful content
   - Verify `docker-setup.sh` and `setup-local.sh` aren't needed