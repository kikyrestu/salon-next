import { NextRequest, NextResponse } from 'next/server';
import { requireInternalApiKey } from '@/lib/internalAuth';
import { getMasterModels } from '@/lib/masterDb';

// Sengaja gak ada authorization tambahan selain internal API key (sama kayak
// endpoint saas/* lainnya) - dipakai buat 2 hal:
//   1. Bootstrap admin PERTAMA (chicken-and-egg: gak ada cara login ke panel
//      PHP kalau belum ada 1 pun row PlatformAdmin).
//   2. Nanti dipanggil dari halaman "Kelola Admin" di panel PHP, yang otorisasinya
//      (cuma super_admin yang boleh buat admin baru) di-enforce di sisi PHP
//      pakai session admin yang login - bukan di layer internal API ini.
export async function GET(request: NextRequest) {
    const auth = requireInternalApiKey(request);
    if (!auth.authorized) return auth.response!;

    try {
        const master = await getMasterModels();
        const admins = await master.PlatformAdmin.find().sort({ createdAt: -1 });
        return NextResponse.json({ success: true, data: admins });
    } catch (error: any) {
        console.error('[internal/saas/admins][GET] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = requireInternalApiKey(request);
    if (!auth.authorized) return auth.response!;

    try {
        const master = await getMasterModels();
        const body = await request.json();
        const { username, password, name, role } = body;

        if (!username || !password || !name) {
            return NextResponse.json(
                { success: false, error: 'username, password, dan name wajib diisi.' },
                { status: 400 }
            );
        }
        if (password.length < 8) {
            return NextResponse.json(
                { success: false, error: 'Password minimal 8 karakter.' },
                { status: 400 }
            );
        }

        const existing = await master.PlatformAdmin.findOne({ username: username.toLowerCase().trim() });
        if (existing) {
            return NextResponse.json({ success: false, error: `Username "${username}" sudah dipakai.` }, { status: 400 });
        }

        // passwordHash di sini masih plaintext pas dikirim ke .create() - hashing
        // beneran kejadian di PlatformAdminSchema.pre('save') (models/PlatformAdmin.ts).
        const admin = await master.PlatformAdmin.create({
            username,
            passwordHash: password,
            name,
            role: role === 'staff' ? 'staff' : 'super_admin',
            isActive: true,
        });

        return NextResponse.json(
            {
                success: true,
                data: { id: admin._id, username: admin.username, name: admin.name, role: admin.role },
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error('[internal/saas/admins][POST] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
