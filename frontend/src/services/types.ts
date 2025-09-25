/**
 * TypeScript types for the service infrastructure
 * 
 * Provides strong typing for service patterns and standardizes
 * API response formats across all services.
 */

// Base API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Service operation result types
export interface ServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: ServiceError;
}

export interface ServiceError {
  message: string;
  code?: string;
  details?: any;
  status?: number;
}

// Service method patterns
export interface CrudService<T, CreateDTO = Partial<T>, UpdateDTO = Partial<T>> {
  // Read operations
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T>;
  
  // Write operations
  create(data: CreateDTO): Promise<T>;
  update(id: string, data: UpdateDTO): Promise<T>;
  delete(id: string): Promise<void>;
}

export interface ProjectScopedService<T, CreateDTO = Partial<T>, UpdateDTO = Partial<T>> {
  // Read operations
  getAll(projectId: string): Promise<T[]>;
  getById(projectId: string, id: string): Promise<T>;
  
  // Write operations
  create(projectId: string, data: CreateDTO): Promise<T>;
  update(projectId: string, id: string, data: UpdateDTO): Promise<T>;
  delete(projectId: string, id: string): Promise<void>;
}

// Service configuration types
export interface ServiceConfiguration {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  mockEnabled?: boolean;
  authRequired?: boolean;
}

// Service registry interface for strong typing
export interface IServiceRegistry {
  // Domain services (to be implemented)
  project: IProjectService;
  task: ITaskService;
  git: IGitService;
  terminal: ITerminalService;
  settings: ISettingsService;
  upload: IUploadService;
  
  // Infrastructure
  sessionAdapter: ISessionAdapter;
}

// Service interfaces (to be implemented by actual services)
export interface IProjectService extends CrudService<any> {
  getBranches(projectId: string): Promise<string[]>;
  pullBaseBranch(projectId: string): Promise<ServiceResult>;
  pushBaseBranch(projectId: string): Promise<ServiceResult>;
  getDashboard(projectId: string): Promise<any>;
  refreshStatus(projectId: string): Promise<ServiceResult>;
}

export interface ITaskService extends ProjectScopedService<any> {
  archive(projectId: string, taskId: string): Promise<void>;
  getCommitHistory(projectId: string, taskId: string): Promise<any[]>;
  checkConflicts(taskId: string): Promise<boolean>;
  updateBranch(projectId: string, taskId: string): Promise<ServiceResult>;
  mergeToBase(projectId: string, taskId: string): Promise<ServiceResult>;
}

export interface IGitService {
  getStatus(projectId: string, taskId: string): Promise<any>;
  getChangedFiles(projectId: string, taskId: string): Promise<any[]>;
  getAllChanges(projectId: string, taskId: string): Promise<any>;
  getDiff(projectId: string, taskId: string, compareWith?: string): Promise<any>;
  getFileDiff(projectId: string, taskId: string, filePath: string, compareWith?: string): Promise<any>;
  stageFile(projectId: string, taskId: string, filePath: string): Promise<ServiceResult>;
  unstageFile(projectId: string, taskId: string, filePath: string): Promise<ServiceResult>;
  commit(projectId: string, taskId: string, message: string, files?: string[]): Promise<ServiceResult>;
  createPR(taskId: string, description: string): Promise<any>;
}

export interface ITerminalService {
  getSessions(taskId: string): Promise<any[]>;
  createSession(taskId: string, options: any): Promise<any>;
  updateTab(sessionId: string, updates: any): Promise<any>;
  deleteSession(sessionId: string): Promise<void>;
  executeCommand(sessionId: string, command: string): Promise<void>;
}

export interface ISettingsService {
  get(): Promise<any>;
  update(settings: any): Promise<ServiceResult>;
  testGithubToken(): Promise<any>;
  getSystemInfo(): Promise<any>;
}

export interface IUploadService {
  getTaskImages(projectId: string, taskId: string): Promise<any>;
  uploadTaskImage(projectId: string, taskId: string, formData: FormData): Promise<any>;
  deleteTaskImage(projectId: string, taskId: string, filename: string): Promise<void>;
}

export interface IContainerService {
  deployContainers(taskId: string): Promise<any>;
  stopContainers(taskId: string): Promise<void>;
  getContainerLogs(taskId: string): Promise<string[]>;
}

export interface ISessionAdapter {
  registerSession(terminalSession: any): string;
  getSessionInfo(normalizedId: string): any;
  findSessionByAnyId(anyId: string): any;
  normalize(anyId: string): string | null;
  getDbSessionId(normalizedId: string): string | null;
  getShelltenderSessionId(normalizedId: string): string | null;
  getAllSessions(): any[];
  updateSession(normalizedId: string, updates: any): boolean;
  removeSession(normalizedId: string): boolean;
  clear(): void;
}

// Hook types
export type ServiceHook<T extends keyof IServiceRegistry> = () => IServiceRegistry[T];

// Service provider types
export interface ServiceProviderConfig {
  mockEnabled?: boolean;
  baseUrl?: string;
  services?: Partial<IServiceRegistry>;
}

// Validation types for service methods
export interface ValidationRule {
  field: string;
  type: 'required' | 'email' | 'minLength' | 'maxLength' | 'pattern';
  value?: any;
  message?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

// Event types for service communication
export interface ServiceEvent<T = any> {
  type: string;
  source: string;
  data: T;
  timestamp: number;
}

export type ServiceEventHandler<T = any> = (event: ServiceEvent<T>) => void;

// Cache types for service data
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheOptions {
  ttl?: number;
  key?: string;
  invalidateOn?: string[];
}

// Service state types
export interface ServiceState {
  loading: boolean;
  error: ServiceError | null;
  initialized: boolean;
  lastFetch?: number;
}

// Service metrics for monitoring
export interface ServiceMetrics {
  requests: number;
  errors: number;
  averageResponseTime: number;
  lastRequest?: number;
  lastError?: number;
}

// Environment-specific service configuration
export interface EnvironmentConfig {
  development: ServiceConfiguration;
  test: ServiceConfiguration;
  production: ServiceConfiguration;
}

// Service dependency injection types
export type ServiceFactory<T> = (config: ServiceConfiguration) => T;
export type ServiceDependencies = Record<string, any>;

// Mock service types
export interface MockServiceOptions {
  enabled: boolean;
  delay?: number;
  errorRate?: number;
  customData?: Record<string, any>;
}

export interface MockService<T> {
  getMockData(): T;
  setMockData(data: T): void;
  resetMockData(): void;
  simulateError(shouldError: boolean): void;
}