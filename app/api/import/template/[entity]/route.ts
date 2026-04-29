/**
 * GET /api/import/template/[entity]
 * Download an empty Excel template for the given entity.
 */
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { generateTemplate, ENTITY_COLUMNS, ENTITY_LABEL, EntityType } from '@/lib/excel';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ entity: string }> }
) {
    const { entity: rawEntity } = await params;
    const entity = rawEntity as EntityType;

    if (!ENTITY_COLUMNS[entity]) {
        return NextResponse.json(
            { success: false, error: `Unknown entity: "${rawEntity}". Valid: ${Object.keys(ENTITY_COLUMNS).join(', ')}` },
            { status: 400 }
        );
    }

    try {
        const wb = generateTemplate(entity);
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

        const filename = `template_${entity}.xlsx`;
        return new NextResponse(new Uint8Array(buf), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-cache',
            },
        });
    } catch (err: any) {
        console.error('Template generation error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
