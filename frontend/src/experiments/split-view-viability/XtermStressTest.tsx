import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useFPSStats } from './useFPSMonitor';
import { FPSIndicator, usePerformanceMonitor } from './FPSIndicator';

interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  terminalCount: number;
  linesPerSecond: number;
}

interface TerminalInstance {
  id: string;
  terminal: Terminal;
  fitAddon: FitAddon;
  outputInterval?: ReturnType<typeof setInterval>;
}

export const XtermStressTest: React.FC = () => {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    memoryUsage: 0,
    renderTime: 0,
    terminalCount: 0,
    linesPerSecond: 0,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [outputRate, setOutputRate] = useState(1000); // lines per second
  const containerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const metricsInterval = useRef<ReturnType<typeof setInterval>>();
  
  // Use the FPS stats hook
  const { fps, startMonitoring, stopMonitoring } = useFPSStats();
  const perfStats = usePerformanceMonitor();

  // Update metrics with FPS (prefer perfStats as it's more accurate)
  useEffect(() => {
    setMetrics(prev => ({ ...prev, fps: perfStats.fps || fps }));
  }, [fps, perfStats.fps]);

  // Start/stop FPS monitoring with test
  useEffect(() => {
    if (isRunning) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
  }, [isRunning, startMonitoring, stopMonitoring]);

  // Memory usage monitoring
  useEffect(() => {
    const measureMetrics = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMetrics(prev => ({
          ...prev,
          memoryUsage: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        }));
      }
    };

    metricsInterval.current = setInterval(measureMetrics, 1000);
    
    return () => {
      if (metricsInterval.current) {
        clearInterval(metricsInterval.current);
      }
    };
  }, []);

  const createTerminal = (index: number) => {
    const terminal = new Terminal({
      rows: 24,
      cols: 80,
      scrollback: 10000,
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    const container = containerRefs.current[index];
    if (container) {
      terminal.open(container);
      fitAddon.fit();
    }

    return { terminal, fitAddon };
  };

  const startStressTest = () => {
    const newTerminals: TerminalInstance[] = [];
    
    // Create 4 terminals
    for (let i = 0; i < 4; i++) {
      const { terminal, fitAddon } = createTerminal(i);
      const id = `terminal-${i}`;
      
      const instance: TerminalInstance = {
        id,
        terminal,
        fitAddon,
      };

      // Start outputting data
      instance.outputInterval = setInterval(() => {
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] Terminal ${i}: ${generateRandomLine()}\r\n`;
        terminal.write(line);
      }, 1000 / outputRate);

      newTerminals.push(instance);
    }

    setTerminals(newTerminals);
    setIsRunning(true);
    setMetrics(prev => ({ ...prev, terminalCount: 4, linesPerSecond: outputRate * 4 }));
  };

  const stopStressTest = () => {
    terminals.forEach(({ terminal, outputInterval }) => {
      if (outputInterval) {
        clearInterval(outputInterval);
      }
      terminal.dispose();
    });
    
    setTerminals([]);
    setIsRunning(false);
    setMetrics(prev => ({ ...prev, terminalCount: 0, linesPerSecond: 0 }));
  };

  const generateRandomLine = () => {
    const messages = [
      'Processing data chunk...',
      'Analyzing code patterns...',
      'Compiling modules...',
      'Running test suite...',
      'Building dependencies...',
      'Optimizing performance...',
      'Checking memory allocation...',
      'Validating input parameters...',
      'Executing batch operation...',
      'Synchronizing state...',
    ];
    
    const randomData = Math.random().toString(36).substring(2, 15);
    return `${messages[Math.floor(Math.random() * messages.length)]} [${randomData}]`;
  };

  const runCreateDestroyTest = async () => {
    const cycles = 100;
    const startTime = performance.now();
    
    for (let cycle = 0; cycle < cycles; cycle++) {
      // Create
      const { terminal, fitAddon } = createTerminal(0);
      
      // Write some data
      for (let i = 0; i < 10; i++) {
        terminal.write(`Cycle ${cycle}, Line ${i}\r\n`);
      }
      
      // Destroy
      terminal.dispose();
      
      // Small delay to let GC potentially run
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    alert(`Create/Destroy Test Complete:\n` +
          `Cycles: ${cycles}\n` +
          `Total Time: ${totalTime.toFixed(2)}ms\n` +
          `Average per cycle: ${(totalTime / cycles).toFixed(2)}ms`);
  };

  return (
    <div className="p-4 bg-gray-900 text-white min-h-screen">
      <FPSIndicator visible={isRunning} />
      <h1 className="text-2xl font-bold mb-4">xterm.js Stress Test</h1>
      
      <div className="mb-4 space-y-2">
        <div className="flex gap-4">
          <button
            onClick={isRunning ? stopStressTest : startStressTest}
            className={`px-4 py-2 rounded ${
              isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isRunning ? 'Stop Stress Test' : 'Start Stress Test (4 Terminals)'}
          </button>
          
          <button
            onClick={runCreateDestroyTest}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
            disabled={isRunning}
          >
            Run Create/Destroy Test (100 cycles)
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <label>Output Rate (lines/sec per terminal):</label>
          <input
            type="range"
            min="100"
            max="2000"
            step="100"
            value={outputRate}
            onChange={(e) => setOutputRate(Number(e.target.value))}
            disabled={isRunning}
            className="w-64"
          />
          <span>{outputRate}</span>
        </div>
      </div>

      <div className="mb-4 p-4 bg-gray-800 rounded">
        <h2 className="text-lg font-semibold mb-2">Performance Metrics</h2>
        {!isRunning && metrics.fps === 0 && (
          <p className="text-sm text-yellow-400 mb-2">
            Note: FPS monitoring activates when test is running. Look for the FPS indicator in the top-right corner.
          </p>
        )}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <div className="text-sm text-gray-400">FPS</div>
            <div className={`text-2xl font-mono ${metrics.fps < 30 ? 'text-red-500' : 'text-green-500'}`}>
              {metrics.fps || '--'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Memory (MB)</div>
            <div className={`text-2xl font-mono ${metrics.memoryUsage > 500 ? 'text-red-500' : 'text-green-500'}`}>
              {metrics.memoryUsage}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Terminals</div>
            <div className="text-2xl font-mono">{metrics.terminalCount}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Total Lines/sec</div>
            <div className="text-2xl font-mono">{metrics.linesPerSecond}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Status</div>
            <div className={`text-sm ${isRunning ? 'text-green-400' : 'text-gray-400'}`}>
              {isRunning ? 'Running' : 'Idle'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2" style={{ height: 'calc(100vh - 300px)' }}>
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            ref={(el) => (containerRefs.current[index] = el)}
            className="bg-black border border-gray-700 overflow-hidden"
            style={{ minHeight: '200px' }}
          />
        ))}
      </div>
    </div>
  );
};