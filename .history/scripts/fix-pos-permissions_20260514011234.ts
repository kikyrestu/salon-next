// scripts/fix-pos-permissions.ts
// ============================================================
// Script untuk fix permission POS yang kosong di semua role
//
// CARA PAKAI:
//   npx ts-node --project tsconfig.json scripts/fix-pos-permissions.ts
//
// Atau kalau pakai tsx:
//   npx tsx scripts/fix-pos-permissions.ts
//
// Script ini akan:
//   - Konek ke MongoDB pakai MONGODB_URI dari .env.local
//   - Loop semua role di DB
//   - Set pos.view = 'all' untuk SEMUA role (termasuk kasir, staff, dll)
//   - Juga fix permission lain yang mungkin belum ada (services, products, staff, customers)
// ============================================================

import mongoose from "mongoose";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI tidak ditemukan di .env.local");
    process.exit(1);
}

// Permission yang dibutuhkan POS agar bisa tampil data
const POS_REQUIRED_PERMISSIONS = {
    pos: { view: "all", create: true, edit: true, delete: false },
    services: { view: "all", create: false, edit: false, delete: false },
    products: { view: "all", create: false, edit: false, delete: false },
    staff: { view: "all", create: false, edit: false, delete: false },
    customers: { view: "all", create: true, edit: false, delete: false },
};

const RoleSchema = new mongoose.Schema(
    {
        name: String,
        description: String,
        isSystem: Boolean,
        permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

async function fixPosPermissions() {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI!, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
    });
    console.log("✅ Connected!\n");

    // Pakai model langsung — tanpa tenant wrapper
    const Role =
        mongoose.models.Role || mongoose.model("Role", RoleSchema);

    const roles = await Role.find({});
    console.log(`📋 Ditemukan ${roles.length} role:\n`);

    for (const role of roles) {
        const permissions = role.permissions || {};
        const updates: string[] = [];

        // Cek dan fix setiap permission yang dibutuhkan POS
        for (const [key, value] of Object.entries(POS_REQUIRED_PERMISSIONS)) {
            const current = permissions[key];

            if (!current) {
                // Key belum ada sama sekali — tambahkan
                permissions[key] = value;
                updates.push(`  ➕ ${key}: ditambahkan (${JSON.stringify(value)})`);
            } else if (current.view === "none" || current.view === false || !current.view) {
                // Key ada tapi view = none — update ke all
                const old = current.view;
                permissions[key] = { ...current, view: "all" };
                updates.push(`  🔄 ${key}.view: "${old}" → "all"`);
            } else {
                updates.push(`  ✅ ${key}.view: "${current.view}" (sudah OK)`);
            }
        }

        if (updates.some((u) => u.includes("➕") || u.includes("🔄"))) {
            role.permissions = permissions;
            role.markModified("permissions");
            await role.save();
            console.log(`🔑 Role: "${role.name}" — DIUPDATE`);
        } else {
            console.log(`⏭️  Role: "${role.name}" — tidak ada perubahan`);
        }

        updates.forEach((u) => console.log(u));
        console.log();
    }

    console.log("✅ Selesai! Silakan login ulang (clear session) supaya permission baru aktif.\n");
    console.log("ℹ️  Kalau masih belum muncul, pastikan user logout → login ulang,");
    console.log("   karena permission di-cache di JWT session.\n");

    await mongoose.disconnect();
    process.exit(0);
}

fixPosPermissions().catch((err) => {
    console.error("❌ Error:", err.message);
    mongoose.disconnect();
    process.exit(1);
});