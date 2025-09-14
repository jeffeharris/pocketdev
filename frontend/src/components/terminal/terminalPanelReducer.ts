/**
 * Terminal Panel Reducer
 * 
 * Consolidates all state management for TerminalPanel into a single reducer.
 * This replaces 9+ separate useState calls with predictable state transitions.
 */

// State shape
export interface TerminalPanelState {
  // Core state
  activeTabId: string;
  isResetting: boolean;
  
  // UI state
  showSessionLauncher: boolean;
  confirmClose: { dbSessionId: string; tabName: string } | null;
  
  // Session tracking
  sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>;
  launchingAgents: Set<string>; // Terminal IDs that are launching AI agents
  
  // Viewport constraints
  canShowQuad: boolean;
  canShowHorizontal: boolean;
  canShowVertical: boolean;
}

// Action types
export type TerminalPanelAction =
  | { type: 'SET_ACTIVE_TAB'; tabId: string }
  | { type: 'START_RESET' }
  | { type: 'FINISH_RESET' }
  | { type: 'SHOW_SESSION_LAUNCHER' }
  | { type: 'HIDE_SESSION_LAUNCHER' }
  | { type: 'REQUEST_CLOSE_CONFIRMATION'; dbSessionId: string; tabName: string }
  | { type: 'CANCEL_CLOSE_CONFIRMATION' }
  | { type: 'UPDATE_SESSION_STATUS'; dbSessionId: string; status: 'connected' | 'disconnected' | 'error' }
  | { type: 'START_AGENT_LAUNCH'; terminalId: string }
  | { type: 'FINISH_AGENT_LAUNCH'; terminalId: string }
  | { type: 'UPDATE_VIEWPORT_CONSTRAINTS'; constraints: { quad: boolean; horizontal: boolean; vertical: boolean } }
  | { type: 'RESET_STATE' };

// Initial state factory
export function createInitialState(taskId: string): TerminalPanelState {
  // Check for saved active tab
  const savedTabId = localStorage.getItem('focusTabId') || localStorage.getItem(`activeTab-${taskId}`) || '';
  if (localStorage.getItem('focusTabId')) {
    localStorage.removeItem('focusTabId');
  }
  
  return {
    activeTabId: savedTabId,
    isResetting: false,
    showSessionLauncher: false,
    confirmClose: null,
    sessionStatuses: new Map(),
    launchingAgents: new Set(),
    canShowQuad: false,
    canShowHorizontal: false,
    canShowVertical: false,
  };
}

// Reducer function
export function terminalPanelReducer(
  state: TerminalPanelState,
  action: TerminalPanelAction
): TerminalPanelState {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeTabId: action.tabId,
      };
    
    case 'START_RESET':
      return {
        ...state,
        isResetting: true,
      };
    
    case 'FINISH_RESET':
      return {
        ...state,
        isResetting: false,
      };
    
    case 'SHOW_SESSION_LAUNCHER':
      return {
        ...state,
        showSessionLauncher: true,
      };
    
    case 'HIDE_SESSION_LAUNCHER':
      return {
        ...state,
        showSessionLauncher: false,
      };
    
    case 'REQUEST_CLOSE_CONFIRMATION':
      return {
        ...state,
        confirmClose: {
          dbSessionId: action.dbSessionId,
          tabName: action.tabName,
        },
      };
    
    case 'CANCEL_CLOSE_CONFIRMATION':
      return {
        ...state,
        confirmClose: null,
      };
    
    case 'UPDATE_SESSION_STATUS': {
      const newStatuses = new Map(state.sessionStatuses);
      newStatuses.set(action.dbSessionId, action.status);
      return {
        ...state,
        sessionStatuses: newStatuses,
      };
    }
    
    case 'START_AGENT_LAUNCH': {
      const newLaunching = new Set(state.launchingAgents);
      newLaunching.add(action.terminalId);
      return {
        ...state,
        launchingAgents: newLaunching,
      };
    }
    
    case 'FINISH_AGENT_LAUNCH': {
      const newLaunching = new Set(state.launchingAgents);
      newLaunching.delete(action.terminalId);
      return {
        ...state,
        launchingAgents: newLaunching,
      };
    }
    
    case 'UPDATE_VIEWPORT_CONSTRAINTS':
      return {
        ...state,
        canShowQuad: action.constraints.quad,
        canShowHorizontal: action.constraints.horizontal,
        canShowVertical: action.constraints.vertical,
      };
    
    case 'RESET_STATE':
      return createInitialState(''); // Will need taskId from context
    
    default:
      return state;
  }
}

// Helper selectors (optional but useful)
export const selectors = {
  isAgentLaunching: (state: TerminalPanelState, terminalId: string): boolean => {
    return state.launchingAgents.has(terminalId);
  },
  
  getSessionStatus: (state: TerminalPanelState, sessionId: string): 'connected' | 'disconnected' | 'error' | undefined => {
    return state.sessionStatuses.get(sessionId);
  },
  
  hasCloseConfirmation: (state: TerminalPanelState): boolean => {
    return state.confirmClose !== null;
  },
  
  canShowSplitMode: (state: TerminalPanelState, orientation: 'horizontal' | 'vertical'): boolean => {
    return orientation === 'horizontal' ? state.canShowHorizontal : state.canShowVertical;
  },
};