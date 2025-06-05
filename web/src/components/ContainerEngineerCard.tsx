import React from 'react';
import { Engineer } from '../types';
import { Bot, Code, Server, Package, Clock, CheckCircle, AlertCircle, ZapOff, RotateCcw, Container } from 'lucide-react';

interface Props {
  engineer: Engineer & { containerized?: boolean };
  onAssignTask: () => void;
}

export function ContainerEngineerCard({ engineer, onAssignTask }: Props) {
  const handleReset = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/container/engineers/${engineer.id}/reset`, {
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
      case 'busy': return <Clock className="h-5 w-5 text-yellow-500 animate-pulse" />;
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
      case 'busy': return 'bg-yellow-100 text-yellow-700';
      case 'error': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 border-2 border-blue-200">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-full flex items-center justify-center text-white font-semibold relative">
              {engineer.name.charAt(0)}
              <Container className="h-4 w-4 absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 text-blue-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-gray-900">{engineer.name}</h3>
              <div className="flex items-center text-sm text-gray-500">
                {getRoleIcon()}
                <span className="ml-1 capitalize">{engineer.role} Engineer</span>
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Container</span>
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

        {engineer.currentTaskDetails && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 line-clamp-2">
              {engineer.currentTaskDetails.description || engineer.currentTaskDetails.task}
            </p>
            {engineer.currentTaskDetails.repository && (
              <p className="text-xs text-gray-500 mt-1">
                📁 {engineer.currentTaskDetails.repository.url.split('/').slice(-2).join('/')}
              </p>
            )}
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
            {engineer.status === 'idle' ? 'Assign Container Task' : 
             engineer.status === 'error' ? 'Error' : 'Running in Container'}
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

        <div className="mt-3 text-xs text-gray-500 flex items-center justify-between">
          <span className="flex items-center">
            <Container className="h-3 w-3 mr-1" />
            Isolated Environment
          </span>
          {engineer.taskHistory && engineer.taskHistory.length > 0 && (
            <span>{engineer.taskHistory.length} tasks completed</span>
          )}
        </div>
      </div>
    </div>
  );
}