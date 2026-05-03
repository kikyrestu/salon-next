import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT, DELETE } from '@/app/api/invoices/[id]/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/tenantDb', () => ({
  getTenantModels: vi.fn().mockResolvedValue({
    Invoice: {
      findById: vi.fn(),
      findByIdAndUpdate: vi.fn(),
    },
    Customer: {
      findByIdAndUpdate: vi.fn(),
    },
  }),
}));

vi.mock('@/lib/rbac', () => ({
  checkPermission: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'test-user-id', role: 'Super Admin' } }),
}));

vi.mock('@/lib/logger', () => ({
  logActivity: vi.fn(),
}));

describe('Invoices API', () => {
  let models: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getTenantModels } = await import('@/lib/tenantDb');
    models = await getTenantModels('test-tenant');
  });

  describe('GET /api/invoices/[id]', () => {
    it('returns 404 if invoice not found', async () => {
      const populateMock = vi.fn().mockReturnValue({ populate: vi.fn().mockResolvedValue(null) });
      models.Invoice.findById.mockReturnValue({ populate: populateMock });

      const req = new NextRequest('http://localhost/api/invoices/123', {
        headers: { 'x-store-slug': 'test-tenant' },
      });
      
      const res = await GET(req, { params: Promise.resolve({ id: '123' }) });
      const data = await res.json();
      
      expect(res.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('returns 200 with invoice data', async () => {
      const mockInvoice = { _id: '123', invoiceNumber: 'INV-001' };
      const populateMock = vi.fn().mockReturnValue({ populate: vi.fn().mockResolvedValue(mockInvoice) });
      models.Invoice.findById.mockReturnValue({ populate: populateMock });

      const req = new NextRequest('http://localhost/api/invoices/123', {
        headers: { 'x-store-slug': 'test-tenant' },
      });
      
      const res = await GET(req, { params: Promise.resolve({ id: '123' }) });
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockInvoice);
    });
  });

  describe('PUT /api/invoices/[id]', () => {
    it('updates invoice status to paid and adds loyalty points', async () => {
      const oldInvoice = { _id: '123', status: 'pending', totalAmount: 100000, customer: 'cust-1' };
      const newInvoice = { ...oldInvoice, status: 'paid' };
      
      models.Invoice.findById.mockResolvedValue(oldInvoice);
      models.Invoice.findByIdAndUpdate.mockResolvedValue(newInvoice);

      const req = new NextRequest('http://localhost/api/invoices/123', {
        method: 'PUT',
        headers: { 'x-store-slug': 'test-tenant' },
        body: JSON.stringify({ status: 'paid' }),
      });
      
      const res = await PUT(req, { params: Promise.resolve({ id: '123' }) });
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Points = 100000 / 10 = 10000
      expect(models.Customer.findByIdAndUpdate).toHaveBeenCalledWith('cust-1', {
        $inc: { loyaltyPoints: 10000, totalPurchases: 100000 }
      });
      
      const { logActivity } = await import('@/lib/logger');
      expect(logActivity).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/invoices/[id] (VOID)', () => {
    it('returns 403 if user is not Super Admin', async () => {
      const { auth } = await import('@/auth');
      (auth as any).mockResolvedValueOnce({ user: { id: 'test', role: 'Staff' } });

      const req = new NextRequest('http://localhost/api/invoices/123', {
        method: 'DELETE',
        headers: { 'x-store-slug': 'test-tenant' },
      });
      
      const res = await DELETE(req, { params: Promise.resolve({ id: '123' }) });
      expect(res.status).toBe(403);
    });

    it('returns 400 if invoice is already voided', async () => {
      models.Invoice.findById.mockResolvedValue({ _id: '123', status: 'voided' });

      const req = new NextRequest('http://localhost/api/invoices/123', {
        method: 'DELETE',
        headers: { 'x-store-slug': 'test-tenant' },
      });
      
      const res = await DELETE(req, { params: Promise.resolve({ id: '123' }) });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('sudah di-void');
    });

    it('successfully voids an invoice as Super Admin', async () => {
      const mockInvoice = { 
        _id: '123', 
        status: 'paid', 
        invoiceNumber: 'INV-001',
        save: vi.fn().mockResolvedValue(true)
      };
      models.Invoice.findById.mockResolvedValue(mockInvoice);

      const req = new NextRequest('http://localhost/api/invoices/123', {
        method: 'DELETE',
        headers: { 'x-store-slug': 'test-tenant' },
        body: JSON.stringify({ reason: 'Salah input' }),
      });
      
      const res = await DELETE(req, { params: Promise.resolve({ id: '123' }) });
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockInvoice.status).toBe('voided');
      expect((mockInvoice as any).voidReason).toBe('Salah input');
      expect(mockInvoice.save).toHaveBeenCalled();
    });
  });
});
