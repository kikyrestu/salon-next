import { getTenantModels } from "@/lib/tenantDb";
import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/rbac';



export async function GET(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { WaSchedule, WaFollowUpContact } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, 'services', 'view');
        if (permissionError) return permissionError;

        

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '5')));
        const search = String(searchParams.get('search') || '').trim();

        const query: any = {};
        if (search) {
            query.phoneNumber = { $regex: search.replace(/[-+\s]/g, ''), $options: 'i' };
        }

        const total = await WaFollowUpContact.countDocuments(query);
        const pages = Math.max(1, Math.ceil(total / limit));
        const currentPage = Math.min(page, pages);

        const contacts = await WaFollowUpContact.find(query)
            .sort({ updatedAt: -1 })
            .skip((currentPage - 1) * limit)
            .limit(limit)
            .lean<any[]>();

        const phones = contacts.map((contact: any) => String(contact.phoneNumber || '').trim()).filter(Boolean);

        const scheduleStats = phones.length > 0
            ? await WaSchedule.aggregate([
                { $match: { phoneNumber: { $in: phones } } },
                {
                    $group: {
                        _id: '$phoneNumber',
                        totalSessions: { $sum: 1 },
                        pendingCount: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'pending'] }, 1, 0],
                            },
                        },
                        sentCount: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'sent'] }, 1, 0],
                            },
                        },
                        failedCount: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'failed'] }, 1, 0],
                            },
                        },
                        lastScheduledAt: { $max: '$scheduledAt' },
                    },
                },
            ])
            : [];

        const statsMap = new Map<string, any>(
            scheduleStats.map((item: any) => [String(item._id || ''), item])
        );

        const items = contacts.map((contact: any) => {
            const phone = String(contact.phoneNumber || '').trim();
            const stat = statsMap.get(phone);

            return {
                phoneNumber: phone,
                isActive: Boolean(contact.isActive),
                totalSessions: Number(stat?.totalSessions || 0),
                pendingCount: Number(stat?.pendingCount || 0),
                sentCount: Number(stat?.sentCount || 0),
                failedCount: Number(stat?.failedCount || 0),
                lastScheduledAt: stat?.lastScheduledAt,
                firstCreatedAt: contact.createdAt,
            };
        });

        return NextResponse.json({
            success: true,
            data: items,
            pagination: {
                total,
                page: currentPage,
                limit,
                pages,
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Failed to fetch follow-up sessions' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest, props: any) {
    const tenantSlug = request.headers.get('x-store-slug') || 'pusat';
    const { WaSchedule, WaFollowUpContact } = await getTenantModels(tenantSlug);

    try {
        const permissionError = await checkPermission(request, 'services', 'edit');
        if (permissionError) return permissionError;

        
        const body = await request.json();
        const phoneNumber = String(body?.phoneNumber || '').trim();
        const isActive = Boolean(body?.isActive);

        if (!phoneNumber) {
            return NextResponse.json({ success: false, error: 'phoneNumber is required' }, { status: 400 });
        }

        const contact = await WaFollowUpContact.findOneAndUpdate(
            { phoneNumber },
            {
                $set: {
                    isActive,
                    lastSeenAt: new Date(),
                },
                $setOnInsert: {
                    phoneNumber,
                    lastSource: 'other',
                },
            },
            { upsert: true, new: true }
        ).lean<any>();

        return NextResponse.json({
            success: true,
            data: {
                phoneNumber: contact?.phoneNumber,
                isActive: Boolean(contact?.isActive),
            },
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Failed to update follow-up contact status' },
            { status: 500 }
        );
    }
}
