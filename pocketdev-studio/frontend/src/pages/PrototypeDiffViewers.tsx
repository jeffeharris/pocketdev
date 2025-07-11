import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';

// Diff2Html imports
import { parse, html } from 'diff2html';
import 'diff2html/bundles/css/diff2html.min.css';

// React Diff View imports
import { parseDiff, Diff as DiffView, Hunk } from 'react-diff-view';
import 'react-diff-view/style/index.css';

// Monaco Editor imports
import { DiffEditor } from '@monaco-editor/react';

interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  diff?: string;
}

const PrototypeDiffViewers: React.FC = () => {
  const [mockDiff, setMockDiff] = useState<string>('');
  const [selectedViewer, setSelectedViewer] = useState<'diff2html' | 'react-diff-view' | 'monaco'>('diff2html');
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [loading, setLoading] = useState(true);
  const [realDiff, setRealDiff] = useState<DiffFile | null>(null);

  // Mock diff data for testing
  const createMockDiff = () => {
    const oldCode = `import React from 'react';
import { useState } from 'react';

export function Component() {
  const [count, setCount] = useState(0);
  
  const handleClick = () => {
    setCount(count + 1);
    console.log('Button clicked');
  };

  return (
    <div className="container">
      <h1>Counter App</h1>
      <p>Count: {count}</p>
      <button onClick={handleClick}>
        Click me
      </button>
    </div>
  );
}`;

    const newCode = `import React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { Button } from './Button';
import { logger } from '../utils/logger';

interface ComponentProps {
  initialCount?: number;
  onCountChange?: (count: number) => void;
}

export function Component({ initialCount = 0, onCountChange }: ComponentProps) {
  const [count, setCount] = useState(initialCount);
  const [lastClicked, setLastClicked] = useState<Date | null>(null);
  
  useEffect(() => {
    if (onCountChange) {
      onCountChange(count);
    }
  }, [count, onCountChange]);
  
  const handleClick = useCallback(() => {
    setCount(prev => prev + 1);
    setLastClicked(new Date());
    logger.info('Button clicked', { count: count + 1 });
  }, [count]);

  const handleReset = useCallback(() => {
    setCount(initialCount);
    setLastClicked(null);
    logger.info('Counter reset');
  }, [initialCount]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Enhanced Counter App</h1>
      <div className="space-y-4">
        <p className="text-lg">Count: <span className="font-semibold">{count}</span></p>
        {lastClicked && (
          <p className="text-sm text-gray-600">
            Last clicked: {lastClicked.toLocaleTimeString()}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={handleClick} variant="primary">
            Increment
          </Button>
          <Button onClick={handleReset} variant="secondary">
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}`;

    // Create a manual unified diff format
    return `diff --git a/Component.tsx b/Component.tsx
index 1234567..abcdefg 100644
--- a/Component.tsx
+++ b/Component.tsx
@@ -1,18 +1,37 @@
 import React from 'react';
-import { useState } from 'react';
+import { useState, useCallback, useEffect } from 'react';
+import { Button } from './Button';
+import { logger } from '../utils/logger';
 
-export function Component() {
-  const [count, setCount] = useState(0);
+interface ComponentProps {
+  initialCount?: number;
+  onCountChange?: (count: number) => void;
+}
+
+export function Component({ initialCount = 0, onCountChange }: ComponentProps) {
+  const [count, setCount] = useState(initialCount);
+  const [lastClicked, setLastClicked] = useState<Date | null>(null);
+  
+  useEffect(() => {
+    if (onCountChange) {
+      onCountChange(count);
+    }
+  }, [count, onCountChange]);
   
-  const handleClick = () => {
-    setCount(count + 1);
-    console.log('Button clicked');
-  };
+  const handleClick = useCallback(() => {
+    setCount(prev => prev + 1);
+    setLastClicked(new Date());
+    logger.info('Button clicked', { count: count + 1 });
+  }, [count]);
+
+  const handleReset = useCallback(() => {
+    setCount(initialCount);
+    setLastClicked(null);
+    logger.info('Counter reset');
+  }, [initialCount]);
 
   return (
-    <div className="container">
-      <h1>Counter App</h1>
-      <p>Count: {count}</p>
-      <button onClick={handleClick}>
-        Click me
-      </button>
+    <div className="container mx-auto p-4">
+      <h1 className="text-2xl font-bold mb-4">Enhanced Counter App</h1>
+      <div className="space-y-4">
+        <p className="text-lg">Count: <span className="font-semibold">{count}</span></p>
+        {lastClicked && (
+          <p className="text-sm text-gray-600">
+            Last clicked: {lastClicked.toLocaleTimeString()}
+          </p>
+        )}
+        <div className="flex gap-2">
+          <Button onClick={handleClick} variant="primary">
+            Increment
+          </Button>
+          <Button onClick={handleReset} variant="secondary">
+            Reset
+          </Button>
+        </div>
+      </div>
     </div>
   );
 }`;
  };

  // Load real diff from the current repo
  useEffect(() => {
    const loadRealDiff = async () => {
      try {
        // Get the first project and task with changes
        const projects = await api.getProjects();
        if (projects.length > 0) {
          const tasks = await api.getTasks(projects[0].id);
          
          // Find a task with a feature branch
          const taskWithBranch = tasks.find(t => t.git_branch && t.git_branch !== 'main');
          
          if (taskWithBranch) {
            const diffData = await api.getTaskDiff(projects[0].id, taskWithBranch.id);
            if (diffData.files && diffData.files.length > 0) {
              // Find a file with substantial changes
              const fileWithChanges = diffData.files.find(f => 
                f.additions > 5 || f.deletions > 5
              ) || diffData.files[0];
              
              setRealDiff(fileWithChanges);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load real diff:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRealDiff();
    setMockDiff(createMockDiff());
  }, []);

  const currentDiff = realDiff?.diff || mockDiff;

  // Render diff2html
  const renderDiff2Html = () => {
    const diff2htmlResult = html(parse(currentDiff), {
      outputFormat: viewMode === 'split' ? 'side-by-side' : 'line-by-line',
      matching: 'lines',
      drawFileList: false,
      highlight: true,
    });

    return (
      <div 
        className="diff2html-wrapper"
        dangerouslySetInnerHTML={{ __html: diff2htmlResult }}
      />
    );
  };

  // Render react-diff-view
  const renderReactDiffView = () => {
    try {
      const files = parseDiff(currentDiff);
      if (!files || files.length === 0) return <div>No diff to display</div>;

      const renderFile = files[0];
      const { oldRevision, newRevision, type, hunks } = renderFile;

      return (
        <div>
          <DiffView
            viewType={viewMode}
            diffType={type}
            hunks={hunks || []}
          />
        </div>
      );
    } catch (error) {
      console.error('Error parsing diff for react-diff-view:', error);
      return <div>Error parsing diff</div>;
    }
  };

  // Extract code from diff for Monaco
  const extractCodeFromDiff = (diff: string): { original: string; modified: string } => {
    const lines = diff.split('\n');
    const original: string[] = [];
    const modified: string[] = [];
    let inHunk = false;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        inHunk = true;
        continue;
      }
      
      if (!inHunk) continue;

      if (line.startsWith('-')) {
        original.push(line.substring(1));
      } else if (line.startsWith('+')) {
        modified.push(line.substring(1));
      } else if (line.startsWith(' ')) {
        original.push(line.substring(1));
        modified.push(line.substring(1));
      }
    }

    return {
      original: original.join('\n'),
      modified: modified.join('\n')
    };
  };

  // Render Monaco Diff Editor
  const renderMonacoDiff = () => {
    const { original, modified } = extractCodeFromDiff(currentDiff);

    return (
      <DiffEditor
        height="600px"
        language="typescript"
        original={original}
        modified={modified}
        theme="vs"
        options={{
          readOnly: true,
          renderSideBySide: viewMode === 'split',
          enableSplitViewResizing: true,
          renderOverviewRuler: true,
          minimap: { 
            enabled: true,
            showSlider: 'always',
            renderCharacters: false,
            maxColumn: 200,
            side: 'right'
          },
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            useShadows: true,
            verticalHasArrows: false,
            horizontalHasArrows: false,
            verticalScrollbarSize: 14,
            horizontalScrollbarSize: 14,
            arrowSize: 30
          }
        }}
      />
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Diff Viewer Library Comparison
        </h1>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Library:
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedViewer('diff2html')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedViewer === 'diff2html'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  diff2html
                </button>
                <button
                  onClick={() => setSelectedViewer('react-diff-view')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedViewer === 'react-diff-view'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  react-diff-view
                </button>
                <button
                  onClick={() => setSelectedViewer('monaco')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedViewer === 'monaco'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Monaco Editor
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                View Mode:
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('split')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'split'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Side by Side
                </button>
                <button
                  onClick={() => setViewMode('unified')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'unified'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Unified
                </button>
              </div>
            </div>

            <div className="ml-auto">
              <p className="text-sm text-gray-600">
                {realDiff ? (
                  <>Using real diff from: <code className="font-mono">{realDiff.path}</code></>
                ) : (
                  'Using mock data (no tasks with diffs found)'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Library Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Library Details</h2>
          
          {selectedViewer === 'diff2html' && (
            <div className="space-y-2 text-gray-700">
              <p><strong>diff2html</strong> - Used by GitLab</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>✅ Excellent performance with large files</li>
                <li>✅ Built-in syntax highlighting</li>
                <li>✅ Side-by-side and unified views</li>
                <li>✅ File tree support for multiple files</li>
                <li>✅ Minimal configuration needed</li>
                <li>❌ Less customizable than others</li>
              </ul>
            </div>
          )}

          {selectedViewer === 'react-diff-view' && (
            <div className="space-y-2 text-gray-700">
              <p><strong>react-diff-view</strong> - Most flexible React component</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>✅ Virtual scrolling for huge files</li>
                <li>✅ Highly customizable rendering</li>
                <li>✅ Token-level highlighting</li>
                <li>✅ Widget system for comments/annotations</li>
                <li>✅ Best for custom UX requirements</li>
                <li>❌ Requires more setup</li>
              </ul>
            </div>
          )}

          {selectedViewer === 'monaco' && (
            <div className="space-y-2 text-gray-700">
              <p><strong>Monaco Editor</strong> - VS Code's editor</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>✅ Best performance for massive files</li>
                <li>✅ Full IDE features (find, go to line, etc)</li>
                <li>✅ Professional look and feel</li>
                <li>✅ Inline diff mode available</li>
                <li>✅ Memory efficient</li>
                <li>❌ Larger bundle size</li>
              </ul>
            </div>
          )}
        </div>

        {/* Diff Viewer */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">
              {selectedViewer === 'diff2html' && 'diff2html Viewer'}
              {selectedViewer === 'react-diff-view' && 'react-diff-view Viewer'}
              {selectedViewer === 'monaco' && 'Monaco Diff Editor'}
            </h3>
          </div>
          
          <div className="p-4">
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Loading diff data...
              </div>
            ) : (
              <>
                {selectedViewer === 'diff2html' && renderDiff2Html()}
                {selectedViewer === 'react-diff-view' && renderReactDiffView()}
                {selectedViewer === 'monaco' && renderMonacoDiff()}
              </>
            )}
          </div>
        </div>

        {/* Performance Notes */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Performance Notes</h3>
          <ul className="space-y-2 text-blue-800">
            <li>• <strong>diff2html</strong>: Handles files up to ~5000 lines smoothly, good syntax highlighting</li>
            <li>• <strong>react-diff-view</strong>: Best for 10k+ lines with virtual scrolling, most memory efficient</li>
            <li>• <strong>Monaco</strong>: Can handle 100k+ lines, but larger initial bundle size (~2MB)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PrototypeDiffViewers;