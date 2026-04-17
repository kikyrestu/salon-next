
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import ServiceCategory from "@/models/ServiceCategory";

export async function GET(request: Request) {
    try {
        await connectToDB();
        const categories = await ServiceCategory.find({ status: "active" }).sort({ name: 1 });
        return NextResponse.json({ success: true, data: categories });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to fetch categories" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await connectToDB();
        const body = await request.json();
        const category = await ServiceCategory.create(body);
        return NextResponse.json({ success: true, data: category });
    } catch (error) {
        return NextResponse.json({ success: false, error: "Failed to create category" }, { status: 500 });
    }
}
