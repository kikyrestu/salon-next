import { describe, it, expect } from 'vitest';
import {
  getCurrencySymbol,
  formatCurrency,
  getAllCurrencies,
  getCurrencyInfo,
} from '@/lib/currency';

describe('getCurrencySymbol', () => {
  it('returns correct symbol for IDR', () => {
    expect(getCurrencySymbol('IDR')).toBe('Rp');
  });

  it('returns correct symbol for USD', () => {
    expect(getCurrencySymbol('USD')).toBe('$');
  });

  it('returns correct symbol for EUR', () => {
    expect(getCurrencySymbol('EUR')).toBe('€');
  });

  it('returns correct symbol for JPY', () => {
    expect(getCurrencySymbol('JPY')).toBe('¥');
  });

  it('returns fallback "Rp" for unknown currency code', () => {
    expect(getCurrencySymbol('XYZ')).toBe('Rp');
  });

  it('returns fallback for empty string', () => {
    expect(getCurrencySymbol('')).toBe('Rp');
  });
});

describe('formatCurrency', () => {
  it('formats positive amount with default IDR', () => {
    const result = formatCurrency(150000);
    expect(result).toContain('Rp');
    expect(result).toContain('150');
  });

  it('formats zero amount', () => {
    const result = formatCurrency(0);
    expect(result).toBe('Rp0');
  });

  it('handles undefined/NaN amount gracefully', () => {
    const result = formatCurrency(undefined as any);
    expect(result).toBe('Rp0');
  });

  it('formats with custom currency code', () => {
    const result = formatCurrency(1000, 'USD');
    expect(result).toContain('$');
  });

  it('formats large numbers with locale separators', () => {
    const result = formatCurrency(1000000, 'IDR');
    expect(result).toContain('Rp');
    // id-ID uses dot as thousands separator
    expect(result).toContain('1.000.000');
  });

  it('removes decimal fractions', () => {
    const result = formatCurrency(150000.75, 'IDR');
    // maximumFractionDigits: 0 means no decimals
    expect(result).not.toContain(',75');
  });
});

describe('getAllCurrencies', () => {
  it('returns a non-empty array', () => {
    const currencies = getAllCurrencies();
    expect(currencies.length).toBeGreaterThan(0);
  });

  it('returns sorted by code', () => {
    const currencies = getAllCurrencies();
    for (let i = 1; i < currencies.length; i++) {
      expect(currencies[i].code.localeCompare(currencies[i - 1].code)).toBeGreaterThanOrEqual(0);
    }
  });

  it('each item has code, symbol, and name', () => {
    const currencies = getAllCurrencies();
    for (const c of currencies) {
      expect(c).toHaveProperty('code');
      expect(c).toHaveProperty('symbol');
      expect(c).toHaveProperty('name');
      expect(c.code).toBeTruthy();
      expect(c.symbol).toBeTruthy();
      expect(c.name).toBeTruthy();
    }
  });

  it('includes IDR and USD', () => {
    const currencies = getAllCurrencies();
    const codes = currencies.map(c => c.code);
    expect(codes).toContain('IDR');
    expect(codes).toContain('USD');
  });
});

describe('getCurrencyInfo', () => {
  it('returns correct info for known code', () => {
    const info = getCurrencyInfo('IDR');
    expect(info.code).toBe('IDR');
    expect(info.symbol).toBe('Rp');
    expect(info.name).toBe('Indonesian Rupiah');
  });

  it('falls back to USD for unknown code', () => {
    const info = getCurrencyInfo('UNKNOWN');
    expect(info.code).toBe('USD');
    expect(info.symbol).toBe('$');
  });
});
