import React from 'react';
import { Terminal } from '@shelltender/client';

export const TestTerminalImport: React.FC = () => {
  console.log('[TestTerminalImport] Terminal component:', Terminal);
  console.log('[TestTerminalImport] Terminal type:', typeof Terminal);
  console.log('[TestTerminalImport] Terminal.displayName:', Terminal?.displayName);
  console.log('[TestTerminalImport] Is ForwardRef?:', Terminal?.$$typeof === Symbol.for('react.forward_ref'));
  
  // Check if it's wrapped in another way
  const terminalStr = Terminal?.toString();
  console.log('[TestTerminalImport] Terminal.toString():', terminalStr);
  
  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">Terminal Import Test</h2>
      <p>Check browser console for Terminal component details</p>
      <pre className="bg-gray-100 p-2 rounded mt-2">
        {JSON.stringify({
          type: typeof Terminal,
          displayName: Terminal?.displayName,
          isForwardRef: Terminal?.$$typeof === Symbol.for('react.forward_ref'),
          keys: Terminal ? Object.keys(Terminal) : []
        }, null, 2)}
      </pre>
    </div>
  );
};