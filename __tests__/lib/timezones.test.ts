import { describe, it, expect } from 'vitest';
import { getAllTimezones } from '@/lib/timezones';

describe('getAllTimezones', () => {
  it('returns a non-empty array', () => {
    const timezones = getAllTimezones();
    expect(Array.isArray(timezones)).toBe(true);
    expect(timezones.length).toBeGreaterThan(0);
  });

  it('each timezone object has value and label properties', () => {
    const timezones = getAllTimezones();
    for (const tz of timezones) {
      expect(tz).toHaveProperty('value');
      expect(tz).toHaveProperty('label');
      expect(typeof tz.value).toBe('string');
      expect(typeof tz.label).toBe('string');
    }
  });

  it('contains critical timezones', () => {
    const timezones = getAllTimezones();
    const values = timezones.map(tz => tz.value);
    
    expect(values).toContain('UTC');
    expect(values).toContain('Asia/Jakarta');
    expect(values).toContain('America/New_York');
    expect(values).toContain('Europe/London');
  });

  it('labels contain UTC offset information', () => {
    const timezones = getAllTimezones();
    const jakarta = timezones.find(tz => tz.value === 'Asia/Jakarta');
    const newYork = timezones.find(tz => tz.value === 'America/New_York');
    
    // Check if label contains UTC offset string like "UTC+07:00"
    expect(jakarta?.label).toContain('UTC+07:00');
    expect(newYork?.label).toContain('UTC-05:00');
  });
});
