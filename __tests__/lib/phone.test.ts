import { describe, it, expect } from 'vitest';
import { normalizeIndonesianPhone, isLikelyValidPhone } from '@/lib/phone';

describe('normalizeIndonesianPhone', () => {
  it('converts 08xx to 628xx', () => {
    expect(normalizeIndonesianPhone('08123456789')).toBe('628123456789');
  });

  it('converts 8xx to 628xx (missing leading 0)', () => {
    expect(normalizeIndonesianPhone('8123456789')).toBe('628123456789');
  });

  it('converts 0062 prefix to 62', () => {
    expect(normalizeIndonesianPhone('00628123456789')).toBe('628123456789');
  });

  it('fixes 620 prefix to 62', () => {
    expect(normalizeIndonesianPhone('6208123456789')).toBe('628123456789');
  });

  it('keeps already correct 62 prefix', () => {
    expect(normalizeIndonesianPhone('628123456789')).toBe('628123456789');
  });

  it('handles phone with spaces and dashes', () => {
    expect(normalizeIndonesianPhone('0812-3456-789')).toBe('628123456789');
  });

  it('handles phone with parentheses', () => {
    expect(normalizeIndonesianPhone('(0812) 3456789')).toBe('628123456789');
  });

  it('handles phone with plus sign', () => {
    expect(normalizeIndonesianPhone('+628123456789')).toBe('628123456789');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeIndonesianPhone('')).toBe('');
  });

  it('returns empty string for null/undefined', () => {
    expect(normalizeIndonesianPhone(null)).toBe('');
    expect(normalizeIndonesianPhone(undefined)).toBe('');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeIndonesianPhone('   ')).toBe('');
  });

  it('returns digits as-is for non-Indonesian number', () => {
    // A number not starting with 62 after normalization
    expect(normalizeIndonesianPhone('13015551234')).toBe('13015551234');
  });
});

describe('isLikelyValidPhone', () => {
  it('returns true for valid Indonesian mobile (12 digits)', () => {
    expect(isLikelyValidPhone('08123456789')).toBe(true);
  });

  it('returns true for already normalized number', () => {
    expect(isLikelyValidPhone('628123456789')).toBe(true);
  });

  it('returns true for 10-digit number (minimum)', () => {
    expect(isLikelyValidPhone('0812345678')).toBe(true);
  });

  it('returns true for 15-digit number (maximum)', () => {
    expect(isLikelyValidPhone('628123456789012')).toBe(true);
  });

  it('returns false for too short number', () => {
    expect(isLikelyValidPhone('08123')).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(isLikelyValidPhone('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isLikelyValidPhone(null)).toBe(false);
  });
});
