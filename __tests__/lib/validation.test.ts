import { describe, it, expect } from 'vitest';
import {
  sanitizeInput,
  validateEmail,
  validatePhone,
  validateRequiredFields,
  validateNumberRange,
  sanitizeObject,
  validateAndSanitize,
} from '@/lib/validation';

describe('sanitizeInput', () => {
  it('removes script tags', () => {
    const input = 'Hello <script>alert("xss")</script> World';
    expect(sanitizeInput(input)).toBe('Hello  World');
  });

  it('removes iframe tags', () => {
    const input = 'Safe <iframe src="evil.com"></iframe> Text';
    expect(sanitizeInput(input)).toBe('Safe  Text');
  });

  it('removes javascript: protocol', () => {
    const input = 'Click javascript:alert(1)';
    expect(sanitizeInput(input)).toBe('Click alert(1)');
  });

  it('removes event handlers', () => {
    const input = 'Text onclick= something';
    expect(sanitizeInput(input)).toBe('Text  something');
  });

  it('preserves normal text', () => {
    expect(sanitizeInput('Hello World')).toBe('Hello World');
  });

  it('trims whitespace', () => {
    expect(sanitizeInput('  Hello  ')).toBe('Hello');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeInput(123 as any)).toBe('');
    expect(sanitizeInput(null as any)).toBe('');
  });
});

describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('accepts email with subdomain', () => {
    expect(validateEmail('user@mail.example.com')).toBe(true);
  });

  it('rejects email without @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('rejects email without domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('rejects email with spaces', () => {
    expect(validateEmail('user @example.com')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateEmail('')).toBe(false);
  });
});

describe('validatePhone', () => {
  it('accepts valid phone with 10 digits', () => {
    expect(validatePhone('0812345678')).toBe(true);
  });

  it('accepts phone with dashes', () => {
    expect(validatePhone('0812-345-678')).toBe(true);
  });

  it('accepts phone with 15 digits (max)', () => {
    expect(validatePhone('123456789012345')).toBe(true);
  });

  it('rejects phone with fewer than 5 digits', () => {
    expect(validatePhone('1234')).toBe(false);
  });

  it('rejects phone with more than 15 digits', () => {
    expect(validatePhone('1234567890123456')).toBe(false);
  });

  it('accepts exactly 5 digits (minimum)', () => {
    expect(validatePhone('12345')).toBe(true);
  });
});

describe('validateRequiredFields', () => {
  it('returns valid when all fields present', () => {
    const result = validateRequiredFields(
      { name: 'John', email: 'john@test.com' },
      ['name', 'email']
    );
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns errors for missing fields', () => {
    const result = validateRequiredFields(
      { name: 'John' },
      ['name', 'email']
    );
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('email is required');
  });

  it('returns error for empty string fields', () => {
    const result = validateRequiredFields(
      { name: '   ' },
      ['name']
    );
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('name cannot be empty');
  });

  it('returns multiple errors for multiple missing fields', () => {
    const result = validateRequiredFields({}, ['name', 'email', 'phone']);
    expect(result.errors).toHaveLength(3);
  });
});

describe('validateNumberRange', () => {
  it('returns true when within range', () => {
    expect(validateNumberRange(5, 1, 10)).toBe(true);
  });

  it('returns true at min boundary', () => {
    expect(validateNumberRange(1, 1, 10)).toBe(true);
  });

  it('returns true at max boundary', () => {
    expect(validateNumberRange(10, 1, 10)).toBe(true);
  });

  it('returns false below min', () => {
    expect(validateNumberRange(0, 1, 10)).toBe(false);
  });

  it('returns false above max', () => {
    expect(validateNumberRange(11, 1, 10)).toBe(false);
  });

  it('returns true when no bounds specified', () => {
    expect(validateNumberRange(999)).toBe(true);
  });

  it('validates with only min', () => {
    expect(validateNumberRange(5, 1)).toBe(true);
    expect(validateNumberRange(0, 1)).toBe(false);
  });

  it('validates with only max', () => {
    expect(validateNumberRange(5, undefined, 10)).toBe(true);
    expect(validateNumberRange(11, undefined, 10)).toBe(false);
  });
});

describe('sanitizeObject', () => {
  it('sanitizes string values', () => {
    const result = sanitizeObject({ name: '<script>evil</script>Safe' });
    expect(result.name).toBe('Safe');
  });

  it('preserves non-string values', () => {
    const result = sanitizeObject({ count: 42, active: true });
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
  });

  it('sanitizes nested objects', () => {
    const result = sanitizeObject({
      user: { name: '<script>x</script>John' }
    });
    expect(result.user.name).toBe('John');
  });

  it('sanitizes arrays of strings', () => {
    const result = sanitizeObject({
      tags: ['safe', '<script>bad</script>ok']
    });
    expect(result.tags[0]).toBe('safe');
    expect(result.tags[1]).toBe('ok');
  });

  it('returns non-object input as-is', () => {
    expect(sanitizeObject(null as any)).toBe(null);
    expect(sanitizeObject(42 as any)).toBe(42);
  });
});

describe('validateAndSanitize', () => {
  it('passes with valid data and all rules', () => {
    const result = validateAndSanitize(
      { name: 'John', email: 'john@test.com', phone: '08123456789', age: 25 },
      {
        required: ['name', 'email'],
        email: ['email'],
        phone: ['phone'],
        numberRange: [{ field: 'age', min: 1, max: 120 }],
      }
    );
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('collects errors from multiple rule types', () => {
    const result = validateAndSanitize(
      { email: 'invalid-email', phone: '12' },
      {
        required: ['name'],
        email: ['email'],
        phone: ['phone'],
      }
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('validates maxLength', () => {
    const result = validateAndSanitize(
      { name: 'A very long name that exceeds the limit' },
      { maxLength: [{ field: 'name', length: 10 }] }
    );
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('must not exceed 10 characters');
  });

  it('validates minLength', () => {
    const result = validateAndSanitize(
      { password: 'ab' },
      { minLength: [{ field: 'password', length: 8 }] }
    );
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('must be at least 8 characters');
  });

  it('runs custom validators', () => {
    const result = validateAndSanitize(
      { status: 'invalid' },
      {
        custom: [{
          field: 'status',
          validator: (val: string) => val !== 'active' && val !== 'inactive',
          message: 'Status must be active or inactive',
        }],
      }
    );
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Status must be active or inactive');
  });

  it('returns sanitized data', () => {
    const result = validateAndSanitize(
      { name: '<script>x</script>John' },
      {}
    );
    expect(result.sanitizedData.name).toBe('John');
  });
});
