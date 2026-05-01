import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';


export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { User, Role } = await getTenantModels(tenantSlug);

    try {
        

        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        if (!email) {
            return NextResponse.json(
                { success: false, error: 'Please provide an email query parameter, e.g., /api/seed-admin?email=your@email.com' },
                { status: 400 }
            );
        }

        // 1. Define resources with standard IPermission structure
        const standardResources = [
            'sales',
            'purchases',
            'products',
            'returns',
            'stock_transfers',
            'expenses',
            'customers',
            'suppliers',
            'users',
            'roles',
            'categories',
            'brands',
            'sale_returns',
            'purchase_returns',
            'deposits',
            'stock_adjustments',
            'reports',
            'invoices'
        ];

        const allPermissions: any = {
            dashboard: { view: true }, // Boolean
            settings: { view: true, edit: true } // Boolean
        };

        standardResources.forEach(resource => {
            allPermissions[resource] = {
                view: 'all',
                create: true,
                edit: true,
                delete: true
            };
        });

        // 2. Create or Update Super Admin Role
        const roleData = {
            name: 'Super Admin',
            description: 'Full access to all system resources',
            permissions: allPermissions
        };

        const role: any = await Role.findOneAndUpdate(
            { name: 'Super Admin' },
            roleData,
            { new: true, upsert: true }
        );

        console.log('Super Admin Role secured:', role._id);

        // 3. Find User and Assign Role
        const user: any = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });

        if (!user) {
            return NextResponse.json(
                { success: false, error: `User with email ${email} not found` },
                { status: 404 }
            );
        }

        user.role = role._id;
        await user.save();

        return NextResponse.json({
            success: true,
            message: `Successfully assigned Super Admin role to ${user.email}`,
            role: role,
            user: {
                id: user._id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error: any) {
        console.error('Seeding error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
