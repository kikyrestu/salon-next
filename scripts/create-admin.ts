// scripts/create-admin.ts
// ============================================================
// Script untuk membuat akun Super Admin di local
//
// CARA PAKAI:
//   npx tsx scripts/create-admin.ts
//
// Login dengan:
//   Email    : admin@admin.com
//   Password : Admin@123!
//   Slug     : pusat
// ============================================================

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI tidak ditemukan di .env.local");
    process.exit(1);
}

// ── Schemas ─────────────────────────────────────────────────

const RoleSchema = new mongoose.Schema(
    {
        name: String,
        description: String,
        isSystem: { type: Boolean, default: false },
        permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true }
);

const UserSchema = new mongoose.Schema(
    {
        name: String,
        email: { type: String, lowercase: true, trim: true },
        password: { type: String, select: false },
        role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
    },
    { timestamps: true }
);

// ── Main ─────────────────────────────────────────────────────

async function main() {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI!, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
    });
    console.log("✅ Connected!\n");

    const Role = mongoose.models.Role || mongoose.model("Role", RoleSchema);
    const User = mongoose.models.User || mongoose.model("User", UserSchema);

    // 1. Buat atau cari role Super Admin
    let adminRole = await Role.findOne({ name: "Super Admin" });
    if (!adminRole) {
        adminRole = await Role.create({
            name: "Super Admin",
            description: "Full access to everything",
            isSystem: true,
            permissions: {},
        });
        console.log("✅ Role 'Super Admin' dibuat.");
    } else {
        console.log("⏭️  Role 'Super Admin' sudah ada.");
    }

    // 2. Hash password langsung (bypass mongoose validator)
    const PLAIN_PASSWORD = "Admin@123!";
    const hashedPassword = await bcrypt.hash(PLAIN_PASSWORD, 10);

    // 3. Upsert user admin
    const existing = await User.findOne({ email: "admin@admin.com" });
    if (existing) {
        await User.updateOne(
            { email: "admin@admin.com" },
            { $set: { password: hashedPassword, role: adminRole._id, name: "Admin" } }
        );
        console.log("🔄 User admin@admin.com sudah ada → password & role diupdate.");
    } else {
        await User.create({
            name: "Admin",
            email: "admin@admin.com",
            password: hashedPassword,
            role: adminRole._id,
        });
        console.log("✅ User admin@admin.com berhasil dibuat.");
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 Admin siap dipakai!\n");
    console.log("   Email    : admin@admin.com");
    console.log("   Password : Admin@123!");
    console.log("   Slug     : pusat");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    await mongoose.disconnect();
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Error:", err.message);
    mongoose.disconnect();
    process.exit(1);
});