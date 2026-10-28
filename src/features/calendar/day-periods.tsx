import type { BusyPeriod } from '@/types/database';
import { mergeRanges, potentiallyAvailable, rangeLabel } from './intervals';
export function DayPeriods({
  periods,
  day,
  stacked = false,
}: {
  periods: Pick<BusyPeriod, 'starts_at' | 'ends_at'>[];
  day: Date;
  stacked?: boolean;
}) {
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  const start = day.getTime(),
    end = next.getTime();
  const busy = mergeRanges(
    periods.map((p) => [Date.parse(p.starts_at), Date.parse(p.ends_at)]),
    start,
    end,
  );
  const free = potentiallyAvailable(periods, start, end);
  return (
    <div className={`day-periods${stacked ? ' stacked' : ''}`}>
      {!busy.length && (
        <p className="helper">
          No busy time recorded for this date; availability is unconfirmed.
        </p>
      )}
      {[
        ...busy.map((r) => ({ r, busy: true })),
        ...free.map((r) => ({ r, busy: false })),
      ]
        .sort((a, b) => a.r[0] - b.r[0])
        .map(({ r, busy }) => (
          <div
            className={busy ? 'period-busy' : 'period-potential'}
            key={`${r[0]}-${busy}`}
          >
            <strong>{busy ? 'Busy' : 'Potentially Available'}</strong>
            <span>{rangeLabel(r, end)}</span>
          </div>
        ))}
    </div>
  );
}
