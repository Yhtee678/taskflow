import { useEffect, useState } from 'react';
import type { BusyOccurrence, TaskRow } from '@/types/database';
// Local display updates only; no polling or scheduling requests.
export function useLiveTime(
  tasks: TaskRow[] | null,
  occurrences: BusyOccurrence[] | undefined,
) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const time = now.getTime();
    const edges = [
      ...(occurrences ?? []).flatMap((o) => [
        Date.parse(o.starts_at),
        Date.parse(o.ends_at),
      ]),
      ...(tasks ?? []).flatMap((t) =>
        t.status !== 'done' && t.due_at ? [Date.parse(t.due_at)] : [],
      ),
    ];
    const next = edges.reduce(
      (next, t) => (t >= time ? Math.min(next, t) : next),
      Math.floor(time / 60000) * 60000 + 60000,
    );
    const timer = window.setTimeout(
      () => setNow(new Date()),
      Math.max(1, next - Date.now() + 1),
    );
    return () => window.clearTimeout(timer);
  }, [now, occurrences, tasks]);
  useEffect(() => {
    const sync = () => setNow(new Date());
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);
  return now;
}
