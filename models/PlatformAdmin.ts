import { Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

// Ganti sistem PIN (app/admin/cabang + app/api/admin/*) yang cuma bandingin
// x-admin-pin vs process.env.ADMIN_PIN (fallback '123456'). Password di-hash
// pakai bcryptjs, PERSIS pola yang sudah dipakai models/User.ts buat password
// tenant - biar dua permukaan auth ini punya level keamanan yang sama, gak
// reinvent hashing baru cuma buat panel PHP ini.

export type PlatformAdminRole = 'super_admin' | 'staff';

export interface IPlatformAdmin {
    _id: string;
    username: string;
    passwordHash: string;
    name: string;
    role: PlatformAdminRole;
    twoFactorSecret?: string; // optional TOTP, diisi kalau admin aktifin 2FA
    isActive: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface IPlatformAdminMethods {
    comparePassword(candidatePassword: string): Promise<boolean>;
}

export type PlatformAdminModel = Model<IPlatformAdmin, {}, IPlatformAdminMethods>;

export const PlatformAdminSchema = new Schema<IPlatformAdmin, PlatformAdminModel, IPlatformAdminMethods>(
    {
        username: {
            type: String,
            required: [true, 'Username wajib diisi'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: true,
            select: false,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        role: {
            type: String,
            enum: ['super_admin', 'staff'],
            default: 'super_admin',
        },
        twoFactorSecret: {
            type: String,
            select: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLoginAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Hash passwordHash sebelum saving - sama persis pola models/User.ts, cuma nama
// field-nya beda (passwordHash, bukan password) biar jelas ini bukan plaintext
// dari awal.
PlatformAdminSchema.pre('save', async function (this: any) {
    if (!this.isModified('passwordHash')) return;
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

PlatformAdminSchema.methods.comparePassword = async function (
    this: any,
    candidatePassword: string
): Promise<boolean> {
    try {
        return await bcrypt.compare(candidatePassword, this.passwordHash);
    } catch {
        return false;
    }
};

export default PlatformAdminSchema;
