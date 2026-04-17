import { NextRequest, NextResponse } from 'next/server';
import { connectToDB } from '@/lib/mongodb';
import { initModels } from '@/lib/initModels';
import WaGreetingLog from '@/models/WaGreetingLog';
import WaTemplate from '@/models/WaTemplate';
import { sendWhatsApp } from '@/lib/fonnte';

const normalizePhone = (phone: string): string => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    return digits;
};

const getInboundPhone = (payload: any): string => {
    const candidates = [
        payload?.sender,
        payload?.from,
        payload?.number,
        payload?.phone,
        payload?.device,
        payload?.chat,
    ];

    const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return String(found || '').trim();
};

const getInboundMessage = (payload: any): string => {
    const candidates = [
        payload?.message,
        payload?.text,
        payload?.msg,
        payload?.body,
        payload?.content,
    ];

    const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return String(found || '').trim();
};

const getInboundCustomerName = (payload: any): string => {
    const candidates = [
        payload?.name,
        payload?.pushname,
        payload?.sender_name,
        payload?.profile_name,
    ];

    const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return String(found || 'Customer').trim();
};

const renderTemplate = (message: string, vars: Record<string, string>): string => {
    return String(message || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => vars[key] ?? '');
};

const getGreetingMessage = async (): Promise<string> => {
    const activeGreetingTemplate = await WaTemplate.findOne({
        isGreetingEnabled: true,
        $or: [
            { templateType: 'greeting' },
            { templateType: { $exists: false } }, // legacy data before type separation
        ],
    })
        .select('message')
        .sort({ createdAt: -1 })
        .lean<any>();

    if (activeGreetingTemplate?.message) {
        return String(activeGreetingTemplate.message);
    }

    return (
        process.env.WA_GREETING_MESSAGE ||
        'Halo, terima kasih sudah menghubungi kami. Admin salon akan membalas pesan Anda secepatnya.'
    );
};

export async function GET() {
    return NextResponse.json({ success: true, message: 'Fonnte webhook endpoint is reachable' });
}

export async function POST(request: NextRequest) {
    try {
        await connectToDB();
        initModels();

        const contentType = request.headers.get('content-type') || '';
        let payload: any = null;

        if (contentType.includes('application/json')) {
            payload = await request.json();
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const form = await request.formData();
            payload = Object.fromEntries(form.entries());
        } else {
            const raw = await request.text();
            payload = { raw };
        }

        // Keep lightweight logging for integration checks in development.
        console.log('[FONNTE_WEBHOOK]', payload);

        const rawPhone = getInboundPhone(payload);
        const message = getInboundMessage(payload);
        const customerName = getInboundCustomerName(payload);
        const normalizedPhone = normalizePhone(rawPhone);

        // Greeting is only sent for inbound chat-like payload with a phone number.
        if (!normalizedPhone || !message) {
            return NextResponse.json({ success: true, skipped: true, reason: 'non-chat payload' });
        }

        const existingGreeting = await WaGreetingLog.findOne({ phoneNormalized: normalizedPhone }).lean();
        if (existingGreeting) {
            return NextResponse.json({ success: true, skipped: true, reason: 'already greeted' });
        }

        const greetingMessageTemplate = await getGreetingMessage();
        const greetingMessage = renderTemplate(greetingMessageTemplate, {
            nama_customer: customerName,
            nama_service: process.env.SALON_NAME || 'salon kami',
        });
        const sendResult = await sendWhatsApp(normalizedPhone, greetingMessage);

        if (!sendResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: sendResult.error || 'Failed to send greeting message',
                },
                { status: 500 }
            );
        }

        await WaGreetingLog.create({
            phoneRaw: rawPhone,
            phoneNormalized: normalizedPhone,
            firstMessageAt: new Date(),
            greetingSentAt: new Date(),
        });

        return NextResponse.json({ success: true, greeted: true, phone: normalizedPhone });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error?.message || 'Failed to process webhook payload' },
            { status: 500 }
        );
    }
}
