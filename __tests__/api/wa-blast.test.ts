import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks (vi.mock is hoisted, so no external variable references) ─────

vi.mock('@/lib/tenantDb', () => {
  const mockCustomerData = [
    { _id: 'c1', name: 'Alice', phone: '628111111111', membershipTier: 'regular', waNotifEnabled: true },
    { _id: 'c2', name: 'Bob', phone: '628222222222', membershipTier: 'premium', waNotifEnabled: true },
  ];

  // Build a chainable mock that supports both GET (select→sort→limit→lean) and POST (select→lean)
  const selectMock = vi.fn().mockImplementation(() => ({
    lean: vi.fn().mockResolvedValue(mockCustomerData),
    sort: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockCustomerData),
      }),
    }),
  }));

  return {
    getTenantModels: vi.fn().mockResolvedValue({
      Customer: {
        find: vi.fn().mockReturnValue({ select: selectMock }),
        aggregate: vi.fn().mockResolvedValue([]),
      },
    Invoice: {
      find: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
    WaBlastLog: {
      create: vi.fn().mockResolvedValue({ _id: 'log1' }),
    },
    Settings: {
      findOne: vi.fn().mockResolvedValue({ fonnteToken: 'test-token', storeName: 'TestSalon' }),
    },
    }),
  };
});

vi.mock('@/lib/rbac', () => ({
  checkPermission: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user1', role: 'Super Admin' } }),
}));

const mockSendWhatsApp = vi.fn().mockResolvedValue({ success: true, data: { status: true } });
vi.mock('@/lib/fonnte', () => ({
  sendWhatsApp: (...args: any[]) => mockSendWhatsApp(...args),
}));

// ── Tests ─────────────────────────────────────────────────────────────

import { GET, POST } from '@/app/api/wa/blast-targets/route';

describe('WA Blast Targets API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendWhatsApp.mockResolvedValue({ success: true, data: { status: true } });
  });

  describe('GET /api/wa/blast-targets', () => {
    it('returns filtered customer list with phone numbers', async () => {
      const req = new NextRequest('http://localhost/api/wa/blast-targets', {
        headers: { 'x-store-slug': 'test-tenant' },
      });

      const res = await GET(req, {});
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.total).toBe(2);
      expect(data.data).toHaveLength(2);
    });

    it('applies membership tier filter', async () => {
      const req = new NextRequest('http://localhost/api/wa/blast-targets?membershipTier=premium', {
        headers: { 'x-store-slug': 'test-tenant' },
      });

      const { getTenantModels } = await import('@/lib/tenantDb');
      const models = await getTenantModels('test-tenant');

      await GET(req, {});

      expect(models.Customer.find).toHaveBeenCalledWith(
        expect.objectContaining({ membershipTier: 'premium' })
      );
    });
  });

  describe('POST /api/wa/blast-targets', () => {
    it('returns 400 if message is empty', async () => {
      const req = new NextRequest('http://localhost/api/wa/blast-targets', {
        method: 'POST',
        headers: { 'x-store-slug': 'test-tenant', 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: ['c1'], message: '' }),
      });

      const res = await POST(req, {});
      expect(res.status).toBe(400);
    });

    it('returns 400 if no customers selected', async () => {
      const req = new NextRequest('http://localhost/api/wa/blast-targets', {
        method: 'POST',
        headers: { 'x-store-slug': 'test-tenant', 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerIds: [], message: 'Hello!' }),
      });

      const res = await POST(req, {});
      expect(res.status).toBe(400);
    });

    it('sends blast successfully and returns sent/failed counts', async () => {
      const req = new NextRequest('http://localhost/api/wa/blast-targets', {
        method: 'POST',
        headers: { 'x-store-slug': 'test-tenant', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerIds: ['c1', 'c2'],
          message: 'Hello {{nama_customer}}!',
          campaignName: 'Test Campaign',
        }),
      });

      const res = await POST(req, {});
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sent).toBe(2);
      expect(data.failed).toBe(0);
      expect(data.total).toBe(2);
      expect(data.failedRecipients).toEqual([]);

      // Verify personalization
      expect(mockSendWhatsApp).toHaveBeenCalledTimes(2);
      expect(mockSendWhatsApp).toHaveBeenCalledWith('628111111111', 'Hello Alice!', 'test-token');
      expect(mockSendWhatsApp).toHaveBeenCalledWith('628222222222', 'Hello Bob!', 'test-token');
    });

    it('returns failedRecipients with error details on partial failure', async () => {
      mockSendWhatsApp
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: 'Unregistered number' });

      const req = new NextRequest('http://localhost/api/wa/blast-targets', {
        method: 'POST',
        headers: { 'x-store-slug': 'test-tenant', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerIds: ['c1', 'c2'],
          message: 'Hello!',
          campaignName: 'Partial Fail',
        }),
      });

      const res = await POST(req, {});
      const data = await res.json();

      expect(data.sent).toBe(1);
      expect(data.failed).toBe(1);
      expect(data.failedRecipients).toHaveLength(1);
      expect(data.failedRecipients[0]).toEqual({
        phone: '628222222222',
        error: 'Unregistered number',
      });
    });

    it('handles sendWhatsApp exceptions gracefully', async () => {
      mockSendWhatsApp.mockRejectedValue(new Error('Network timeout'));

      const req = new NextRequest('http://localhost/api/wa/blast-targets', {
        method: 'POST',
        headers: { 'x-store-slug': 'test-tenant', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerIds: ['c1'],
          message: 'Hello!',
        }),
      });

      const res = await POST(req, {});
      const data = await res.json();

      // Mock returns both customers regardless of filter, so both fail
      expect(data.sent).toBe(0);
      expect(data.failed).toBe(2);
      expect(data.failedRecipients).toHaveLength(2);
      expect(data.failedRecipients[0].error).toBe('Network timeout');
    });

    it('creates a WaBlastLog entry after sending', async () => {
      const req = new NextRequest('http://localhost/api/wa/blast-targets', {
        method: 'POST',
        headers: { 'x-store-slug': 'test-tenant', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerIds: ['c1'],
          message: 'Hello!',
          campaignName: 'Log Test',
        }),
      });

      await POST(req, {});

      const { getTenantModels } = await import('@/lib/tenantDb');
      const models = await getTenantModels('test-tenant');

      expect(models.WaBlastLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignName: 'Log Test',
          message: 'Hello!',
          sentCount: 2,
        })
      );
    });
  });
});
