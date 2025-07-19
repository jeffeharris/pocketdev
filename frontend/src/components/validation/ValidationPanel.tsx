import React from 'react';
import { Play, Square, Monitor } from 'lucide-react';

interface ValidationPanelProps {
  taskId: string;
  onClose: () => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({ taskId, onClose }) => {
  return (
    <div className="absolute inset-0 bg-white flex flex-col">
      {/* Validation Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Monitor className="w-5 h-5" />
            <div>
              <h3 className="font-semibold">Validation: Task {taskId}</h3>
              <p className="text-sm text-purple-200">Test your changes in isolated containers</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="px-3 py-1 bg-purple-700 hover:bg-purple-800 rounded text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Validation Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Deploy Controls */}
        <div className="w-80 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
          <h4 className="font-medium text-gray-900 mb-3">Deploy & Test</h4>
          <div className="space-y-2">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <Play className="w-4 h-4" />
              Deploy Containers
            </button>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700">
              <Square className="w-4 h-4" />
              Stop All
            </button>
          </div>
          
          {/* Service placeholders */}
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3">Services</h4>
            <div className="space-y-2">
              <div className="bg-white rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">web-app</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">running</span>
                </div>
                <div className="text-sm text-gray-500">Port 9001</div>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Preview */}
        <div className="flex-1 p-4">
          <h4 className="font-medium text-gray-900 mb-3">Live Preview</h4>
          <div className="border-2 border-dashed border-gray-300 rounded-lg h-full bg-gray-50 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Monitor className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Deploy containers to see preview</p>
            </div>
          </div>
        </div>

        {/* Right: Logs */}
        <div className="w-80 border-l border-gray-200 p-4">
          <h4 className="font-medium text-gray-900 mb-3">Container Logs</h4>
          <div className="bg-gray-900 rounded-lg overflow-hidden h-full p-3 font-mono text-sm text-green-400">
            <div>💤 Waiting for deployment...</div>
          </div>
        </div>
      </div>
    </div>
  );
};