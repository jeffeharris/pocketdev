# Observability Guide

## Overview
The backend now includes built-in observability features for better debugging and monitoring.

## Features

### 1. Correlation IDs
Every request gets a unique correlation ID for tracing:
- Automatically generated or passed via `X-Correlation-ID` header
- Included in all logs and error responses
- Helps trace requests across services

### 2. Structured Logging
The Logger utility provides:
- JSON output in production
- Colored, readable output in development
- Built-in operation timing
- Context propagation

### 3. Request Logging
All HTTP requests are logged with:
- Method, path, and query parameters
- Response status and duration
- Correlation ID for tracing

## Configuration

### Environment Variables
```bash
# Log level: debug, info, warn, error
LOG_LEVEL=info

# Enable/disable request logging
LOG_REQUESTS=true

# Node environment affects log format
NODE_ENV=production  # JSON logs
NODE_ENV=development # Pretty logs
```

### Docker Compose
These variables are pre-configured in all docker-compose files:
- `docker-compose.yml`: Production defaults (info level)
- `docker-compose.dev.yml`: Development defaults (debug level)
- `docker-compose-secure.yml`: Production defaults

## Usage Examples

### In Services
```javascript
import { Logger } from '../utils/logger.js';

class MyService {
  constructor() {
    this.logger = new Logger('MyService');
  }
  
  async doSomething() {
    // Time an operation
    return await this.logger.timeOperation('operation-name', async () => {
      // ... your code
      return result;
    }, { contextData: 'value' });
  }
  
  // Regular logging
  logInfo() {
    this.logger.info('Something happened', { userId: 123 });
    this.logger.warn('Warning message', { threshold: 0.8 });
    this.logger.error('Error occurred', { error: err.message });
  }
}
```

### Finding Logs

#### Development Mode
```bash
# Pretty printed logs with colors
docker-compose logs -f backend

# Example output:
[2025-09-14T10:30:45.123Z] [INFO] GitService: git.clone completed duration_ms=2340 success=true
```

#### Production Mode
```bash
# JSON formatted for parsing
docker-compose logs backend | jq '.'

# Example output:
{
  "timestamp": "2025-09-14T10:30:45.123Z",
  "level": "info",
  "service": "GitService",
  "message": "git.clone completed",
  "duration_ms": 2340,
  "success": true,
  "correlationId": "abc-123-def"
}
```

### Tracing Requests
1. Find the correlation ID in the response header or error response
2. Search logs for that ID:
```bash
docker-compose logs backend | grep "abc-123-def"
```

## Performance Monitoring

Operations are automatically timed in:
- **GitService**: clone, sync, merge, status
- **TaskService**: create
- **ProjectService**: create, sync

Look for `duration_ms` in logs to identify slow operations.

## Debugging Tips

1. **Enable debug logging**: Set `LOG_LEVEL=debug` for verbose output
2. **Disable request logging**: Set `LOG_REQUESTS=false` to reduce noise
3. **Use correlation IDs**: Track requests across multiple services
4. **Monitor operation times**: Look for operations taking >1000ms

## Future Enhancements
- [ ] Metrics collection (Prometheus format)
- [ ] Log aggregation setup (ELK stack)
- [ ] Performance alerts
- [ ] Request sampling for high-traffic scenarios