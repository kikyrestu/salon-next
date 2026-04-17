import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';

export async function GET() {
    try {
        await dbConnect();
        return NextResponse.json(
            {
                success: true,
                message: 'Database connected successfully!'
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Database test error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message,
                details: {
                    name: error.name,
                    code: error.code,
                }
            },
            { status: 500 }
        );
    }
}
