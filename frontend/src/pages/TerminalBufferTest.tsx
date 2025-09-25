import { useState, useEffect } from 'react';
import { DirectTerminalDebug } from '../components/terminal/DirectTerminalDebug';

export function TerminalBufferTest() {
  const [sessionId, setSessionId] = useState('');
  const [taskId, setTaskId] = useState('');
  
  useEffect(() => {
    // Get first task with a terminal session
    fetch('/api/tasks')
      .then(res => res.json())
      .then(tasks => {
        const taskWithTerminal = tasks.find((t: any) => t.terminals?.length > 0);
        if (taskWithTerminal) {
          setTaskId(taskWithTerminal.id);
          setSessionId(taskWithTerminal.terminals[0].shelltenderSessionId);
          console.log('[TerminalBufferTest] Found session:', {
            taskId: taskWithTerminal.id,
            sessionId: taskWithTerminal.terminals[0].shelltenderSessionId
          });
        }
      });
  }, []);
  
  const handleClearAndReload = () => {
    console.log('[TerminalBufferTest] Clearing storage and reloading...');
    sessionStorage.clear();
    localStorage.clear();
    location.reload();
  };
  
  const handleSoftRefresh = () => {
    console.log('[TerminalBufferTest] Soft refresh - remounting component...');
    setSessionId('');
    setTimeout(() => {
      if (taskId) {
        fetch(`/api/tasks/${taskId}`)
          .then(res => res.json())
          .then(task => {
            if (task.terminals?.length > 0) {
              setSessionId(task.terminals[0].shelltenderSessionId);
            }
          });
      }
    }, 100);
  };
  
  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <h1 className="text-lg font-semibold mb-4">Terminal Buffer Test</h1>
        <div className="flex gap-4 items-center">
          <button
            onClick={handleClearAndReload}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Clear Storage & Reload
          </button>
          <button
            onClick={handleSoftRefresh}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Soft Refresh (Remount)
          </button>
          <button
            onClick={() => location.reload()}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Hard Refresh
          </button>
          <div className="text-sm text-gray-600">
            Session: {sessionId || 'Not loaded'}
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Open browser console to see debug logs
        </div>
      </div>
      
      <div className="flex-1 p-4">
        {sessionId ? (
          <div className="h-full bg-gray-900 rounded-lg overflow-hidden">
            <DirectTerminalDebug
              taskId={taskId}
              dbSessionId={sessionId}
              shelltenderSessionId={sessionId}
              onSessionStatus={(status) => {
                console.log('[TerminalBufferTest] Session status:', status);
              }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            Loading terminal session...
          </div>
        )}
      </div>
    </div>
  );
}