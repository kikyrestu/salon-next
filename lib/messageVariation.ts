/**
 * Add subtle variations to WA messages to avoid identical-content spam detection.
 * WhatsApp flags identical messages sent to many people — this adds small,
 * natural variations that don't change the meaning.
 */

const GREETING_VARIATIONS = ['Halo', 'Hai', 'Hi', 'Hallo'];
const CLOSING_VARIATIONS = [
    'Terima kasih 🙏',
    'Salam hangat 😊',
    'Sampai jumpa ✨',
    'Terima kasih ya 🙏',
    'Salam dari kami 😊',
];

/**
 * Add message variation to reduce spam detection risk.
 * - Replaces common greetings with random variations
 */
export function addMessageVariation(message: string): string {
    let varied = message;

    // 1. Replace greeting at start of message
    const greetingMatch = varied.match(/^(Halo|Hai|Hi|Hallo)/i);
    if (greetingMatch) {
        const randomGreeting = GREETING_VARIATIONS[Math.floor(Math.random() * GREETING_VARIATIONS.length)];
        varied = varied.replace(greetingMatch[0], randomGreeting);
    }

    // 2. Append random closing variations if not already ends with one
    // Only append if message is reasonably long, to avoid weird short messages
    if (varied.length > 20) {
        const hasClosing = CLOSING_VARIATIONS.some(c => varied.includes(c.replace(/[^a-zA-Z]/g, '').trim()));
        if (!hasClosing) {
            const randomClosing = CLOSING_VARIATIONS[Math.floor(Math.random() * CLOSING_VARIATIONS.length)];
            varied += `\n\n${randomClosing}`;
        }
    }

    // 3. Randomize emoji at the end of some sentences
    // This looks for a period or exclamation mark at the end of a line and sometimes appends an emoji
    const EMOJIS = ['✨', '🌟', '✂️', '💅', '💆‍♀️', '💇‍♀️', '💖'];
    const lines = varied.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().length > 15 && /[.!]$/.test(lines[i].trim()) && Math.random() > 0.7) {
            const randomEmoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
            lines[i] = lines[i].trim() + ' ' + randomEmoji;
        }
    }
    varied = lines.join('\n');

    // BLOCK-02 Fix: Invisible characters injection has been removed.
    // Using zero-width characters is easily detected by WA and increases block risk.

    return varied;
}
