import React, { useState } from 'react';
import { XtermStressTest } from './XtermStressTest';
import { LayoutPerformanceTest } from './LayoutPerformanceTest';

export const SplitViewViabilityTests: React.FC = () => {
  const [activeTest, setActiveTest] = useState<'xterm' | 'layout' | 'results'>('xterm');

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-xl font-bold text-white mb-2">Split View Viability Testing</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTest('xterm')}
              className={`px-4 py-2 rounded transition-colors ${
                activeTest === 'xterm' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              xterm.js Stress Test
            </button>
            <button
              onClick={() => setActiveTest('layout')}
              className={`px-4 py-2 rounded transition-colors ${
                activeTest === 'layout' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Layout Performance Test
            </button>
            <button
              onClick={() => setActiveTest('results')}
              className={`px-4 py-2 rounded transition-colors ${
                activeTest === 'results' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Test Results & Analysis
            </button>
          </div>
        </div>
      </div>

      <div className="test-content">
        {activeTest === 'xterm' && <XtermStressTest />}
        {activeTest === 'layout' && <LayoutPerformanceTest />}
        {activeTest === 'results' && <TestResults />}
      </div>
    </div>
  );
};

const TestResults: React.FC = () => {
  return (
    <div className="p-6 text-white">
      <h2 className="text-2xl font-bold mb-6">Viability Test Results & Recommendations</h2>

      <div className="space-y-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-blue-400">Test 1: xterm.js Stress Test</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Maintains 30+ FPS with 4 terminals active</span>
              <span className="px-3 py-1 bg-yellow-600 rounded text-sm">PENDING</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Memory usage under 500MB for 4 terminals</span>
              <span className="px-3 py-1 bg-yellow-600 rounded text-sm">PENDING</span>
            </div>
            <div className="flex items-center justify-between">
              <span>No memory leaks after 100 create/destroy cycles</span>
              <span className="px-3 py-1 bg-yellow-600 rounded text-sm">PENDING</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Resize maintains 24+ FPS</span>
              <span className="px-3 py-1 bg-yellow-600 rounded text-sm">PENDING</span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-700 rounded">
            <p className="text-sm">
              <strong>Instructions:</strong> Run the xterm.js stress test with 4 terminals at 1000 lines/second. 
              Monitor FPS and memory usage. Also run the create/destroy test to check for memory leaks.
            </p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-blue-400">Test 2: WebSocket Scaling Test</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>All 4 connections stable for 10 minutes</span>
              <span className="px-3 py-1 bg-yellow-600 rounded text-sm">PENDING</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Message latency under 100ms per terminal</span>
              <span className="px-3 py-1 bg-yellow-600 rounded text-sm">PENDING</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total bandwidth under 1MB/s for typical AI output</span>
              <span className="px-3 py-1 bg-yellow-600 rounded text-sm">PENDING</span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-700 rounded">
            <p className="text-sm">
              <strong>Instructions:</strong> Run the WebSocket scaling test from the backend: 
              <code className="ml-2 px-2 py-1 bg-gray-800 rounded">node backend/src/tests/websocket-scaling-test.js</code>
            </p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-4 text-blue-400">Test 3: Layout Performance</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Smooth resize at 60FPS with empty terminals</span>
              <span className="px-3 py-1 bg-yellow-600 rounded text-sm">PENDING</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Acceptable resize (24+ FPS) with active content</span>
              <span className="px-3 py-1 bg-yellow-600 rounded text-sm">PENDING</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Layout calculations under 16ms</span>
              <span className="px-3 py-1 bg-yellow-600 rounded text-sm">PENDING</span>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-700 rounded">
            <p className="text-sm">
              <strong>Instructions:</strong> Test different split layouts and resize performance. 
              Initialize terminals and test resizing with active content.
            </p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border-2 border-gray-700">
          <h3 className="text-xl font-semibold mb-4 text-yellow-400">Go/No-Go Decision</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-green-400 mb-2">✅ Proceed with Full Implementation if:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All Phase 0 tests pass their success criteria</li>
                <li>POC shows acceptable performance with 2 terminals</li>
                <li>No architectural blockers discovered</li>
                <li>Memory usage stays under control</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-yellow-400 mb-2">⚠️ Pivot to Alternative Approach if:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>xterm.js can't handle multiple instances efficiently</li>
                <li>WebSocket limits are hit</li>
                <li>Performance is borderline (needs optimization first)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-red-400 mb-2">❌ Abandon Feature if:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Browser fundamentally can't handle the load</li>
                <li>Would require major architecture changes</li>
                <li>Performance is unacceptably poor</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-900 rounded">
            <p className="text-center text-lg">
              Current Recommendation: <span className="font-bold text-yellow-400">AWAITING TEST RESULTS</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};