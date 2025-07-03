import React, { useState, useRef, useEffect } from 'react';
import { Editor, DiffEditor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

const PrototypeMergeConflict: React.FC = () => {
  const [viewMode, setViewMode] = useState<'inline' | 'three-way'>('inline');
  const [resolvedContent, setResolvedContent] = useState<string>('');
  const [hasConflicts, setHasConflicts] = useState<boolean>(true);
  const [conflictCount, setConflictCount] = useState<number>(0);
  const [currentConflict, setCurrentConflict] = useState<number>(0);
  const [conflictRanges, setConflictRanges] = useState<Array<{ startLine: number; endLine: number }>>([]);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

  // Sample file with merge conflicts
  const conflictedFile = `import React from 'react';
import { useState } from 'react';

export function ShoppingCart() {
  const [items, setItems] = useState([]);
  
<<<<<<< HEAD
  const addItem = (item) => {
    setItems([...items, { ...item, quantity: 1 }]);
    toast.success('Item added to cart!');
  };
  
  const removeItem = (id) => {
    setItems(items.filter(item => item.id !== id));
    toast.info('Item removed from cart');
  };
=======
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
>>>>>>> feature/cart-improvements
  
  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

<<<<<<< HEAD
  const getTaxAmount = () => {
    const subtotal = calculateTotal();
    return subtotal * 0.08; // 8% tax
  };
  
  const getFinalTotal = () => {
    return calculateTotal() + getTaxAmount();
  };
=======
  const getDiscount = () => {
    const total = calculateTotal();
    if (total > 100) return total * 0.1; // 10% discount
    return 0;
  };
  
  const getFinalTotal = () => {
    return calculateTotal() - getDiscount();
  };
>>>>>>> feature/cart-improvements

  return (
    <div className="shopping-cart">
      <h2>Shopping Cart ({items.length} items)</h2>
      <div className="totals">
        <p>Subtotal: $0.00</p>
        <p>Total: $0.00</p>
      </div>
      {/* Rest of component */}
    </div>
  );
}`;

  // Extracted versions for three-way merge
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

  // Check for conflicts and find their ranges
  const checkForConflicts = (content: string) => {
    const lines = content.split('\n');
    const conflicts: Array<{ startLine: number; endLine: number; id: number }> = [];
    let inConflict = false;
    let conflictStart = 0;
    
    lines.forEach((line, index) => {
      if (line.includes('<<<<<<< HEAD')) {
        inConflict = true;
        conflictStart = index + 1; // 1-based line numbers
      } else if (line.includes('>>>>>>>') && inConflict) {
        conflicts.push({
          startLine: conflictStart,
          endLine: index + 1,
          id: conflicts.length
        });
        inConflict = false;
      }
    });
    
    setConflictRanges(conflicts);
    setConflictCount(conflicts.length);
    setHasConflicts(conflicts.length > 0);
    if (conflicts.length > 0 && currentConflict >= conflicts.length) {
      setCurrentConflict(0);
    }
    return conflicts.length;
  };

  // Apply conflict decorations
  const applyConflictDecorations = (editor: monaco.editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    const model = editor.getModel();
    const lines = model.getLinesContent();

    let conflictStart = 0;
    let separatorLine = 0;
    let inConflict = false;

    lines.forEach((line: string, index: number) => {
      const lineNumber = index + 1;
      
      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        conflictStart = lineNumber;
        decorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'conflict-marker-head',
            glyphMarginClassName: 'conflict-glyph',
            minimap: { 
              color: '#ff6b6b',
              position: 1 // MinimapPosition.Inline
            },
            overviewRuler: {
              color: '#ff6b6b',
              position: 4 // OverviewRulerLane.Full
            }
          }
        });
      } else if (line.startsWith('=======')) {
        separatorLine = lineNumber;
        
        // Add red highlight for the current/HEAD section
        if (conflictStart > 0) {
          decorations.push({
            range: new monaco.Range(conflictStart + 1, 1, lineNumber - 1, 1),
            options: {
              isWholeLine: true,
              className: 'conflict-current-section',
              minimap: {
                color: '#ff6b6b',
                position: 1 // MinimapPosition.Inline
              }
            }
          });
        }
        
        decorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'conflict-marker-separator',
            minimap: { 
              color: '#ffd43b',
              position: 1 // MinimapPosition.Inline
            },
            overviewRuler: {
              color: '#ffd43b',
              position: 2 // OverviewRulerLane.Center
            }
          }
        });
      } else if (line.startsWith('>>>>>>>')) {
        // Add green highlight for the incoming section
        if (separatorLine > 0) {
          decorations.push({
            range: new monaco.Range(separatorLine + 1, 1, lineNumber - 1, 1),
            options: {
              isWholeLine: true,
              className: 'conflict-incoming-section',
              minimap: {
                color: '#51cf66',
                position: 1 // MinimapPosition.Inline
              }
            }
          });
        }
        
        decorations.push({
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'conflict-marker-incoming',
            minimap: { 
              color: '#51cf66',
              position: 1 // MinimapPosition.Inline
            },
            overviewRuler: {
              color: '#51cf66',
              position: 4 // OverviewRulerLane.Full
            }
          }
        });
        
        // Add hover message for the entire conflict
        decorations.push({
          range: new monaco.Range(conflictStart, 1, lineNumber, 1),
          options: {
            hoverMessage: [
              { value: '**Merge Conflict**' },
              { value: 'Choose which changes to keep:' },
              { value: '- Accept Current (HEAD)' },
              { value: '- Accept Incoming' },
              { value: '- Accept Both' }
            ]
          }
        });
        
        inConflict = false;
        separatorLine = 0;
      }
    });

    // Update decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);
  };

  // Handle editor mount for inline mode
  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Check initial content
    checkForConflicts(conflictedFile);
    
    // Apply initial decorations
    applyConflictDecorations(editor, monaco);
    
    // Navigate to first conflict after a short delay
    setTimeout(() => {
      if (conflictRanges.length > 0) {
        navigateToConflict(0);
      }
    }, 100);
    
    // Monitor changes
    editor.onDidChangeModelContent(() => {
      const content = editor.getValue();
      checkForConflicts(content);
      applyConflictDecorations(editor, monaco);
    });
    
    // Register keyboard shortcuts for the conflict resolution
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_1, () => acceptCurrentSingle());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_2, () => acceptIncomingSingle());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_3, () => acceptBothSingle());
  };

  // Navigate to specific conflict
  const navigateToConflict = (index: number) => {
    if (!editorRef.current || !conflictRanges[index]) return;
    
    const conflict = conflictRanges[index];
    const editor = editorRef.current;
    const model = editor.getModel();
    
    // Get the first line of actual code after <<<<<<< HEAD
    let contextLines = 0;
    if (conflict.startLine < model.getLineCount()) {
      const firstCodeLine = model.getLineContent(conflict.startLine + 1);
      // Count leading spaces/tabs
      const indentMatch = firstCodeLine.match(/^(\s*)/);
      if (indentMatch) {
        const indent = indentMatch[1];
        // Count spaces (1 context line per 2 spaces) or tabs (1 per tab)
        const spaces = (indent.match(/ /g) || []).length;
        const tabs = (indent.match(/\t/g) || []).length;
        const indentLevel = Math.floor(spaces / 2) + tabs;
        
        // Check if the line DIRECTLY above HEAD is the natural parent (one indent less)
        let hasNaturalParent = false;
        if (conflict.startLine > 1 && indentLevel > 0) {
          const lineAboveHead = model.getLineContent(conflict.startLine - 1);
          const aboveIndentMatch = lineAboveHead.match(/^(\s*)/);
          if (aboveIndentMatch) {
            const aboveIndent = aboveIndentMatch[1];
            const aboveSpaces = (aboveIndent.match(/ /g) || []).length;
            const aboveTabs = (aboveIndent.match(/\t/g) || []).length;
            const aboveIndentLevel = Math.floor(aboveSpaces / 2) + aboveTabs;
            
            // If line DIRECTLY above is one indent level less AND not empty, it's the natural parent
            const lineContent = lineAboveHead.trim();
            if (aboveIndentLevel === indentLevel - 1 && lineContent.length > 0) {
              hasNaturalParent = true;
            }
          }
        }
        
        // Context lines = indent level - 1 (don't count the natural parent)
        contextLines = hasNaturalParent ? Math.max(0, indentLevel - 1) : indentLevel;
        
        console.log('Indent analysis:', {
          firstCodeLine,
          spaces,
          tabs,
          contextLines
        });
      }
    }
    
    // Set cursor to the conflict start
    editor.setPosition({ lineNumber: conflict.startLine, column: 1 });
    
    // Use setScrollTop to position with context based on indentation
    const lineHeight = editor.getOption(monacoRef.current.editor.EditorOption.lineHeight);
    // Show more context for deeply indented code
    const topLine = Math.max(1, conflict.startLine - contextLines);
    const scrollTop = (topLine - 1) * lineHeight;
    editor.setScrollTop(scrollTop);
    
    editor.focus();
    setCurrentConflict(index);
  };

  // Navigate to next/previous conflict
  const navigatePrevious = () => {
    if (conflictCount === 0) return;
    const newIndex = currentConflict > 0 ? currentConflict - 1 : conflictCount - 1;
    navigateToConflict(newIndex);
  };

  const navigateNext = () => {
    if (conflictCount === 0) return;
    const newIndex = currentConflict < conflictCount - 1 ? currentConflict + 1 : 0;
    navigateToConflict(newIndex);
  };

  // Quick conflict resolution functions - now work on current conflict only
  const acceptCurrentSingle = () => {
    if (!editorRef.current || conflictRanges.length === 0) return;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    const conflict = conflictRanges[currentConflict];
    
    // Get the content of the current conflict
    const startLine = conflict.startLine;
    const endLine = conflict.endLine;
    const lines = model.getLinesContent();
    
    const currentContent = [];
    let inCurrent = false;
    
    for (let i = startLine - 1; i < endLine; i++) {
      const line = lines[i];
      if (line.includes('<<<<<<< HEAD')) {
        inCurrent = true;
        continue;
      } else if (line.includes('=======')) {
        inCurrent = false;
        continue;
      } else if (line.includes('>>>>>>>')) {
        break;
      }
      
      if (inCurrent) {
        currentContent.push(line);
      }
    }
    
    // Replace the conflict with the current content
    const range = new monacoRef.current.Range(startLine, 1, endLine, lines[endLine - 1].length + 1);
    editor.executeEdits('', [{
      range: range,
      text: currentContent.join('\n') + '\n'
    }]);
    
    checkForConflicts(editor.getValue());
  };

  const acceptIncomingSingle = () => {
    if (!editorRef.current || conflictRanges.length === 0) return;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    const conflict = conflictRanges[currentConflict];
    
    const startLine = conflict.startLine;
    const endLine = conflict.endLine;
    const lines = model.getLinesContent();
    
    const incomingContent = [];
    let inIncoming = false;
    
    for (let i = startLine - 1; i < endLine; i++) {
      const line = lines[i];
      if (line.includes('=======')) {
        inIncoming = true;
        continue;
      } else if (line.includes('>>>>>>>')) {
        break;
      }
      
      if (inIncoming) {
        incomingContent.push(line);
      }
    }
    
    const range = new monacoRef.current.Range(startLine, 1, endLine, lines[endLine - 1].length + 1);
    editor.executeEdits('', [{
      range: range,
      text: incomingContent.join('\n') + '\n'
    }]);
    
    checkForConflicts(editor.getValue());
  };

  const acceptBothSingle = () => {
    if (!editorRef.current || conflictRanges.length === 0) return;
    
    const editor = editorRef.current;
    const model = editor.getModel();
    const conflict = conflictRanges[currentConflict];
    
    const startLine = conflict.startLine;
    const endLine = conflict.endLine;
    const lines = model.getLinesContent();
    
    const currentContent = [];
    const incomingContent = [];
    let inCurrent = false;
    let inIncoming = false;
    
    for (let i = startLine - 1; i < endLine; i++) {
      const line = lines[i];
      if (line.includes('<<<<<<< HEAD')) {
        inCurrent = true;
        continue;
      } else if (line.includes('=======')) {
        inCurrent = false;
        inIncoming = true;
        continue;
      } else if (line.includes('>>>>>>>')) {
        break;
      }
      
      if (inCurrent) {
        currentContent.push(line);
      } else if (inIncoming) {
        incomingContent.push(line);
      }
    }
    
    const range = new monacoRef.current.Range(startLine, 1, endLine, lines[endLine - 1].length + 1);
    editor.executeEdits('', [{
      range: range,
      text: currentContent.join('\n') + '\n' + incomingContent.join('\n') + '\n'
    }]);
    
    checkForConflicts(editor.getValue());
  };

  // Accept all functions
  const acceptAllCurrent = () => {
    if (!editorRef.current) return;
    const content = editorRef.current.getValue();
    const resolved = content
      .replace(/<<<<<<< HEAD\n([\s\S]*?)=======\n[\s\S]*?>>>>>>> [\s\S]*?\n/gm, '$1');
    editorRef.current.setValue(resolved);
    setResolvedContent(resolved);
    checkForConflicts(resolved);
  };

  const acceptAllIncoming = () => {
    if (!editorRef.current) return;
    const content = editorRef.current.getValue();
    const resolved = content
      .replace(/<<<<<<< HEAD\n[\s\S]*?=======\n([\s\S]*?)>>>>>>> [\s\S]*?\n/gm, '$1');
    editorRef.current.setValue(resolved);
    setResolvedContent(resolved);
    checkForConflicts(resolved);
  };

  const acceptAllBoth = () => {
    if (!editorRef.current) return;
    const content = editorRef.current.getValue();
    const resolved = content
      .replace(/<<<<<<< HEAD\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> [\s\S]*?\n/gm, '$1\n$2');
    editorRef.current.setValue(resolved);
    setResolvedContent(resolved);
    checkForConflicts(resolved);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Monaco Merge Conflict Resolution
        </h1>

        {/* Conflict Status */}
        {viewMode === 'inline' && (
          <div className={`rounded-lg p-4 mb-4 ${
            hasConflicts 
              ? 'bg-yellow-50 border border-yellow-200' 
              : 'bg-green-50 border border-green-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {hasConflicts ? (
                  <>
                    <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                    <span className="text-yellow-800 font-medium">
                      Conflict {currentConflict + 1} of {conflictCount}
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                    <span className="text-green-800 font-medium">
                      All conflicts resolved! ✨
                    </span>
                  </>
                )}
              </div>
              {!hasConflicts && (
                <button
                  onClick={() => navigator.clipboard.writeText(editorRef.current?.getValue() || '')}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Copy Resolved Code
                </button>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                View Mode:
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('inline')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'inline'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Inline Conflicts
                </button>
                <button
                  onClick={() => setViewMode('three-way')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    viewMode === 'three-way'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Three-Way Merge
                </button>
              </div>
            </div>

            {viewMode === 'inline' && (
              <div className="space-y-3">
                {/* Navigation */}
                {conflictCount > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={navigatePrevious}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Previous conflict"
                    >
                      ← Previous
                    </button>
                    <button
                      onClick={navigateNext}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Next conflict"
                    >
                      Next →
                    </button>
                  </div>
                )}
                
                {/* Single conflict resolution */}
                <div className="flex gap-2">
                  <span className="text-sm font-medium text-gray-700 self-center">Current conflict:</span>
                  <button
                    onClick={acceptCurrentSingle}
                    className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Accept Current
                  </button>
                  <button
                    onClick={acceptIncomingSingle}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Accept Incoming
                  </button>
                  <button
                    onClick={acceptBothSingle}
                    className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  >
                    Accept Both
                  </button>
                </div>
                
                {/* Accept all dropdown */}
                <div className="flex gap-2">
                  <details className="relative">
                    <summary className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer">
                      Accept All ▼
                    </summary>
                    <div className="absolute top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-10 min-w-[200px]">
                      <button
                        onClick={acceptAllCurrent}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded transition-colors"
                      >
                        Accept All Current
                      </button>
                      <button
                        onClick={acceptAllIncoming}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded transition-colors"
                      >
                        Accept All Incoming
                      </button>
                      <button
                        onClick={acceptAllBoth}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded transition-colors"
                      >
                        Accept All Both
                      </button>
                    </div>
                  </details>
                  
                  <button
                    onClick={() => {
                      if (editorRef.current && monacoRef.current) {
                        editorRef.current.setValue(conflictedFile);
                        checkForConflicts(conflictedFile);
                        setCurrentConflict(0);
                        // Re-apply decorations after reset
                        setTimeout(() => {
                          applyConflictDecorations(editorRef.current, monacoRef.current);
                        }, 10);
                      }
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Reset All
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold">
              {viewMode === 'inline' ? 'ShoppingCart.tsx - Resolve Conflicts' : 'Three-Way Merge View'}
            </h3>
            {viewMode === 'inline' && (
              <p className="text-sm text-gray-600 mt-1">
                Edit directly in the editor or use the quick resolution buttons above
              </p>
            )}
          </div>
          
          <div className="relative">
            {viewMode === 'inline' ? (
              <>
                <Editor
                  height="600px"
                  defaultLanguage="typescript"
                  defaultValue={conflictedFile}
                  theme="vs"
                  beforeMount={(monaco) => {
                    // Disable TypeScript diagnostics for this editor
                    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                      noSemanticValidation: true,
                      noSyntaxValidation: true
                    });
                  }}
                  onMount={handleEditorDidMount}
                  options={{
                    minimap: { 
                      enabled: true,
                      showSlider: 'always',
                      renderCharacters: false,
                      maxColumn: 120,
                      side: 'right'
                    },
                    scrollbar: {
                      vertical: 'visible',
                      horizontal: 'visible',
                      verticalScrollbarSize: 14,
                      horizontalScrollbarSize: 14,
                      verticalHasArrows: false,
                      horizontalHasArrows: false,
                      useShadows: false
                    },
                    scrollBeyondLastLine: false,
                    glyphMargin: true,
                    lineNumbers: 'on',
                    renderLineHighlight: 'all',
                    renderWhitespace: 'selection',
                    padding: {
                      top: 10,
                      bottom: 10
                    },
                    overviewRulerLanes: 3,
                    overviewRulerBorder: false,
                    // Disable error squiggles in editor
                    renderValidationDecorations: 'off',
                    // Disable the built-in context menu to remove IDE actions
                    contextmenu: false,
                    // Disable various features we don't need for merge conflicts
                    selectionClipboard: false,
                    columnSelection: false,
                    folding: false,
                    links: false,
                    occurrencesHighlight: false,
                    quickSuggestions: false,
                    parameterHints: { enabled: false },
                    suggestOnTriggerCharacters: false,
                    acceptSuggestionOnCommitCharacter: false,
                    tabCompletion: 'off',
                    wordBasedSuggestions: false,
                    // Disable lightbulb
                    lightbulb: { enabled: false },
                    // Disable hover
                    hover: { enabled: false }
                  }}
                />
                
                {/* Custom styles for conflict markers */}
                <style dangerouslySetInnerHTML={{ __html: `
                  .conflict-marker-head { background-color: rgba(255, 107, 107, 0.2); }
                  .conflict-marker-separator { background-color: rgba(255, 213, 59, 0.2); }
                  .conflict-marker-incoming { background-color: rgba(81, 207, 102, 0.2); }
                  .conflict-background { background-color: rgba(255, 193, 7, 0.1); }
                  .conflict-glyph { background-color: #ff6b6b; width: 10px !important; margin-left: 3px; }
                  
                  /* Color-coded sections */
                  .conflict-current-section { 
                    background-color: rgba(255, 107, 107, 0.1); 
                    border-left: 3px solid #ff6b6b;
                  }
                  .conflict-incoming-section { 
                    background-color: rgba(81, 207, 102, 0.1); 
                    border-left: 3px solid #51cf66;
                  }
                `}} />
              </>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {/* Base vs Current */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2 bg-red-50 text-sm font-medium text-red-800 border-b border-red-200">
                    Base → Current (Your Changes)
                  </div>
                  <DiffEditor
                    height="300px"
                    language="typescript"
                    original={baseVersion}
                    modified={currentVersion}
                    theme="vs"
                    beforeMount={(monaco) => {
                      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                        noSemanticValidation: true,
                        noSyntaxValidation: true
                      });
                    }}
                    options={{
                      readOnly: true,
                      renderSideBySide: true,
                      minimap: { enabled: false },
                      scrollbar: { 
                        vertical: 'visible',
                        horizontal: 'auto',
                        verticalScrollbarSize: 10,
                        verticalHasArrows: false,
                        horizontalHasArrows: false,
                        useShadows: false
                      },
                      scrollBeyondLastLine: false,
                      padding: { top: 10, bottom: 10 },
                      diffAlgorithm: 'advanced',
                      renderValidationDecorations: 'off'
                    }}
                  />
                </div>

                {/* Base vs Incoming */}
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2 bg-green-50 text-sm font-medium text-green-800 border-b border-green-200">
                    Base → Incoming (Their Changes)
                  </div>
                  <DiffEditor
                    height="300px"
                    language="typescript"
                    original={baseVersion}
                    modified={incomingVersion}
                    theme="vs"
                    beforeMount={(monaco) => {
                      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                        noSemanticValidation: true,
                        noSyntaxValidation: true
                      });
                    }}
                    options={{
                      readOnly: true,
                      renderSideBySide: true,
                      minimap: { enabled: false },
                      scrollbar: { 
                        vertical: 'visible',
                        horizontal: 'auto',
                        verticalScrollbarSize: 10,
                        verticalHasArrows: false,
                        horizontalHasArrows: false,
                        useShadows: false
                      },
                      scrollBeyondLastLine: false,
                      padding: { top: 10, bottom: 10 },
                      diffAlgorithm: 'advanced',
                      renderValidationDecorations: 'off'
                    }}
                  />
                </div>

                {/* Current vs Incoming (Conflicts) */}
                <div className="col-span-2 bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2 bg-purple-50 text-sm font-medium text-purple-800 border-b border-purple-200">
                    Current ↔ Incoming (Conflicts to Resolve)
                  </div>
                  <DiffEditor
                    height="300px"
                    language="typescript"
                    original={currentVersion}
                    modified={incomingVersion}
                    theme="vs"
                    beforeMount={(monaco) => {
                      monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
                        noSemanticValidation: true,
                        noSyntaxValidation: true
                      });
                    }}
                    options={{
                      readOnly: true,
                      renderSideBySide: true,
                      minimap: { 
                        enabled: true,
                        showSlider: 'always',
                        renderCharacters: false,
                        maxColumn: 120
                      },
                      scrollbar: { 
                        vertical: 'visible',
                        horizontal: 'auto',
                        verticalScrollbarSize: 14,
                        horizontalScrollbarSize: 14,
                        verticalHasArrows: false,
                        horizontalHasArrows: false,
                        useShadows: false
                      },
                      scrollBeyondLastLine: false,
                      padding: { top: 10, bottom: 10 },
                      diffAlgorithm: 'advanced',
                      renderValidationDecorations: 'off',
                      overviewRulerLanes: 3,
                      overviewRulerBorder: false
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Monaco Merge Conflict Features</h3>
          <ul className="space-y-2 text-blue-800">
            <li>• <strong>Inline editing</strong>: Edit conflicts directly in the editor with syntax highlighting</li>
            <li>• <strong>Minimap navigation</strong>: See conflict locations in the scrollbar overview</li>
            <li>• <strong>Three-way view</strong>: Compare base, current, and incoming changes side by side</li>
            <li>• <strong>Smart IntelliSense</strong>: Get code completion even while resolving conflicts</li>
            <li>• <strong>Custom decorations</strong>: Visual markers for conflict regions</li>
            <li>• <strong>Quick actions</strong>: Accept current, incoming, or both changes with one click</li>
          </ul>
        </div>

        {/* Note */}
        <div className="mt-4 text-sm text-gray-600">
          <p><strong>Note:</strong> VS Code's full merge editor isn't available in the web version, but Monaco provides excellent building blocks for custom merge UIs.</p>
        </div>
      </div>
    </div>
  );
};

export default PrototypeMergeConflict;