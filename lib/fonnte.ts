export interface SendWhatsAppResult {
    success: boolean;
    data?: unknown;
    error?: string;
}

/**
 * Send a WhatsApp message via Fonnte API.
 * @param phone - Target phone number
 * @param message - Message body
 * @param fonnteToken - Optional explicit Fonnte API token. When provided, skips DB lookup.
 */
export async function sendWhatsApp(
    phone: string,
    message: string,
    fonnteToken?: string
): Promise<SendWhatsAppResult> {
    const token = (fonnteToken || process.env.FONNTE_TOKEN || '').trim();

    if (!token) {
        return { success: false, error: 'FONNTE_TOKEN is not configured. Pass token or set env variable.' };
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
