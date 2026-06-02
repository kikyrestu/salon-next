import { NextRequest, NextResponse } from 'next/server';
import { getMasterModels } from '@/lib/masterDb';
import { getTenantModels } from '@/lib/tenantDb';

function validatePin(request: NextRequest) {
    const headerPin = request.headers.get('x-admin-pin');
    const cookiePin = request.cookies.get('admin_pin')?.value;
    const pin = headerPin || cookiePin;
    const correctPin = process.env.ADMIN_PIN || '123456';
    return pin === correctPin;
}

// GET: Fetch all Super Admins for a specific branch
export async function GET(request: NextRequest, props: any) {
    if (!validatePin(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await props.params;
        const master = await getMasterModels();
        const branch = await master.Store.findById(id);

        if (!branch) {
            return NextResponse.json({ success: false, error: 'Cabang tidak ditemukan' }, { status: 404 });
        }

        const { User, Role } = await getTenantModels(branch.slug);
        
        const superAdminRole = await Role.findOne({ name: 'Super Admin' });
        if (!superAdminRole) {
            return NextResponse.json({ success: true, data: [] });
        }

        const admins = await User.find({ role: superAdminRole._id }).select('-password').sort({ createdAt: -1 });

        return NextResponse.json({ success: true, data: admins });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST: Add a new Super Admin to a specific branch
export async function POST(request: NextRequest, props: any) {
    if (!validatePin(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await props.params;
        const body = await request.json();
        const { name, email, password } = body;

        if (!name || !email || !password) {
            return NextResponse.json({ success: false, error: 'Nama, Email, dan Password diperlukan' }, { status: 400 });
        }

        const master = await getMasterModels();
        const branch = await master.Store.findById(id);

        if (!branch) {
            return NextResponse.json({ success: false, error: 'Cabang tidak ditemukan' }, { status: 404 });
        }

        const { User, Role } = await getTenantModels(branch.slug);

        const superAdminRole = await Role.findOne({ name: 'Super Admin' });
        if (!superAdminRole) {
            return NextResponse.json({ success: false, error: 'Role Super Admin tidak ditemukan. Silakan set-up cabang ini terlebih dahulu.' }, { status: 400 });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return NextResponse.json({ success: false, error: 'Email sudah terdaftar di cabang ini' }, { status: 400 });
        }

        const newAdmin = await User.create({
            name,
            email: email.toLowerCase().trim(),
            password,
            role: superAdminRole._id
        });

        return NextResponse.json({ success: true, message: 'Super Admin berhasil ditambahkan', data: newAdmin });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PUT: Reset Password for a specific Super Admin
export async function PUT(request: NextRequest, props: any) {
    if (!validatePin(request)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await props.params;
        const body = await request.json();
        const { adminId, password } = body;

        if (!adminId || !password) {
            return NextResponse.json({ success: false, error: 'ID Admin dan Password baru diperlukan' }, { status: 400 });
        }

        const master = await getMasterModels();
        const branch = await master.Store.findById(id);

        if (!branch) {
            return NextResponse.json({ success: false, error: 'Cabang tidak ditemukan' }, { status: 404 });
        }

        const { User } = await getTenantModels(branch.slug);

        const adminUser = await User.findById(adminId);
        if (!adminUser) {
            return NextResponse.json({ success: false, error: 'Akun admin tidak ditemukan' }, { status: 404 });
        }

        adminUser.password = password;
        await adminUser.save();

        return NextResponse.json({ success: true, message: 'Password berhasil direset' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
