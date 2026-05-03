import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  createErrorResponse, 
  handleApiError, 
  handleValidationError, 
  handleNotFoundError, 
  handleUnauthorizedError, 
  handleForbiddenError 
} from '@/lib/errorHandler';
import { NextResponse } from 'next/server';

// Mock NextResponse.json to just return its arguments for easy inspection
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, init }))
  }
}));

describe('createErrorResponse', () => {
  it('returns formatted error object without details by default', () => {
    const response = createErrorResponse(400, 'Bad Request') as any;
    expect(response.init.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Bad Request');
    expect(response.body.details).toBeUndefined();
  });

  it('includes details in development when explicitly allowed', () => {
    // NODE_ENV is set to 'test' in vitest.setup.ts, temporarily change to development
    vi.stubEnv('NODE_ENV', 'development');
    
    const details = { field: 'required' };
    const response = createErrorResponse(400, 'Bad Request', true, details) as any;
    
    expect(response.body.details).toEqual(details);
    
    // Restore
    vi.unstubAllEnvs();
  });

  it('hides details in production even if requested', () => {
    vi.stubEnv('NODE_ENV', 'production');
    
    const details = { dbQuery: 'SELECT * FROM users' };
    const response = createErrorResponse(500, 'Server Error', true, details) as any;
    
    expect(response.body.details).toBeUndefined();
    
    // Restore
    vi.unstubAllEnvs();
  });
});

describe('handleApiError', () => {
  let consoleSpy: any;
  
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('handles ValidationError', () => {
    const error = new Error('Invalid input');
    error.name = 'ValidationError';
    
    const response = handleApiError('TestContext', error) as any;
    expect(response.init.status).toBe(400);
    expect(response.body.error).toBe('Validation error occurred');
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('handles MongoError', () => {
    const error = new Error('Database disconnected');
    error.name = 'MongoError';
    
    const response = handleApiError('TestContext', error) as any;
    expect(response.init.status).toBe(400);
    expect(response.body.error).toBe('Database error occurred');
  });

  it('handles duplicate entry error (code 11000)', () => {
    const error: any = new Error('Duplicate key');
    error.code = 11000;
    
    const response = handleApiError('TestContext', error) as any;
    expect(response.init.status).toBe(400);
    expect(response.body.error).toBe('Duplicate entry error');
  });

  it('handles generic errors as 500 Internal Server Error', () => {
    const error = new TypeError('Cannot read property of undefined');
    
    const response = handleApiError('TestContext', error) as any;
    expect(response.init.status).toBe(500);
    expect(response.body.error).toBe('Internal server error occurred');
  });
});

describe('Specific error handlers', () => {
  it('handleValidationError formats correctly', () => {
    const response = handleValidationError(['Name required', 'Email invalid']) as any;
    expect(response.init.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
    expect(response.body.details).toBeUndefined(); // Details are false by default in handleValidationError
  });

  it('handleNotFoundError formats correctly', () => {
    const response = handleNotFoundError('Customer') as any;
    expect(response.init.status).toBe(404);
    expect(response.body.error).toBe('Customer not found');
  });

  it('handleUnauthorizedError formats correctly', () => {
    const response = handleUnauthorizedError() as any;
    expect(response.init.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized access');
  });

  it('handleForbiddenError formats correctly', () => {
    const response = handleForbiddenError() as any;
    expect(response.init.status).toBe(403);
    expect(response.body.error).toBe('Access forbidden');
  });
});
