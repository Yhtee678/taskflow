import type { TaskRow } from '@/types/database';
import type { PersonalScheduleSnapshot } from '@/features/calendar/mini-calendar';
import { localDay, potentiallyAvailable } from '@/features/calendar/intervals';
export function myTasksBannerState(
  tasks: TaskRow[] | null,
  schedule: PersonalScheduleSnapshot | null,
  now: Date,
) {
  const day = localDay(now),
    end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1),
    time = now.getTime();
  const covered =
    !!schedule?.data &&
    !schedule.loading &&
    !schedule.error &&
    Date.parse(schedule.from) <= day.getTime() &&
    Date.parse(schedule.until) >= end.getTime();
  const availability = covered
    ? potentiallyAvailable(
        schedule!.data!.occurrences,
        day.getTime(),
        end.getTime(),
      ).some(([a, b]) => a <= time && time < b)
      ? 'Potentially Available'
      : 'Currently busy'
    : schedule?.error
      ? 'Availability unavailable'
      : 'Checking schedule…';
  if (!tasks)
    return {
      availability,
      kind: 'loading',
      message: 'Checking your assigned work…',
      pending: null,
      overdue: 0,
      next: null,
    };
  const pending = tasks.filter((t) => t.status !== 'done');
  const overdue = pending.filter(
    (t) => t.due_at && Date.parse(t.due_at) < time,
  ).length;
  const next =
    pending
      .filter((t) => t.due_at && Date.parse(t.due_at) >= time)
      .sort((a, b) => Date.parse(a.due_at!) - Date.parse(b.due_at!))[0] ?? null;
  let kind: string, message: string;
  if (overdue) {
    kind = 'overdue';
    message = 'A deadline has passed. One task at a time.';
  } else if (tasks.length && !pending.length) {
    kind = 'complete';
    message = 'All caught up! Nice work.';
  } else if (availability === 'Currently busy') {
    kind = 'busy';
    message = "You're currently busy. Focus on what you're doing.";
  } else if (next && Date.parse(next.due_at!) - time <= 24 * 60 * 60 * 1000) {
    kind = 'upcoming';
    message = "Deadline's getting close. A little progress can help.";
  } else if (pending.length) {
    kind = 'pending';
    message = "One task at a time. You've got this.";
  } else {
    kind = 'empty';
    message = 'No assigned tasks right now.';
  }
  return {
    availability,
    kind,
    message,
    pending: pending.length,
    overdue,
    next,
  };
}
