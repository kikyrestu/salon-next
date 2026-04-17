export interface TimezoneInfo {
    value: string;
    label: string;
}

const timezones: TimezoneInfo[] = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/Anchorage', label: 'UTC-09:00 Alaska - Anchorage' },
    { value: 'America/Los_Angeles', label: 'UTC-08:00 Pacific Time - Los Angeles' },
    { value: 'America/Denver', label: 'UTC-07:00 Mountain Time - Denver' },
    { value: 'America/Phoenix', label: 'UTC-07:00 Arizona - Phoenix' },
    { value: 'America/Chicago', label: 'UTC-06:00 Central Time - Chicago' },
    { value: 'America/Mexico_City', label: 'UTC-06:00 Mexico City' },
    { value: 'America/New_York', label: 'UTC-05:00 Eastern Time - New York' },
    { value: 'America/Toronto', label: 'UTC-05:00 Toronto' },
    { value: 'America/Bogota', label: 'UTC-05:00 Bogota' },
    { value: 'America/Halifax', label: 'UTC-04:00 Atlantic Time - Halifax' },
    { value: 'America/Sao_Paulo', label: 'UTC-03:00 Sao Paulo' },
    { value: 'America/Argentina/Buenos_Aires', label: 'UTC-03:00 Buenos Aires' },
    { value: 'Atlantic/Azores', label: 'UTC-01:00 Azores' },
    { value: 'Europe/London', label: 'UTC+00:00 London' },
    { value: 'Europe/Dublin', label: 'UTC+00:00 Dublin' },
    { value: 'Europe/Paris', label: 'UTC+01:00 Paris' },
    { value: 'Europe/Berlin', label: 'UTC+01:00 Berlin' },
    { value: 'Europe/Madrid', label: 'UTC+01:00 Madrid' },
    { value: 'Europe/Rome', label: 'UTC+01:00 Rome' },
    { value: 'Europe/Athens', label: 'UTC+02:00 Athens' },
    { value: 'Europe/Helsinki', label: 'UTC+02:00 Helsinki' },
    { value: 'Africa/Cairo', label: 'UTC+02:00 Cairo' },
    { value: 'Africa/Johannesburg', label: 'UTC+02:00 Johannesburg' },
    { value: 'Europe/Moscow', label: 'UTC+03:00 Moscow' },
    { value: 'Asia/Riyadh', label: 'UTC+03:00 Riyadh' },
    { value: 'Asia/Dubai', label: 'UTC+04:00 Dubai' },
    { value: 'Asia/Karachi', label: 'UTC+05:00 Karachi' },
    { value: 'Asia/Kolkata', label: 'UTC+05:30 Kolkata' },
    { value: 'Asia/Dhaka', label: 'UTC+06:00 Dhaka' },
    { value: 'Asia/Bangkok', label: 'UTC+07:00 Bangkok' },
    { value: 'Asia/Jakarta', label: 'UTC+07:00 Jakarta' },
    { value: 'Asia/Singapore', label: 'UTC+08:00 Singapore' },
    { value: 'Asia/Hong_Kong', label: 'UTC+08:00 Hong Kong' },
    { value: 'Asia/Shanghai', label: 'UTC+08:00 Shanghai' },
    { value: 'Australia/Perth', label: 'UTC+08:00 Perth' },
    { value: 'Asia/Tokyo', label: 'UTC+09:00 Tokyo' },
    { value: 'Asia/Seoul', label: 'UTC+09:00 Seoul' },
    { value: 'Australia/Adelaide', label: 'UTC+09:30 Adelaide' },
    { value: 'Australia/Sydney', label: 'UTC+10:00 Sydney' },
    { value: 'Pacific/Auckland', label: 'UTC+12:00 Auckland' },
];

export function getAllTimezones(): TimezoneInfo[] {
    return timezones;
}
