"use client";

import { useState, useEffect } from "react";
import { Save, Store, Mail, Phone, MapPin, DollarSign, Percent, Image as ImageIcon, Globe, FileText, Clock, CreditCard, MessageSquare, Send, Bell, Sparkles, Trash2, RefreshCw, Gift } from "lucide-react";
import FormInput, { FormSelect, FormButton } from "@/components/dashboard/FormInput";
import SearchableSelect from "@/components/dashboard/SearchableSelect";
import { getAllCurrencies } from "@/lib/currency";
import { getAllTimezones } from "@/lib/timezones";
import PermissionGate from "@/components/PermissionGate";
import { useSettings } from "@/components/providers/SettingsProvider";

interface Settings {
    storeName: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    taxId: string;
    currency: string;
    timezone: string;
    taxRate: number;
    logoUrl: string;
    businessHours: string;
    receiptFooter: string;
    showStaffOnReceipt: boolean;
    walletBonusTiers: { minAmount: number; bonusPercent: number }[];
    termsAndConditions: string;

    // Loyalty & Referral
    loyaltyPointPerSpend: number;
    loyaltyPointValue: number;
    referralRewardPoints: number;
    referralDiscountType: "percentage" | "nominal";
    referralDiscountValue: number;

    // WhatsApp Settings (Fonnte)
    fonnteToken: string;
    waBlastNumber: string;
    waAdminNumber: string;
    waOwnerNumber: string;
    membershipExpiryReminderDays: number;
    packageExpiryReminderDays: number;
    dailyReportTime: string;

    // SMS Settings
    smsEnabled: boolean;
    twilioAccountSid: string;
    twilioAuthToken: string;
    twilioPhoneNumber: string;
    // Email Settings
    emailEnabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPassword: string;
    smtpFrom: string;
    // Reminder Settings
    reminderDaysBefore: number;
    reminderMethod: string;
    // AI Settings
    aiEnabled: boolean;
    openaiApiKey: string;
    openaiModel: string;
}

interface GreetingLogItem {
    _id: string;
    phoneRaw: string;
    phoneNormalized: string;
    greetingSentAt?: string;
    createdAt?: string;
}

