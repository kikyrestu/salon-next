import mongoose, { Schema, Model, models } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser {
    _id: string;
    name?: string;
    email: string;
    password: string;
    role?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserMethods {
    comparePassword(candidatePassword: string): Promise<boolean>;
}

type UserModel = Model<IUser, {}, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
    {
        name: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                'Please enter a valid email',
            ],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [8, 'Password must be at least 8 characters'],
            validate: {
                validator: function(v: string) {
                    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(v);
                },
                message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
            },
            select: false, // Don't return password by default
        },
        role: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Role',
        },
    },
    {
        timestamps: true,
    }
);

// Hash password before saving
userSchema.pre('save', async function (this: any) {
    if (!this.isModified('password')) {
        console.log('⏭️ Password not modified, skipping hash');
        return;
    }

    console.log('🔐 Hashing password...');
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    console.log('✅ Password hashed successfully');
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (
    this: any,
    candidatePassword: string
): Promise<boolean> {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        return false;
    }
};

const User = (models.User as UserModel) || mongoose.model<IUser, UserModel>('User', userSchema);

export default User;

