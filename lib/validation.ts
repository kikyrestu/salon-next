import { NextResponse } from 'next/server';

// Sanitize input to prevent XSS and injection attacks
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove potentially harmful characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove iframe tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
}

// Validate email format
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone number format
export function validatePhone(phone: string): boolean {
  // Allow various phone number formats (at least 5 digits/characters)
  const phoneDigits = phone.replace(/\D/g, '');
  return phoneDigits.length >= 5 && phoneDigits.length <= 15;
}

// Validate required fields
export function validateRequiredFields(obj: Record<string, any>, requiredFields: string[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of requiredFields) {
    if (!obj[field]) {
      errors.push(`${field} is required`);
    } else if (typeof obj[field] === 'string' && obj[field].trim() === '') {
      errors.push(`${field} cannot be empty`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Validate number range
export function validateNumberRange(value: number, min?: number, max?: number): boolean {
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

// Sanitize object inputs
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sanitized: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        typeof item === 'string' ? sanitizeInput(item) : sanitizeObject(item)
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Create validation middleware
export function validateAndSanitize(
  body: any,
  rules: {
    required?: string[];
    email?: string[];
    phone?: string[];
    numberRange?: { field: string; min?: number; max?: number }[];
    maxLength?: { field: string; length: number }[];
    minLength?: { field: string; length: number }[];
    custom?: { field: string; validator: (value: any) => boolean; message: string }[];
  }
): { isValid: boolean; errors: string[]; sanitizedData: any } {

  const errors: string[] = [];
  let sanitizedData = { ...body };

  // Sanitize all string inputs
  sanitizedData = sanitizeObject(sanitizedData);

  // Validate required fields
  if (rules.required) {
    const requiredValidation = validateRequiredFields(sanitizedData, rules.required);
    if (!requiredValidation.isValid) {
      errors.push(...requiredValidation.errors);
    }
  }

  // Validate email fields
  if (rules.email && Array.isArray(rules.email)) {
    for (const field of rules.email) {
      if (sanitizedData[field] && !validateEmail(sanitizedData[field])) {
        errors.push(`${field} must be a valid email address`);
      }
    }
  }

  // Validate phone fields
  if (rules.phone && Array.isArray(rules.phone)) {
    for (const field of rules.phone) {
      if (sanitizedData[field] && !validatePhone(sanitizedData[field])) {
        errors.push(`${field} must be a valid phone number`);
      }
    }
  }

  // Validate number ranges
  if (rules.numberRange && Array.isArray(rules.numberRange)) {
    for (const rangeRule of rules.numberRange) {
      const value = sanitizedData[rangeRule.field];
      if (value !== undefined && value !== null && typeof value === 'number') {
        if (!validateNumberRange(value, rangeRule.min, rangeRule.max)) {
          const minText = rangeRule.min !== undefined ? `minimum value ${rangeRule.min}` : '';
          const maxText = rangeRule.max !== undefined ? `maximum value ${rangeRule.max}` : '';
          const separator = rangeRule.min !== undefined && rangeRule.max !== undefined ? ' and ' : '';
          errors.push(`${rangeRule.field} must be ${minText}${separator}${maxText}`);
        }
      }
    }
  }

  // Validate max length
  if (rules.maxLength && Array.isArray(rules.maxLength)) {
    for (const lengthRule of rules.maxLength) {
      const value = sanitizedData[lengthRule.field];
      if (typeof value === 'string' && value.length > lengthRule.length) {
        errors.push(`${lengthRule.field} must not exceed ${lengthRule.length} characters`);
      }
    }
  }

  // Validate min length
  if (rules.minLength && Array.isArray(rules.minLength)) {
    for (const lengthRule of rules.minLength) {
      const value = sanitizedData[lengthRule.field];
      if (typeof value === 'string' && value.length < lengthRule.length) {
        errors.push(`${lengthRule.field} must be at least ${lengthRule.length} characters`);
      }
    }
  }

  // Custom validations
  if (rules.custom && Array.isArray(rules.custom)) {
    for (const customRule of rules.custom) {
      if (customRule.validator(sanitizedData[customRule.field])) {
        errors.push(customRule.message);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData
  };
}

// Response helper for validation errors
export function validationErrorResponse(errors: string[]) {
  return NextResponse.json(
    {
      success: false,
      error: 'Validation failed',
      details: errors
    },
    { status: 400 }
  );
}