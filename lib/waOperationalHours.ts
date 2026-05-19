/**
 * Shared utility for WA operational hours checking.
 * All WA sending paths (cron routes, scheduler, campaigns) should use this
 * to respect the dynamic operational hours configured by the store owner.
 */

export interface OperationalHoursSettings {
    waOperationalHoursStart?: number; // jam mulai (0-23), default 8
    waOperationalHoursEnd?: number;   // jam selesai (0-23), default 20
}

/**
 * Cek apakah waktu sekarang ada di dalam jam operasional WA.
 * Membaca settings dari DB sehingga owner bisa konfigurasi sendiri.
 *
 * @param settings - Settings dari DB
 * @param now      - Waktu saat ini (default: new Date())
 * @returns { allowed, currentHour, reason? }
 */
export function checkOperationalHours(
    settings: OperationalHoursSettings,
    now: Date = new Date()
): { allowed: boolean; currentHour: number; reason?: string } {

    const tz = 'Asia/Jakarta';
    const opStart = settings.waOperationalHoursStart ?? 8;
    const opEnd = settings.waOperationalHoursEnd ?? 20;

    const currentHour = parseInt(
        new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: 'numeric',
            hour12: false,
        }).format(now)
    );

    if (opStart >= opEnd) {
        return {
            allowed: false,
            currentHour,
            reason: `Invalid operational hours config: start (${opStart}) >= end (${opEnd})`
        };
    }

    const allowed = currentHour >= opStart && currentHour < opEnd;

    return {
        allowed,
        currentHour,
        reason: allowed
            ? undefined
            : `Outside operational hours (now: ${currentHour}:xx WIB, allowed: ${opStart}:00-${opEnd}:00)`
    };
}

/**
 * Cek apakah sudah melewati waktu jadwal hari ini.
 * Dipakai untuk notifikasi yang punya jam spesifik (misal daily report jam 21:00)
 *
 * @param scheduleTime - string "HH:MM" (misal "21:00")
 * @param now          - waktu sekarang
 * @returns { ready: boolean; scheduledAt: string; reason?: string }
 */
export function checkScheduleTime(
    scheduleTime: string,
    now: Date = new Date()
): { ready: boolean; scheduledAt: string; reason?: string } {

    const tz = 'Asia/Jakarta';
    const [hh, mm] = scheduleTime.split(':').map(Number);

    // Buat Date object untuk scheduled time di timezone toko
    const nowInTz = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const scheduledToday = new Date(nowInTz);
    scheduledToday.setHours(hh, mm, 0, 0);

    const ready = nowInTz.getTime() >= scheduledToday.getTime();

    return {
        ready,
        scheduledAt: `${scheduleTime} ${tz}`,
        reason: ready
            ? undefined
            : `Not yet time (scheduled: ${scheduleTime}, now: ${nowInTz.getHours()}:${String(nowInTz.getMinutes()).padStart(2, '0')})`
    };
}
