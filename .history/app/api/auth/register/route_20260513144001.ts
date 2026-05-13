import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/rbac';

export async function POST(req: NextRequest, props: any) {
    const tenantSlug = req.headers.get('x-store-slug') || 'pusat';
    const { User } = await getTenantModels(tenantSlug);

    try {
        // [B12 FIX] Endpoint ini harus di-protect — hanya user dengan users.create yang boleh daftar akun baru
        const permissionError = await checkPermission(req, 'users', 'create');
        if (permissionError) return permissionError;

        const body = await req.json();

        const { name, email, password } = body;

        // Validate input
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required' },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }

        // Additional password strength validation
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
        if (!passwordRegex.test(password)) {
            return NextResponse.json(
                { error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { error: 'User already exists with this email' },
                { status: 409 }
            );
        }

        // Create new user (password will be hashed by the pre-save hook)
        const user = await User.create({
            name,
            email,
            password,
        });

        // Return success (don't send password back)
        return NextResponse.json(
            {
                message: 'User created successfully',
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                },
            },
            { status: 201 }
        );
    } catch (error: any) {
        // Handle validation errors
        if (error.name === 'ValidationError') {
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            );
        }

        // Handle MongoDB connection errors
        if (error.name === 'MongooseError' || error.message?.includes('connect')) {
            return NextResponse.json(
                { error: 'Database connection failed. Please check your MongoDB connection string.' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                error: 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            },
            { status: 500 }
        );
    }
}