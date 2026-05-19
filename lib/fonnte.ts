import { decryptFonnteToken } from './encryption';

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
    let token = (fonnteToken ?? '').trim();

    // If caller passed a token, use it as-is (caller is responsible for decrypting).
    // Only attempt decrypt if falling back to FONNTE_TOKEN env var.
    if (!token) {
        const envToken = (process.env.FONNTE_TOKEN || '').trim();
        if (envToken) {
            try {
                token = decryptFonnteToken(envToken);
            } catch (decryptErr: any) {
                console.error('[FONNTE] Env token decrypt failed, using raw:', decryptErr.message);
                token = envToken; // Fallback to raw env token
            }
        }
    }

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
                'Content-Type': 'application/json',
                Authorization: token,
            },
            body: JSON.stringify({
                target: phone,
                message: message,
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

/**
 * Validate if a phone number is registered on WhatsApp via Fonnte API.
 * Use this before blast/campaign to filter out invalid numbers.
 */
export async function validateWhatsAppNumber(
    phone: string,
    fonnteToken?: string
): Promise<{ valid: boolean; registered: boolean }> {
    const token = (fonnteToken || process.env.FONNTE_TOKEN || '').trim();
    if (!token || !phone) return { valid: false, registered: false };

    try {
        const response = await fetch('https://api.fonnte.com/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: token,
            },
            body: JSON.stringify({
                target: phone,
            }),
        });
        const data = await response.json() as any;
        return {
            valid: data?.status === true,
            registered: data?.registered === true,
        };
    } catch {
        return { valid: false, registered: false };
    }
}
