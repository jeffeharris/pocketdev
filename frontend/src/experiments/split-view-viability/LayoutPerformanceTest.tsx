import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface ResizeMetrics {
  fps: number;
  layoutCalculationTime: number;
  resizeCount: number;
  lastResizeTime: number;
}

export const LayoutPerformanceTest: React.FC = () => {
  const [splitMode, setSplitMode] = useState<'single' | 'horizontal' | 'vertical' | 'quad'>('horizontal');
  const [isResizing, setIsResizing] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50); // percentage
  const [metrics, setMetrics] = useState<ResizeMetrics>({
    fps: 60,
    layoutCalculationTime: 0,
    resizeCount: 0,
    lastResizeTime: 0,
  });
  const [terminalsActive, setTerminalsActive] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startSplit: number } | null>(null);
  const frameCountRef = useRef(0);
  const lastFrameTime = useRef(performance.now());
  const terminals = useRef<Map<string, { terminal: Terminal; fitAddon: FitAddon }>>(new Map());

  // FPS measurement during resize
  const measureResizeFPS = useCallback(() => {
    if (!isResizing) return;

    frameCountRef.current++;
    const currentTime = performance.now();
    const elapsed = currentTime - lastFrameTime.current;

    if (elapsed >= 100) { // Update every 100ms during resize
      const fps = Math.round((frameCountRef.current * 1000) / elapsed);
      setMetrics(prev => ({ ...prev, fps }));
      frameCountRef.current = 0;
      lastFrameTime.current = currentTime;
    }

    requestAnimationFrame(measureResizeFPS);
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      frameCountRef.current = 0;
      lastFrameTime.current = performance.now();
      requestAnimationFrame(measureResizeFPS);
    }
  }, [isResizing, measureResizeFPS]);

  const createTerminalInContainer = (containerId: string, container: HTMLElement) => {
    const terminal = new Terminal({
      rows: 24,
      cols: 80,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    
    // Add some content
    terminal.write('Terminal ' + containerId + ' ready.\r\n');
    terminal.write('$ ');

    // Simulate some activity
    let lineCount = 0;
    const interval = setInterval(() => {
      if (terminalsActive) {
        terminal.write(`\r\n[${new Date().toISOString()}] Processing line ${lineCount++}...`);
        terminal.write('\r\n$ ');
      }
    }, 500);

    terminals.current.set(containerId, { terminal, fitAddon });

    return () => {
      clearInterval(interval);
      terminal.dispose();
      terminals.current.delete(containerId);
    };
  };

  const initializeTerminals = () => {
    // Clear existing terminals
    terminals.current.forEach(({ terminal }) => terminal.dispose());
    terminals.current.clear();

    // Create terminals based on split mode
    const terminalContainers = containerRef.current?.querySelectorAll('.terminal-container');
    if (terminalContainers) {
      terminalContainers.forEach((container, index) => {
        createTerminalInContainer(`term-${index}`, container as HTMLElement);
      });

      // Fit all terminals after a brief delay
      setTimeout(() => {
        terminals.current.forEach(({ fitAddon }) => fitAddon.fit());
      }, 100);
    }

    setTerminalsActive(true);
  };

  const clearTerminals = () => {
    terminals.current.forEach(({ terminal }) => terminal.dispose());
    terminals.current.clear();
    setTerminalsActive(false);
  };

  const handleMouseDown = (e: React.MouseEvent, direction: 'horizontal' | 'vertical') => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    
    resizeRef.current = { startX, startY, startSplit: splitPosition };
    setIsResizing(true);

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current || !containerRef.current) return;

      const layoutStart = performance.now();
      const rect = containerRef.current.getBoundingClientRect();
      
      let newPosition: number;
      if (direction === 'horizontal') {
        const deltaY = e.clientY - resizeRef.current.startY;
        const percentDelta = (deltaY / rect.height) * 100;
        newPosition = Math.max(20, Math.min(80, resizeRef.current.startSplit + percentDelta));
      } else {
        const deltaX = e.clientX - resizeRef.current.startX;
        const percentDelta = (deltaX / rect.width) * 100;
        newPosition = Math.max(20, Math.min(80, resizeRef.current.startSplit + percentDelta));
      }

      setSplitPosition(newPosition);
      
      // Resize terminals
      requestAnimationFrame(() => {
        terminals.current.forEach(({ fitAddon }) => fitAddon.fit());
      });

      const layoutTime = performance.now() - layoutStart;
      setMetrics(prev => ({
        ...prev,
        layoutCalculationTime: layoutTime,
        resizeCount: prev.resizeCount + 1,
        lastResizeTime: Date.now(),
      }));
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const renderSplitLayout = () => {
    switch (splitMode) {
      case 'single':
        return (
          <div className="terminal-container w-full h-full bg-black" />
        );

      case 'horizontal':
        return (
          <>
            <div 
              className="terminal-container bg-black" 
              style={{ height: `${splitPosition}%` }}
            />
            <div 
              className="resize-handle-horizontal"
              onMouseDown={(e) => handleMouseDown(e, 'horizontal')}
            />
            <div 
              className="terminal-container bg-black" 
              style={{ height: `${100 - splitPosition}%` }}
            />
          </>
        );

      case 'vertical':
        return (
          <>
            <div 
              className="terminal-container bg-black" 
              style={{ width: `${splitPosition}%` }}
            />
            <div 
              className="resize-handle-vertical"
              onMouseDown={(e) => handleMouseDown(e, 'vertical')}
            />
            <div 
              className="terminal-container bg-black" 
              style={{ width: `${100 - splitPosition}%` }}
            />
          </>
        );

      case 'quad':
        return (
          <div className="grid grid-cols-2 grid-rows-2 h-full gap-1">
            <div className="terminal-container bg-black" />
            <div className="terminal-container bg-black" />
            <div className="terminal-container bg-black" />
            <div className="terminal-container bg-black" />
          </div>
        );
    }
  };

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Layout Performance Test</h1>

      <div className="mb-4 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSplitMode('single')}
            className={`px-4 py-2 rounded ${splitMode === 'single' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Single
          </button>
          <button
            onClick={() => setSplitMode('horizontal')}
            className={`px-4 py-2 rounded ${splitMode === 'horizontal' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Horizontal Split
          </button>
          <button
            onClick={() => setSplitMode('vertical')}
            className={`px-4 py-2 rounded ${splitMode === 'vertical' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Vertical Split
          </button>
          <button
            onClick={() => setSplitMode('quad')}
            className={`px-4 py-2 rounded ${splitMode === 'quad' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Quad View
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={initializeTerminals}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded"
            disabled={terminalsActive}
          >
            Initialize Terminals
          </button>
          <button
            onClick={clearTerminals}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
            disabled={!terminalsActive}
          >
            Clear Terminals
          </button>
        </div>
      </div>

      <div className="mb-4 p-4 bg-gray-800 rounded">
        <h2 className="text-lg font-semibold mb-2">Resize Performance Metrics</h2>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-400">Resize FPS</div>
            <div className={`text-2xl font-mono ${
              isResizing ? (metrics.fps < 24 ? 'text-red-500' : metrics.fps < 60 ? 'text-yellow-500' : 'text-green-500') : 'text-gray-500'
            }`}>
              {isResizing ? metrics.fps : '--'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Layout Calc (ms)</div>
            <div className={`text-2xl font-mono ${metrics.layoutCalculationTime > 16 ? 'text-red-500' : 'text-green-500'}`}>
              {metrics.layoutCalculationTime.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Resize Events</div>
            <div className="text-2xl font-mono">{metrics.resizeCount}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Status</div>
            <div className={`text-sm ${isResizing ? 'text-yellow-400' : 'text-gray-400'}`}>
              {isResizing ? 'Resizing...' : terminalsActive ? 'Active' : 'Idle'}
            </div>
          </div>
        </div>
        
        <div className="mt-4 text-sm">
          <p className="text-gray-400">Success Criteria:</p>
          <ul className="mt-1 space-y-1">
            <li className={`${!terminalsActive ? 'text-gray-500' : metrics.fps >= 60 ? 'text-green-400' : metrics.fps >= 24 ? 'text-yellow-400' : 'text-red-400'}`}>
              ✓ Smooth resize at 60FPS with empty terminals
            </li>
            <li className={`${!terminalsActive || !isResizing ? 'text-gray-500' : metrics.fps >= 24 ? 'text-green-400' : 'text-red-400'}`}>
              ✓ Acceptable resize (24+ FPS) with active content
            </li>
            <li className={`${metrics.layoutCalculationTime === 0 ? 'text-gray-500' : metrics.layoutCalculationTime < 16 ? 'text-green-400' : 'text-red-400'}`}>
              ✓ Layout calculations under 16ms
            </li>
          </ul>
        </div>
      </div>

      <div 
        ref={containerRef}
        className={`relative bg-gray-800 border border-gray-700 ${
          splitMode === 'horizontal' ? 'flex flex-col' : 
          splitMode === 'vertical' ? 'flex flex-row' : ''
        }`}
        style={{ height: 'calc(100vh - 400px)', minHeight: '400px' }}
      >
        {renderSplitLayout()}
      </div>

      <style>
        {`
          .resize-handle-horizontal {
            height: 4px;
            background: #4b5563;
            cursor: row-resize;
            position: relative;
            flex-shrink: 0;
          }
          
          .resize-handle-horizontal:hover,
          .resize-handle-horizontal:active {
            background: #3b82f6;
          }
          
          .resize-handle-vertical {
            width: 4px;
            background: #4b5563;
            cursor: col-resize;
            position: relative;
            flex-shrink: 0;
          }
          
          .resize-handle-vertical:hover,
          .resize-handle-vertical:active {
            background: #3b82f6;
          }
          
          .terminal-container {
            position: relative;
            overflow: hidden;
          }
        `}
      </style>
    </div>
  );
};