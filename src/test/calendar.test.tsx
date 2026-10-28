import './data-api-mocks';
import {
  testBusyEvents,
  testBusyOccurrences,
  testTeamBusy,
} from './data-api-mocks';
import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { routes } from '@/app/router';
import { AuthContext } from '@/features/auth/auth-context';
import { testSession } from './auth-fixtures';
import {
  localDay,
  commonPotential,
  potentiallyAvailable,
  mergeRanges,
  monthWindow,
} from '@/features/calendar/intervals';
import {
  saveBusyEvent,
  deleteBusyEvent,
  loadPersonalCalendar,
  loadTeamBusy,
} from '@/features/calendar/queries';
import { startOfWeek } from '@/lib/local-dates';
const stamp = (day: Date, hour: number) =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hour,
  ).toISOString();
async function visit(path: string) {
  render(
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
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: [path] })}
      />
    </AuthContext.Provider>,
  );
  await waitFor(() =>
    expect(screen.queryAllByText('Loading…')).toHaveLength(0),
  );
}
function seedEvent() {
  const day = localDay();
  const event = {
    id: 'private-event',
    user_id: testSession.user.id,
    title: 'Private exam title',
    category: 'exam' as const,
    description: 'Private description',
    starts_at: stamp(day, 9),
    ends_at: stamp(day, 10),
    recurrence: 'weekly' as const,
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    created_at: stamp(day, 8),
  };
  testBusyEvents.push(event);
  testBusyOccurrences.push({
    event_id: event.id,
    starts_at: event.starts_at,
    ends_at: event.ends_at,
  });
  return event;
}
describe('Calendar UI with mocked API queries', () => {
  it('supports a personal calendar without depending on project scope', async () => {
    await visit('/calendar');
    expect(
      screen.getByRole('heading', { name: 'Calendar', level: 1 }),
    ).toBeInTheDocument();
    expect(loadPersonalCalendar).toHaveBeenCalledWith(
      testSession.user.id,
      expect.any(String),
      expect.any(String),
    );
    expect(
      screen.getByText(/Unrecorded time is not confirmed free/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add busy event' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { current: 'date' })).toHaveAttribute(
      'aria-current',
      'date',
    );
  });
  it('submits an overnight recurring personal event using real session identity', async () => {
    const user = userEvent.setup();
    await visit('/calendar');
    await user.click(screen.getByRole('button', { name: 'Add busy event' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'Night study');
    await user.selectOptions(
      within(dialog).getByLabelText('Category'),
      'study',
    );
    fireEvent.change(within(dialog).getByLabelText('Starts (local)'), {
      target: { value: '2026-12-31T23:00' },
    });
    fireEvent.change(within(dialog).getByLabelText('Ends (local)'), {
      target: { value: '2027-01-01T01:00' },
    });
    await user.selectOptions(
      within(dialog).getByLabelText('Recurrence'),
      'weekly',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Save busy event' }),
    );
    expect(saveBusyEvent).toHaveBeenCalledWith(
      testSession.user.id,
      expect.objectContaining({
        title: 'Night study',
        category: 'study',
        recurrence: 'weekly',
      }),
      undefined,
    );
    const values = vi.mocked(saveBusyEvent).mock.calls.at(-1)![1];
    expect(Date.parse(values.ends_at) - Date.parse(values.starts_at)).toBe(
      7200000,
    );
  });
  it('edits and deletes the whole recurring series', async () => {
    const event = seedEvent();
    const user = userEvent.setup();
    await visit('/calendar');
    await user.click(
      within(
        screen.getByRole('region', { name: 'Selected date details' }),
      ).getByRole('button', { name: 'Edit series' }),
    );
    const dialog = screen.getByRole('dialog');
    const title = within(dialog).getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Changed series');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save busy event' }),
    );
    expect(saveBusyEvent).toHaveBeenCalledWith(
      testSession.user.id,
      expect.objectContaining({ title: 'Changed series' }),
      event.id,
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const refreshedDate = await screen.findByRole('region', {
      name: 'Selected date details',
    });
    await user.click(
      within(refreshedDate).getByRole('button', { name: 'Delete series' }),
    );
    expect(confirm).toHaveBeenCalledWith('Delete the entire recurring series?');
    expect(deleteBusyEvent).toHaveBeenCalledWith(testSession.user.id, event.id);
    confirm.mockRestore();
  });
  it('retains API errors in the event editor without reporting success', async () => {
    seedEvent();
    const user = userEvent.setup();
    await visit('/calendar');
    await user.click(
      within(
        screen.getByRole('region', { name: 'Selected date details' }),
      ).getByRole('button', { name: 'Edit series' }),
    );
    vi.mocked(saveBusyEvent).mockRejectedValueOnce(
      new Error('Connection failed'),
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Save busy event',
      }),
    );
    expect(
      await within(screen.getByRole('dialog')).findByRole('alert'),
    ).toHaveTextContent('Connection failed');
  });
  it('shares only occupancy in the team UI and marks unrecorded time unconfirmed', async () => {
    seedEvent();
    const monday = startOfWeek();
    testTeamBusy.push({
      user_id: 'brandon',
      starts_at: stamp(monday, 9),
      ends_at: stamp(monday, 10),
    });
    await visit('/projects/website/availability');
    expect(loadTeamBusy).toHaveBeenCalledWith(
      'website',
      expect.any(String),
      expect.any(String),
    );
    expect(screen.queryByText('Private exam title')).not.toBeInTheDocument();
    expect(screen.queryByText('Private description')).not.toBeInTheDocument();
    expect(screen.getAllByText('Busy').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Potentially Available').length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByText(/availability is unconfirmed/).length,
    ).toBeGreaterThan(0);
  });
  it('does not infer free time when the team API fails', async () => {
    vi.mocked(loadTeamBusy).mockRejectedValueOnce(
      new Error('Project membership required'),
    );
    await visit('/projects/website/availability');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Project membership required',
    );
    expect(screen.queryByText('Potentially Available')).not.toBeInTheDocument();
  });
  it('offers date inspection and a full calendar link on My Tasks', async () => {
    seedEvent();
    await visit('/my-tasks');
    const widget = screen.getByRole('complementary', {
      name: 'Dashboard calendar',
    });
    expect(
      within(widget).getByRole('link', { name: 'Open full Calendar' }),
    ).toHaveAttribute('href', '/calendar');
    expect(
      within(widget).getAllByLabelText('Personal busy events').length,
    ).toBeGreaterThan(0);
    expect(
      within(widget).getByRole('button', { current: 'date' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
  it('keeps Overview focused on the project without a Mini Calendar', async () => {
    await visit('/projects/website/overview');
    expect(
      screen.queryByRole('complementary', { name: 'Dashboard calendar' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Project progress/ }),
    ).toBeInTheDocument();
  });
});
describe('dynamic potential availability', () => {
  const period = (user_id: string, a: number, b: number) => ({
    user_id,
    starts_at: new Date(a).toISOString(),
    ends_at: new Date(b).toISOString(),
  });
  it('merges overlapping, nested and adjacent busy ranges before subtracting', () => {
    expect(
      mergeRanges(
        [
          [10, 30],
          [15, 20],
          [30, 40],
          [-10, 5],
        ],
        0,
        60,
      ),
    ).toEqual([
      [0, 5],
      [10, 40],
    ]);
    expect(
      potentiallyAvailable([period('a', 10, 30), period('a', 20, 40)], 0, 60),
    ).toEqual([
      [0, 10],
      [40, 60],
    ]);
  });
  it('clips overnight blocks and uses exclusive ends', () => {
    expect(
      potentiallyAvailable([period('a', -10, 20), period('a', 60, 80)], 0, 60),
    ).toEqual([[20, 60]]);
    expect(potentiallyAvailable([period('a', -10, 0)], 0, 60)).toEqual([
      [0, 60],
    ]);
  });
  it('takes the complement of all selected busy periods without a member cap', () => {
    const ids = Array.from({ length: 12 }, (_, i) => String(i));
    const busy = ids.map((id, i) => period(id, i * 2, i * 2 + 1));
    expect(commonPotential(busy, ids, 0, 30)).toContainEqual([23, 30]);
    expect(commonPotential(busy, ['0'], 0, 30)).toEqual([[1, 30]]);
    expect(commonPotential(busy, [], 0, 30)).toEqual([]);
  });
  it('represents no recorded events as potential rather than stored or confirmed availability', () => {
    expect(potentiallyAvailable([], 0, 60)).toEqual([[0, 60]]);
  });
  it('builds month windows across December/January using local midnights', () => {
    const window = monthWindow(new Date(2026, 11, 15));
    expect(window.start.getHours()).toBe(0);
    expect(window.end.getFullYear()).toBe(2027);
    expect(window.days % 7).toBe(0);
    expect(localDay(new Date(2026, 9, 26, 18)).getHours()).toBe(0);
  });
});
