// Currency utility functions

export interface CurrencyInfo {
    code: string;
    symbol: string;
    name: string;
}

const currencies: Record<string, CurrencyInfo> = {
    AED: { code: 'AED', symbol: '\u062f.\u0625', name: 'UAE Dirham' },
    AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
    BDT: { code: 'BDT', symbol: '\u09f3', name: 'Bangladeshi Taka' },
    BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
    CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    CHF: { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
    CNY: { code: 'CNY', symbol: '\u00a5', name: 'Chinese Yuan' },
    EGP: { code: 'EGP', symbol: 'E\u00a3', name: 'Egyptian Pound' },
    EUR: { code: 'EUR', symbol: '\u20ac', name: 'Euro' },
    GBP: { code: 'GBP', symbol: '\u00a3', name: 'British Pound' },
    HKD: { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
    IDR: { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
    INR: { code: 'INR', symbol: '\u20b9', name: 'Indian Rupee' },
    JPY: { code: 'JPY', symbol: '\u00a5', name: 'Japanese Yen' },
    KRW: { code: 'KRW', symbol: '\u20a9', name: 'South Korean Won' },
    KWD: { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar' },
    LKR: { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee' },
    MMK: { code: 'MMK', symbol: 'K', name: 'Myanmar Kyat' },
    MXN: { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
    MYR: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
    NGN: { code: 'NGN', symbol: '\u20a6', name: 'Nigerian Naira' },
    NOK: { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
    NPR: { code: 'NPR', symbol: '\u20a8', name: 'Nepalese Rupee' },
    NZD: { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
    OMR: { code: 'OMR', symbol: '\u0631.\u0639.', name: 'Omani Rial' },
    PHP: { code: 'PHP', symbol: '\u20b1', name: 'Philippine Peso' },
    PKR: { code: 'PKR', symbol: '\u20a8', name: 'Pakistani Rupee' },
    QAR: { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal' },
    SAR: { code: 'SAR', symbol: 'SR', name: 'Saudi Riyal' },
    SEK: { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
    SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
    THB: { code: 'THB', symbol: '\u0e3f', name: 'Thai Baht' },
    TRY: { code: 'TRY', symbol: '\u20ba', name: 'Turkish Lira' },
    USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
    VND: { code: 'VND', symbol: '\u20ab', name: 'Vietnamese Dong' },
    ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
};

export function getCurrencySymbol(code: string): string {
    return currencies[code]?.symbol || '$';
}

export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
    const symbol = getCurrencySymbol(currencyCode);
    return `${symbol}${Number(amount || 0).toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;
}

export function getAllCurrencies(): CurrencyInfo[] {
    return Object.values(currencies).sort((a, b) => a.code.localeCompare(b.code));
}

export function getCurrencyInfo(code: string): CurrencyInfo {
    return currencies[code] || currencies.USD;
}
