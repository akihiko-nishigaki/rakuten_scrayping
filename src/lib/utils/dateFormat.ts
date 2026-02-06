import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const JAPAN_TIMEZONE = 'Asia/Tokyo';

/**
 * Format a date in Japan timezone (JST)
 */
export function formatJST(date: Date | string, formatStr: string = 'yyyy/MM/dd HH:mm:ss'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const jstDate = toZonedTime(d, JAPAN_TIMEZONE);
    return format(jstDate, formatStr);
}

/**
 * Format a date in Japan timezone with short format (MM/dd HH:mm)
 */
export function formatJSTShort(date: Date | string): string {
    return formatJST(date, 'MM/dd HH:mm');
}
