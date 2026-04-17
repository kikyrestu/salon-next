import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { User, Role } from '@/lib/initModels';
import { checkPermission } from '@/lib/rbac';

// GET /api/users - List all users
export async function GET(request: NextRequest) {
    try {
        await connectDB();

        // Check Permissions
        const permissionError = await checkPermission(request, 'users', 'view');
        if (permissionError) return permissionError;

        // Ensure roles are loaded
        if (!Role) {
            console.log("Role model not loaded");
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const search = searchParams.get("search") || "";

        const query: any = {};

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            User.find(query)
                .select('-password') // Exclude password
                .populate('role', 'name description') // Populate role details
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments(query)
        ]);

        return NextResponse.json({
            success: true,
            data: users,
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

// POST /api/users - Create new user (Admin only)
export async function POST(request: NextRequest) {
    try {
        await connectDB();

        // Check Permissions
        const permissionError = await checkPermission(request, 'users', 'create');
        if (permissionError) return permissionError;

        const body = await request.json();

        // Check if email already exists
        const existingUser = await User.findOne({ email: body.email });
        if (existingUser) {
            return NextResponse.json(
                { success: false, error: "Email already registered" },
                { status: 400 }
            );
        }

        const user: any = await User.create(body);

        // Return without password
        const userObj = user.toObject();
        delete userObj.password;

        return NextResponse.json({ success: true, data: userObj }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
