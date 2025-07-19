import React, { useState } from 'react';
import { StatusBadge } from '../components/diff/StatusBadge';
import type { FileStatusType } from '../components/diff/StatusBadge';
import { StatusBadge2, STATUS_EXAMPLES } from '../components/diff/StatusBadge2';
import { StatusIcon, STATUS_PRIORITY } from '../components/diff/StatusIcon';
import { StatusIcon2, STATUS_LEGEND } from '../components/diff/StatusIcon2';
import { ThreeStateToggle } from '../components/diff/ThreeStateToggle';
import type { ToggleOption } from '../components/diff/ThreeStateToggle';
import { SearchInput, HighlightedPath } from '../components/diff/SearchInput';
import { parseFileStatuses } from '../utils/status-utils';

export const ComponentPlayground: React.FC = () => {
  const [toggleValue, setToggleValue] = useState<ToggleOption>('working');
  const [searchValue, setSearchValue] = useState('');
  
  const testFiles = [
    { path: '/frontend/src/components/diff/StatusBadge.tsx', status: 'A ', additions: 156, deletions: 0 },
    { path: '/frontend/src/components/diff/SearchInput.tsx', status: 'M ', additions: 23, deletions: 18 },
    { path: '/frontend/src/components/diff/ThreeStateToggle.tsx', status: ' M', additions: 45, deletions: 12 },
    { path: '/backend/services/new-service.js', status: '??', additions: 89, deletions: 0 },
    { path: '/frontend/src/types/diff.ts', status: 'MM', additions: 34, deletions: 28 },
    { path: '/frontend/src/utils/old-util.ts', status: 'D ', additions: 0, deletions: 145 },
    { path: '/backend/deprecated.js', status: ' D', additions: 0, deletions: 67 },
  ];
  
  const filteredFiles = testFiles.filter(file => 
    !searchValue || file.path.toLowerCase().includes(searchValue.toLowerCase())
  );
  
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold mb-8">Component Playground</h1>
      
      {/* StatusBadge Examples */}
      <section>
        <h2 className="text-xl font-semibold mb-4">StatusBadge Component</h2>
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <span>Single Status - Staged:</span>
            <StatusBadge statuses={['staged']} />
          </div>
          <div className="flex items-center justify-between">
            <span>Single Status - Modified:</span>
            <StatusBadge statuses={['unstaged']} />
          </div>
          <div className="flex items-center justify-between">
            <span>Single Status - Untracked:</span>
            <StatusBadge statuses={['untracked']} />
          </div>
          <div className="flex items-center justify-between">
            <span>Single Status - Committed:</span>
            <StatusBadge statuses={['committed']} />
          </div>
          <div className="flex items-center justify-between">
            <span>Single Status - Deleted:</span>
            <StatusBadge statuses={['deleted']} />
          </div>
          <div className="flex items-center justify-between">
            <span>Multiple Statuses (common case):</span>
            <StatusBadge statuses={['staged', 'unstaged']} />
          </div>
          <div className="flex items-center justify-between">
            <span>Deleted + Staged:</span>
            <StatusBadge statuses={['staged', 'deleted']} />
          </div>
        </div>
      </section>

      {/* StatusIcon2 - View-based Icons */}
      <section>
        <h2 className="text-xl font-semibold mb-4">StatusIcon2 - Staged vs Unstaged View</h2>
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 mb-4">
            Clear indication of staged vs unstaged. Icons change based on current view mode.
          </p>
          
          {/* View mode examples */}
          <div className="space-y-4">
            {(['working', 'all', 'base'] as const).map(mode => (
              <div key={mode} className="p-3 bg-white border border-gray-200 rounded">
                <h3 className="text-sm font-medium mb-3 capitalize">{mode} View</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { code: 'M ', desc: 'Staged only' },
                    { code: ' M', desc: 'Unstaged only' },
                    { code: 'MM', desc: 'Both staged & unstaged' },
                    { code: '??', desc: 'Untracked' },
                    { code: 'UU', desc: 'Conflict' }
                  ].map(item => (
                    <div key={item.code} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <StatusIcon2 gitStatus={item.code} viewMode={mode} />
                      <div className="text-xs">
                        <code className="font-mono bg-gray-200 px-1 rounded">{item.code}</code>
                        <span className="text-gray-600 ml-1">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* StatusIcon - Priority-based Icons */}
      <section>
        <h2 className="text-xl font-semibold mb-4">StatusIcon - Priority Icons (Recommended)</h2>
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 mb-4">
            Shows only the highest priority status as an icon. Green dot indicates additional staged changes.
          </p>
          
          {/* Priority explanation */}
          <div className="mb-6 p-3 bg-white border border-gray-200 rounded">
            <h3 className="text-sm font-medium mb-2">Priority Order:</h3>
            <div className="flex items-center gap-4 text-xs">
              {STATUS_PRIORITY.map((item, index) => (
                <div key={item.status} className="flex items-center gap-1">
                  <StatusIcon gitStatus={item.example} size="sm" showTooltip={false} />
                  <span className="text-gray-600">{item.status}</span>
                  {index < STATUS_PRIORITY.length - 1 && <span className="text-gray-400">{'>'}</span>}
                </div>
              ))}
            </div>
          </div>
          
          {/* Examples grid */}
          <div className="grid grid-cols-2 gap-3">
            {STATUS_EXAMPLES.map((example) => (
              <div key={example.code} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded">
                <div className="flex items-center gap-3">
                  <StatusIcon gitStatus={example.code} size="md" />
                  <div>
                    <code className="text-sm font-mono bg-gray-100 px-1 rounded">{example.code}</code>
                    <p className="text-xs text-gray-600 mt-0.5">{example.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Size comparison */}
          <div className="mt-4 p-3 bg-white border border-gray-200 rounded">
            <h3 className="text-sm font-medium mb-2">Size Options:</h3>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <StatusIcon gitStatus="MM" size="sm" />
                <span className="text-sm text-gray-600">Small (default)</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon gitStatus="MM" size="md" />
                <span className="text-sm text-gray-600">Medium</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Simplified StatusBadge2 */}
      <section>
        <h2 className="text-xl font-semibold mb-4">StatusBadge2 - Simplified Version</h2>
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600 mb-4">
            Single badge per file showing the most important status. Mixed states show "+S" indicator.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {STATUS_EXAMPLES.map((example) => (
              <div key={example.code} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                <div>
                  <code className="text-sm font-mono bg-gray-100 px-1 rounded">{example.code}</code>
                  <span className="text-sm text-gray-600 ml-2">{example.description}</span>
                </div>
                <StatusBadge2 gitStatus={example.code} />
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* ThreeStateToggle */}
      <section>
        <h2 className="text-xl font-semibold mb-4">ThreeStateToggle Component</h2>
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800 mb-4">
            <strong>Implementation Note:</strong> When integrating, wrap in a flex container with justify-start to prevent stretching. 
            The toggle should maintain its intrinsic width based on content.
          </div>
          <div>
            <p className="mb-2">Normal state:</p>
            <div className="flex items-center"> {/* This wrapper prevents stretching */}
              <ThreeStateToggle value={toggleValue} onChange={setToggleValue} />
            </div>
            <p className="mt-2 text-sm text-gray-600">Current value: {toggleValue}</p>
          </div>
          <div>
            <p className="mb-2">With disabled option (Working Tree):</p>
            <div className="flex items-center">
              <ThreeStateToggle 
                value={toggleValue} 
                onChange={setToggleValue}
                disabledOptions={['working']}
              />
            </div>
          </div>
          <div>
            <p className="mb-2">Fully disabled:</p>
            <div className="flex items-center">
              <ThreeStateToggle 
                value={toggleValue} 
                onChange={setToggleValue}
                disabled
              />
            </div>
          </div>
        </div>
      </section>
      
      {/* SearchInput */}
      <section>
        <h2 className="text-xl font-semibold mb-4">SearchInput Component</h2>
        <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
          <div>
            <p className="mb-2">With {testFiles.length} files (threshold: 5):</p>
            <SearchInput 
              value={searchValue}
              onChange={setSearchValue}
              totalItems={testFiles.length}
              placeholder="Search files..."
            />
          </div>
          
          {/* File list with highlights */}
          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-medium mb-2">Example file list with StatusIcon:</h3>
            {filteredFiles.map((file, index) => {
              return (
                <div key={index} className="flex items-center gap-3 p-3 bg-white rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                  <StatusIcon gitStatus={file.status} size="sm" />
                  <div className="flex-1 min-w-0">
                    <HighlightedPath 
                      path={file.path}
                      searchTerm={searchValue}
                      className="text-sm font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-green-600">+{file.additions}</span>
                    <span className="text-red-600">-{file.deletions}</span>
                  </div>
                </div>
              );
            })}
            {filteredFiles.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                No files match '{searchValue}'
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};