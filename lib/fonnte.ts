export interface SendWhatsAppResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

export async function sendWhatsApp(phone: string, message: string): Promise<SendWhatsAppResult> {
    const token = process.env.FONNTE_TOKEN;

    if (!token) {
        return { success: false, error: 'FONNTE_TOKEN is not configured' };
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

        return { success: true, data: parsed };
    } catch (error: any) {
        return {
            success: false,
            error: error?.message || 'Unknown error while sending WhatsApp message',
        };
    }
}
