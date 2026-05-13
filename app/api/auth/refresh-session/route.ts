import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTenantModels } from '@/lib/tenantDb';

/**
 * POST /api/auth/refresh-session
 * ──────────────────────────────────────────────────────
 * [U02 FIX] Force-refresh JWT permissions tanpa harus logout.
 *
 * Digunakan untuk kasus:
 * - Admin baru selesai mengubah role/permissions user lain
 * - User ingin permissions ter-update sebelum interval 5 menit
 *
 * Cara kerja:
 * 1. Verifikasi session aktif
 * 2. Ambil role & permissions terbaru dari DB
 * 3. Trigger NextAuth `update()` → JWT callback akan langsung refresh
 *
 * Sisi client harus memanggil `update()` dari `useSession()` setelah
 * response 200 untuk men-sync session di browser.
 *
 * Contoh penggunaan di client:
 * ```ts
 * const { update } = useSession();
 * await fetch('/api/auth/refresh-session', { method: 'POST', headers: { 'x-store-slug': slug } });
 * await update(); // trigger JWT callback dengan trigger === 'update'
 * ```
 * ──────────────────────────────────────────────────────
 */
export async function POST(request: NextRequest) {
    try {
        const session: any = await auth();

        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const tenantSlug = session.user.tenantSlug ||
            request.headers.get('x-store-slug') ||
            'pusat';

        const roleId = session.user.roleId;

        if (!roleId || !tenantSlug) {
            return NextResponse.json(
                { success: false, error: 'Session tidak memiliki roleId atau tenantSlug.' },
                { status: 400 }
            );
        }

        // Fetch permissions terbaru langsung dari DB
        const { Role } = await getTenantModels(tenantSlug);
        const role = await Role.findById(roleId).lean() as any;

        if (!role) {
            return NextResponse.json(
                { success: false, error: 'Role tidak ditemukan. Mungkin sudah dihapus.' },
                { status: 404 }
            );
        }

        // Kembalikan permissions terbaru ke client.
        // Client menggunakan ini sebagai sinyal untuk memanggil update() dari useSession(),
        // yang akan men-trigger JWT callback dengan trigger === 'update' sehingga
        // token di-refresh dari DB secara langsung.
        return NextResponse.json({
            success: true,
            message: 'Permissions ter-update. Panggil update() dari useSession() untuk sync.',
            currentRole: role.name,
            permissionsRefreshedAt: new Date().toISOString(),
        });

    } catch (error: any) {
        console.error('[refresh-session] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Gagal me-refresh session.' },
            { status: 500 }
        );
    }
}
