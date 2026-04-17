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
    }
}, {
    timestamps: true
});

// Settings should be a singleton, but we'll handle that in the API logic
// by always fetching/updating the first document
const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

export default Settings;
