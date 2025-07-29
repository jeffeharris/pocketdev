import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
}

export function renderWithRouter(
  ui: ReactElement,
  { route = '/', ...renderOptions }: CustomRenderOptions = {}
) {
  window.history.pushState({}, 'Test page', route);

  return render(
    <BrowserRouter>
      {ui}
    </BrowserRouter>,
    renderOptions
  );
}

// Re-export everything from React Testing Library except render
export { 
  screen, 
  fireEvent, 
  waitFor, 
  within,
  cleanup,
  act,
  renderHook,
  waitForElementToBeRemoved,
  queryByAttribute,
  queryAllByAttribute,
  getByAttribute,
  getAllByAttribute,
  findByAttribute,
  findAllByAttribute
} from '@testing-library/react';

// Mock data generators for tests
export const createMockTerminal = (overrides?: Partial<any>) => ({
  sessionId: 'test-session-1',
  dbSessionId: 'test-db-session-1',
  tabName: 'Test Terminal',
  tabOrder: 0,
  aiState: 'idle',
  isActive: true,
  createdAt: new Date().toISOString(),
  lastActivity: new Date().toISOString(),
  ...overrides
});

export const createMockTask = (overrides?: Partial<any>) => ({
  id: 'test-task-1',
  projectId: 'test-project-1',
  name: 'Test Task',
  description: 'Test task description',
  status: 'open',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const createMockProject = (overrides?: Partial<any>) => ({
  id: 'test-project-1',
  name: 'Test Project',
  repositoryUrl: 'https://github.com/test/repo',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

// Helper to wait for async updates
export const waitForNextUpdate = () => 
  new Promise(resolve => setTimeout(resolve, 0));

// Helper to mock fetch responses
export const mockFetchResponse = (data: any, options?: ResponseInit) => {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => data,
    ...options
  } as Response);
};

// Helper to create mock WebSocket
export class MockWebSocket {
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send(data: string | ArrayBuffer | Blob | ArrayBufferView) {
    // Mock send implementation
  }

  close(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code, reason }));
    }
  }

  simulateMessage(data: any) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }
}