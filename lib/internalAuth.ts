import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Dipakai khusus buat /api/internal/saas/* — endpoint yang nanti dikonsumsi panel
// admin PHP (arsitektur Opsi B, lihat blueprint-teknis-internal.md section 2).
// SENGAJA dipisah dari validatePin() yang ada di app/api/admin/* (PIN lama, bakal
// dihapus begitu panel PHP live) dan dari protectAPI() di lib/protect-api.ts
// (itu buat session NextAuth user tenant/POS, beda konteks otentikasi sama sekali).
//
// Key dibaca dari header `x-internal-api-key`, dibandingkan pakai timing-safe
// compare (bukan `===` biasa kayak validatePin() yang sekarang) buat ngurangin
// exposure ke timing attack.

const HEADER_NAME = 'x-internal-api-key';

function getConfiguredKey(): string | null {
    const key = process.env.INTERNAL_API_KEY;
    if (!key || key.trim().length === 0) return null;
    return key;
}

function timingSafeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    // Buffer harus sama panjang buat timingSafeEqual, kalau beda panjang udah pasti gak cocok
    // tapi tetep kita bandingin ke buffer dummy sepanjang bufA biar gak bocorin length lewat timing.
    if (bufA.length !== bufB.length) {
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

export interface InternalAuthResult {
    authorized: boolean;
    response: NextResponse | null;
}

export function requireInternalApiKey(request: NextRequest): InternalAuthResult {
    const configuredKey = getConfiguredKey();

    if (!configuredKey) {
        // Fail closed. Beda dari validatePin() lama yang fallback ke '123456' kalau
        // env kosong — di sini kalau INTERNAL_API_KEY belum di-set, endpoint DITOLAK
        // semua, bukan dibuka pakai default value yang gampang ditebak.
        console.error('[internalAuth] INTERNAL_API_KEY belum diset di environment.');
        return {
            authorized: false,
            response: NextResponse.json(
                { success: false, error: 'Internal API belum dikonfigurasi di server.' },
                { status: 503 }
            ),
        };
    }

    const providedKey = request.headers.get(HEADER_NAME);

    if (!providedKey || !timingSafeCompare(providedKey, configuredKey)) {
        return {
            authorized: false,
            response: NextResponse.json(
                { success: false, error: 'Unauthorized: internal API key tidak valid.' },
                { status: 401 }
            ),
        };
    }

    return { authorized: true, response: null };
}
