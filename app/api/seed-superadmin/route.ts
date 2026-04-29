/**
 * GET /api/seed-superadmin
 * Creates a Super Admin user with full permissions.
 * DELETE THIS FILE AFTER USE IN PRODUCTION.
 */
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { User, Role } from '@/lib/initModels';

export async function GET() {
    try {
        await connectDB();

        const email = 'superadmin@salon.com';
        const password = 'Admin@123';
        const name = 'Super Admin';

        // Build full permissions
        const resources = [
            'sales', 'purchases', 'products', 'returns', 'stock_transfers',
            'expenses', 'customers', 'suppliers', 'users', 'roles',
            'categories', 'brands', 'sale_returns', 'purchase_returns',
            'deposits', 'stock_adjustments', 'reports', 'invoices',
            'services', 'staff', 'appointments', 'payroll', 'pos',
            'membership', 'vouchers', 'bundles', 'packages',
            'waTemplates', 'usageLogs', 'staffSlots', 'aiReports',
            'activityLogs', 'calendarView',
        ];

        const permissions: any = {
            dashboard: { view: true },
            settings: { view: true, edit: true },
        };

        resources.forEach(r => {
            permissions[r] = { view: 'all', create: true, edit: true, delete: true };
        });

        // Upsert role
        const role: any = await Role.findOneAndUpdate(
            { name: 'Super Admin' },
            { name: 'Super Admin', description: 'Full access', permissions },
            { new: true, upsert: true }
        );

        // Upsert user
        let user: any = await User.findOne({ email });
        if (user) {
            user.role = role._id;
            user.name = name;
            await user.save();
        } else {
            user = await User.create({ email, password, name, role: role._id });
        }

        return NextResponse.json({
            success: true,
            message: `Super Admin ready! Login with: ${email} / ${password}`,
            user: { id: user._id, email: user.email, name: user.name },
        });
    } catch (error: any) {
        console.error('Seed error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
