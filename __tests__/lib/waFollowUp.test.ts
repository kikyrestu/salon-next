import { describe, it, expect, vi, beforeEach } from 'vitest';
import mongoose from 'mongoose';

// ─── vi.hoisted: variabel ini diinisialisasi SEBELUM vi.mock di-hoist ────────
const {
    mockInsertMany,
    mockWaScheduleFind,
    mockInvoiceFindById,
    mockCustomerFindById,
    mockServiceFind,
    mockModels,
} = vi.hoisted(() => {
    const mockInsertMany = vi.fn().mockResolvedValue([]);
    const mockWaScheduleFind = vi.fn();
    const mockInvoiceFindById = vi.fn();
    const mockCustomerFindById = vi.fn();
    const mockServiceFind = vi.fn();

    const mockModels = {
        Invoice: { findById: mockInvoiceFindById },
        Customer: { findById: mockCustomerFindById },
        Service: { find: mockServiceFind },
        WaSchedule: {
            find: mockWaScheduleFind,
            insertMany: mockInsertMany,
        },
    };

    return { mockInsertMany, mockWaScheduleFind, mockInvoiceFindById, mockCustomerFindById, mockServiceFind, mockModels };
});

vi.mock('@/lib/tenantDb', () => ({
    getTenantModels: vi.fn().mockResolvedValue(mockModels),
}));

vi.mock('@/lib/phone', () => ({
    normalizeIndonesianPhone: (v: unknown) => {
        const s = String(v || '').replace(/\D/g, '');
        if (!s) return '';
        if (s.startsWith('0')) return `62${s.slice(1)}`;
        if (s.startsWith('8')) return `62${s}`;
        return s;
    },
}));

import { scheduleFollowUp } from '@/lib/waFollowUp';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const oid = () => new mongoose.Types.ObjectId();

const makeInvoice = (overrides: Record<string, unknown> = {}) => ({
    _id: oid(),
    customer: oid(),
    customerPhone: '081234567890',
    date: new Date('2024-01-01T10:00:00Z'),
    items: [],
    ...overrides,
});

const makeServiceItem = (serviceId: mongoose.Types.ObjectId, overrides: Record<string, unknown> = {}) => ({
    itemModel: 'Service',
    item: serviceId,
    name: 'Haircut',
    price: 100000,
    quantity: 1,
    total: 100000,
    ...overrides,
});

const makeService = (id: mongoose.Types.ObjectId, waFollowUp: Record<string, unknown> = {}) => ({
    _id: id,
    waFollowUp: {
        enabled: true,
        firstDelayValue: 3,
        firstDelayUnit: 'day',
        firstTemplateId: oid(),
        ...waFollowUp,
    },
});

const withLean = (value: unknown) => ({ lean: () => Promise.resolve(value) });
const withSelect = (value: unknown) => ({ select: () => withLean(value) });

