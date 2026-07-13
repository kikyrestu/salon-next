import { NextRequest, NextResponse } from 'next/server';
import { approveRegistration, rejectRegistration } from '@/lib/provisioning';

function validatePin(request: NextRequest) {
    const headerPin = request.headers.get('x-admin-pin');
    const cookiePin = request.cookies.get('admin_pin')?.value;
    const pin = headerPin || cookiePin;
    const correctPin = process.env.ADMIN_PIN || '123456';
    return pin === correctPin;
}

// NOTE: route ini masih dipertahankan (PIN auth) sampai panel PHP live, sesuai
// blueprint-teknis-internal.md section 1.3 & 4. Logic approve/reject-nya udah
// dipindah ke lib/provisioning.ts biar bisa dipakai bareng sama
// /api/internal/saas/registrations/[id]/approve (dipanggil PHP panel / payment webhook nanti).
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!validatePin(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { action, rejectionReason } = body;
        const { id } = await params;

        if (!action || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
        }

        if (action === 'approve') {
            const result = await approveRegistration(id);
            if (!result.ok) {
                return NextResponse.json({ success: false, error: result.error }, { status: result.status });
            }
            return NextResponse.json({ success: true, message: 'Toko berhasil di-approve dan siap digunakan!' });
        } else {
            const result = await rejectRegistration(id, rejectionReason);
            if (!result.ok) {
                return NextResponse.json({ success: false, error: result.error }, { status: result.status });
            }
            return NextResponse.json({ success: true, message: 'Pendaftaran ditolak.' });
        }
    } catch (error: any) {
        console.error('Approve/Reject error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
