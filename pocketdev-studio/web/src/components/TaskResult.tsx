import React from 'react';
import { X, FileText, Download, Check } from 'lucide-react';

interface Props {
  result: any;
  onClose: () => void;
}

export function TaskResult({ result, onClose }: Props) {
  if (!result) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Task Completed</h2>
              <p className="text-sm text-gray-500 mt-1">
                Cost: ${result.cost?.toFixed(4) || '0.00'} | 
                Duration: {Math.round((result.duration_ms || 0) / 1000)}s
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Files Created */}
          {result.savedFiles && result.savedFiles.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                Files Created ({result.savedFiles.length})
              </h3>
              <div className="space-y-2">
                {result.savedFiles.map((file: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium">{file.filename}</p>
                        <p className="text-sm text-gray-500">
                          {file.language} • {file.size} bytes
                        </p>
                      </div>
                    </div>
                    <button className="p-2 hover:bg-gray-200 rounded">
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Claude's Response */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Claude's Response</h3>
            <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
              <pre className="whitespace-pre-wrap text-sm">
                {result.result || 'No response'}
              </pre>
            </div>
          </div>

          {/* Session Info */}
          {result.sessionId && (
            <div className="mt-4 text-sm text-gray-500">
              Session ID: {result.sessionId}
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}