beforeEach(() => {
    vi.clearAllMocks();
    mockWaScheduleFind.mockReturnValue({
        select: () => ({ lean: () => Promise.resolve([]) }),
    });
    mockInsertMany.mockResolvedValue([]);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('scheduleFollowUp — BUG-09: second follow-up harus ikut dijadwalkan', () => {

    it('menjadwalkan HANYA first follow-up kalau service tidak punya second config', async () => {
        const svcId = oid();
        const invoice = makeInvoice({ items: [makeServiceItem(svcId)] });

        mockInvoiceFindById.mockReturnValue(withLean(invoice));
        mockServiceFind.mockReturnValue({
            select: () => ({ lean: () => Promise.resolve([makeService(svcId)]) }),
        });

        const count = await scheduleFollowUp(String(invoice._id), 'test-tenant');

        expect(count).toBe(1);
        const inserted = mockInsertMany.mock.calls[0][0] as any[];
        expect(inserted).toHaveLength(1);
        expect(inserted[0].status).toBe('pending');
    });

    it('menjadwalkan DUA pending docs (first + second) kalau service punya second config lengkap', async () => {
        const svcId = oid();
        const firstTemplateId = oid();
        const secondTemplateId = oid();
        const invoice = makeInvoice({ items: [makeServiceItem(svcId)] });

        mockInvoiceFindById.mockReturnValue(withLean(invoice));
        mockServiceFind.mockReturnValue({
            select: () => ({
                lean: () => Promise.resolve([
                    makeService(svcId, {
                        firstTemplateId,
                        firstDelayValue: 3,
                        firstDelayUnit: 'day',
                        secondTemplateId,
                        secondDelayValue: 7,
                        secondDelayUnit: 'day',
                    }),
                ]),
            }),
        });

        const count = await scheduleFollowUp(String(invoice._id), 'test-tenant');

        expect(count).toBe(2);
        const inserted = mockInsertMany.mock.calls[0][0] as any[];
        expect(inserted).toHaveLength(2);
        expect(inserted.every((d: any) => d.status === 'pending')).toBe(true);

        const templateIds = inserted.map((d: any) => String(d.templateId));
        expect(templateIds).toContain(String(firstTemplateId));
        expect(templateIds).toContain(String(secondTemplateId));
    });

    it('scheduledAt second follow-up lebih jauh dari first', async () => {
        const svcId = oid();
        const invoice = makeInvoice({ items: [makeServiceItem(svcId)] });

        mockInvoiceFindById.mockReturnValue(withLean(invoice));
        mockServiceFind.mockReturnValue({
            select: () => ({
                lean: () => Promise.resolve([
                    makeService(svcId, {
                        firstDelayValue: 3,
                        firstDelayUnit: 'day',
                        secondTemplateId: oid(),
                        secondDelayValue: 7,
                        secondDelayUnit: 'day',
                    }),
                ]),
            }),
        });

        await scheduleFollowUp(String(invoice._id), 'test-tenant');

        const inserted = mockInsertMany.mock.calls[0][0] as any[];
        const sorted = [...inserted].sort(
            (a: any, b: any) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
        );
        expect(new Date(sorted[1].scheduledAt).getTime()).toBeGreaterThan(
            new Date(sorted[0].scheduledAt).getTime()
        );
    });

    it('tidak menjadwalkan second kalau secondDelayValue = 0', async () => {
        const svcId = oid();
        const invoice = makeInvoice({ items: [makeServiceItem(svcId)] });

        mockInvoiceFindById.mockReturnValue(withLean(invoice));
        mockServiceFind.mockReturnValue({
            select: () => ({
                lean: () => Promise.resolve([
                    makeService(svcId, {
                        secondTemplateId: oid(),
                        secondDelayValue: 0,
                        secondDelayUnit: 'day',
                    }),
                ]),
            }),
        });

        const count = await scheduleFollowUp(String(invoice._id), 'test-tenant');
        expect(count).toBe(1);
        const inserted = mockInsertMany.mock.calls[0][0] as any[];
        expect(inserted).toHaveLength(1);
    });

    it('tidak menjadwalkan second kalau secondTemplateId tidak ada', async () => {
        const svcId = oid();
        const invoice = makeInvoice({ items: [makeServiceItem(svcId)] });

        mockInvoiceFindById.mockReturnValue(withLean(invoice));
        mockServiceFind.mockReturnValue({
            select: () => ({
                lean: () => Promise.resolve([
                    makeService(svcId, { secondDelayValue: 7, secondDelayUnit: 'day' }),
                ]),
            }),
        });

        const count = await scheduleFollowUp(String(invoice._id), 'test-tenant');
        expect(count).toBe(1);
    });
});

describe('scheduleFollowUp — prioritas service (lineAmount tertinggi menang)', () => {

    it('kalau dua service eligible, hanya satu yang jadi pending (yang lineAmount lebih besar)', async () => {
        const svcA = oid();
        const svcB = oid();
        const invoice = makeInvoice({
            items: [
                makeServiceItem(svcA, { name: 'Treatment', price: 200000, total: 200000 }),
                makeServiceItem(svcB, { name: 'Haircut', price: 50000, total: 50000 }),
            ],
        });

        mockInvoiceFindById.mockReturnValue(withLean(invoice));
        mockServiceFind.mockReturnValue({
            select: () => ({
                lean: () => Promise.resolve([
                    makeService(svcA, { firstTemplateId: oid() }),
                    makeService(svcB, { firstTemplateId: oid() }),
                ]),
            }),
        });

        const count = await scheduleFollowUp(String(invoice._id), 'test-tenant');

        const inserted = mockInsertMany.mock.calls[0][0] as any[];
        const pendingDocs = inserted.filter((d: any) => d.status === 'pending');
        const failedDocs = inserted.filter((d: any) => d.status === 'failed');

        expect(pendingDocs).toHaveLength(1);
        expect(failedDocs).toHaveLength(1);
        expect(count).toBe(2);
    });

    it('service pemenang dengan second follow-up: pending = 2, failed = 1 untuk loser', async () => {
        const svcA = oid();
        const svcB = oid();
        const invoice = makeInvoice({
            items: [
                makeServiceItem(svcA, { name: 'Treatment', price: 200000, total: 200000 }),
                makeServiceItem(svcB, { name: 'Haircut', price: 50000, total: 50000 }),
            ],
        });

        mockInvoiceFindById.mockReturnValue(withLean(invoice));
        mockServiceFind.mockReturnValue({
            select: () => ({
                lean: () => Promise.resolve([
                    makeService(svcA, {
                        firstTemplateId: oid(),
                        secondTemplateId: oid(),
                        secondDelayValue: 14,
                        secondDelayUnit: 'day',
                    }),
                    makeService(svcB, { firstTemplateId: oid() }),
                ]),
            }),
        });

        const count = await scheduleFollowUp(String(invoice._id), 'test-tenant');

        const inserted = mockInsertMany.mock.calls[0][0] as any[];
        const pendingDocs = inserted.filter((d: any) => d.status === 'pending');
        const failedDocs = inserted.filter((d: any) => d.status === 'failed');

        expect(pendingDocs).toHaveLength(2);
        expect(failedDocs).toHaveLength(1);
        expect(count).toBe(3);
    });
});

describe('scheduleFollowUp — edge cases', () => {

    it('return 0 kalau invoice tidak ditemukan', async () => {
        mockInvoiceFindById.mockReturnValue(withLean(null));
        const count = await scheduleFollowUp(String(oid()), 'test-tenant');
        expect(count).toBe(0);
        expect(mockInsertMany).not.toHaveBeenCalled();
    });

    it('return 0 kalau tidak ada service items di invoice', async () => {
        const invoice = makeInvoice({ items: [] });
        mockInvoiceFindById.mockReturnValue(withLean(invoice));
        const count = await scheduleFollowUp(String(invoice._id), 'test-tenant');
        expect(count).toBe(0);
    });

    it('return 0 kalau service tidak punya waFollowUp.enabled = true', async () => {
        const svcId = oid();
        const invoice = makeInvoice({ items: [makeServiceItem(svcId)] });
        mockInvoiceFindById.mockReturnValue(withLean(invoice));
        mockServiceFind.mockReturnValue({
            select: () => ({
                lean: () => Promise.resolve([makeService(svcId, { enabled: false })]),
            }),
        });

        const count = await scheduleFollowUp(String(invoice._id), 'test-tenant');
        expect(count).toBe(0);
    });

    it('skip pending doc yang templateId-nya sudah ada di DB (dedup)', async () => {
        const svcId = oid();
        const templateId = oid();
        const invoice = makeInvoice({ items: [makeServiceItem(svcId)] });

        mockInvoiceFindById.mockReturnValue(withLean(invoice));
        mockServiceFind.mockReturnValue({
            select: () => ({
                lean: () => Promise.resolve([makeService(svcId, { firstTemplateId: templateId })]),
            }),
        });
        mockWaScheduleFind.mockReturnValue({
            select: () => ({
                lean: () => Promise.resolve([
                    { templateId, scheduledAt: new Date(), status: 'pending' },
                ]),
            }),
        });

        const count = await scheduleFollowUp(String(invoice._id), 'test-tenant');
        expect(count).toBe(0);
        expect(mockInsertMany).not.toHaveBeenCalled();
    });

    it('fallback ke customer phone dari DB kalau invoice tidak punya customerPhone', async () => {
        const svcId = oid();
        const customerId = oid();
        const invoice = makeInvoice({
            customer: customerId,
            customerPhone: '',
            followUpPhoneNumber: '',
            items: [makeServiceItem(svcId)],
        });

        mockInvoiceFindById.mockReturnValue(withLean(invoice));
        mockCustomerFindById.mockReturnValue(withSelect({ phone: '081999888777' }));
        mockServiceFind.mockReturnValue({
            select: () => ({
                lean: () => Promise.resolve([makeService(svcId)]),
            }),
        });

        const count = await scheduleFollowUp(String(invoice._id), 'test-tenant');
        expect(count).toBe(1);
        const inserted = mockInsertMany.mock.calls[0][0] as any[];
        expect(inserted[0].phoneNumber).toBe('6281999888777');
    });
});