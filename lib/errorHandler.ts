import { NextResponse } from 'next/server';

// Centralized error handler to prevent information disclosure
export function createErrorResponse(status: number, error: string, showDetails: boolean = false, details?: any) {
  const response: any = {
    success: false,
    error: error
  };

  // Only include details in development or when explicitly allowed
  if (showDetails && process.env.NODE_ENV === 'development' && details) {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

// Safe error logger that doesn't expose sensitive information
export function logError(context: string, error: any, userId?: string) {
  // Log the error for internal debugging
  console.error(`[${context}] Error:`, {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    userId: userId,
    timestamp: new Date().toISOString()
  });
}

// Generic error handler that sanitizes error messages
export function handleApiError(context: string, error: any, userId?: string) {
  // Log the actual error internally
  logError(context, error, userId);

  // Return a generic error message to the client
  if (error.name === 'ValidationError') {
    return createErrorResponse(400, 'Validation error occurred', false);
  } else if (error.code === 11000) {
    return createErrorResponse(400, 'Duplicate entry error', false);
  } else if (error.name === 'MongoServerError' || error.name === 'MongoError') {
    return createErrorResponse(400, 'Database error occurred', false);
  } else {
    return createErrorResponse(500, 'Internal server error occurred', false);
  }
}

// Specific error handlers for different scenarios
export function handleValidationError(errors: string[]) {
  return createErrorResponse(400, 'Validation failed', false, { errors });
}

export function handleNotFoundError(entity: string) {
  return createErrorResponse(404, `${entity} not found`, false);
}

export function handleUnauthorizedError() {
  return createErrorResponse(401, 'Unauthorized access', false);
}

export function handleForbiddenError() {
  return createErrorResponse(403, 'Access forbidden', false);
}