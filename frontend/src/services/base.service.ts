/**
 * BaseService - Abstract base class for all domain services
 * 
 * Provides common functionality:
 * - Typed fetch wrapper with error handling
 * - Automatic mock data support
 * - Consistent API response handling
 * - Authentication headers (when needed)
 */

// Service Error types
export class ServiceError extends Error {
  public readonly status: number;
  public readonly response?: any;

  constructor(message: string, status: number, response?: any) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
    this.response = response;
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string, response?: any) {
    super(message, 400, response);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(message: string, response?: any) {
    super(message, 404, response);
    this.name = 'NotFoundError';
  }
}

export class NetworkError extends ServiceError {
  constructor(message: string, response?: any) {
    super(message, 0, response);
    this.name = 'NetworkError';
  }
}

// Base service configuration
interface ServiceConfig {
  baseUrl?: string;
  mockEnabled?: boolean;
}

/**
 * Abstract base service that all domain services extend
 */
export abstract class BaseService {
  protected readonly baseUrl: string;
  protected readonly mockEnabled: boolean;

  constructor(config: ServiceConfig = {}) {
    this.baseUrl = config.baseUrl || '/api';
    this.mockEnabled = config.mockEnabled ?? (import.meta.env.VITE_USE_MOCKS === 'true');
  }

  /**
   * Typed fetch wrapper with comprehensive error handling
   */
  protected async fetch<T>(url: string, options?: RequestInit): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      // Handle empty responses (204 No Content)
      if (response.status === 204) {
        return undefined as T;
      }

      return response.json();
    } catch (error) {
      if (error instanceof ServiceError) {
        throw error;
      }
      
      // Network or other errors
      throw new NetworkError(
        error instanceof Error ? error.message : 'Network request failed'
      );
    }
  }

  /**
   * Handle error responses and convert to appropriate error types
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: any;
    
    try {
      errorData = await response.json();
    } catch {
      errorData = { error: response.statusText };
    }

    const message = errorData.error || errorData.message || `API Error: ${response.statusText}`;

    switch (response.status) {
      case 400:
        throw new ValidationError(message, errorData);
      case 404:
        throw new NotFoundError(message, errorData);
      default:
        throw new ServiceError(message, response.status, errorData);
    }
  }

  /**
   * GET request helper
   */
  protected get<T>(url: string, options?: RequestInit): Promise<T> {
    return this.fetch<T>(url, { ...options, method: 'GET' });
  }

  /**
   * POST request helper
   */
  protected post<T>(url: string, data?: any, options?: RequestInit): Promise<T> {
    return this.fetch<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request helper
   */
  protected put<T>(url: string, data?: any, options?: RequestInit): Promise<T> {
    return this.fetch<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH request helper
   */
  protected patch<T>(url: string, data?: any, options?: RequestInit): Promise<T> {
    return this.fetch<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request helper
   */
  protected delete<T>(url: string, options?: RequestInit): Promise<T> {
    return this.fetch<T>(url, { ...options, method: 'DELETE' });
  }

  /**
   * Upload helper for multipart/form-data
   */
  protected async upload<T>(url: string, formData: FormData, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      method: 'POST',
      body: formData,
      // Don't set Content-Type - let browser handle multipart boundary
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response.json();
  }

  /**
   * Check if mocks are enabled for this service
   */
  protected get isMockEnabled(): boolean {
    return this.mockEnabled;
  }

  /**
   * Abstract method to initialize mock data
   * Services should override this if they provide mock functionality
   */
  protected initializeMockData?(): void;
}