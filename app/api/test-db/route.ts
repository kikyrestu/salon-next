import { NextResponse } from 'next/server';

export async function GET() {
    try {
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
