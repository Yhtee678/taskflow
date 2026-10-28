import {
  allRows,
  changed,
  dataClient,
  dataError,
  text,
} from '@/lib/data-client';
import type { BusyEventRow } from '@/types/database';
export const categories = {
  class: 'Class',
  exam: 'Test/Exam',
  event: 'Event',
  study: 'Study',
  personal: 'Personal',
  other: 'Other',
} as const;
export type BusyValues = Pick<
  BusyEventRow,
  | 'title'
  | 'category'
  | 'description'
  | 'starts_at'
  | 'ends_at'
  | 'recurrence'
  | 'time_zone'
>;
function calendarError(error: unknown): never {
  if (typeof error === 'object' && error && 'code' in error)
    throw dataError(error as { code: string });
  throw error;
}
export async function loadPersonalCalendar(
  userId: string,
  start: string,
  end: string,
) {
  const db = dataClient();
  try {
    const [events, occurrences] = await Promise.all([
      allRows((a, b) =>
        db
          .from('busy_events')
          .select('*')
          .eq('user_id', userId)
          .order('starts_at')
          .order('id')
          .range(a, b),
      ),
      allRows((a, b) =>
        db
          .rpc('get_own_busy_occurrences', { p_start: start, p_end: end })
          .order('starts_at')
          .order('event_id')
          .range(a, b),
      ),
    ]);
    return { events, occurrences };
  } catch (error) {
    return calendarError(error);
  }
}
export async function loadTeamBusy(
  projectId: string,
  start: string,
  end: string,
) {
  return allRows((a, b) =>
    dataClient()
      .rpc('get_project_busy_periods', {
        p_project_id: projectId,
        p_start: start,
        p_end: end,
      })
      .order('user_id')
      .order('starts_at')
      .order('ends_at')
      .range(a, b),
  );
}
export async function saveBusyEvent(
  userId: string,
  values: BusyValues,
  id?: string,
) {
  if (
    !Number.isFinite(Date.parse(values.starts_at)) ||
    !Number.isFinite(Date.parse(values.ends_at)) ||
    Date.parse(values.starts_at) >= Date.parse(values.ends_at)
  )
    throw new Error(
      'End must be after start. For overnight events select the next end date.',
    );
  if (
    !Object.hasOwn(categories, values.category) ||
    !['none', 'daily', 'weekly'].includes(values.recurrence)
  )
    throw new Error('Select a valid category and recurrence.');
  const payload = {
    ...values,
    title: text(values.title, 200, true),
    description: text(values.description, 10000),
  };
  const db = dataClient();
  return id
    ? changed(
        await db
          .from('busy_events')
          .update(payload)
          .eq('id', id)
          .eq('user_id', userId)
          .select(),
      )
    : changed(
        await db
          .from('busy_events')
          .insert({ ...payload, user_id: userId })
          .select(),
      );
}
export async function deleteBusyEvent(userId: string, id: string) {
  return changed(
    await dataClient()
      .from('busy_events')
      .delete()
      .eq('user_id', userId)
      .eq('id', id)
      .select(),
  );
}
