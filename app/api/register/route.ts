import { NextRequest, NextResponse } from 'next/server';
import { getMasterModels } from '@/lib/masterDb';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { storeName, slug, ownerName, email, password, phone } = body;

        // Validate required fields
        if (!storeName || !slug || !ownerName || !email || !password || !phone) {
            return NextResponse.json(
                { success: false, error: 'Semua field wajib diisi' },
                { status: 400 }
            );
        }

        // Validate slug format
        const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (cleanSlug.length < 3) {
            return NextResponse.json(
                { success: false, error: 'Slug minimal 3 karakter (huruf kecil dan angka)' },
                { status: 400 }
            );
        }

        // Reserved slugs
        const reserved = ['admin', 'api', 'pusat', 'register', 'login', 'setup', '_next'];
        if (reserved.includes(cleanSlug)) {
            return NextResponse.json(
                { success: false, error: `Slug "${cleanSlug}" tidak bisa digunakan` },
                { status: 400 }
            );
        }

        // Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return NextResponse.json(
                { success: false, error: 'Password minimal 8 karakter, harus mengandung huruf besar, huruf kecil, angka, dan simbol' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { success: false, error: 'Format email tidak valid' },
                { status: 400 }
            );
        }

        const { Store, Registration, AdminSettings } = await getMasterModels();

        // Check if slug already exists in stores
        const existingStore = await Store.findOne({ slug: cleanSlug });
        if (existingStore) {
            return NextResponse.json(
                { success: false, error: 'Nama toko (slug) sudah digunakan. Silakan pilih nama lain.' },
                { status: 400 }
            );
        }

        // Check if slug already exists in pending registrations
        const existingReg = await Registration.findOne({ slug: cleanSlug, status: 'pending' });
        if (existingReg) {
            return NextResponse.json(
                { success: false, error: 'Nama toko ini sudah dalam antrian pendaftaran. Silakan tunggu persetujuan admin.' },
                { status: 400 }
            );
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create registration
        const registration = await Registration.create({
            storeName: storeName.trim(),
            slug: cleanSlug,
            ownerName: ownerName.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            hashedPassword,
            status: 'pending',
        });

        // Send WA notification to admin (if configured)
        try {
            const adminSettings = await AdminSettings.findOne();
            if (adminSettings?.fonnteToken && adminSettings?.adminPhone) {
                const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
                const message = `📋 *Pendaftaran Toko Baru!*\n\nNama Toko: *${storeName}*\nOwner: ${ownerName}\nEmail: ${email}\nNo. HP: ${phone}\n\nBuka panel admin untuk review:\n${baseUrl}/admin/cabang`;

                await fetch('https://api.fonnte.com/send', {
                    method: 'POST',
                    headers: {
                        'Authorization': adminSettings.fonnteToken,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        target: adminSettings.adminPhone,
                        message,
                    }),
                });
            }
        } catch (waError) {
            console.error('WA notification to admin failed:', waError);
            // Don't fail the registration just because WA failed
        }

        return NextResponse.json({
            success: true,
            message: 'Pendaftaran berhasil! Silakan tunggu persetujuan admin.',
            data: {
                id: registration._id,
                storeName: registration.storeName,
                slug: registration.slug,
                status: registration.status,
            }
        }, { status: 201 });

    } catch (error: any) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Terjadi kesalahan saat pendaftaran' },
            { status: 500 }
        );
    }
}
