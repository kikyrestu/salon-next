import { getTenantModels } from '@/lib/tenantDb';
import { getMasterModels } from '@/lib/masterDb';

// Single source of truth — tambah resource baru di sini, otomatis ke semua role saat server start
export const FULL_PERMISSION_KEYS: Record<string, any> = {
    dashboard: { view: true },
    appointments: { view: 'all', create: true, edit: true, delete: true },
    pos: { view: 'all', create: true, edit: true, delete: true },
    services: { view: 'all', create: true, edit: true, delete: true },
    products: { view: 'all', create: true, edit: true, delete: true },
    staff: { view: 'all', create: true, edit: true, delete: true },
    customers: { view: 'all', create: true, edit: true, delete: true },
    suppliers: { view: 'all', create: true, edit: true, delete: true },
    expenses: { view: 'all', create: true, edit: true, delete: true },
    purchases: { view: 'all', create: true, edit: true, delete: true },
    invoices: { view: 'all', create: true, edit: true, delete: true },
    deposits: { view: 'all', create: true, edit: true, delete: true },
    payroll: { view: 'all', create: true, edit: true, delete: true },
    vouchers: { view: 'all', create: true, edit: true, delete: true },
    usageLogs: { view: 'all', create: true, edit: true, delete: true },
    reports: { view: 'all', create: true, edit: true, delete: true },
    users: { view: 'all', create: true, edit: true, delete: true },
    roles: { view: 'all', create: true, edit: true, delete: true },
    staffSlots: { view: 'all', create: true, edit: true, delete: true },
    bundles: { view: 'all', create: true, edit: true, delete: true },
    packages: { view: 'all', create: true, edit: true, delete: true },
    membership: { view: 'all', create: true, edit: true, delete: true },
    waTemplates: { view: 'all', create: true, edit: true, delete: true },
    aiReports: { view: true },
    calendarView: { view: true },
    activityLogs: { view: true },
    settings: { view: true, edit: true },
};

// Migrate satu tenant
export async function migratePermissionsForTenant(slug: string): Promise<{ name: string; updated: string[] }[]> {
    const { Role } = await getTenantModels(slug);
    const roles = await Role.find({});
    const results: { name: string; updated: string[] }[] = [];

    for (const role of roles) {
        const permissions = role.permissions || {};
        const updated: string[] = [];
        const isAdmin = role.name.toLowerCase() === 'admin' || role.name.toLowerCase() === 'super admin';

        for (const [key, adminDefault] of Object.entries(FULL_PERMISSION_KEYS)) {
            if (isAdmin) {
                permissions[key] = adminDefault;
                updated.push(key);
            } else {
                // Non-admin: hanya tambah kalau key belum ada di DB (tidak override yang sudah diset)
                if (!(key in permissions)) {
                    if ('create' in adminDefault) {
                        permissions[key] = { view: 'none', create: false, edit: false, delete: false };
                    } else {
                        permissions[key] = { view: false };
                    }
                    updated.push(key);
                }
            }
        }

        role.permissions = permissions;
        role.markModified('permissions');
        await role.save();
        results.push({ name: role.name, updated });
    }

    return results;
}

// Migrate semua tenant (dipanggil saat server start)
export async function migratePermissionsAllTenants(): Promise<void> {
    try {
        // Ambil semua slug dari Master DB
        const master = await getMasterModels();
        const stores = master.Store ? await master.Store.find({ isActive: true }).select('slug') : [];
        const slugs: string[] = stores.map((s: any) => s.slug);

        // Selalu include 'pusat' (fallback tenant)
        if (!slugs.includes('pusat')) slugs.push('pusat');

        for (const slug of slugs) {
            try {
                const results = await migratePermissionsForTenant(slug);
                const totalUpdated = results.reduce((sum, r) => sum + r.updated.length, 0);
                if (totalUpdated > 0) {
                    console.log(`🔑 [migrate-permissions] Tenant "${slug}": ${results.length} roles, ${totalUpdated} fields updated`);
                }
            } catch (err: any) {
                // Jangan crash server kalau satu tenant gagal
                console.error(`⚠️ [migrate-permissions] Tenant "${slug}" failed:`, err.message);
            }
        }
    } catch (err: any) {
        console.error('⚠️ [migrate-permissions] Master DB lookup failed, migrating pusat only:', err.message);
        try {
            await migratePermissionsForTenant('pusat');
        } catch (e: any) {
            console.error('⚠️ [migrate-permissions] pusat fallback also failed:', e.message);
        }
    }
}