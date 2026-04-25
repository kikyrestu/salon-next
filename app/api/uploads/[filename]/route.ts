import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import fs from "fs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
    try {
        const { filename } = await params;
        const filePath = path.join(process.cwd(), "public", "uploads", filename);
        
        if (!fs.existsSync(filePath)) {
            return new NextResponse("Not Found", { status: 404 });
        }

        const file = await readFile(filePath);
        
        // Determine content type based on extension
        const ext = path.extname(filename).toLowerCase();
        let contentType = "image/jpeg";
        if (ext === ".png") contentType = "image/png";
        else if (ext === ".webp") contentType = "image/webp";
        else if (ext === ".gif") contentType = "image/gif";
        
        return new NextResponse(file, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch (e) {
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
