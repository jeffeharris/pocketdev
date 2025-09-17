import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useSplitViewStore } from '../stores/splitViewStore';
import { handleTerminalWebSocketEvent } from '../stores/terminal/terminalStore.deep';

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WebSocketContextValue {
  status: WebSocketStatus;
  subscribe: (type: 'project' | 'task', id: string, handler: (data: any) => void) => void;
  unsubscribe: (type: 'project' | 'task', id: string, handler: (data: any) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: React.ReactNode;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  reconnectDelay = 3000,
  maxReconnectAttempts = 10
}) => {
  const [status, setStatus] = useState<WebSocketStatus>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Use relative URL for proxy support
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      
      ws.onopen = () => {
        setStatus('connected');
        reconnectAttemptsRef.current = 0;
        
        // Resubscribe to all channels
        handlersRef.current.forEach((_, channel) => {
          const [type, id] = channel.split(':');
          ws.send(JSON.stringify({
            type: 'subscribe',
            [type === 'project' ? 'projectId' : 'taskId']: id
          }));
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle split layout changes
          if (data.type === 'split-layout-changed' && data.taskId) {
            const { updateLayout } = useSplitViewStore.getState();
            if (data.data?.splitLayout) {
              updateLayout(data.taskId, data.data.splitLayout);
            }
          }
          
          // Handle terminal-related events
          const terminalEvents = [
            'terminal-created',
            'terminal-updated',
            'terminal-deleted',
            'terminal-state-changed',
            'terminal-renamed',
            'terminals-reordered'
          ];
          
          if (terminalEvents.includes(data.type) && data.taskId) {
            handleTerminalWebSocketEvent(data.type, data);
          }
          
          // Route message to appropriate handlers
          if (data.taskId) {
            const handlers = handlersRef.current.get(`task:${data.taskId}`);
            handlers?.forEach(handler => handler(data));
          }
          if (data.projectId) {
            const handlers = handlersRef.current.get(`project:${data.projectId}`);
            handlers?.forEach(handler => handler(data));
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus('error');
      };

      ws.onclose = () => {
        setStatus('disconnected');
        wsRef.current = null;

        // Attempt reconnection if under max attempts
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = window.setTimeout(connect, reconnectDelay);
        }
      };

      wsRef.current = ws;
      setStatus('connecting');
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setStatus('error');
    }
  }, [reconnectDelay, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  const subscribe = useCallback((type: 'project' | 'task', id: string, handler: (data: any) => void) => {
    const channel = `${type}:${id}`;
    
    // Add handler to the set for this channel
    if (!handlersRef.current.has(channel)) {
      handlersRef.current.set(channel, new Set());
      
      // Send subscribe message if connected
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'subscribe',
          [type === 'project' ? 'projectId' : 'taskId']: id
        }));
      }
    }
    
    handlersRef.current.get(channel)!.add(handler);
  }, []);

  const unsubscribe = useCallback((type: 'project' | 'task', id: string, handler: (data: any) => void) => {
    const channel = `${type}:${id}`;
    const handlers = handlersRef.current.get(channel);
    
    if (handlers) {
      handlers.delete(handler);
      
      // If no more handlers for this channel, unsubscribe
      if (handlers.size === 0) {
        handlersRef.current.delete(channel);
        
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'unsubscribe',
            [type === 'project' ? 'projectId' : 'taskId']: id
          }));
        }
      }
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <WebSocketContext.Provider value={{ status, subscribe, unsubscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};
