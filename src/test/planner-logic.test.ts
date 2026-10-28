import { describe, it, expect, vi } from 'vitest';
import { commonAvailability, saveSlot } from '@/features/availability/queries';
import { filterTasks } from '@/features/tasks/filter-tasks';
import { initialFilters } from '@/features/tasks/filter-state';
import {
  changed,
  AccessError,
  safeResourceUrl,
  dataError,
} from '@/lib/data-client';
import { toLocalInput, toInstant } from '@/lib/local-dates';
import type { SlotRow, TaskRow } from '@/types/database';
import { getSupabaseClient } from '@/lib/supabase';
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: vi.fn() }));
const slot = (user: string, start: string, end: string): SlotRow => ({
  id: crypto.randomUUID(),
  project_id: 'project',
  user_id: user,
  starts_at: start,
  ends_at: end,
  created_at: start,
});
describe('planner input and permission boundaries', () => {
  it('treats zero-row writes as lost access, not successful edits', () => {
    expect(() => changed({ data: [], error: null })).toThrow(AccessError);
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,unsafe',
    'ftp://example.com',
    'https://user:password@example.com',
  ])('rejects unsafe URL %s', (value) =>
    expect(() => safeResourceUrl(value)).toThrow(),
  );
  it('shows migration-required errors rather than silent mock fallback', () =>
    expect(dataError({ code: '42703' }).message).toContain('migration'));
  it('round trips a local deadline without moving its instant', () => {
    const v = '2026-10-27T23:30';
    expect(toLocalInput(toInstant(v))).toBe(v);
    expect(toInstant('')).toBeNull();
  });
  it('rejects invalid or reversed availability before using the client', async () => {
    await expect(saveSlot('p', 'u', 'bad', 'bad')).rejects.toThrow();
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });
});
describe('available-time intersections', () => {
  it('merges same-member overlaps without double counting and preserves overnight overlap', () => {
    const s = [
      slot('a', '2026-10-27T22:00Z', '2026-10-28T02:00Z'),
      slot('a', '2026-10-28T00:00Z', '2026-10-28T03:00Z'),
      slot('b', '2026-10-27T23:00Z', '2026-10-28T01:00Z'),
    ];
    expect(
      commonAvailability(
        s,
        ['a', 'b'],
        Date.parse('2026-10-27T00:00Z'),
        Date.parse('2026-10-29T00:00Z'),
      ),
    ).toEqual([
      [Date.parse('2026-10-27T23:00Z'), Date.parse('2026-10-28T01:00Z')],
    ]);
  });
  it('does not count touching exclusive ends as overlap or infer free time for missing members', () => {
    const s = [
      slot('a', '2026-10-27T14:00Z', '2026-10-27T15:00Z'),
      slot('b', '2026-10-27T15:00Z', '2026-10-27T16:00Z'),
    ];
    expect(commonAvailability(s, ['a', 'b'], 0, Infinity)).toEqual([]);
    expect(commonAvailability(s, ['a', 'missing'], 0, Infinity)).toEqual([]);
  });
});
describe('task filtering and sorting', () => {
  it('sorts actual priorities and keeps undated tasks after dated tasks', () => {
    const tasks = [
      {
        id: 'a',
        title: 'Alpha',
        priority: 'low',
        status: 'todo',
        project_id: 'p',
        assignee_id: null,
        due_at: null,
        position: 0,
      },
      {
        id: 'b',
        title: 'Beta',
        priority: 'high',
        status: 'done',
        project_id: 'p',
        assignee_id: null,
        due_at: '2026-10-27T12:00Z',
        position: 1,
      },
    ] as TaskRow[];
    expect(filterTasks(tasks, initialFilters).map((t) => t.id)).toEqual([
      'b',
      'a',
    ]);
    expect(
      filterTasks(tasks, { ...initialFilters, status: 'todo' }).map(
        (t) => t.id,
      ),
    ).toEqual(['a']);
    expect(
      filterTasks(tasks, {
        ...initialFilters,
        priority: 'high',
        sort: 'priority',
      }).map((t) => t.id),
    ).toEqual(['b']);
  });
});
