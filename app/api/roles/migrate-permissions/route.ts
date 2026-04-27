import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Role } from '@/lib/initModels';

// All permission keys that should exist on every role
const FULL_PERMISSION_KEYS: Record<string, any> = {
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

// Force-update ALL permission keys on ALL roles
async function migratePermissions() {
    try {
        await connectDB();

        const roles = await Role.find({});
        const results: { name: string; updated: string[] }[] = [];

        for (const role of roles) {
            const permissions = role.permissions || {};
            const updated: string[] = [];
            const isAdmin = role.name.toLowerCase() === 'admin' || role.name.toLowerCase() === 'super admin';

            for (const [key, adminDefault] of Object.entries(FULL_PERMISSION_KEYS)) {
                if (isAdmin) {
                    // Admin always gets FULL access for every key
                    permissions[key] = adminDefault;
                    updated.push(key);
                } else {
                    // Non-admin: only add if missing
                    if (!(key in permissions)) {
                        if ('create' in adminDefault) {
                            permissions[key] = { view: 'all', create: false, edit: false, delete: false };
                        } else {
                            permissions[key] = { view: true };
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

        return NextResponse.json({
            success: true,
            message: `Force-migrated ${results.length} roles`,
            details: results,
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// GET & POST both work
export async function GET() { return migratePermissions(); }
export async function POST() { return migratePermissions(); }
