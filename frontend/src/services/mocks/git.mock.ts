/**
 * Mock data for GitService
 * Separated from production code for cleaner services
 */

import type { GitStatus } from '../../types/git';
import type { DiffFile, FileCategory } from '../../types/diff';

export const mockGitStatus: GitStatus = {
  clean: false,
  ahead: 2,
  behind: 0,
  filesChanged: 3,
  branch: 'feature/test-branch',
  upToDate: false
};

export const mockFiles: DiffFile[] = [
  {
    path: 'src/components/Button.tsx',
    type: 'modified',
    additions: 15,
    deletions: 3,
    status: ' M',
    category: 'unstaged' as FileCategory,
    staged: false,
    unstaged: true,
    untracked: false,
    committed: false
  },
  {
    path: 'src/utils/helpers.ts',
    type: 'added',
    additions: 42,
    deletions: 0,
    status: 'A ',
    category: 'staged' as FileCategory,
    staged: true,
    unstaged: false,
    untracked: false,
    committed: false
  },
  {
    path: 'docs/README.md',
    type: 'added',
    additions: 20,
    deletions: 0,
    status: '??',
    category: 'untracked' as FileCategory,
    staged: false,
    unstaged: false,
    untracked: true,
    committed: false
  },
  {
    path: 'src/api/client.ts',
    type: 'modified',
    additions: 8,
    deletions: 12,
    status: 'MM',
    category: 'staged' as FileCategory,
    staged: true,
    unstaged: true,
    untracked: false,
    committed: false
  }
];

export const mockUnpushedCommits = [
  { hash: 'abc123f', message: 'Add new feature components' },
  { hash: 'def456a', message: 'Fix styling issues' }
];

export const mockDiffContent = `diff --git a/src/components/Button.tsx b/src/components/Button.tsx
index 1234567..abcdefg 100644
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1,6 +1,8 @@
 import React from 'react';
+import { cn } from '../utils/cn';
 
 interface ButtonProps {
   children: React.ReactNode;
+  variant?: 'primary' | 'secondary';
   onClick?: () => void;
 }
 
@@ -8,7 +10,7 @@ export const Button: React.FC<ButtonProps> = ({
   children,
   onClick
 }) => {
-  return <button onClick={onClick}>{children}</button>;
+  return <button className={cn('btn', variant)} onClick={onClick}>{children}</button>;
 };`;

export const mockFileDiffContent = (filePath: string) => `diff --git a/${filePath} b/${filePath}
index 1234567..abcdefg 100644
--- a/${filePath}
+++ b/${filePath}
@@ -1,3 +1,5 @@
 // Original content
+// Added line 1
+// Added line 2
 function example() {
   return 'Hello World';
 }`;

// Helper functions
export async function mockDelay(ms: number = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}