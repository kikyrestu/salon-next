
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/mongodb";
import Service from "@/models/Service";
import ServiceCategory from "@/models/ServiceCategory"; // Ensure it's registered
import { initModels } from "@/lib/initModels";

const normalizeServicePayload = (payload: any) => {
    const body = { ...payload };

    if (body?.waFollowUp) {
        body.waFollowUp = {
            ...body.waFollowUp,
            firstDays: Number(body.waFollowUp.firstDays || 0),
            secondDays: Number(body.waFollowUp.secondDays || 0),
            firstTemplateId: body.waFollowUp.firstTemplateId || undefined,
            secondTemplateId: body.waFollowUp.secondTemplateId || undefined,
        };
    }

    return body;
};

export async function GET(request: Request) {
    try {
        await connectToDB();
        initModels();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const categoryId = searchParams.get("category");
        const search = searchParams.get("search");

        const query: any = { status: "active" };
        if (categoryId) query.category = categoryId;
        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        const total = await Service.countDocuments(query);
        const services = await Service.find(query)
            .populate("category", "name")
            .sort({ name: 1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return NextResponse.json({
            success: true,
            data: services,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: "Failed to fetch services" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await connectToDB();
        const rawBody = await request.json();
        const body = normalizeServicePayload(rawBody);
        const service = await Service.create(body);
        return NextResponse.json({ success: true, data: service });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: "Failed to create service" }, { status: 500 });
    }
}
