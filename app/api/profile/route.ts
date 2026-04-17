import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { User } from '@/lib/initModels';
import { auth } from '@/auth';
import bcrypt from 'bcryptjs';

// GET /api/profile - Get current user profile
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session || !session.user?.email) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        await connectDB();

        const user = await User.findOne({ email: session.user.email }).select('-password');
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: user
        });
    } catch (error: any) {
        console.error('Error fetching profile:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT /api/profile - Update user profile
export async function PUT(request: NextRequest) {
    try {
        const session = await auth();
        if (!session || !session.user?.email) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        await connectDB();
        const body = await request.json();
        const { name, email, password, confirmPassword } = body;

        // Validate required fields
        if (!email) {
            return NextResponse.json(
                { success: false, error: 'Email is required' },
                { status: 400 }
            );
        }

        // Find current user
        const user = await User.findOne({ email: session.user.email });
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        // Check if email is being changed and if it's already taken
        if (email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return NextResponse.json(
                    { success: false, error: 'Email is already in use' },
                    { status: 400 }
                );
            }
            user.email = email;
        }

        // Update name
        if (name) {
            user.name = name;
        }

        // Update password if provided
        if (password) {
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

            if (password !== confirmPassword) {
                return NextResponse.json(
                    { success: false, error: 'Passwords do not match' },
                    { status: 400 }
                );
            }

            // Password hashing is handled by the pre-save hook in User model
            // But we need to explicitly set it so isModified returns true
            user.password = password;
        }

        await user.save();

        // Return updated user without password
        const { password: _, ...updatedUser } = user.toObject();

        return NextResponse.json({
            success: true,
            data: updatedUser,
            message: 'Profile updated successfully'
        });

    } catch (error: any) {
        console.error('Error updating profile:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
