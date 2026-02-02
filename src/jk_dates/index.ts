/**
 * Calculate week-number from a date.
 */
export function calcWeekNumber(year: number, month: number, day: number): number {
    const date = new Date(Date.UTC(year, month - 1, day));
    const dayNum = date.getUTCDay() || 7;

    date.setUTCDate(date.getUTCDate() + (4 - dayNum));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));

    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}