/**
 * Service Registry - Central registry for all services
 * 
 * This provides a clean way to manage service dependencies and access them
 * throughout the application. It replaces the current app.locals pattern
 * with a more structured approach.
 * 
 * Following deep module principles: simple interface (4 methods), 
 * complex dependency management hidden inside.
 */
export class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.initialized = new Set();
  }

  /**
   * Register a service with the registry
   * @param {string} name - Service name
   * @param {Function|Object} serviceFactory - Service class or factory function
   * @param {Array} dependencies - Array of dependency names this service needs
   */
  register(name, serviceFactory, dependencies = []) {
    this.services.set(name, {
      factory: serviceFactory,
      dependencies,
      instance: null
    });
  }

  /**
   * Get a service by name, creating it if necessary
   * @param {string} name - Service name
   * @returns {Object} Service instance
   */
  get(name) {
    const serviceConfig = this.services.get(name);
    if (!serviceConfig) {
      throw new Error(`Service '${name}' not found in registry`);
    }

    // Return existing instance if already created
    if (serviceConfig.instance) {
      return serviceConfig.instance;
    }

    // Create new instance with dependencies
    const dependencies = this._resolveDependencies(serviceConfig.dependencies);
    
    // Handle both class constructors and factory functions
    if (typeof serviceConfig.factory === 'function') {
      // Check if it's a class constructor or factory function
      try {
        serviceConfig.instance = new serviceConfig.factory(...dependencies);
      } catch (error) {
        // If constructor fails, try as factory function
        serviceConfig.instance = serviceConfig.factory(...dependencies);
      }
    } else {
      // Direct object
      serviceConfig.instance = serviceConfig.factory;
    }

    this.initialized.add(name);
    return serviceConfig.instance;
  }

  /**
   * Check if a service is registered
   * @param {string} name - Service name
   * @returns {boolean} True if service is registered
   */
  hasService(name) {
    return this.services.has(name);
  }

  /**
   * Get all registered service names
   * @returns {Array<string>} Array of service names
   */
  getServiceNames() {
    return Array.from(this.services.keys());
  }

  // Private helper methods

  /**
   * Resolve dependencies for a service
   * @private
   */
  _resolveDependencies(dependencyNames) {
    const resolved = [];
    
    for (const depName of dependencyNames) {
      // Check for special dependency types first
      if (depName === 'models') {
        // Handle models dependency - comes from app.locals
        if (this.appLocals && this.appLocals.models) {
          resolved.push(this.appLocals.models);
        } else {
          throw new Error(`Models dependency not available`);
        }
      } else if (depName === 'githubTokenService') {
        // Handle githubTokenService dependency - comes from app.locals
        if (this.appLocals && this.appLocals.githubTokenService) {
          resolved.push(this.appLocals.githubTokenService);
        } else {
          throw new Error(`GitHub token service dependency not available`);
        }
      } else if (depName.startsWith('models.')) {
        // Handle models.* dependencies - these come from app.locals
        resolved.push(this._getModelsReference(depName));
      } else if (depName.startsWith('app.')) {
        // Handle app.* dependencies - these come from app.locals
        resolved.push(this._getAppReference(depName));
      } else {
        // Regular service dependency - prevent circular dependencies
        if (this.initialized.has(depName)) {
          resolved.push(this.get(depName));
        } else {
          resolved.push(this.get(depName));
        }
      }
    }
    
    return resolved;
  }

  /**
   * Get reference to models (temporary bridge while transitioning)
   * @private
   */
  _getModelsReference(depName) {
    const modelType = depName.split('.')[1];
    if (this.appLocals && this.appLocals.models) {
      return modelType ? this.appLocals.models[modelType] || this.appLocals.models : this.appLocals.models;
    }
    throw new Error(`Models dependency '${depName}' not available`);
  }

  /**
   * Get reference to app.locals (temporary bridge while transitioning)
   * @private
   */
  _getAppReference(depName) {
    const refName = depName.split('.')[1];
    if (this.appLocals) {
      return this.appLocals[refName];
    }
    throw new Error(`App dependency '${depName}' not available`);
  }

  /**
   * Set app.locals reference for transitional dependencies
   * @param {Object} appLocals - Express app.locals object
   */
  setAppLocals(appLocals) {
    this.appLocals = appLocals;
  }
}

/**
 * Middleware to add services to request object
 * @param {ServiceRegistry} serviceRegistry - The service registry instance
 * @returns {Function} Express middleware function
 */
export function serviceMiddleware(serviceRegistry) {
  return (req, res, next) => {
    req.services = serviceRegistry;
    next();
  };
}