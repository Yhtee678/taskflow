import { dataClient, allRows, changed } from '@/lib/data-client';
import type { SlotRow } from '@/types/database';
export async function loadSlots(projectId: string, start: string, end: string) {
  return allRows((a, b) =>
    dataClient()
      .from('availability_slots')
      .select('*')
      .eq('project_id', projectId)
      .lt('starts_at', end)
      .gt('ends_at', start)
      .order('starts_at')
      .order('id')
      .range(a, b),
  );
}
export async function saveSlot(
  projectId: string,
  userId: string,
  starts_at: string,
  ends_at: string,
  id?: string,
) {
  if (
    !Number.isFinite(Date.parse(starts_at)) ||
    !Number.isFinite(Date.parse(ends_at)) ||
    Date.parse(ends_at) <= Date.parse(starts_at)
  )
    throw new Error(
      'End must be after start. For overnight availability select the following end date.',
    );
  const db = dataClient();
  return id
    ? changed(
        await db
          .from('availability_slots')
          .update({ starts_at, ends_at })
          .eq('project_id', projectId)
          .eq('user_id', userId)
          .eq('id', id)
          .select(),
      )
    : changed(
        await db
          .from('availability_slots')
          .insert({
            project_id: projectId,
            user_id: userId,
            starts_at,
            ends_at,
          })
          .select(),
      );
}
export async function deleteSlot(
  projectId: string,
  userId: string,
  id: string,
) {
  return changed(
    await dataClient()
      .from('availability_slots')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('id', id)
      .select(),
  );
}
export type Interval = [number, number];
export function commonAvailability(
  slots: SlotRow[],
  users: string[],
  start: number,
  end: number,
): Interval[] {
  const uniqueUsers = [...new Set(users)];
  if (uniqueUsers.length < 2) return [];
  const merge = (ranges: Interval[]) => {
    const out: Interval[] = [];
    for (const r of ranges.sort((a, b) => a[0] - b[0])) {
      const last = out.at(-1);
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else out.push([...r]);
    }
    return out;
  };
  let shared: Interval[] = [[start, end]];
  for (const user of uniqueUsers) {
    const ranges = merge(
      slots
        .filter((s) => s.user_id === user)
        .map(
          (s) =>
            [
              Math.max(start, Date.parse(s.starts_at)),
              Math.min(end, Date.parse(s.ends_at)),
            ] as Interval,
        )
        .filter((r) => r[0] < r[1]),
    );
    const next: Interval[] = [];
    for (const a of shared)
      for (const b of ranges) {
        const lo = Math.max(a[0], b[0]),
          hi = Math.min(a[1], b[1]);
        if (lo < hi) next.push([lo, hi]);
      }
    shared = merge(next);
  }
  return shared;
}
