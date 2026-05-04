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
        default: 'IDR'
    },
    timezone: {
        type: String,
        default: 'Asia/Jakarta'
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
    showStaffOnReceipt: {
        type: Boolean,
        default: true
    },
    showTaxAndTaxableAmountOnReceipt: {
        type: Boolean,
        default: true
    },
    showCommissionInPOS: {
        type: Boolean,
        default: false
    },
    // Wallet Bonus Tiers (top-up bonus %)
    walletBonusTiers: [{
        minAmount: { type: Number, required: true },
        bonusPercent: { type: Number, required: true }
    }],
    walletIncludedServices: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
    }],
    walletIncludedProducts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    walletIncludedBundles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceBundle'
    }],
    termsAndConditions: {
        type: String,
        default: ''
    },

    fonnteToken: {
        type: String,
        default: ''
    },
    // WA Marketing Numbers
    waBlastNumber: {
        type: String,
        default: ''
    },
    waAdminNumber: {
        type: String,
        default: ''
    },
    waOwnerNumber: {
        type: String,
        default: ''
    },
    // WA Auto-Reminder Settings
    membershipExpiryReminderDays: {
        type: Number,
        default: 30,
        min: 1
    },
    packageExpiryReminderDays: {
        type: Number,
        default: 30,
        min: 1
    },
    dailyReportTime: {
        type: String,
        default: '21:00'
    },
    // WA Message Templates
    waTemplateStockAlert: {
        type: String,
        default: '⚠️ *Notifikasi Stok Rendah — {{storeName}}*\n\nAda {{count}} produk yang stoknya hampir habis:\n\n{{productList}}\n\nSegera lakukan restok! 📦'
    },
    waTemplateDailyReport: {
        type: String,
        default: '📊 *Laporan Harian — {{storeName}}*\n📅 {{date}}\n\n💰 Total Pendapatan: Rp{{totalAmount}}\n🧾 Jumlah Transaksi: {{totalTransactions}}\n👥 Pelanggan Dilayani: {{totalCustomers}}\n\nTerima kasih! 🙏'
    },
    waTemplateMembershipExpiry: {
        type: String,
        default: 'Halo {{customerName}} 👋\n\nMembership *{{membershipTier}}* Anda di *{{storeName}}* akan berakhir dalam *{{daysLeft}} hari* ({{expiryDate}}).\n\nSegera perpanjang agar tetap menikmati benefit spesial! ✨'
    },
    waTemplatePackageExpiry: {
        type: String,
        default: 'Halo {{customerName}} 👋\n\nPaket *{{packageName}}* Anda di *{{storeName}}* akan berakhir dalam *{{daysLeft}} hari* ({{expiryDate}}).\nSisa kuota: {{remainingQuota}}\n\nSegera gunakan sebelum hangus! 💆'
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
    // Referral Discount for the customer who uses a referral code
    referralDiscountType: {
        type: String,
        enum: ['percentage', 'nominal'],
        default: 'nominal'
    },
    referralDiscountValue: {
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
