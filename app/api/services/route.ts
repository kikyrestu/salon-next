import { getTenantModels } from "@/lib/tenantDb";

import { NextResponse } from "next/server";

 // Ensure it's registered


const normalizeServicePayload = (payload: any) => {
    const body = { ...payload };

    const toLegacyDays = (value: number, unit: string) => {
        if (!Number.isFinite(value) || value <= 0) return 0;
        if (unit === 'minute') return value / 1440;
        if (unit === 'hour') return value / 24;
        return value;
    };

    if (body?.waFollowUp) {
        const firstDelayUnit = body.waFollowUp.firstDelayUnit || 'day';
        const secondDelayUnit = body.waFollowUp.secondDelayUnit || 'day';
        const firstDelayValue = Number(body.waFollowUp.firstDelayValue ?? body.waFollowUp.firstDays ?? 0);
        const secondDelayValue = Number(body.waFollowUp.secondDelayValue ?? body.waFollowUp.secondDays ?? 0);

        body.waFollowUp = {
            ...body.waFollowUp,
            firstDays: toLegacyDays(firstDelayValue, firstDelayUnit),
            secondDays: toLegacyDays(secondDelayValue, secondDelayUnit),
            firstDelayValue,
            firstDelayUnit,
            secondDelayValue,
            secondDelayUnit,
            firstTemplateId: body.waFollowUp.firstTemplateId || undefined,
            secondTemplateId: body.waFollowUp.secondTemplateId || undefined,
        };
    }

    return body;
};

export async function GET(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Service, ServiceCategory } = await getTenantModels(tenantSlug);

    try {
        
        

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

export async function POST(request: Request, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { Service, ServiceCategory } = await getTenantModels(tenantSlug);

    try {
        
        const rawBody = await request.json();
        const body = normalizeServicePayload(rawBody);
        const service = await Service.create(body);
        return NextResponse.json({ success: true, data: service });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ success: false, error: "Failed to create service" }, { status: 500 });
    }
}
