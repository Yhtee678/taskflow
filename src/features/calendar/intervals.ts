import type { BusyPeriod } from '@/types/database';
export type Range = [number, number];
export function localDay(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
export function rangeLabel([a, b]: Range, end?: number) {
  const time = (n: number) =>
    new Date(n).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  return `${time(a)} – ${b === end ? 'End of Day' : time(b)}`;
}
export function mergeRanges(
  ranges: Range[],
  start: number,
  end: number,
): Range[] {
  const merged: Range[] = [];
  for (const [a, b] of ranges
    .map(([a, b]) => [Math.max(a, start), Math.min(b, end)] as Range)
    .filter(([a, b]) => a < b)
    .sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else merged.push([a, b]);
  }
  return merged;
}
// Complement of recorded occupancy only. Absence of events is not confirmed free time.
export function potentiallyAvailable(
  periods: Pick<BusyPeriod, 'starts_at' | 'ends_at'>[],
  start: number,
  end: number,
): Range[] {
  if (start >= end) return [];
  const busy = mergeRanges(
    periods.map((p) => [Date.parse(p.starts_at), Date.parse(p.ends_at)]),
    start,
    end,
  );
  const out: Range[] = [];
  let cursor = start;
  for (const [a, b] of busy) {
    if (cursor < a) out.push([cursor, a]);
    cursor = b;
  }
  if (cursor < end) out.push([cursor, end]);
  return out;
}
export function commonPotential(
  periods: BusyPeriod[],
  users: string[],
  start: number,
  end: number,
): Range[] {
  if (!users.length) return [];
  return potentiallyAvailable(
    periods.filter((p) => users.includes(p.user_id)),
    start,
    end,
  );
}
export function overlaps(start: string, end: string, day: Date, next: Date) {
  return Date.parse(start) < next.getTime() && Date.parse(end) > day.getTime();
}
export function monthWindow(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
  const days =
    Math.ceil(
      (offset +
        new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) /
        7,
    ) * 7;
  return {
    start,
    end: new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + days,
    ),
    days,
  };
}
