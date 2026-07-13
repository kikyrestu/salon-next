import { NextRequest, NextResponse } from 'next/server';
import { requireInternalApiKey } from '@/lib/internalAuth';
import { getMasterModels } from '@/lib/masterDb';
import { checkRateLimit } from '@/lib/rateLimiter';

// PHP panel POST username+password ke sini, Next.js yang validasi (bcrypt compare
// jalan di sini, bukan di PHP) lalu PHP yang bikin session-nya sendiri kalau valid.
// Internal API key (header) itu shared secret ANTAR SERVER (PHP <-> Next.js), beda
// layer sama username/password si admin manusia - makanya tetep di-rate-limit per
// username biar gak kena credential stuffing walau internal key-nya udah bocor duluan.
export async function POST(request: NextRequest) {
    const auth = requireInternalApiKey(request);
    if (!auth.authorized) return auth.response!;

    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ success: false, error: 'Username dan password wajib diisi.' }, { status: 400 });
        }

        const rateLimit = await checkRateLimit(`platform-admin-login:${username.toLowerCase().trim()}`, 15 * 60 * 1000, 5);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, error: 'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.' },
                { status: 429 }
            );
        }

        const master = await getMasterModels();
        const admin = await master.PlatformAdmin.findOne({ username: username.toLowerCase().trim() }).select(
            '+passwordHash'
        );

        // Pesan error SENGAJA disamain buat "gak ketemu" vs "password salah" -
        // biar gak bocorin username mana yang valid ke orang yang nyoba brute-force.
        const genericError = { success: false, error: 'Username atau password salah.' };

        if (!admin || !admin.isActive) {
            return NextResponse.json(genericError, { status: 401 });
        }

        const isValid = await admin.comparePassword(password);
        if (!isValid) {
            return NextResponse.json(genericError, { status: 401 });
        }

        admin.lastLoginAt = new Date();
        await admin.save();

        return NextResponse.json({
            success: true,
            data: {
                id: admin._id,
                username: admin.username,
                name: admin.name,
                role: admin.role,
            },
        });
    } catch (error: any) {
        console.error('[internal/saas/admins/login][POST] error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
