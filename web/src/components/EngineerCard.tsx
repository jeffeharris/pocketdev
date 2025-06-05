import React from 'react';
import { Engineer } from '../types';
import { Bot, Code, Server, Package, Clock, CheckCircle, AlertCircle, ZapOff, RotateCcw } from 'lucide-react';

interface Props {
  engineer: Engineer;
  onAssignTask: () => void;
}

export function EngineerCard({ engineer, onAssignTask }: Props) {
  const handleReset = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/engineers/${engineer.id}/reset`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to reset engineer');
    } catch (error) {
      console.error('Error resetting engineer:', error);
    }
  };
  const getStatusIcon = () => {
    switch (engineer.status) {
      case 'idle': return <ZapOff className="h-5 w-5 text-gray-400" />;
      case 'thinking': return <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />;
      case 'coding': return <Code className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'testing': return <Package className="h-5 w-5 text-purple-500 animate-pulse" />;
      case 'complete': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Bot className="h-5 w-5 text-gray-400" />;
    }
  };

  const getRoleIcon = () => {
    switch (engineer.role) {
      case 'frontend': return <Code className="h-4 w-4" />;
      case 'backend': return <Server className="h-4 w-4" />;
      case 'devops': return <Package className="h-4 w-4" />;
      default: return <Bot className="h-4 w-4" />;
    }
  };

  const getStatusColor = () => {
    switch (engineer.status) {
      case 'idle': return 'bg-gray-100 text-gray-700';
      case 'thinking': return 'bg-yellow-100 text-yellow-700';
      case 'coding': return 'bg-blue-100 text-blue-700';
      case 'testing': return 'bg-purple-100 text-purple-700';
      case 'complete': return 'bg-green-100 text-green-700';
      case 'error': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
              {engineer.name.charAt(0)}
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-gray-900">{engineer.name}</h3>
              <div className="flex items-center text-sm text-gray-500">
                {getRoleIcon()}
                <span className="ml-1 capitalize">{engineer.role} Engineer</span>
              </div>
            </div>
          </div>
          {getStatusIcon()}
        </div>

        <div className="mb-4">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
            {engineer.status}
          </span>
        </div>

        {engineer.current_task && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 line-clamp-2">{engineer.current_task}</p>
          </div>
        )}

        {engineer.progress !== undefined && engineer.progress > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>Progress</span>
              <span>{engineer.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${engineer.progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onAssignTask}
            disabled={engineer.status !== 'idle'}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              engineer.status === 'idle'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {engineer.status === 'idle' ? 'Assign Task' : 
             engineer.status === 'error' ? 'Error' : 'Busy'}
          </button>
          
          {engineer.status === 'error' && (
            <button
              onClick={handleReset}
              className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-md transition-colors"
              title="Reset Engineer"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          )}
        </div>

        {engineer.last_update && (
          <p className="text-xs text-gray-400 mt-2 text-center">
            Updated {new Date(engineer.last_update).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}