import { NextRequest, NextResponse } from 'next/server';
import { getTenantModels } from '@/lib/tenantDb';

export async function GET(req: NextRequest) {
    try {
        const models = await getTenantModels('pusat');
        const WaSchedule = Array.isArray(models) ? (models as any).WaSchedule : (models as any).WaSchedule;
        
        const schedules = await WaSchedule.find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('templateId');
            
        return NextResponse.json({ success: true, count: schedules.length, schedules });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
