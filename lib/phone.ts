export function normalizeIndonesianPhone(rawPhone: unknown): string {
    const input = String(rawPhone || '').trim();
    if (!input) return '';

    let digits = input.replace(/\D/g, '');
    if (!digits) return '';

    // Handle numbers prefixed with international call prefix, e.g. 0062...
    if (digits.startsWith('00')) {
        digits = digits.slice(2);
    }

    // Common local format: 08xxxxxxxxxx -> 628xxxxxxxxxx
    if (digits.startsWith('0')) {
        digits = `62${digits.slice(1)}`;
    }

    // Some users omit 0 and type 8xxxxxxxxxx.
    if (digits.startsWith('8')) {
        digits = `62${digits}`;
    }

    // Fix mixed input like 62 08xxxxxxxxxx -> 6208... => 628...
    if (digits.startsWith('620')) {
        digits = `62${digits.slice(3)}`;
    }

    // Keep only Indonesian numbers in E.164-like local form without plus sign.
    if (!digits.startsWith('62')) {
        return digits;
    }

    return digits;
}

export function isLikelyValidPhone(rawPhone: unknown): boolean {
    const normalized = normalizeIndonesianPhone(rawPhone);
    const digits = normalized.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
}
