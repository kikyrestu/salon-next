import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Role } from '@/lib/initModels';
import { checkPermission } from '@/lib/rbac';

// GET /api/roles - List all roles
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        // Check Permissions
        const permissionError = await checkPermission(request, 'roles', 'view');
        if (permissionError) return permissionError;

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";

        const query: any = {};

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        const skip = (page - 1) * limit;

        const [roles, total] = await Promise.all([
            Role.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Role.countDocuments(query)
        ]);

        return NextResponse.json({
            success: true,
            data: roles,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST /api/roles - Create new role
export async function POST(request: NextRequest) {
    try {
        await connectDB();

        // Check Permissions
        const permissionError = await checkPermission(request, 'roles', 'create');
        if (permissionError) return permissionError;

        const body = await request.json();

        if (!body.name) {
            return NextResponse.json(
                { success: false, error: "Role name is required" },
                { status: 400 }
            );
        }

        const role = await Role.create(body);
        return NextResponse.json({ success: true, data: role }, { status: 201 });
    } catch (error: any) {
        if (error.code === 11000) {
            return NextResponse.json(
                { success: false, error: "Role name already exists" },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
