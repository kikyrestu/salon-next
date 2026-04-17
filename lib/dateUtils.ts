// Simple timezone-aware date formatting without external dependencies
let cachedTimezone: string | null = null;

type DateParts = {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (
    timezone: string,
    options: Intl.DateTimeFormatOptions = {}
) => {
    const cacheKey = `${timezone}-${JSON.stringify(options)}`;
    if (!formatterCache.has(cacheKey)) {
        formatterCache.set(cacheKey, new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            hour12: false,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            ...options,
        }));
    }
    return formatterCache.get(cacheKey)!;
};

const getDateParts = (date: Date, timezone: string): DateParts => {
    const parts = getFormatter(timezone).formatToParts(date);
    const values = Object.fromEntries(
        parts
            .filter((part) => part.type !== "literal")
            .map((part) => [part.type, Number(part.value)])
    ) as Record<string, number>;

    return {
        year: values.year,
        month: values.month,
        day: values.day,
        hour: values.hour,
        minute: values.minute,
        second: values.second,
    };
};

const getTimezoneOffsetMs = (date: Date, timezone: string): number => {
    const parts = getDateParts(date, timezone);
    const utcEquivalent = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
    );

    return utcEquivalent - date.getTime();
};

const getUtcDateForTimezoneLocalTime = (
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    timezone: string
): Date => {
    let utcTs = Date.UTC(year, month - 1, day, hour, minute, second);

    // Recalculate a few times to settle around DST boundaries.
    for (let i = 0; i < 3; i += 1) {
        const offset = getTimezoneOffsetMs(new Date(utcTs), timezone);
        utcTs = Date.UTC(year, month - 1, day, hour, minute, second) - offset;
    }

    return new Date(utcTs);
};

const pad = (value: number) => String(value).padStart(2, "0");

export const getTimezone = async (): Promise<string> => {
    if (cachedTimezone) return cachedTimezone;
    try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.success && data.data.timezone) {
            cachedTimezone = data.data.timezone;
            return data.data.timezone;
        }
    } catch (error) {
        console.error("Failed to fetch timezone", error);
    }
    return 'UTC';
};

export const getCurrentDateInTimezone = (timezone: string = "UTC", date: Date = new Date()): string => {
    const parts = getDateParts(date, timezone);
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};

export const getMonthDateRangeInTimezone = (timezone: string = "UTC", date: Date = new Date()) => {
    const parts = getDateParts(date, timezone);
    const lastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();

    return {
        startDate: `${parts.year}-${pad(parts.month)}-01`,
        endDate: `${parts.year}-${pad(parts.month)}-${pad(lastDay)}`,
    };
};

export const getUtcRangeForDateRange = (
    startDate: string,
    endDate: string,
    timezone: string = "UTC"
) => {
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);

    const start = getUtcDateForTimezoneLocalTime(startYear, startMonth, startDay, 0, 0, 0, timezone);
    const nextDayStart = getUtcDateForTimezoneLocalTime(endYear, endMonth, endDay + 1, 0, 0, 0, timezone);
    const end = new Date(nextDayStart.getTime() - 1);

    return { start, end };
};

export const formatDateTime = (date: string | Date, timezone: string = 'UTC'): string => {
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        return new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(d);
    } catch (e) {
        return String(date);
    }
};

export const formatDate = (date: string | Date, timezone: string = 'UTC'): string => {
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        return new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(d);
    } catch (e) {
        return String(date);
    }
};
