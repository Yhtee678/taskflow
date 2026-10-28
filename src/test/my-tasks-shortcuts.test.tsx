import './data-api-mocks';
import {
  testTasks,
  testBusyEvents,
  testBusyOccurrences,
} from './data-api-mocks';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
  renderHook,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { routes } from '@/app/router';
import { AuthContext } from '@/features/auth/auth-context';
import { testSession } from './auth-fixtures';
import { loadMyTasks, saveTask } from '@/features/tasks/queries';
import { loadPersonalCalendar } from '@/features/calendar/queries';
import { myTasksBannerState } from '@/features/tasks/banner-state';
import { useLiveTime } from '@/features/tasks/use-live-time';
import type { PersonalScheduleSnapshot } from '@/features/calendar/mini-calendar';
import type { TaskRow } from '@/types/database';
import { loadCatalog } from '@/features/projects/queries';
function mount() {
  const router = createMemoryRouter(routes, { initialEntries: ['/my-tasks'] });
  const view = render(
    <AuthContext.Provider
      value={{
        session: testSession,
        loading: false,
        busy: false,
        error: null,
        configurationError: null,
        signIn: async () => {},
        signOut: async () => {},
        retry: () => {},
      }}
    >
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
  return { ...view, router };
}
async function visit() {
  const view = mount();
  await waitFor(() =>
    expect(screen.queryAllByText('Loading…')).toHaveLength(0),
  );
  return view;
}
describe('My Tasks completion shortcuts', () => {
  it('refreshes on tab focus without replacing the loaded page or losing local state', async () => {
    const user = userEvent.setup();
    await visit();
    const heading = screen.getByRole('heading', { name: 'My Tasks', level: 1 });
    const mini = screen.getByRole('complementary', {
      name: 'Dashboard calendar',
    });
    await user.click(
      within(mini).getByRole('button', { name: 'Next mini calendar month' }),
    );
    await waitFor(() =>
      expect(within(mini).queryByText('Loading…')).not.toBeInTheDocument(),
    );
    const month = within(mini).getByRole('heading', { level: 2 }).textContent;
    await user.type(
      screen.getByRole('searchbox', { name: 'Search tasks' }),
      'Map',
    );
    let finishCatalog!: (
      value: Awaited<ReturnType<typeof loadCatalog>>,
    ) => void;
    let finishTasks!: (value: Awaited<ReturnType<typeof loadMyTasks>>) => void;
    const catalog = await loadCatalog(testSession.user.id);
    const originalTasks = await loadMyTasks(testSession.user.id);
    vi.mocked(loadCatalog).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCatalog = resolve;
        }),
    );
    vi.mocked(loadMyTasks).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishTasks = resolve;
        }),
    );
    const calls = vi.mocked(loadMyTasks).mock.calls.length;
    fireEvent.focus(window);
    expect(loadMyTasks).toHaveBeenCalledTimes(calls + 1);
    expect(screen.getByRole('heading', { name: 'My Tasks', level: 1 })).toBe(
      heading,
    );
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toHaveValue('Map');
    expect(within(mini).getByRole('heading', { level: 2 })).toHaveTextContent(
      month!,
    );
    const updated = originalTasks
      .filter((task) => task.assignee_id === testSession.user.id)
      .map((task) => ({
        ...task,
        title: `Map updated by teammate: ${task.title}`,
      }));
    await act(async () => {
      finishCatalog(catalog);
      finishTasks(updated);
    });
    expect(screen.getByRole('heading', { name: 'My Tasks', level: 1 })).toBe(
      heading,
    );
    expect(
      screen.getAllByText(/Map updated by teammate:/).length,
    ).toBeGreaterThan(0);
  });
  it.each([
    ['todo', 'done'],
    ['in_progress', 'done'],
    ['done', 'todo'],
  ] as const)(
    '%s → %s uses the existing save flow without navigating',
    async (from, to) => {
      const task = testTasks.find((t) => t.id === 'user-flows')!;
      task.status = from;
      const user = userEvent.setup();
      const { router } = await visit();
      const button = screen.getByRole('button', {
        name: `Mark ${task.title} as ${from === 'done' ? 'to do' : 'done'}`,
      });
      await user.click(button);
      expect(saveTask).toHaveBeenCalledWith(
        task.project_id,
        { status: to },
        task.id,
      );
      expect(router.state.location.pathname).toBe('/my-tasks');
      await screen.findByRole('button', {
        name: `Mark ${task.title} as ${to === 'done' ? 'to do' : 'done'}`,
      });
      expect(task.status).toBe(to);
    },
  );
  it('optimistically updates the row and blocks repeated clicks until acknowledgement', async () => {
    const task = testTasks.find((t) => t.id === 'user-flows')!;
    let finish!: (row: TaskRow) => void;
    vi.mocked(saveTask).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const user = userEvent.setup();
    const { router } = await visit();
    const button = screen.getByRole('button', {
      name: `Mark ${task.title} as done`,
    });
    await user.click(button);
    const optimistic = screen.getByRole('button', {
      name: `Mark ${task.title} as to do`,
    });
    expect(optimistic).toHaveAttribute('aria-pressed', 'true');
    expect(optimistic).toBeDisabled();
    fireEvent.click(optimistic);
    fireEvent.click(optimistic);
    expect(saveTask).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/my-tasks');
    await act(async () => {
      task.status = 'done';
      finish({ ...task });
    });
  });
  it('restores the previous status on failure and reports the error', async () => {
    const task = testTasks.find((t) => t.id === 'user-flows')!;
    task.status = 'in_progress';
    vi.mocked(saveTask).mockRejectedValueOnce(
      new Error('Status update failed'),
    );
    const user = userEvent.setup();
    await visit();
    await user.click(
      screen.getByRole('button', { name: `Mark ${task.title} as done` }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Status update failed',
    );
    expect(
      screen.getByRole('button', { name: `Mark ${task.title} as done` }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(task.status).toBe('in_progress');
  });
  it('supports keyboard completion and leaves title navigation intact', async () => {
    const user = userEvent.setup();
    const { router } = await visit();
    const button = screen.getByRole('button', {
      name: 'Mark Map the key user flows as done',
    });
    button.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('button', {
      name: 'Mark Map the key user flows as to do',
    });
    await user.click(
      within(screen.getByRole('table')).getByRole('link', {
        name: 'Map the key user flows',
      }),
    );
    expect(router.state.location.pathname).toBe(
      '/projects/website/tasks/user-flows',
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Map the key user flows',
      }),
    ).toBeInTheDocument();
  });
  it('applies the status change through the existing active task filter', async () => {
    const user = userEvent.setup();
    await visit();
    await user.selectOptions(
      screen.getByLabelText('Filter by status'),
      'in_progress',
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Mark Map the key user flows as done',
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /Mark Map the key user flows/ }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(loadMyTasks).toHaveBeenCalledTimes(2));
    expect(await screen.findByLabelText('Filter by status')).toHaveValue(
      'in_progress',
    );
  });
  it('orders banner, project, activity preview and page heading while keeping the history link outside the scroll list', async () => {
    await visit();
    const banner = screen.getByRole('region', {
        name: 'Current time and task summary',
      }),
      project = screen.getByLabelText('Current project'),
      activity = screen.getByRole('region', { name: 'Recent Activity' }),
      heading = screen.getByRole('heading', { level: 1, name: 'My Tasks' });
    expect(
      banner.compareDocumentPosition(project) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      project.compareDocumentPosition(activity) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      activity.compareDocumentPosition(heading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const link = within(activity).getByRole('link', {
      name: 'View full activity history →',
    });
    expect(link.closest('ol')).toBeNull();
  });
});
const now = new Date('2026-10-28T09:35:00Z');
function schedule(ranges: [number, number][] = []): PersonalScheduleSnapshot {
  return {
    loading: false,
    error: null,
    from: new Date(now.getTime() - 48 * 3600000).toISOString(),
    until: new Date(now.getTime() + 48 * 3600000).toISOString(),
    data: {
      events: [],
      occurrences: ranges.map(([a, b], i) => ({
        event_id: String(i),
        starts_at: new Date(a).toISOString(),
        ends_at: new Date(b).toISOString(),
      })),
    },
  };
}
function task(values: Partial<TaskRow> = {}): TaskRow {
  return { ...testTasks[0], status: 'todo', due_at: null, ...values };
}
describe('banner message priority and availability using existing interval logic', () => {
  it('prioritizes overdue work without claiming a busy user is free', () => {
    const state = myTasksBannerState(
      [task({ due_at: new Date(now.getTime() - 1).toISOString() })],
      schedule([[now.getTime() - 1000, now.getTime() + 1000]]),
      now,
    );
    expect(state.kind).toBe('overdue');
    expect(state.overdue).toBe(1);
    expect(state.availability).toBe('Currently busy');
  });
  it('shows all-completed work before the busy message while retaining the busy label', () => {
    const state = myTasksBannerState(
      [
        task({
          status: 'done',
          due_at: new Date(now.getTime() - 1).toISOString(),
        }),
      ],
      schedule([[now.getTime() - 1000, now.getTime() + 1000]]),
      now,
    );
    expect(state.kind).toBe('complete');
    expect(state.pending).toBe(0);
    expect(state.overdue).toBe(0);
    expect(state.availability).toBe('Currently busy');
  });
  it('prioritizes current busy time over an upcoming deadline', () => {
    expect(
      myTasksBannerState(
        [task({ due_at: new Date(now.getTime() + 3600000).toISOString() })],
        schedule([[now.getTime() - 1000, now.getTime() + 1000]]),
        now,
      ).kind,
    ).toBe('busy');
  });
  it('recognizes the nearest incomplete upcoming deadline in the 24-hour window', () => {
    const near = task({
      id: 'near',
      due_at: new Date(now.getTime() + 3600000).toISOString(),
    });
    const state = myTasksBannerState(
      [
        task({ due_at: new Date(now.getTime() + 7200000).toISOString() }),
        near,
        task({ status: 'done', due_at: now.toISOString() }),
      ],
      schedule(),
      now,
    );
    expect(state.kind).toBe('upcoming');
    expect(state.pending).toBe(2);
    expect(state.next?.id).toBe('near');
  });
  it('distinguishes potential time with pending work from no assignments', () => {
    expect(myTasksBannerState([task()], schedule(), now).kind).toBe('pending');
    expect(myTasksBannerState([], schedule(), now).kind).toBe('empty');
    expect(myTasksBannerState([], schedule(), now).availability).toBe(
      'Potentially Available',
    );
  });
  it('does not claim availability or completion while required data is loading or failed', () => {
    expect(myTasksBannerState(null, null, now).kind).toBe('loading');
    expect(myTasksBannerState([task()], null, now).availability).toBe(
      'Checking schedule…',
    );
    expect(
      myTasksBannerState(
        [task()],
        { ...schedule(), error: new Error('offline') },
        now,
      ).availability,
    ).toBe('Availability unavailable');
  });
  it('handles overlapping overnight occurrences and exclusive busy ends', () => {
    expect(
      myTasksBannerState(
        [task()],
        schedule([
          [now.getTime() - 12 * 3600000, now.getTime() + 3600000],
          [now.getTime() - 1000, now.getTime() + 2000],
        ]),
        now,
      ).availability,
    ).toBe('Currently busy');
    expect(
      myTasksBannerState(
        [task()],
        schedule([[now.getTime() - 1000, now.getTime()]]),
        now,
      ).availability,
    ).toBe('Potentially Available');
  });
});
describe('live banner display timer', () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  it('crosses busy boundaries and updates the clock without polling data', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    testTasks.forEach((t) => {
      t.status = 'done';
    });
    const start = new Date(now.getTime() + 10000).toISOString(),
      end = new Date(now.getTime() + 20000).toISOString();
    testBusyEvents.push({
      id: 'timed',
      user_id: testSession.user.id,
      title: 'Busy',
      category: 'class',
      description: '',
      recurrence: 'daily',
      time_zone: 'UTC',
      starts_at: start,
      ends_at: end,
      created_at: start,
    });
    testBusyOccurrences.push({
      event_id: 'timed',
      starts_at: start,
      ends_at: end,
    });
    const view = mount();
    await act(async () => {});
    const banner = screen.getByRole('region', {
      name: 'Current time and task summary',
    });
    expect(
      within(banner).getByText('Potentially Available'),
    ).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10001);
    });
    expect(within(banner).getByText('Currently busy')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(
      within(banner).getByText('Potentially Available'),
    ).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(banner).toHaveTextContent(
      new Date(Date.now()).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }),
    );
    expect(loadPersonalCalendar).toHaveBeenCalledTimes(1);
    expect(loadMyTasks).toHaveBeenCalledTimes(1);
    view.unmount();
  });
  it('cleans up its display timeout on unmount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const hook = renderHook(() => useLiveTime([], []));
    expect(vi.getTimerCount()).toBe(1);
    hook.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
