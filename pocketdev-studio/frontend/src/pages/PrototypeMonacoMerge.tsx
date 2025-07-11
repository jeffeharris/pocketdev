import React, { useState, useRef, useEffect } from 'react';
import { Editor, DiffEditor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

const PrototypeMonacoMerge: React.FC = () => {
  const [mergedContent, setMergedContent] = useState<string>('');
  const [activeConflict, setActiveConflict] = useState<number>(0);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  // Sample versions for merge
  const baseVersion = `import React from 'react';
import { useState } from 'react';

export function ShoppingCart() {
  const [items, setItems] = useState([]);
  
  const addItem = (item) => {
    setItems([...items, { ...item, quantity: 1 }]);
  };
  
  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  return (
    <div className="shopping-cart">
      <h2>Shopping Cart ({items.length} items)</h2>
      {/* Rest of component */}
    </div>
  );
}`;

  const currentVersion = `import React from 'react';
import { useState } from 'react';

export function ShoppingCart() {
  const [items, setItems] = useState([]);
  
  const addItem = (item) => {
    setItems([...items, { ...item, quantity: 1 }]);
    toast.success('Item added to cart!');
  };
  
  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
    toast.info('Item removed from cart');
  };
  
  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  return (
    <div className="shopping-cart">
      <h2>Shopping Cart ({items.length} items)</h2>
      {/* Rest of component */}
    </div>
  );
}`;

  const incomingVersion = `import React from 'react';
import { useState } from 'react';

export function ShoppingCart() {
  const [items, setItems] = useState([]);
  
  const addItem = (item) => {
    const existingItem = items.find(i => i.id === item.id);
    if (existingItem) {
      updateQuantity(item.id, existingItem.quantity + 1);
    } else {
      setItems([...items, { ...item, quantity: 1 }]);
    }
  };
  
  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      setItems(items.filter(item => item.id !== id));
    } else {
      setItems(items.map(item => 
        item.id === id ? { ...item, quantity } : item
      ));
    }
  };
  
  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  return (
    <div className="shopping-cart">
      <h2>Shopping Cart ({items.length} items)</h2>
      {/* Rest of component */}
    </div>
  );
}`;

  // Initialize with a merged version showing conflicts
  useEffect(() => {
    const merged = `import React from 'react';
import { useState } from 'react';

export function ShoppingCart() {
  const [items, setItems] = useState([]);
  
<<<<<<< Current Changes
  const addItem = (item) => {
    setItems([...items, { ...item, quantity: 1 }]);
    toast.success('Item added to cart!');
  };
  
  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
    toast.info('Item removed from cart');
  };
======= Incoming Changes
  const addItem = (item) => {
    const existingItem = items.find(i => i.id === item.id);
    if (existingItem) {
      updateQuantity(item.id, existingItem.quantity + 1);
    } else {
      setItems([...items, { ...item, quantity: 1 }]);
    }
  };
  
  const updateQuantity = (id, quantity) => {
    if (quantity <= 0) {
      setItems(items.filter(item => item.id !== id));
    } else {
      setItems(items.map(item => 
        item.id === id ? { ...item, quantity } : item
      ));
    }
  };
>>>>>>> 
  
  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  return (
    <div className="shopping-cart">
      <h2>Shopping Cart ({items.length} items)</h2>
      {/* Rest of component */}
    </div>
  );
}`;
    setMergedContent(merged);
  }, []);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Add code actions for conflicts
    const actionProvider = monaco.languages.registerCodeActionProvider('typescript', {
      provideCodeActions: (model: any, range: any, context: any, token: any) => {
        const actions = [];
        const startLine = range.startLineNumber;
        const endLine = range.endLineNumber;
        
        // Check if we're in a conflict zone by looking at the whole area
        let inConflict = false;
        let conflictStart = 0;
        let conflictEnd = 0;
        
        for (let line = Math.max(1, startLine - 10); line <= Math.min(model.getLineCount(), endLine + 10); line++) {
          const lineContent = model.getLineContent(line);
          if (lineContent.includes('<<<<<<< Current Changes')) {
            conflictStart = line;
            inConflict = true;
          } else if (lineContent.includes('>>>>>>>') && inConflict) {
            conflictEnd = line;
            if (startLine >= conflictStart && endLine <= conflictEnd) {
              // We're in a conflict zone
              actions.push({
                title: '⬆️ Accept Current Changes',
                kind: monaco.languages.CodeActionKind.QuickFix,
                diagnostics: [],
                edit: {
                  edits: [{
                    resource: model.uri,
                    textEdit: {
                      range: new monaco.Range(conflictStart, 1, conflictEnd, model.getLineMaxColumn(conflictEnd)),
                      text: 'RESOLVED_CURRENT'
                    }
                  }]
                },
                isPreferred: false
              });

              actions.push({
                title: '⬇️ Accept Incoming Changes',
                kind: monaco.languages.CodeActionKind.QuickFix,
                diagnostics: [],
                edit: {
                  edits: [{
                    resource: model.uri,
                    textEdit: {
                      range: new monaco.Range(conflictStart, 1, conflictEnd, model.getLineMaxColumn(conflictEnd)),
                      text: 'RESOLVED_INCOMING'
                    }
                  }]
                },
                isPreferred: false
              });

              actions.push({
                title: '🔀 Accept Both Changes',
                kind: monaco.languages.CodeActionKind.QuickFix,
                diagnostics: [],
                edit: {
                  edits: [{
                    resource: model.uri,
                    textEdit: {
                      range: new monaco.Range(conflictStart, 1, conflictEnd, model.getLineMaxColumn(conflictEnd)),
                      text: 'RESOLVED_BOTH'
                    }
                  }]
                },
                isPreferred: false
              });
              break;
            }
            inConflict = false;
          }
        }

        return {
          actions: actions,
          dispose: () => {}
        };
      }
    });

    // Add inline decorations for conflicts
    updateConflictDecorations(editor, monaco);
  };

  const updateConflictDecorations = (editor: any, monaco: any) => {
    const model = editor.getModel();
    const content = model.getValue();
    const lines = content.split('\n');
    const decorations: any[] = [];
    
    let inConflict = false;
    let conflictStart = 0;
    let conflictCurrent = 0;
    let conflictSeparator = 0;

    lines.forEach((line: string, index: number) => {
      const lineNumber = index + 1;
      
      if (line.includes('<<<<<<< Current Changes')) {
        inConflict = true;
        conflictStart = lineNumber;
        conflictCurrent = lineNumber;
        
        // Add inline widget for accept buttons
        decorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'conflict-current-marker',
            glyphMarginClassName: 'conflict-glyph-current',
            minimap: { position: 2, color: '#ff6b6b' },
            overviewRuler: {
              position: 4, // OverviewRulerLane.Full
              color: '#ff6b6b'
            }
          }
        });
      } else if (line.includes('=======')) {
        conflictSeparator = lineNumber;
        decorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'conflict-separator-marker',
            minimap: { position: 2, color: '#ffd43b' }
          }
        });
      } else if (line.includes('>>>>>>> ')) {
        // Highlight the entire conflict region
        decorations.push({
          range: new monaco.Range(conflictStart, 1, lineNumber, 1),
          options: {
            className: 'conflict-region',
            isWholeLine: true,
            linesDecorationsClassName: 'conflict-margin'
          }
        });

        // Add accept buttons as widgets
        decorations.push({
          range: new monaco.Range(conflictStart, 1, conflictStart, 1),
          options: {
            beforeContentClassName: 'accept-current-widget'
          }
        });

        decorations.push({
          range: new monaco.Range(conflictSeparator + 1, 1, conflictSeparator + 1, 1),
          options: {
            beforeContentClassName: 'accept-incoming-widget'
          }
        });
        
        inConflict = false;
      }
    });

    editor.deltaDecorations([], decorations);
  };

  const acceptCurrent = () => {
    if (!editorRef.current) return;
    const content = editorRef.current.getValue();
    const resolved = content.replace(
      /<<<<<<< Current Changes[\s\S]*?=======([\s\S]*?)>>>>>>> /gm,
      (match: string, p1: string, p2: string) => {
        const currentContent = match.split('=======')[0].replace('<<<<<<< Current Changes\n', '');
        return currentContent.trim();
      }
    );
    editorRef.current.setValue(resolved);
    updateConflictDecorations(editorRef.current, monacoRef.current);
  };

  const acceptIncoming = () => {
    if (!editorRef.current) return;
    const content = editorRef.current.getValue();
    const resolved = content.replace(
      /<<<<<<< Current Changes[\s\S]*?=======([\s\S]*?)>>>>>>> /gm,
      (match: string) => {
        const parts = match.split('=======');
        const incomingContent = parts[1].replace('>>>>>>> \n', '').replace(' Incoming Changes\n', '');
        return incomingContent.trim();
      }
    );
    editorRef.current.setValue(resolved);
    updateConflictDecorations(editorRef.current, monacoRef.current);
  };

  const acceptBoth = () => {
    if (!editorRef.current) return;
    const content = editorRef.current.getValue();
    const resolved = content.replace(
      /<<<<<<< Current Changes([\s\S]*?)======= Incoming Changes([\s\S]*?)>>>>>>> /gm,
      (match: string, current: string, incoming: string) => {
        return current.trim() + '\n\n' + incoming.trim();
      }
    );
    editorRef.current.setValue(resolved);
    updateConflictDecorations(editorRef.current, monacoRef.current);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Monaco Interactive Merge Editor
        </h1>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <p className="text-blue-800">
            <strong>Try it out:</strong> Edit the code directly, use the quick-fix menu (lightbulb icon), 
            or click the action buttons to resolve conflicts. Monaco provides full IDE features while merging!
          </p>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Quick Resolution Actions</h3>
          <div className="flex gap-4">
            <button
              onClick={acceptCurrent}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Accept All Current Changes
            </button>
            <button
              onClick={acceptIncoming}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Accept All Incoming Changes
            </button>
            <button
              onClick={acceptBoth}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Accept Both (Combine)
            </button>
          </div>
        </div>

        {/* Main Editor with Merge UI */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">Interactive Merge Editor</h3>
            <p className="text-sm text-gray-600 mt-1">
              Resolve conflicts inline with full IntelliSense support
            </p>
          </div>
          
          <div className="relative">
            <Editor
              height="600px"
              defaultLanguage="typescript"
              value={mergedContent}
              theme="vs"
              onMount={handleEditorDidMount}
              onChange={(value) => setMergedContent(value || '')}
              options={{
                minimap: { 
                  enabled: true,
                  showSlider: 'always'
                },
                scrollbar: {
                  vertical: 'visible',
                  horizontal: 'visible',
                  verticalScrollbarSize: 14,
                  horizontalScrollbarSize: 14
                },
                glyphMargin: true,
                lineNumbers: 'on',
                renderLineHighlight: 'all',
                renderWhitespace: 'selection',
                lightbulb: {
                  enabled: true
                },
                quickSuggestions: true,
                suggestOnTriggerCharacters: true
              }}
            />
            
            {/* Custom styles for conflict visualization */}
            <style dangerouslySetInnerHTML={{ __html: `
              .conflict-current-marker { 
                background-color: rgba(255, 107, 107, 0.2); 
                border-left: 3px solid #ff6b6b;
              }
              .conflict-separator-marker { 
                background-color: rgba(255, 213, 59, 0.2); 
                border-left: 3px solid #ffd43b;
              }
              .conflict-incoming-marker { 
                background-color: rgba(81, 207, 102, 0.2); 
                border-left: 3px solid #51cf66;
              }
              .conflict-region { 
                background-color: rgba(255, 193, 7, 0.05); 
              }
              .conflict-margin {
                background-color: #ffc107;
                width: 5px !important;
              }
              .conflict-glyph-current { 
                background-color: #ff6b6b; 
                border-radius: 50%;
                width: 10px !important; 
                height: 10px !important;
                margin: 5px;
              }
              
              /* Inline action widgets */
              .accept-current-widget::before {
                content: "⬆️ Accept Current";
                position: absolute;
                right: 10px;
                background: #ff6b6b;
                color: white;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                z-index: 10;
              }
              
              .accept-incoming-widget::before {
                content: "⬇️ Accept Incoming";
                position: absolute;
                right: 10px;
                background: #51cf66;
                color: white;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                z-index: 10;
              }
            `}} />
          </div>
        </div>

        {/* Three-way diff reference */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="font-semibold text-sm mb-2">Base (Original)</h4>
            <Editor
              height="200px"
              defaultLanguage="typescript"
              value={baseVersion}
              theme="vs"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollbar: { vertical: 'hidden' },
                lineNumbers: 'off',
                folding: false
              }}
            />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="font-semibold text-sm mb-2 text-red-600">Current Changes</h4>
            <Editor
              height="200px"
              defaultLanguage="typescript"
              value={currentVersion}
              theme="vs"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollbar: { vertical: 'hidden' },
                lineNumbers: 'off',
                folding: false
              }}
            />
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="font-semibold text-sm mb-2 text-green-600">Incoming Changes</h4>
            <Editor
              height="200px"
              defaultLanguage="typescript"
              value={incomingVersion}
              theme="vs"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                scrollbar: { vertical: 'hidden' },
                lineNumbers: 'off',
                folding: false
              }}
            />
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 bg-purple-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-900 mb-2">Monaco Merge Editor Features</h3>
          <ul className="space-y-2 text-purple-800">
            <li>• <strong>Inline editing</strong>: Resolve conflicts with full TypeScript support</li>
            <li>• <strong>Code actions</strong>: Right-click or use Ctrl+. for quick fixes</li>
            <li>• <strong>IntelliSense</strong>: Autocomplete works even in merge mode</li>
            <li>• <strong>Minimap navigation</strong>: See all conflicts at a glance</li>
            <li>• <strong>Syntax validation</strong>: Catch errors while merging</li>
            <li>• <strong>Custom widgets</strong>: Inline accept/reject buttons (prototype)</li>
            <li>• <strong>Diff decorations</strong>: Visual conflict markers</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PrototypeMonacoMerge;