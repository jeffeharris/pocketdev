import React from 'react';
import { GitBranch, Plus, FileText } from 'lucide-react';

interface MergePanelProps {
  taskId: string;
  onClose: () => void;
}

export const MergePanel: React.FC<MergePanelProps> = ({ taskId, onClose }) => {
  return (
    <div className="absolute inset-0 bg-white flex flex-col">
      {/* Merge Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5" />
            <div>
              <h3 className="font-semibold">Merge: Task {taskId}</h3>
              <p className="text-sm text-green-200">Create pull request and manage merge</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="px-3 py-1 bg-green-700 hover:bg-green-800 rounded text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Merge Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Merge Controls */}
        <div className="w-80 border-r border-gray-200 bg-gray-50 p-4 overflow-y-auto">
          <h4 className="font-medium text-gray-900 mb-3">Pull Request</h4>
          <div className="space-y-2">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              <Plus className="w-4 h-4" />
              Create PR
            </button>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <GitBranch className="w-4 h-4" />
              Auto-Merge
            </button>
          </div>
          
          {/* Changed Files */}
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3">Changed Files</h4>
            <div className="space-y-1">
              <button className="w-full p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-sm font-mono text-gray-900 truncate">src/components/TaskCard.tsx</span>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-green-600">+23</span>
                  <span className="text-red-600">-5</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Diff Viewer */}
        <div className="flex-1 p-4">
          <h4 className="font-medium text-gray-900 mb-3">File Changes</h4>
          <div className="border border-gray-200 rounded-lg h-full bg-white overflow-hidden flex items-center justify-center">
            <div className="text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Select a file to view changes</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};