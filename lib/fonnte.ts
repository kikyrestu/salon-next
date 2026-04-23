import mongoose from "mongoose";
import Settings from "@/models/Settings";

export interface SendWhatsAppResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

export async function sendWhatsApp(phone: string, message: string): Promise<SendWhatsAppResult> {
    // Try to connect to DB and get settings if not already connected
    if (mongoose.connection.readyState !== 1) {
        try {
            await mongoose.connect(process.env.MONGODB_URI as string);
        } catch (e) {
            console.error("Fonnte DB connect error:", e);
        }
    }
    
    let token = String(process.env.FONNTE_TOKEN || '').trim();
    
    try {
        const settings = await Settings.findOne({});
        if (settings && settings.fonnteToken) {
            token = String(settings.fonnteToken).trim();
        }
    } catch (e) {}

    if (!token) {
        return { success: false, error: 'FONNTE_TOKEN is not configured in settings or env' };
    }

    if (!phone || !message) {
        return { success: false, error: 'phone and message are required' };
    }

    try {
        const response = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                target: phone,
                message,
            }),
        });

        const text = await response.text();
        let parsed: unknown = text;

        try {
            parsed = text ? JSON.parse(text) : null;
        } catch {
            parsed = text;
        }

        if (!response.ok) {
            return {
                success: false,
                error: `Fonnte request failed with status ${response.status}`,
                data: parsed,
            };
        }

        // Fonnte can return HTTP 200 with { status: false, reason: "..." }.
        if (parsed && typeof parsed === 'object' && 'status' in (parsed as Record<string, unknown>)) {
            const apiStatus = Boolean((parsed as Record<string, unknown>).status);
            if (!apiStatus) {
                const reason = String((parsed as Record<string, unknown>).reason || 'Fonnte API returned status=false');
                return {
                    success: false,
                    error: reason,
                    data: parsed,
                };
            }
        }

        return { success: true, data: parsed };
    } catch (error: any) {
        return {
            success: false,
            error: error?.message || 'Unknown error while sending WhatsApp message',
        };
    }
}
