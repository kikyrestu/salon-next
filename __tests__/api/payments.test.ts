import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as CREATE_INVOICE } from '@/app/api/payments/xendit/create-invoice/route';
import { POST as WEBHOOK } from '@/app/api/payments/xendit/webhook/route';
import { NextRequest } from 'next/server';
import { checkPermission } from '@/lib/rbac';
import { createXenditInvoice } from '@/lib/xendit';
import mongoose from 'mongoose';

vi.mock('@/lib/tenantDb', () => ({
  getTenantModels: vi.fn().mockResolvedValue({
    Invoice: {
      findById: vi.fn(),
      aggregate: vi.fn(),
    },
    PaymentTransaction: {
      create: vi.fn(),
      findOne: vi.fn(),
    },
    PackageOrder: {
      findById: vi.fn(),
      findByIdAndUpdate: vi.fn(),
    },
    Deposit: {
      findOne: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
    },
    CustomerPackage: {
      create: vi.fn(),
    }
  }),
}));

vi.mock('@/lib/rbac', () => ({
  checkPermission: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/xendit', () => ({
  createXenditInvoice: vi.fn(),
}));

describe('Payments API (Xendit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (checkPermission as any).mockResolvedValue(null);
    process.env.XENDIT_WEBHOOK_TOKEN = 'test-token';
  });

  describe('POST /api/payments/xendit/create-invoice', () => {
    it('should return 400 if amount is <= 0 for package_order without invoiceId', async () => {
      const req = new NextRequest('http://localhost/api/payments/xendit/create-invoice', {
        method: 'POST',
        headers: { 'x-store-slug': 'test-tenant' },
        body: JSON.stringify({ amount: 0, sourceType: 'package_order', sourceId: new mongoose.Types.ObjectId().toString() }),
      });

      const { getTenantModels } = await import('@/lib/tenantDb');
      const models = await getTenantModels('test-tenant');
      (models.PackageOrder.findById as any).mockResolvedValue({ _id: '1', amount: 0 });

      const res = await CREATE_INVOICE(req, {});
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('Amount must be greater than zero');
    });

    it('should create a payment transaction for package_order', async () => {
      const { getTenantModels } = await import('@/lib/tenantDb');
      const models = await getTenantModels('test-tenant');

      const sourceId = new mongoose.Types.ObjectId().toString();
      (models.PackageOrder.findById as any).mockResolvedValue({ _id: sourceId, amount: 100000, customer: 'c1' });
      (createXenditInvoice as any).mockResolvedValue({ id: 'xnd-1', invoice_url: 'http://xendit.com/123' });
      (models.PaymentTransaction.create as any).mockResolvedValue({ _id: 'tx-1', status: 'pending' });

      const req = new NextRequest('http://localhost/api/payments/xendit/create-invoice', {
        method: 'POST',
        headers: { 'x-store-slug': 'test-tenant' },
        body: JSON.stringify({ sourceType: 'package_order', sourceId }),
      });

      const res = await CREATE_INVOICE(req, {});
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(createXenditInvoice).toHaveBeenCalled();
      expect(models.PaymentTransaction.create).toHaveBeenCalled();
      expect(models.PackageOrder.findByIdAndUpdate).toHaveBeenCalledWith(sourceId, { paymentTransaction: 'tx-1', status: 'pending' });
    });

    it('should create a payment transaction for invoice', async () => {
      const { getTenantModels } = await import('@/lib/tenantDb');
      const models = await getTenantModels('test-tenant');

      const invoiceId = new mongoose.Types.ObjectId().toString();
      const mockInvoice = { _id: invoiceId, totalAmount: 100000, amountPaid: 20000, customer: 'c1', invoiceNumber: 'INV-1', save: vi.fn() };
      (models.Invoice.findById as any).mockResolvedValue(mockInvoice);
      (createXenditInvoice as any).mockResolvedValue({ id: 'xnd-2', invoice_url: 'http://xendit.com/456' });
      (models.PaymentTransaction.create as any).mockResolvedValue({ _id: 'tx-2', status: 'pending' });

      const req = new NextRequest('http://localhost/api/payments/xendit/create-invoice', {
        method: 'POST',
        headers: { 'x-store-slug': 'test-tenant' },
        body: JSON.stringify({ invoiceId }),
      });

      const res = await CREATE_INVOICE(req, {});
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.amount).toBe(80000); // 100000 - 20000
      expect(mockInvoice.save).toHaveBeenCalled();
    });
  });

  describe('POST /api/payments/xendit/webhook', () => {
    it('should return 401 if token is invalid', async () => {
      const req = new NextRequest('http://localhost/api/payments/xendit/webhook', {
        method: 'POST',
        headers: { 'x-store-slug': 'test-tenant', 'x-callback-token': 'wrong-token' },
        body: JSON.stringify({}),
      });

      const res = await WEBHOOK(req, {});
      expect(res.status).toBe(401);
    });

    it('should mark invoice transaction as paid and create deposit', async () => {
      const { getTenantModels } = await import('@/lib/tenantDb');
      const models = await getTenantModels('test-tenant');

      const mockTx = {
        externalId: 'ext-1',
        xenditInvoiceId: 'xnd-1',
        processedEventKeys: [],
        sourceType: 'invoice',
        sourceId: 'inv-1',
        amount: 50000,
        save: vi.fn(),
      };
      (models.PaymentTransaction.findOne as any).mockResolvedValue(mockTx);

      const mockInvoice = { _id: 'inv-1', totalAmount: 50000, amountPaid: 0, save: vi.fn() };
      (models.Invoice.findById as any).mockResolvedValue(mockInvoice);
      (models.Deposit.findOne as any).mockResolvedValue(null); // deposit doesn't exist yet
      (models.Deposit.aggregate as any).mockResolvedValue([{ totalPaid: 50000 }]);

      const req = new NextRequest('http://localhost/api/payments/xendit/webhook', {
        method: 'POST',
        headers: { 'x-store-slug': 'test-tenant', 'x-callback-token': 'test-token' },
        body: JSON.stringify({
          external_id: 'ext-1',
          status: 'PAID',
          paid_amount: 50000,
          id: 'xnd-1'
        }),
      });

      const res = await WEBHOOK(req, {});
      expect(res.status).toBe(200);
      expect(models.Deposit.create).toHaveBeenCalled();
      expect(mockInvoice.status).toBe('paid');
      expect(mockInvoice.save).toHaveBeenCalled();
      expect(mockTx.save).toHaveBeenCalled();
      expect(mockTx.status).toBe('paid');
    });

    it('should activate customer package when package_order is paid', async () => {
      const { getTenantModels } = await import('@/lib/tenantDb');
      const models = await getTenantModels('test-tenant');

      const mockTx = {
        externalId: 'ext-pkg',
        processedEventKeys: [],
        sourceType: 'package_order',
        sourceId: 'ord-1',
        amount: 100000,
        save: vi.fn(),
      };
      (models.PaymentTransaction.findOne as any).mockResolvedValue(mockTx);

      const mockOrder = { 
        _id: 'ord-1', 
        customer: 'c1', 
        package: 'pkg1',
        activatedCustomerPackage: null,
        packageSnapshot: { validityDays: 30, items: [] },
        save: vi.fn() 
      };
      (models.PackageOrder.findById as any).mockResolvedValue(mockOrder);
      (models.CustomerPackage.create as any).mockResolvedValue({ _id: 'cpkg1' });

      const req = new NextRequest('http://localhost/api/payments/xendit/webhook', {
        method: 'POST',
        headers: { 'x-store-slug': 'test-tenant', 'x-callback-token': 'test-token' },
        body: JSON.stringify({
          external_id: 'ext-pkg',
          status: 'PAID',
          paid_amount: 100000,
        }),
      });

      const res = await WEBHOOK(req, {});
      expect(res.status).toBe(200);
      expect(models.CustomerPackage.create).toHaveBeenCalled();
      expect(mockOrder.status).toBe('paid');
      expect(mockOrder.activatedCustomerPackage).toBe('cpkg1');
      expect(mockOrder.save).toHaveBeenCalled();
    });
  });
});
