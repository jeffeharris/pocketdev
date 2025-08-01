import { useState, useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export function TerminalRawTest() {
  const [sessionId, setSessionId] = useState('');
  const [wsStatus, setWsStatus] = useState('disconnected');
  const [logs, setLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev.slice(-50), `${new Date().toISOString()} - ${message}`]);
  };
  
  useEffect(() => {
    // Get first task with a terminal session
    fetch('/api/tasks')
      .then(res => res.json())
      .then(tasks => {
        const taskWithTerminal = tasks.find((t: any) => t.terminals?.length > 0);
        if (taskWithTerminal) {
          const session = taskWithTerminal.terminals[0].shelltenderSessionId;
          setSessionId(session);
          addLog(`Found session: ${session}`);
        }
      });
  }, []);
  
  const connectWebSocket = () => {
    if (!sessionId) {
      addLog('No session ID available');
      return;
    }
    
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    // Create XTerm instance if needed
    if (!xtermRef.current && terminalRef.current) {
      const term = new XTerm({
        cursorBlink: false,
        cursorStyle: 'block'
      });
      
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      
      term.open(terminalRef.current);
      fitAddon.fit();
      
      xtermRef.current = term;
      addLog('XTerm instance created');
    }
    
    // Connect to Shelltender WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/shelltender-ws`;
    
    addLog(`Connecting to ${wsUrl}...`);
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      addLog('WebSocket connected');
      setWsStatus('connected');
      
      // Send connect message
      const connectMsg = {
        type: 'connect',
        sessionId: sessionId,
        useIncrementalUpdates: true
      };
      
      addLog(`Sending connect message: ${JSON.stringify(connectMsg)}`);
      ws.send(JSON.stringify(connectMsg));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        addLog(`Received message type: ${data.type}`);
        
        if (data.type === 'connect') {
          addLog(`Connect response - has scrollback: ${!!data.scrollback}, length: ${data.scrollback?.length}`);
          
          // Write scrollback to terminal
          if (data.scrollback && xtermRef.current) {
            addLog('Writing scrollback to terminal...');
            xtermRef.current.write(data.scrollback);
          }
        } else if (data.type === 'output') {
          // Handle regular output
          if (data.data && xtermRef.current) {
            xtermRef.current.write(data.data);
          }
        }
      } catch (e) {
        addLog(`Error parsing message: ${e}`);
      }
    };
    
    ws.onerror = (error) => {
      addLog(`WebSocket error: ${error}`);
      setWsStatus('error');
    };
    
    ws.onclose = () => {
      addLog('WebSocket closed');
      setWsStatus('disconnected');
    };
    
    wsRef.current = ws;
  };
  
  const sendCommand = (cmd: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const inputMsg = {
        type: 'input',
        sessionId: sessionId,
        data: cmd + '\r'
      };
      addLog(`Sending input: ${cmd}`);
      wsRef.current.send(JSON.stringify(inputMsg));
    }
  };
  
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <h1 className="text-lg font-semibold mb-4">Terminal Raw WebSocket Test</h1>
        <div className="flex gap-4 items-center mb-4">
          <button
            onClick={connectWebSocket}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={!sessionId}
          >
            Connect WebSocket
          </button>
          <button
            onClick={() => sendCommand('ls -la')}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            disabled={wsStatus !== 'connected'}
          >
            Send 'ls -la'
          </button>
          <button
            onClick={() => location.reload()}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Refresh Page
          </button>
          <div className="text-sm">
            <span className="text-gray-600">Session: </span>
            <span className="font-mono">{sessionId || 'Not loaded'}</span>
          </div>
          <div className="text-sm">
            <span className="text-gray-600">Status: </span>
            <span className={`font-semibold ${
              wsStatus === 'connected' ? 'text-green-600' : 
              wsStatus === 'error' ? 'text-red-600' : 
              'text-gray-600'
            }`}>
              {wsStatus}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex">
        {/* Terminal */}
        <div className="w-1/2 p-4">
          <div className="h-full bg-gray-900 rounded-lg overflow-hidden p-4">
            <div ref={terminalRef} className="h-full" />
          </div>
        </div>
        
        {/* Logs */}
        <div className="w-1/2 p-4">
          <div className="h-full bg-white rounded-lg shadow-sm p-4 overflow-auto">
            <h2 className="text-sm font-semibold mb-2">Debug Logs</h2>
            <div className="space-y-1 text-xs font-mono">
              {logs.map((log, i) => (
                <div key={i} className="text-gray-700 break-all">{log}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}