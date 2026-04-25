import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
    storeName: {
        type: String,
        required: [true, 'Store name is required'],
        default: 'SalonNext'
    },
    address: {
        type: String,
        default: ''
    },
    phone: {
        type: String,
        default: ''
    },
    email: {
        type: String,
        default: ''
    },
    website: {
        type: String,
        default: ''
    },
    taxId: {
        type: String,
        default: ''
    },
    currency: {
        type: String,
        default: 'USD'
    },
    timezone: {
        type: String,
        default: 'UTC'
    },
    taxRate: {
        type: Number,
        default: 0
    },
    logoUrl: {
        type: String,
        default: ''
    },
    businessHours: {
        type: String,
        default: 'Mon-Fri: 9:00 AM - 6:00 PM'
    },
    receiptFooter: {
        type: String,
        default: 'Thank you for your business!'
    },
    termsAndConditions: {
        type: String,
        default: ''
    },

    fonnteToken: {
        type: String,
        default: ''
    },
    // SMS Settings (Twilio)
    smsEnabled: {
        type: Boolean,
        default: false
    },
    twilioAccountSid: {
        type: String,
        default: ''
    },
    twilioAuthToken: {
        type: String,
        default: ''
    },
    twilioPhoneNumber: {
        type: String,
        default: ''
    },
    // Email Settings (SMTP)
    emailEnabled: {
        type: Boolean,
        default: false
    },
    smtpHost: {
        type: String,
        default: ''
    },
    smtpPort: {
        type: Number,
        default: 587
    },
    smtpSecure: {
        type: Boolean,
        default: false
    },
    smtpUser: {
        type: String,
        default: ''
    },
    smtpPassword: {
        type: String,
        default: ''
    },
    smtpFrom: {
        type: String,
        default: ''
    },
    // Reminder Settings
    reminderDaysBefore: {
        type: Number,
        default: 1
    },
    reminderMethod: {
        type: String,
        enum: ['sms', 'email', 'both'],
        default: 'both'
    },
    // AI Settings
    aiEnabled: {
        type: Boolean,
        default: false
    },
    openaiApiKey: {
        type: String,
        default: ''
    },
    openaiModel: {
        type: String,
        default: 'gpt-4o'
    },
    // Premium Membership Settings
    membershipPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    membershipDurationDays: {
        type: Number,
        default: 365,
        min: 1
    },
    loyaltyPointPerSpend: {
        type: Number,
        default: 0,
        min: 0
    },
    loyaltyPointValue: {
        type: Number,
        default: 0,
        min: 0
    },
    // Referral Rewards
    referralRewardPoints: {
        type: Number,
        default: 0,
        min: 0
    },
    birthdayVoucherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Voucher'
    },
    // Member Discount Defaults
    memberDiscountType: {
        type: String,
        enum: ['percentage', 'nominal'],
        default: 'percentage'
    },
    memberDiscountValue: {
        type: Number,
        default: 0,
        min: 0
    },
    // Included items for membership benefit
    memberIncludedServices: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    }],
    memberIncludedProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    memberIncludedBundles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceBundle'
    }]
}, {
    timestamps: true
});

// Force re-register model on hot-reload so schema changes (like new fonnteToken field) take effect
if (mongoose.models.Settings) {
    delete mongoose.models.Settings;
}
const Settings = mongoose.model('Settings', SettingsSchema);

export default Settings;
