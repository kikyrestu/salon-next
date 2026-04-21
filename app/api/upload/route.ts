import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        const filePath = path.join(uploadDir, fileName);

        await writeFile(filePath, buffer);

        return NextResponse.json({ 
            success: true, 
            url: `/uploads/${fileName}` 
        });
    } catch (error: any) {
        console.error('File upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
