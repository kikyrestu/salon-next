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

// Default values for NEW keys added to non-admin roles
const DEFAULT_FULL_PERMISSION = { view: 'all', create: true, edit: true, delete: true };
const DEFAULT_BOOLEAN_PERMISSION = { view: true };

// Shared logic
async function migratePermissions() {
    try {
        await connectDB();

        const roles = await Role.find({});
        const results: { name: string; added: string[] }[] = [];

        for (const role of roles) {
            const permissions = role.permissions || {};
            const added: string[] = [];
            const isAdmin = role.name.toLowerCase() === 'admin' || role.name.toLowerCase() === 'super admin';

            for (const [key, adminDefault] of Object.entries(FULL_PERMISSION_KEYS)) {
                if (!(key in permissions)) {
                    // For admin roles, grant full access. For others, also grant full access
                    // since the user likely wants all menus visible.
                    // If you want non-admin roles to default to 'none', change this logic.
                    if (isAdmin) {
                        permissions[key] = adminDefault;
                    } else {
                        // Grant view access so menus show up, but no create/edit/delete
                        if ('create' in adminDefault) {
                            permissions[key] = { view: 'all', create: false, edit: false, delete: false };
                        } else {
                            permissions[key] = { view: true };
                        }
                    }
                    added.push(key);
                }
            }

            if (added.length > 0) {
                role.permissions = permissions;
                role.markModified('permissions');
                await role.save();
                results.push({ name: role.name, added });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Migrated ${results.length} roles`,
            details: results,
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// GET & POST /api/roles/migrate-permissions
export async function GET() { return migratePermissions(); }
export async function POST() { return migratePermissions(); }