export default function SettingsPage() {
    const { refreshSettings } = useSettings();
    const [settings, setSettings] = useState<Settings>({
        storeName: "",
        address: "",
        phone: "",
        email: "",
        website: "",
        taxId: "",
        currency: "USD",
        timezone: "UTC",
        taxRate: 0,
        logoUrl: "",
        businessHours: "Mon-Fri: 9:00 AM - 6:00 PM",
        receiptFooter: "Thank you for your business!",
        showStaffOnReceipt: true,
        walletBonusTiers: [],
        termsAndConditions: "",
        loyaltyPointPerSpend: 0,
        loyaltyPointValue: 0,
        referralRewardPoints: 0,
        referralDiscountType: "nominal",
        referralDiscountValue: 0,
        // WhatsApp Settings
        fonnteToken: "",
        waBlastNumber: "",
        waAdminNumber: "",
        waOwnerNumber: "",
        membershipExpiryReminderDays: 30,
        packageExpiryReminderDays: 30,
        dailyReportTime: "21:00",
        // SMS Settings
        smsEnabled: false,
        twilioAccountSid: "",
        twilioAuthToken: "",
        twilioPhoneNumber: "",
        // Email Settings
        emailEnabled: false,
        smtpHost: "",
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: "",
        smtpPassword: "",
        smtpFrom: "",
        // Reminder Settings
        reminderDaysBefore: 1,
        reminderMethod: "both",
        // AI Settings
        aiEnabled: false,
        openaiApiKey: "",
        openaiModel: "gpt-4o",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [waPushLoading, setWaPushLoading] = useState(false);
    const [waPushResult, setWaPushResult] = useState<{ total: number; sent: number; failed: number } | null>(null);
    const [greetingPhone, setGreetingPhone] = useState("");
    const [deletingGreeting, setDeletingGreeting] = useState(false);
    const [deletingAllGreeting, setDeletingAllGreeting] = useState(false);
    const [greetingLogs, setGreetingLogs] = useState<GreetingLogItem[]>([]);
    const [greetingLogTotal, setGreetingLogTotal] = useState(0);
    const [loadingGreetingLogs, setLoadingGreetingLogs] = useState(false);


    const currencies = getAllCurrencies();
    const timezones = getAllTimezones();

    useEffect(() => {
        fetchSettings();
        fetchGreetingLogs();
    }, []);

    const fetchGreetingLogs = async () => {
        setLoadingGreetingLogs(true);
        try {
            const res = await fetch('/api/wa/greeting-logs');
            const data = await res.json();
            if (!data.success) return;

            setGreetingLogTotal(data.data?.total || 0);
            setGreetingLogs(data.data?.items || []);
        } catch (error) {
            console.error('Error fetching greeting logs:', error);
        } finally {
            setLoadingGreetingLogs(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/settings");
            const data = await res.json();
            if (data.success) {
                // Merge fetched data with defaults to ensure all fields exist
                setSettings({
                    storeName: data.data.storeName || "",
                    address: data.data.address || "",
                    phone: data.data.phone || "",
                    email: data.data.email || "",
                    website: data.data.website || "",
                    taxId: data.data.taxId || "",
                    currency: data.data.currency || "USD",
                    timezone: data.data.timezone || "UTC",
                    taxRate: data.data.taxRate || 0,
                    logoUrl: data.data.logoUrl || "",
                    businessHours: data.data.businessHours || "Mon-Fri: 9:00 AM - 6:00 PM",
                    receiptFooter: data.data.receiptFooter || "Thank you for your business!",
                    showStaffOnReceipt: data.data.showStaffOnReceipt !== false,
                    walletBonusTiers: data.data.walletBonusTiers || [],
                    termsAndConditions: data.data.termsAndConditions || "",
                    loyaltyPointPerSpend: data.data.loyaltyPointPerSpend || 0,
                    loyaltyPointValue: data.data.loyaltyPointValue || 0,
                    referralRewardPoints: data.data.referralRewardPoints || 0,
                    referralDiscountType: data.data.referralDiscountType || "nominal",
                    referralDiscountValue: data.data.referralDiscountValue || 0,

                    // WhatsApp Settings
                    fonnteToken: data.data.fonnteToken || "",
                    waBlastNumber: data.data.waBlastNumber || "",
                    waAdminNumber: data.data.waAdminNumber || "",
                    waOwnerNumber: data.data.waOwnerNumber || "",
                    membershipExpiryReminderDays: data.data.membershipExpiryReminderDays || 30,
                    packageExpiryReminderDays: data.data.packageExpiryReminderDays || 30,
                    dailyReportTime: data.data.dailyReportTime || "21:00",
                    // SMS Settings
                    smsEnabled: data.data.smsEnabled || false,
                    twilioAccountSid: data.data.twilioAccountSid || "",
                    twilioAuthToken: data.data.twilioAuthToken || "",
                    twilioPhoneNumber: data.data.twilioPhoneNumber || "",
                    // Email Settings
                    emailEnabled: data.data.emailEnabled || false,
                    smtpHost: data.data.smtpHost || "",
                    smtpPort: data.data.smtpPort || 587,
                    smtpSecure: data.data.smtpSecure || false,
                    smtpUser: data.data.smtpUser || "",
                    smtpPassword: data.data.smtpPassword || "",
                    smtpFrom: data.data.smtpFrom || "",
                    // Reminder Settings
                    reminderDaysBefore: data.data.reminderDaysBefore || 1,
                    reminderMethod: data.data.reminderMethod || "both",
                    // AI Settings
                    aiEnabled: data.data.aiEnabled || false,
                    openaiApiKey: data.data.openaiApiKey || "",
                    openaiModel: data.data.openaiModel || "gpt-4o",
                });
            }
        } catch (error) {
            console.error("Error fetching settings:", error);
            setMessage({ type: "error", text: "Failed to load settings" });
        } finally {
            setLoading(false);
        }
    };



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ type: "", text: "" });

        try {
            const res = await fetch("/api/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            const data = await res.json();
            if (data.success) {
                setSettings(prev => ({ ...prev, ...data.data }));
                await refreshSettings();
                setMessage({ type: "success", text: "Settings saved successfully!" });
            } else {
                setMessage({ type: "error", text: data.error || "Failed to save settings" });
            }
        } catch (error) {
            console.error("Error saving settings:", error);
            setMessage({ type: "error", text: "Failed to save settings" });
        } finally {
            setSaving(false);
        }
    };

    const handleTestWaPush = async () => {
        setWaPushLoading(true);
        setWaPushResult(null);

        try {
            const res = await fetch("/api/wa/trigger", {
                method: "POST",
            });
            const data = await res.json();

            if (!data.success) {
                setMessage({ type: "error", text: data.error || "Failed to trigger WhatsApp push" });
                return;
            }

            setWaPushResult(data.data || { total: 0, sent: 0, failed: 0 });
            setMessage({ type: "success", text: "WhatsApp push test executed successfully" });
        } catch (error) {
            console.error("Error triggering WhatsApp push test:", error);
            setMessage({ type: "error", text: "Failed to trigger WhatsApp push test" });
        } finally {
            setWaPushLoading(false);
        }
    };

    const handleDeleteGreetingLog = async (phoneArg?: string) => {
        const phoneToDelete = String(phoneArg || greetingPhone).trim();

        if (!phoneToDelete) {
            setMessage({ type: "error", text: "Masukkan nomor terlebih dahulu" });
            return;
        }

        setDeletingGreeting(true);
        try {
            const res = await fetch("/api/wa/greeting-logs", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: phoneToDelete }),
            });
            const data = await res.json();

            if (!data.success) {
                setMessage({ type: "error", text: data.error || "Gagal menghapus greeting log" });
                return;
            }

            setMessage({ type: "success", text: `${data.message} (${data.data?.phone || phoneToDelete})` });
            setGreetingPhone("");
            await fetchGreetingLogs();
        } catch (error) {
            console.error("Error deleting greeting log:", error);
            setMessage({ type: "error", text: "Gagal menghapus greeting log" });
        } finally {
            setDeletingGreeting(false);
        }
    };

    const handleDeleteAllGreetingLogs = async () => {
        if (!confirm("Hapus SEMUA greeting log? Aksi ini tidak bisa dibatalkan.")) return;

        setDeletingAllGreeting(true);
        try {
            const res = await fetch("/api/wa/greeting-logs", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clearAll: true }),
            });
            const data = await res.json();

            if (!data.success) {
                setMessage({ type: "error", text: data.error || "Gagal menghapus semua greeting log" });
                return;
            }

            setMessage({ type: "success", text: `${data.message}. Total dihapus: ${data.data?.deletedCount || 0}` });
            await fetchGreetingLogs();
        } catch (error) {
            console.error("Error deleting all greeting logs:", error);
            setMessage({ type: "error", text: "Gagal menghapus semua greeting log" });
        } finally {
            setDeletingAllGreeting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-900 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Store Settings</h1>
                <p className="text-gray-500">Manage your store details and configuration</p>
            </div>

            {message.text && (
                <div className={`p-4 rounded-lg mb-6 ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* General Information */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Store className="w-5 h-5 text-blue-900" />
                        General Information
                    </h2>
                    <div className="grid grid-cols-1 gap-6">
                        <FormInput
                            label="Store Name"
                            value={settings.storeName}
                            onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                            required
                            placeholder="e.g. SalonNext"
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Store Logo
                            </label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            setSettings({ ...settings, logoUrl: reader.result as string });
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                        </div>
                        {settings.logoUrl && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Logo Preview</label>
                                <div className="flex items-center gap-4">
                                    <img src={settings.logoUrl} alt="Store Logo" className="h-20 object-contain border rounded p-2" />
                                    <button
                                        type="button"
                                        onClick={() => setSettings({ ...settings, logoUrl: "" })}
                                        className="text-sm text-red-600 hover:text-red-700"
                                    >
                                        Remove Logo
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Contact Details */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Phone className="w-5 h-5 text-blue-900" />
                        Contact Details
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormInput
                            label="Phone Number"
                            value={settings.phone}
                            onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                            placeholder="+1 234 567 890"
                        />
                        <FormInput
                            label="Email Address"
                            value={settings.email}
                            onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                            type="email"
                            placeholder="contact@store.com"
                        />
                        <FormInput
                            label="Website"
                            value={settings.website}
                            onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                            placeholder="https://www.yourstore.com"
                        />
                        <FormInput
                            label="Business Hours"
                            value={settings.businessHours}
                            onChange={(e) => setSettings({ ...settings, businessHours: e.target.value })}
                            placeholder="Mon-Fri: 9:00 AM - 6:00 PM"
                        />
                        <div className="md:col-span-2">
                            <FormInput
                                label="Address"
                                value={settings.address}
                                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                                placeholder="123 Main St, City, Country"
                            />
                        </div>
                    </div>
                </div>

                {/* Business Information */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-900" />
                        Business Information
                    </h2>
                    <div className="grid grid-cols-1 gap-6">
                        <FormInput
                            label="Tax ID / Registration Number"
                            value={settings.taxId}
                            onChange={(e) => setSettings({ ...settings, taxId: e.target.value })}
                            placeholder="e.g. 123-456-789"
                        />
                    </div>
                </div>

                {/* Receipt Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-900" />
                        Receipt / Nota Settings
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                                <p className="text-sm font-bold text-gray-900">Tampilkan "Served By" di Nota</p>
                                <p className="text-xs text-gray-500 mt-0.5">Menampilkan nama staff yang melayani di struk cetak</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={settings.showStaffOnReceipt}
                                    onChange={(e) => setSettings({ ...settings, showStaffOnReceipt: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Wallet Bonus Tiers */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-blue-900" />
                        Wallet Bonus Tiers
                    </h2>
                    <p className="text-xs text-gray-500 mb-4">
                        Atur bonus otomatis berdasarkan nominal top-up. Contoh: Top-up 500rb bonus 10%, top-up 1jt bonus 20%.
                    </p>
                    <div className="space-y-3">
                        {(settings.walletBonusTiers || []).map((tier, idx) => (
                            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-5">
                                    <label className="text-[10px] text-gray-500 mb-0.5 block">Min Top-Up (Rp)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={tier.minAmount}
                                        onChange={(e) => {
                                            const newTiers = [...settings.walletBonusTiers];
                                            newTiers[idx] = { ...newTiers[idx], minAmount: Number(e.target.value) };
                                            setSettings({ ...settings, walletBonusTiers: newTiers });
                                        }}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
                                        placeholder="500000"
                                    />
                                </div>
                                <div className="col-span-5">
                                    <label className="text-[10px] text-gray-500 mb-0.5 block">Bonus (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={tier.bonusPercent}
                                        onChange={(e) => {
                                            const newTiers = [...settings.walletBonusTiers];
                                            newTiers[idx] = { ...newTiers[idx], bonusPercent: Number(e.target.value) };
                                            setSettings({ ...settings, walletBonusTiers: newTiers });
                                        }}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
                                        placeholder="10"
                                    />
                                </div>
                                <div className="col-span-2 flex justify-center pt-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const newTiers = settings.walletBonusTiers.filter((_, i) => i !== idx);
                                            setSettings({ ...settings, walletBonusTiers: newTiers });
                                        }}
                                        className="text-red-500 text-xs font-bold hover:text-red-700"
                                    >
                                        Hapus
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => {
                                setSettings({
                                    ...settings,
                                    walletBonusTiers: [...(settings.walletBonusTiers || []), { minAmount: 0, bonusPercent: 0 }],
                                });
                            }}
                            className="text-sm text-blue-700 font-semibold hover:underline"
                        >
                            + Tambah Tier
                        </button>
                    </div>
                </div>

                {/* Financial Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-blue-900" />
                        Financial Settings
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormSelect
                            label="Currency"
                            value={settings.currency}
                            onChange={(e: any) => setSettings({ ...settings, currency: e.target.value })}
                            options={currencies.map(c => ({ value: c.code, label: `${c.symbol} ${c.code} - ${c.name}` }))}
                        />

                        <FormSelect
                            label="Timezone"
                            value={settings.timezone}
                            onChange={(e: any) => setSettings({ ...settings, timezone: e.target.value })}
                            options={timezones}
                        />
                        <FormInput
                            label="Default Tax Rate (%)"
                            value={settings.taxRate.toString()}
                            onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) || 0 })}
                            type="number"
                            placeholder="0"
                        />
                    </div>
                </div>

                {/* Receipt Customization */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-900" />
                        Receipt Customization
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Receipt Footer Message
                            </label>
                            <input
                                type="text"
                                value={settings.receiptFooter}
                                onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                                placeholder="Thank you for your business!"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Terms and Conditions
                            </label>
                            <textarea
                                value={settings.termsAndConditions}
                                onChange={(e) => setSettings({ ...settings, termsAndConditions: e.target.value })}
                                rows={4}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-transparent"
                                placeholder="Enter your terms and conditions..."
                            />
                        </div>
                    </div>
                </div>

                {/* Loyalty & Referral Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Gift className="w-5 h-5 text-amber-600" />
                        Loyalty & Referral Settings
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormInput
                            label="Loyalty: Poin per Spending (Rp)"
                            type="number"
                            value={settings.loyaltyPointPerSpend.toString()}
                            onChange={(e) => setSettings({ ...settings, loyaltyPointPerSpend: parseFloat(e.target.value) || 0 })}
                            min="0"
                            placeholder="100000 = tiap Rp100.000 = 1 poin"
                        />
                        <FormInput
                            label="Loyalty: Nilai 1 Poin (Rp)"
                            type="number"
                            value={settings.loyaltyPointValue.toString()}
                            onChange={(e) => setSettings({ ...settings, loyaltyPointValue: parseFloat(e.target.value) || 0 })}
                            min="0"
                            placeholder="1000 = 1 poin = Rp1.000"
                        />
                        <FormInput
                            label="Referral: Bonus Poin untuk Pengajak"
                            type="number"
                            value={settings.referralRewardPoints.toString()}
                            onChange={(e) => setSettings({ ...settings, referralRewardPoints: parseFloat(e.target.value) || 0 })}
                            min="0"
                            placeholder="Misal: 50 poin"
                        />
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <FormInput
                                    label="Referral: Diskon untuk Customer Baru"
                                    type="number"
                                    value={settings.referralDiscountValue.toString()}
                                    onChange={(e) => setSettings({ ...settings, referralDiscountValue: parseFloat(e.target.value) || 0 })}
                                    min="0"
                                    placeholder="Nilai diskon referral"
                                />
                            </div>
                            <select
                                value={settings.referralDiscountType}
                                onChange={(e) => setSettings({ ...settings, referralDiscountType: e.target.value as "percentage" | "nominal" })}
                                className="h-10 px-2 border border-gray-300 rounded-lg text-sm bg-white mb-4"
                            >
                                <option value="nominal">Rp</option>
                                <option value="percentage">%</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* SMS Settings (Twilio) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-900" />
                        SMS Settings (Twilio)
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-100">
                            <input
                                type="checkbox"
                                id="smsEnabled"
                                checked={settings.smsEnabled}
                                onChange={(e) => setSettings({ ...settings, smsEnabled: e.target.checked })}
                                className="w-4 h-4 text-blue-900 rounded focus:ring-blue-900"
                            />
                            <label htmlFor="smsEnabled" className="text-sm font-medium text-gray-900 cursor-pointer">
                                Enable SMS Notifications
                            </label>
                        </div>
                        {settings.smsEnabled && (
                            <div className="grid grid-cols-1 gap-4 pl-4 border-l-2 border-blue-200">
                                <FormInput
                                    label="Twilio Account SID"
                                    value={settings.twilioAccountSid}
                                    onChange={(e) => setSettings({ ...settings, twilioAccountSid: e.target.value })}
                                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                                />
                                <FormInput
                                    label="Twilio Auth Token"
                                    type="password"
                                    value={settings.twilioAuthToken}
                                    onChange={(e) => setSettings({ ...settings, twilioAuthToken: e.target.value })}
                                    placeholder="Your Twilio Auth Token"
                                />
                                <FormInput
                                    label="Twilio Phone Number"
                                    value={settings.twilioPhoneNumber}
                                    onChange={(e) => setSettings({ ...settings, twilioPhoneNumber: e.target.value })}
                                    placeholder="+1234567890"
                                />
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-xs text-yellow-800">
                                        <strong>Note:</strong> Get your Twilio credentials from <a href="https://www.twilio.com/console" target="_blank" rel="noopener noreferrer" className="underline">Twilio Console</a>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* WhatsApp Settings (Fonnte) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-green-600" />
                        WhatsApp Settings (Fonnte API)
                    </h2>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            <FormInput
                                label="Fonnte API Token"
                                type="password"
                                value={settings.fonnteToken}
                                onChange={(e) => setSettings({ ...settings, fonnteToken: e.target.value })}
                                placeholder="Your Fonnte Token"
                            />
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-xs text-yellow-800">
                                    <strong>Note:</strong> Get your Token from <a href="https://fonnte.com" target="_blank" rel="noopener noreferrer" className="underline">Fonnte API Dashboard</a>. This will override the token from `.env` file if provided.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* WA Marketing Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-green-600" />
                        WA Marketing & Notifications
                    </h2>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormInput
                                label="WA Admin (Stock Alert)"
                                value={settings.waAdminNumber}
                                onChange={(e) => setSettings({ ...settings, waAdminNumber: e.target.value })}
                                placeholder="628123456789"
                            />
                            <FormInput
                                label="WA Owner (Daily Report)"
                                value={settings.waOwnerNumber}
                                onChange={(e) => setSettings({ ...settings, waOwnerNumber: e.target.value })}
                                placeholder="628123456789"
                            />
                            <FormInput
                                label="Daily Report Time"
                                value={settings.dailyReportTime}
                                onChange={(e) => setSettings({ ...settings, dailyReportTime: e.target.value })}
                                placeholder="21:00"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormInput
                                label="Membership Expiry Reminder (hari sebelum)"
                                type="number"
                                value={settings.membershipExpiryReminderDays.toString()}
                                onChange={(e) => setSettings({ ...settings, membershipExpiryReminderDays: parseInt(e.target.value) || 30 })}
                                min="1"
                                placeholder="30"
                            />
                            <FormInput
                                label="Package Expiry Reminder (hari sebelum)"
                                type="number"
                                value={settings.packageExpiryReminderDays.toString()}
                                onChange={(e) => setSettings({ ...settings, packageExpiryReminderDays: parseInt(e.target.value) || 30 })}
                                min="1"
                                placeholder="30"
                            />
                        </div>
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-xs text-green-800">
                                <strong>Auto WA:</strong> Stock alert → Admin | Daily report → Owner | Membership/Package expiry → Customer.<br/>
                                Setup cron job di <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="underline">cron-job.org</a> untuk trigger otomatis:
                                <code className="ml-1 bg-green-100 px-1.5 py-0.5 rounded text-[10px]">/api/cron/wa-stock-alert</code>,
                                <code className="ml-1 bg-green-100 px-1.5 py-0.5 rounded text-[10px]">/api/cron/wa-daily-report</code>,
                                <code className="ml-1 bg-green-100 px-1.5 py-0.5 rounded text-[10px]">/api/cron/wa-membership-expiry</code>,
                                <code className="ml-1 bg-green-100 px-1.5 py-0.5 rounded text-[10px]">/api/cron/wa-package-expiry</code>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Email Settings (SMTP) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Send className="w-5 h-5 text-blue-900" />
                        Email Settings (SMTP)
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
                            <input
                                type="checkbox"
                                id="emailEnabled"
                                checked={settings.emailEnabled}
                                onChange={(e) => setSettings({ ...settings, emailEnabled: e.target.checked })}
                                className="w-4 h-4 text-blue-900 rounded focus:ring-blue-900"
                            />
                            <label htmlFor="emailEnabled" className="text-sm font-medium text-gray-900 cursor-pointer">
                                Enable Email Notifications
                            </label>
                        </div>
                        {settings.emailEnabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-4 border-l-2 border-green-200">
                                <FormInput
                                    label="SMTP Host"
                                    value={settings.smtpHost}
                                    onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                                    placeholder="smtp.gmail.com"
                                />
                                <FormInput
                                    label="SMTP Port"
                                    type="number"
                                    value={settings.smtpPort.toString()}
                                    onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 587 })}
                                    placeholder="587"
                                />
                                <FormInput
                                    label="SMTP Username"
                                    value={settings.smtpUser}
                                    onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                                    placeholder="your_email@gmail.com"
                                />
                                <FormInput
                                    label="SMTP Password"
                                    type="password"
                                    value={settings.smtpPassword}
                                    onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                                    placeholder="Your app password"
                                />
                                <div className="md:col-span-2">
                                    <FormInput
                                        label="From Email Address"
                                        value={settings.smtpFrom}
                                        onChange={(e) => setSettings({ ...settings, smtpFrom: e.target.value })}
                                        placeholder='"Your Salon" <noreply@yoursalon.com>'
                                    />
                                </div>
                                <div className="md:col-span-2 flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                    <input
                                        type="checkbox"
                                        id="smtpSecure"
                                        checked={settings.smtpSecure}
                                        onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked })}
                                        className="w-4 h-4 text-blue-900 rounded focus:ring-blue-900"
                                    />
                                    <label htmlFor="smtpSecure" className="text-sm text-gray-700 cursor-pointer">
                                        Use SSL/TLS (Enable for port 465, disable for port 587)
                                    </label>
                                </div>
                                <div className="md:col-span-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-xs text-yellow-800">
                                        <strong>Gmail Users:</strong> Use port 587, enable 2FA, and generate an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline">App Password</a>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Reminder Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-blue-900" />
                        Appointment Reminder Settings
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormInput
                            label="Send Reminders (Days Before)"
                            type="number"
                            value={settings.reminderDaysBefore.toString()}
                            onChange={(e) => setSettings({ ...settings, reminderDaysBefore: parseInt(e.target.value) || 1 })}
                            min="0"
                            max="7"
                            placeholder="1"
                        />
                        <FormSelect
                            label="Reminder Method"
                            value={settings.reminderMethod}
                            onChange={(e: any) => setSettings({ ...settings, reminderMethod: e.target.value })}
                            options={[
                                { value: "both", label: "SMS & Email" },
                                { value: "sms", label: "SMS Only" },
                                { value: "email", label: "Email Only" }
                            ]}
                        />
                    </div>
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                            <strong>Note:</strong> Reminders will be sent automatically {settings.reminderDaysBefore} day(s) before appointments via {
                                settings.reminderMethod === 'both' ? 'SMS and Email' :
                                    settings.reminderMethod === 'sms' ? 'SMS only' : 'Email only'
                            }.
                        </p>
                    </div>
                </div>

                {/* AI Settings */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-900" />
                        AI Power Reporting Settings
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-100">
                            <input
                                type="checkbox"
                                id="aiEnabled"
                                checked={settings.aiEnabled}
                                onChange={(e) => setSettings({ ...settings, aiEnabled: e.target.checked })}
                                className="w-4 h-4 text-blue-900 rounded focus:ring-blue-900"
                            />
                            <label htmlFor="aiEnabled" className="text-sm font-medium text-gray-900 cursor-pointer">
                                Enable AI Powered Insights & Reporting
                            </label>
                        </div>
                        {settings.aiEnabled && (
                            <div className="grid grid-cols-1 gap-4 pl-4 border-l-2 border-purple-200">
                                <FormInput
                                    label="OpenAI API Key"
                                    type="password"
                                    value={settings.openaiApiKey}
                                    onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                                    placeholder="sk-..."
                                />
                                <FormSelect
                                    label="OpenAI Model"
                                    value={settings.openaiModel}
                                    onChange={(e: any) => setSettings({ ...settings, openaiModel: e.target.value })}
                                    options={[
                                        { value: "gpt-4o", label: "GPT-4o (Recommended)" },
                                        { value: "gpt-4o-mini", label: "GPT-4o Mini (Faster/Cheaper)" },
                                        { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
                                        { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" }
                                    ]}
                                />
                                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-xs text-yellow-800">
                                        <strong>Note:</strong> Your API key is stored securely. Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI Dashboard</a>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>


                {/* System Management */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Save className="w-5 h-5 text-blue-900" />
                        System Management
                    </h2>
                    <div className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Database Backup</h3>
                                <p className="text-xs text-gray-500 mt-1">Export all your business data to a JSON file for safety.</p>
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    try {
                                        window.location.href = '/api/settings/backup';
                                    } catch (error) {
                                        console.error("Backup failed:", error);
                                        alert("Backup failed. Please try again.");
                                    }
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-bold hover:bg-blue-800 transition-colors shadow-sm"
                            >
                                <Save className="w-4 h-4" />
                                Download Backup
                            </button>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Uji Coba Push WhatsApp</h3>
                                <p className="text-xs text-gray-500 mt-1">Trigger manual pengiriman WA follow-up yang sudah jatuh tempo.</p>
                                {waPushResult && (
                                    <p className="text-xs text-gray-700 mt-2">
                                        Hasil: total {waPushResult.total}, sent {waPushResult.sent}, failed {waPushResult.failed}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleTestWaPush}
                                disabled={waPushLoading}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-60"
                            >
                                <Send className="w-4 h-4" />
                                {waPushLoading ? "Processing..." : "Push WA Sekarang"}
                            </button>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex flex-col gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Reset Greeting Log</h3>
                                <p className="text-xs text-gray-500 mt-1">Hapus log nomor agar greeting bisa terkirim lagi dari awal.</p>
                            </div>

                            <div className="flex flex-col md:flex-row gap-2 md:items-center">
                                <input
                                    type="text"
                                    value={greetingPhone}
                                    onChange={(e) => setGreetingPhone(e.target.value)}
                                    placeholder="Contoh: 0895352281010"
                                    className="w-full md:max-w-sm px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        void handleDeleteGreetingLog();
                                    }}
                                    disabled={deletingGreeting}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-500 transition-colors shadow-sm disabled:opacity-60"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {deletingGreeting ? "Menghapus..." : "Hapus Nomor Ini"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteAllGreetingLogs}
                                    disabled={deletingAllGreeting}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-bold hover:bg-gray-600 transition-colors shadow-sm disabled:opacity-60"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    {deletingAllGreeting ? "Menghapus..." : "Hapus Semua Log"}
                                </button>
                                <button
                                    type="button"
                                    onClick={fetchGreetingLogs}
                                    disabled={loadingGreetingLogs}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-60"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    {loadingGreetingLogs ? "Memuat..." : "Refresh List"}
                                </button>
                            </div>

                            <div className="text-xs text-gray-600">
                                Total nomor tersimpan: <span className="font-semibold">{greetingLogTotal}</span>
                            </div>

                            <div className="max-h-56 overflow-auto border border-gray-200 rounded-lg bg-white">
                                {loadingGreetingLogs ? (
                                    <div className="p-3 text-xs text-gray-500">Memuat daftar nomor...</div>
                                ) : greetingLogs.length === 0 ? (
                                    <div className="p-3 text-xs text-gray-500">Belum ada nomor tersimpan.</div>
                                ) : (
                                    <ul className="divide-y divide-gray-100">
                                        {greetingLogs.map((log) => (
                                            <li key={log._id} className="p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800">{log.phoneNormalized}</p>
                                                    <p className="text-[11px] text-gray-500">
                                                        Raw: {log.phoneRaw || '-'} | Greeting: {log.greetingSentAt ? new Date(log.greetingSentAt).toLocaleString() : '-'}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        void handleDeleteGreetingLog(log.phoneNormalized);
                                                    }}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 rounded text-xs font-semibold hover:bg-red-100"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <PermissionGate resource="settings" action="edit">
                        <FormButton
                            type="submit"
                            loading={saving}
                            icon={<Save className="w-5 h-5" />}
                        >
                            Save Settings
                        </FormButton>
                    </PermissionGate>
                </div>
            </form>
        </div>
    );
}
