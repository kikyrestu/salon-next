import { describe, it, expect } from 'vitest';
import { calculateSplitCommission, CalculateSplitCommissionParams } from '@/lib/splitCommission';

describe('calculateSplitCommission', () => {
  it('returns error if no staff assigned', () => {
    const result = calculateSplitCommission({
      splitMode: 'auto',
      assignments: [],
      servicePrice: 100000,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Minimal 1 staff harus di-assign');
  });

  it('returns error if duplicate staff assigned', () => {
    const result = calculateSplitCommission({
      splitMode: 'auto',
      assignments: [
        { staffId: '1', percentage: 50 },
        { staffId: '1', percentage: 50 },
      ],
      servicePrice: 100000,
    });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Staff duplikat tidak diperbolehkan');
  });

  describe('auto split mode', () => {
    it('splits equally for 1 staff (100%)', () => {
      const result = calculateSplitCommission({
        splitMode: 'auto',
        assignments: [{ staffId: '1' }],
        servicePrice: 100000,
        commissionType: 'percentage',
        commissionValue: 10,
      });
      expect(result.isValid).toBe(true);
      expect(result.assignments[0].percentage).toBe(100);
      expect(result.assignments[0].komisiNominal).toBe(10000); // 10% of 100000
    });

    it('splits equally for 2 staff (50/50)', () => {
      const result = calculateSplitCommission({
        splitMode: 'auto',
        assignments: [{ staffId: '1' }, { staffId: '2' }],
        servicePrice: 100000,
        commissionType: 'percentage',
        commissionValue: 10,
      });
      expect(result.isValid).toBe(true);
      expect(result.assignments[0].percentage).toBe(50);
      expect(result.assignments[1].percentage).toBe(50);
      expect(result.assignments[0].komisiNominal).toBe(5000);
      expect(result.assignments[1].komisiNominal).toBe(5000);
    });

    it('splits equally for 3 staff and handles rounding (33.33/33.33/33.34)', () => {
      const result = calculateSplitCommission({
        splitMode: 'auto',
        assignments: [{ staffId: '1' }, { staffId: '2' }, { staffId: '3' }],
        servicePrice: 100000,
        commissionType: 'fixed',
        commissionValue: 30000,
      });
      expect(result.isValid).toBe(true);
      expect(result.assignments[0].percentage).toBe(33.33);
      expect(result.assignments[1].percentage).toBe(33.33);
      expect(result.assignments[2].percentage).toBe(33.34);
      
      expect(result.assignments[0].komisiNominal).toBe(9999); // 33.33% of 30000
      expect(result.assignments[1].komisiNominal).toBe(9999);
      expect(result.assignments[2].komisiNominal).toBe(10002); // 33.34% of 30000
      expect(result.totalCommission).toBe(30000);
    });
  });

  describe('manual split mode', () => {
    it('calculates correctly with custom percentages', () => {
      const result = calculateSplitCommission({
        splitMode: 'manual',
        assignments: [
          { staffId: '1', percentage: 70 },
          { staffId: '2', percentage: 30 },
        ],
        servicePrice: 100000,
        commissionType: 'fixed',
        commissionValue: 10000,
      });
      expect(result.isValid).toBe(true);
      expect(result.assignments[0].komisiNominal).toBe(7000);
      expect(result.assignments[1].komisiNominal).toBe(3000);
    });

    it('returns error if total percentage is not 100%', () => {
      const result = calculateSplitCommission({
        splitMode: 'manual',
        assignments: [
          { staffId: '1', percentage: 70 },
          { staffId: '2', percentage: 40 }, // Total 110%
        ],
        servicePrice: 100000,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Total porsi staff wajib tepat 100%');
    });

    it('returns error if any percentage is 0 or negative', () => {
      const result = calculateSplitCommission({
        splitMode: 'manual',
        assignments: [
          { staffId: '1', percentage: 100 },
          { staffId: '2', percentage: 0 },
        ],
        servicePrice: 100000,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Setiap porsi staff harus lebih dari 0%');
    });
    
    it('accepts porsiPersen as fallback for percentage', () => {
      const result = calculateSplitCommission({
        splitMode: 'manual',
        assignments: [
          { staffId: '1', porsiPersen: 60 },
          { staffId: '2', porsiPersen: 40 },
        ],
        servicePrice: 100000,
        commissionType: 'fixed',
        commissionValue: 10000,
      });
      expect(result.isValid).toBe(true);
      expect(result.assignments[0].percentage).toBe(60);
      expect(result.assignments[1].percentage).toBe(40);
    });
  });

  describe('commission calculation logic', () => {
    it('calculates percentage commission correctly', () => {
      const result = calculateSplitCommission({
        splitMode: 'auto',
        assignments: [{ staffId: '1' }],
        servicePrice: 200000,
        quantity: 1,
        commissionType: 'percentage',
        commissionValue: 15, // 15% of 200k = 30k
      });
      expect(result.totalCommission).toBe(30000);
    });

    it('calculates fixed commission with quantity correctly', () => {
      const result = calculateSplitCommission({
        splitMode: 'auto',
        assignments: [{ staffId: '1' }],
        servicePrice: 100000,
        quantity: 3,
        commissionType: 'fixed',
        commissionValue: 15000, // 15k * 3 = 45k
      });
      expect(result.totalCommission).toBe(45000);
    });

    it('returns zero commission if no commission rule is applied', () => {
      const result = calculateSplitCommission({
        splitMode: 'auto',
        assignments: [{ staffId: '1' }],
        servicePrice: 100000,
        commissionValue: 0,
      });
      expect(result.isValid).toBe(true);
      expect(result.totalCommission).toBe(0);
      expect(result.assignments[0].komisiNominal).toBe(0);
    });
    
    it('handles package_redeem source correctly', () => {
      const result = calculateSplitCommission({
        splitMode: 'auto',
        assignments: [{ staffId: '1' }],
        servicePrice: 100000, // Service base price
        commissionType: 'percentage',
        commissionValue: 10,
        sourceType: 'package_redeem', 
      });
      // Even if it's package redeem, base commission should use serviceBaseAmount
      expect(result.totalCommission).toBe(10000);
    });
  });
});
