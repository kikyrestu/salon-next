import { NextRequest, NextResponse } from 'next/server';
import { getMasterModels } from '@/lib/masterDb';
import { getTenantModels } from '@/lib/tenantDb';
import mongoose from 'mongoose';

function validatePin(request: NextRequest) {
    const headerPin = request.headers.get('x-admin-pin');
    const cookiePin = request.cookies.get('admin_pin')?.value;
    const pin = headerPin || cookiePin;
    const correctPin = process.env.ADMIN_PIN || '123456';
    return pin === correctPin;
}

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

        const master = await getMasterModels();
        const registration = await master.Registration.findById(id).select('+hashedPassword');

        if (!registration) {
            return NextResponse.json({ success: false, error: 'Pendaftaran tidak ditemukan' }, { status: 404 });
        }

        if (registration.status !== 'pending') {
            return NextResponse.json({ success: false, error: 'Pendaftaran sudah diproses' }, { status: 400 });
        }

        const adminSettings = await master.AdminSettings.findOne();
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

        if (action === 'approve') {
            // 1. Create Store in Master DB
            const cleanSlug = registration.slug.replace(/[^a-z0-9-]/g, '');
            
            // Check if slug already exists in stores (just to be safe)
            const existingStore = await master.Store.findOne({ slug: cleanSlug });
            if (existingStore) {
                 return NextResponse.json({ success: false, error: 'Slug cabang sudah digunakan.' }, { status: 400 });
            }

            const baseUri = process.env.MONGODB_URI;
            if (!baseUri) throw new Error('MONGODB_URI is missing');

            const url = new URL(baseUri);
            const uniqueSuffix = Date.now().toString(36);
            url.pathname = `/salon_${cleanSlug}_${uniqueSuffix}`;
            const dbUri = url.toString();
            
            const newStore = await master.Store.create({
                name: registration.storeName,
                slug: cleanSlug,
                dbUri,
                isActive: true
            });

            // 2. Create Tenant DB + Super Admin
            const { User, Role } = await getTenantModels(cleanSlug);
            
            const standardResources = ['appointments', 'pos', 'services', 'products', 'purchases', 'usageLogs', 'staff', 'staffSlots', 'customers', 'suppliers', 'payroll', 'expenses', 'reports', 'users', 'roles', 'invoices', 'activityLogs', 'calendarView'];
            const allPermissions: any = { dashboard: { view: true }, settings: { view: true, edit: true }, aiReports: { view: true } };
            standardResources.forEach(resource => { allPermissions[resource] = { view: 'all', create: true, edit: true, delete: true }; });
            
            const superAdminRole = await Role.findOneAndUpdate(
                { name: 'Super Admin' },
                { $setOnInsert: { name: 'Super Admin', description: 'Full access to all system resources', isSystem: true }, $set: { permissions: allPermissions } },
                { upsert: true, new: true }
            );

            // Directly insert User using mongoose Model.collection to bypass the pre('save') hook that would hash the already hashed password
            await User.collection.insertOne({
                name: registration.ownerName,
                email: registration.email,
                password: registration.hashedPassword,
                role: superAdminRole._id,
                createdAt: new Date(),
                updatedAt: new Date(),
                __v: 0
            });

            // 3. Update registration status
            registration.status = 'approved';
            registration.hashedPassword = 'cleared'; // remove hash for security
            await registration.save();

            // 4. Send WA
            if (adminSettings?.fonnteToken && registration.phone) {
                const message = `✅ *Selamat!* Pendaftaran toko *${registration.storeName}* telah disetujui.\n\nSilakan login ke sistem kasir Anda di:\n${baseUrl}/${registration.slug}/login\n\nEmail: ${registration.email}\n(Gunakan password yang Anda daftarkan)`;
                fetch('https://api.fonnte.com/send', {
                    method: 'POST',
                    headers: { 'Authorization': adminSettings.fonnteToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target: registration.phone, message })
                }).catch(e => console.error('Fonnte send error:', e));
            }

            return NextResponse.json({ success: true, message: 'Toko berhasil di-approve dan siap digunakan!' });

        } else if (action === 'reject') {
            registration.status = 'rejected';
            registration.rejectionReason = rejectionReason || 'Tidak ada alasan.';
            registration.hashedPassword = 'cleared';
            await registration.save();

            if (adminSettings?.fonnteToken && registration.phone) {
                const message = `❌ Mohon maaf, pendaftaran toko *${registration.storeName}* belum dapat disetujui saat ini.\n\nAlasan: ${rejectionReason || '-'}\n\nSilakan hubungi admin untuk informasi lebih lanjut.`;
                fetch('https://api.fonnte.com/send', {
                    method: 'POST',
                    headers: { 'Authorization': adminSettings.fonnteToken, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target: registration.phone, message })
                }).catch(e => console.error('Fonnte send error:', e));
            }

            return NextResponse.json({ success: true, message: 'Pendaftaran ditolak.' });
        }

    } catch (error: any) {
        console.error('Approve/Reject error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
