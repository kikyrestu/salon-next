/**
 * Validate WA message content before sending to reduce spam risk.
 * Checks for risky patterns that may trigger WA spam detection.
 */

const RISKY_PATTERNS: { pattern: RegExp; label: string }[] = [
    { pattern: /gratis/i, label: 'kata "gratis"' },
    { pattern: /\bpromo\b.*!\s*$/i, label: 'kata "promo" + tanda seru' },
    { pattern: /klik link/i, label: '"klik link"' },
    { pattern: /bit\.ly/i, label: 'URL shortener bit.ly' },
    { pattern: /tinyurl/i, label: 'URL shortener tinyurl' },
    { pattern: /s\.id\//i, label: 'URL shortener s.id' },
];

export interface MessageValidationResult {
    safe: boolean;
    warnings: string[];
}

export function validateMessageContent(message: string): MessageValidationResult {
    const warnings: string[] = [];

    if (message.length > 1000) {
        warnings.push('Pesan terlalu panjang (>1000 karakter) — WA cenderung flag sebagai spam');
    }

    const exclamationCount = (message.match(/!/g) || []).length;
    if (exclamationCount > 3) {
        warnings.push(`Terlalu banyak tanda seru (${exclamationCount}x) — terkesan spam`);
    }

    const capsRatio = message.replace(/[^A-Z]/g, '').length / Math.max(message.replace(/[^a-zA-Z]/g, '').length, 1);
    if (capsRatio > 0.5 && message.length > 20) {
        warnings.push('Terlalu banyak huruf kapital — terkesan berteriak/spam');
    }

    for (const { pattern, label } of RISKY_PATTERNS) {
        if (pattern.test(message)) {
            warnings.push(`Konten berisiko: ${label} — pertimbangkan ulang kata-katanya`);
        }
    }

    return { safe: warnings.length === 0, warnings };
}
