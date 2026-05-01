import { NextRequest, NextResponse } from 'next/server';
import { getTenantModels } from '@/lib/tenantDb';

/**
 * Initial Setup API - Creates Super Admin Role and First Admin User
 * This endpoint should only be accessible when no users exist in the system
 */
export async function POST(request: NextRequest, props: any) {
    try {
        console.log('🚀 Starting initial setup...');
        const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
        const { User, Role } = await getTenantModels(tenantSlug);

        // Check if any users already exist
        const existingUsers = await User.countDocuments();
        if (existingUsers > 0) {
            console.log('⚠️ Setup already completed (users found)');
            return NextResponse.json(
                {
                    success: false,
                    error: 'Setup already completed. Users already exist in the system.'
                },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { name, email, password } = body;

        // Validate required fields
        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: 'Email and password are required' },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { success: false, error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }

        // Additional password strength validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
        if (!passwordRegex.test(password)) {
            return NextResponse.json(
                { success: false, error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' },
                { status: 400 }
            );
        }

        // 1. Create or Update Super Admin Role with all permissions
        const standardResources = [
            'appointments',
            'pos',
            'services',
            'products',
            'purchases',
            'usageLogs',
            'staff',
            'staffSlots',
            'customers',
            'suppliers',
            'payroll',
            'expenses',
            'reports',
            'users',
            'roles',
            'invoices',
            'activityLogs',
            'calendarView'
        ];

        const allPermissions: any = {
            dashboard: { view: true },
            settings: { view: true, edit: true },
            aiReports: { view: true } // aiReports is boolean view only
        };

        standardResources.forEach(resource => {
            allPermissions[resource] = {
                view: 'all',
                create: true,
                edit: true,
                delete: true
            };
        });

        // Use findOneAndUpdate with upsert to avoid duplicate key errors if a role was partially created
        const superAdminRole = await Role.findOneAndUpdate(
            { name: 'Super Admin' },
            {
                $setOnInsert: {
                    name: 'Super Admin',
                    description: 'Full access to all system resources',
                    isSystem: true
                },
                $set: {
                    permissions: allPermissions
                }
            },
            { upsert: true, new: true }
        );

        console.log('✅ Super Admin Role ready:', superAdminRole._id);

        // 2. Create first admin user
        // We use create instead of findOneAndUpdate here because we want to trigger the 'pre-save' hook for password hashing
        const adminUser = await User.create({
            name: name || 'Administrator',
            email: email.toLowerCase().trim(),
            password: password,
            role: superAdminRole._id
        });

        console.log('✅ Admin User created:', adminUser.email);

        return NextResponse.json({
            success: true,
            message: 'Setup completed successfully! You can now login with your credentials.',
            data: {
                user: {
                    id: adminUser._id,
                    name: adminUser.name,
                    email: adminUser.email
                },
                role: {
                    id: superAdminRole._id,
                    name: superAdminRole.name
                }
            }
        }, { status: 201 });

    } catch (error: any) {
        console.error('❌ Setup error detailed:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to complete setup' },
            { status: 500 }
        );
    }
}

/**
 * Check if setup is required
 */
export async function GET(request: Request, props: any) {
    try {
        const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
        const { User, Role } = await getTenantModels(tenantSlug);

        const userCount = await User.countDocuments();
        const roleCount = await Role.countDocuments();

        return NextResponse.json({
            success: true,
            setupRequired: userCount === 0,
            stats: {
                users: userCount,
                roles: roleCount
            }
        });

    } catch (error: any) {
        console.error('❌ Setup check error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
