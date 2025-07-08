import React, { useRef, useEffect, useState } from 'react';
import { Terminal, WebSocketProvider } from '@shelltender/client';
import type { TerminalHandle } from '@shelltender/client';

export const TestTerminalRef: React.FC = () => {
  const terminalRef = useRef<TerminalHandle>(null);
  const [refStatus, setRefStatus] = useState<string>('Initializing...');
  const [refCallbackInvoked, setRefCallbackInvoked] = useState(false);
  const [terminalMounted, setTerminalMounted] = useState(false);
  
  // Test ref availability after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (terminalRef.current) {
        setRefStatus('✅ Ref is available');
        console.log('[TestTerminalRef] Terminal ref is available:', terminalRef.current);
        console.log('[TestTerminalRef] Available methods:', Object.keys(terminalRef.current));
      } else {
        setRefStatus('❌ Ref is null');
        console.log('[TestTerminalRef] Terminal ref is still null after mount');
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);
  
  const handleTestFocus = () => {
    console.log('[TestTerminalRef] Testing focus method...');
    if (terminalRef.current?.focus) {
      terminalRef.current.focus();
      console.log('[TestTerminalRef] ✅ Focus method called successfully');
    } else {
      console.log('[TestTerminalRef] ❌ Focus method not available');
    }
  };
  
  const handleTestFit = () => {
    console.log('[TestTerminalRef] Testing fit method...');
    if (terminalRef.current?.fit) {
      terminalRef.current.fit();
      console.log('[TestTerminalRef] ✅ Fit method called successfully');
    } else {
      console.log('[TestTerminalRef] ❌ Fit method not available');
    }
  };
  
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">Terminal Ref API Test (v0.4.4)</h2>
      <div className="mb-4">
        <p>Ref Status: {refStatus}</p>
        <p>Ref Callback Invoked: {refCallbackInvoked ? '✅ Yes' : '❌ No'}</p>
        <p>Terminal Mounted: {terminalMounted ? '✅ Yes' : '❌ No'}</p>
      </div>
      <div className="mb-4 space-x-2">
        <button 
          onClick={handleTestFocus}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Focus
        </button>
        <button 
          onClick={handleTestFit}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Test Fit
        </button>
      </div>
      <div className="h-64 border border-gray-300">
        <WebSocketProvider config={{ url: '/shelltender-ws' }}>
          <Terminal
            ref={(ref) => {
              console.log('[TestTerminalRef] Ref callback invoked with:', ref);
              setRefCallbackInvoked(true);
              terminalRef.current = ref;
            }}
            sessionId="test-terminal-ref"
            onSessionCreated={(sessionId: string) => {
              console.log('[TestTerminalRef] Session created:', sessionId);
              setTerminalMounted(true);
            }}
            fontSize={14}
            theme={{ 
              background: '#1e1e1e',
              foreground: '#d4d4d4'
            }}
          />
        </WebSocketProvider>
      </div>
    </div>
  );
};