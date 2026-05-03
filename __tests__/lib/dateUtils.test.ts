import { describe, it, expect } from 'vitest';
import {
  getCurrentDateInTimezone,
  getMonthDateRangeInTimezone,
  getUtcRangeForDateRange,
  formatDateTime,
  formatDate,
} from '@/lib/dateUtils';

describe('getCurrentDateInTimezone', () => {
  it('returns date in YYYY-MM-DD format', () => {
    const result = getCurrentDateInTimezone('UTC');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns correct date for UTC', () => {
    const fixedDate = new Date('2025-06-15T10:00:00Z');
    const result = getCurrentDateInTimezone('UTC', fixedDate);
    expect(result).toBe('2025-06-15');
  });

  it('handles timezone offset correctly for Asia/Jakarta (UTC+7)', () => {
    // 2025-06-15T20:00:00Z = 2025-06-16T03:00:00 WIB
    const fixedDate = new Date('2025-06-15T20:00:00Z');
    const result = getCurrentDateInTimezone('Asia/Jakarta', fixedDate);
    expect(result).toBe('2025-06-16');
  });

  it('uses UTC as default timezone', () => {
    const fixedDate = new Date('2025-01-01T00:00:00Z');
    const result = getCurrentDateInTimezone(undefined, fixedDate);
    expect(result).toBe('2025-01-01');
  });
});

describe('getMonthDateRangeInTimezone', () => {
  it('returns correct range for January', () => {
    const fixedDate = new Date('2025-01-15T12:00:00Z');
    const range = getMonthDateRangeInTimezone('UTC', fixedDate);
    expect(range.startDate).toBe('2025-01-01');
    expect(range.endDate).toBe('2025-01-31');
  });

  it('returns correct range for February (non-leap year)', () => {
    const fixedDate = new Date('2025-02-10T12:00:00Z');
    const range = getMonthDateRangeInTimezone('UTC', fixedDate);
    expect(range.startDate).toBe('2025-02-01');
    expect(range.endDate).toBe('2025-02-28');
  });

  it('returns correct range for February (leap year)', () => {
    const fixedDate = new Date('2024-02-10T12:00:00Z');
    const range = getMonthDateRangeInTimezone('UTC', fixedDate);
    expect(range.startDate).toBe('2024-02-01');
    expect(range.endDate).toBe('2024-02-29');
  });

  it('returns correct range for month with 30 days', () => {
    const fixedDate = new Date('2025-04-15T12:00:00Z');
    const range = getMonthDateRangeInTimezone('UTC', fixedDate);
    expect(range.startDate).toBe('2025-04-01');
    expect(range.endDate).toBe('2025-04-30');
  });

  it('handles timezone crossing for month boundary', () => {
    // UTC: 2025-01-31T23:00:00Z → Jakarta: 2025-02-01T06:00
    const fixedDate = new Date('2025-01-31T23:00:00Z');
    const range = getMonthDateRangeInTimezone('Asia/Jakarta', fixedDate);
    expect(range.startDate).toBe('2025-02-01');
    expect(range.endDate).toBe('2025-02-28');
  });
});

describe('getUtcRangeForDateRange', () => {
  it('returns start and end as Date objects', () => {
    const { start, end } = getUtcRangeForDateRange('2025-06-01', '2025-06-30', 'UTC');
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
  });

  it('start is beginning of first day in timezone', () => {
    const { start } = getUtcRangeForDateRange('2025-06-15', '2025-06-15', 'UTC');
    expect(start.toISOString()).toBe('2025-06-15T00:00:00.000Z');
  });

  it('end is last millisecond of last day in timezone', () => {
    const { start, end } = getUtcRangeForDateRange('2025-06-15', '2025-06-15', 'UTC');
    // end should be 23:59:59.999 of the day
    expect(end.getTime()).toBe(new Date('2025-06-16T00:00:00.000Z').getTime() - 1);
  });

  it('handles multi-day range', () => {
    const { start, end } = getUtcRangeForDateRange('2025-06-01', '2025-06-30', 'UTC');
    expect(start.toISOString()).toBe('2025-06-01T00:00:00.000Z');
    expect(end.getTime()).toBe(new Date('2025-07-01T00:00:00.000Z').getTime() - 1);
  });

  it('adjusts for timezone offset (Asia/Jakarta = UTC+7)', () => {
    const { start } = getUtcRangeForDateRange('2025-06-15', '2025-06-15', 'Asia/Jakarta');
    // Start of June 15 in WIB (UTC+7) = June 14 17:00:00 UTC
    expect(start.toISOString()).toBe('2025-06-14T17:00:00.000Z');
  });
});

describe('formatDateTime', () => {
  it('formats a Date object correctly', () => {
    const date = new Date('2025-06-15T14:30:00Z');
    const result = formatDateTime(date, 'UTC');
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });

  it('accepts string input', () => {
    const result = formatDateTime('2025-06-15T14:30:00Z', 'UTC');
    expect(result).toContain('Jun');
    expect(result).toContain('15');
  });

  it('returns original string for invalid date', () => {
    const result = formatDateTime('not-a-date', 'UTC');
    expect(result).toBe('not-a-date');
  });

  it('defaults to UTC timezone', () => {
    const date = new Date('2025-06-15T14:30:00Z');
    const result = formatDateTime(date);
    expect(result).toContain('Jun');
  });
});

describe('formatDate', () => {
  it('formats date without time', () => {
    const date = new Date('2025-06-15T14:30:00Z');
    const result = formatDate(date, 'UTC');
    expect(result).toContain('Jun');
    expect(result).toContain('15');
    expect(result).toContain('2025');
    // Should NOT contain time
    expect(result).not.toMatch(/\d{2}:\d{2}/);
  });

  it('accepts string input', () => {
    const result = formatDate('2025-06-15T14:30:00Z', 'UTC');
    expect(result).toContain('Jun');
  });

  it('returns original string for invalid date', () => {
    const result = formatDate('invalid', 'UTC');
    expect(result).toBe('invalid');
  });
});
