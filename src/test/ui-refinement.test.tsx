import './data-api-mocks';
import {
  testProjectActivities,
  testBusyEvents,
  testBusyOccurrences,
  testTasks,
  testProjects,
} from './data-api-mocks';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { routes } from '@/app/router';
import { AuthContext } from '@/features/auth/auth-context';
import { testSession } from './auth-fixtures';
import { loadPersonalCalendar } from '@/features/calendar/queries';
import { localDay, rangeLabel } from '@/features/calendar/intervals';
import { eventTimeLabel } from '@/features/calendar/schedule-time';
import { updateDisplayName } from '@/features/projects/queries';
import { activityPreviewTime } from '@/features/project-activity/activity-text';
async function visit(path = '/my-tasks') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
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
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
  await waitFor(() =>
    expect(screen.queryAllByText('Loading…')).toHaveLength(0),
  );
  return router;
}
function seedBusy() {
  const day = localDay();
  const start = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      11,
    ).toISOString(),
    end = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      12,
    ).toISOString();
  testBusyEvents.push({
    id: 'busy',
    user_id: testSession.user.id,
    title: 'Class',
    category: 'class',
    description: '',
    starts_at: start,
    ends_at: end,
    recurrence: 'daily',
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    created_at: start,
  });
  testBusyOccurrences.push({
    event_id: 'busy',
    starts_at: start,
    ends_at: end,
  });
}
describe('focused workspace UI refinements', () => {
  it('separates activity actions from linked task context in the preview', async () => {
    testProjectActivities.push({
      id: 'completed',
      project_id: 'website',
      task_id: 'task-1',
      task_title: 'A long task title that should remain readable',
      actor_id: testSession.user.id,
      actor_name: 'Test User',
      kind: 'task_completed',
      task_status: 'done',
      deadline_at: null,
      assignee_name: '',
      created_at: new Date().toISOString(),
    });
    await visit();
    const preview = screen.getByRole('region', { name: 'Recent Activity' });
    const action = within(preview).getByText('Test User completed a task');
    const title = within(preview).getByText(
      'A long task title that should remain readable',
    );
    expect(action).not.toBe(title);
    expect(title.closest('a')).toHaveAttribute(
      'href',
      '/projects/website/tasks/task-1',
    );
    expect(preview.querySelector('time')).toHaveTextContent(
      activityPreviewTime(testProjectActivities[0].created_at),
    );
    expect(within(preview).getByRole('list')).toHaveAttribute('tabindex', '0');
  });
  it('places a compact selected-project activity preview below the project heading', async () => {
    for (let i = 0; i < 4; i++)
      testProjectActivities.push({
        id: String(i),
        project_id: 'website',
        task_id: null,
        task_title: '',
        actor_id: testSession.user.id,
        actor_name: 'Test User',
        kind: 'discussion_added',
        task_status: null,
        deadline_at: null,
        assignee_name: '',
        created_at: new Date(2026, 9, 28, 10, i).toISOString(),
      });
    await visit();
    const preview = screen.getByRole('region', { name: 'Recent Activity' }),
      project = screen.getByLabelText('Current project');
    expect(
      project.compareDocumentPosition(preview) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(preview).getAllByRole('listitem')).toHaveLength(3);
    expect(
      within(preview).queryByRole('button', { name: 'View More' }),
    ).not.toBeInTheDocument();
    expect(
      within(preview).getByRole('link', {
        name: 'View full activity history →',
      }),
    ).toHaveAttribute('href', '/projects/website/overview#recent-activity');
    expect(
      screen.getByText('Your assigned work across all projects.'),
    ).toBeInTheDocument();
  });
  it('separates mini-calendar sections and uses concise empty states', async () => {
    testTasks.splice(0);
    await visit();
    const mini = screen.getByRole('complementary', {
      name: 'Dashboard calendar',
    });
    expect(
      within(mini).getByRole('region', { name: 'Upcoming personal events' }),
    ).toHaveTextContent('—');
    expect(
      within(mini).getByRole('region', { name: 'Upcoming assigned deadlines' }),
    ).toHaveTextContent('—');
    expect(
      within(mini).getByRole('region', { name: 'Selected date' }),
    ).toHaveTextContent('—');
    expect(
      within(mini).getByRole('link', { name: 'Open full Calendar' }),
    ).toHaveAttribute('href', '/calendar');
  });
  it('reuses one personal-calendar request for mini-calendar and today availability', async () => {
    seedBusy();
    await visit();
    const mini = screen.getByRole('complementary', {
        name: 'Dashboard calendar',
      }),
      preview = screen.getByRole('complementary', { name: 'My Availability' });
    expect(
      mini.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(preview).getByText('Busy')).toBeInTheDocument();
    expect(within(preview).getAllByText('Potentially Available')).toHaveLength(
      2,
    );
    expect(within(preview).getByText(/End of Day/)).toBeInTheDocument();
    expect(
      within(preview).queryByText('Unrecorded time is not confirmed free.'),
    ).not.toBeInTheDocument();
    expect(loadPersonalCalendar).toHaveBeenCalledTimes(1);
    expect(within(preview).queryByRole('button')).not.toBeInTheDocument();
  });
  it('shows a concise no-busy-event availability state without a full-day interval', async () => {
    await visit();
    const preview = screen.getByRole('complementary', {
      name: 'My Availability',
    });
    expect(
      within(preview).getByText('Potentially Available'),
    ).toBeInTheDocument();
    expect(
      within(preview).getByText('No busy events recorded today'),
    ).toBeInTheDocument();
    expect(within(preview).queryByText(/End of Day/)).not.toBeInTheDocument();
    expect(
      screen.queryByText('Unrecorded time is not confirmed free.'),
    ).not.toBeInTheDocument();
    expect(
      within(preview).getByRole('link', { name: 'View full Calendar →' }),
    ).toHaveAttribute('href', '/calendar');
  });
  it('keeps overnight busy occurrences in today’s interval presentation', async () => {
    const today = localDay();
    testBusyOccurrences.push({
      event_id: 'overnight',
      starts_at: new Date(today.getTime() - 3600000).toISOString(),
      ends_at: new Date(today.getTime() + 3600000).toISOString(),
    });
    await visit();
    const preview = screen.getByRole('complementary', {
      name: 'My Availability',
    });
    expect(within(preview).getByText('Busy')).toBeInTheDocument();
    expect(
      within(preview).queryByText('No busy events recorded today'),
    ).not.toBeInTheDocument();
  });
  it('preserves mini-calendar month and selected-date navigation', async () => {
    const user = userEvent.setup();
    await visit();
    const mini = screen.getByRole('complementary', {
      name: 'Dashboard calendar',
    });
    await user.click(
      within(mini).getByRole('button', { name: 'Next mini calendar month' }),
    );
    const expected = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      1,
    );
    expect(
      within(mini).getByRole('heading', {
        name: expected.toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        }),
      }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(within(mini).queryAllByText('Loading…')).toHaveLength(0),
    );
    expect(
      within(mini).getByRole('region', { name: 'Selected date' }),
    ).toHaveTextContent(
      expected.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    );
  });
  it('consolidates navigation and redirects old project calendar routes with their scope', async () => {
    const router = await visit('/projects/website/calendar');
    expect(
      await screen.findByRole('heading', { name: 'Calendar', level: 1 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/calendar');
    expect(router.state.location.search).toBe('?project=website');
    expect(
      screen.queryByRole('link', { name: 'Deadline Calendar' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'All tasks' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'My tasks' }),
    ).toBeInTheDocument();
  });
  it('shows project and personal deadlines through the main Calendar without losing My/All controls', async () => {
    const user = userEvent.setup();
    await visit('/calendar');
    await user.click(screen.getByRole('link', { name: 'Project deadlines' }));
    await screen.findByRole('button', { name: 'All tasks' });
    await user.click(screen.getByRole('button', { name: 'My tasks' }));
    expect(screen.getByRole('button', { name: 'My tasks' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('link', { name: 'Personal Calendar' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'All tasks' }),
      ).not.toBeInTheDocument(),
    );
  });
  it('presents daily schedule sections independently and keeps actions grouped', async () => {
    seedBusy();
    await visit('/calendar');
    for (const name of [
      'Suggested Availability',
      'My busy events',
      'Task deadlines',
      'Assigned work to complete',
    ])
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    const events = screen.getByRole('region', { name: 'My busy events' });
    expect(
      within(events).getByRole('button', { name: 'Edit series' }),
    ).toBeInTheDocument();
    expect(
      within(events).getByRole('button', { name: 'Delete series' }),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('region', { name: 'Suggested Availability' }),
      ).getByText(/End of Day/),
    ).toBeInTheDocument();
  });
  it('keeps full long project names available and preserves native project switching', async () => {
    const long =
      'A very long university project title that needs to remain readable in the sidebar';
    testProjects[0].name = long;
    const user = userEvent.setup();
    await visit();
    const picker = screen.getByLabelText('Selected project');
    expect(picker).toHaveAttribute('title', long);
    expect(picker.parentElement).toHaveTextContent(long);
    await user.selectOptions(picker, 'research');
    expect(screen.getByLabelText('Current project')).toHaveTextContent(
      'Research Project',
    );
  });
  it('supports account keyboard navigation and the existing display-name editor', async () => {
    const user = userEvent.setup();
    await visit();
    const trigger = screen.getByRole('button', { name: 'Account: Test User' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(
      screen.getByRole('menuitem', { name: 'Edit display name' }),
    ).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(trigger);
    await user.click(
      screen.getByRole('menuitem', { name: 'Edit display name' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit display name' });
    const input = within(dialog).getByLabelText('Display name');
    await user.clear(input);
    await user.type(input, 'Updated Name');
    await user.click(within(dialog).getByRole('button', { name: 'Save name' }));
    expect(updateDisplayName).toHaveBeenCalledWith(
      testSession.user.id,
      'Updated Name',
    );
  });
  it('offers the same account menu on mobile More without outdated preview text', async () => {
    const user = userEvent.setup();
    await visit();
    await user.click(
      within(
        screen.getByRole('navigation', { name: 'Mobile navigation' }),
      ).getByRole('button', { name: 'More' }),
    );
    const more = screen.getByRole('region', { name: 'More navigation' });
    await user.click(
      within(more).getByRole('button', { name: 'Account: Test User' }),
    );
    expect(
      within(more).getByRole('menuitem', { name: 'Sign out' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Authenticated account')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Phase 1 frontend preview/),
    ).not.toBeInTheDocument();
  });
});
describe('schedule boundary presentation', () => {
  it('formats activity times without seconds and identifies previous days', () => {
    const now = new Date(2026, 9, 28, 12);
    const date = new Date(2026, 9, 28, 10, 5, 37);
    const time = date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    expect(activityPreviewTime(date.toISOString(), now)).toBe(time);
    date.setDate(27);
    expect(activityPreviewTime(date.toISOString(), now)).toBe(
      `Yesterday · ${time}`,
    );
    date.setFullYear(2025);
    expect(activityPreviewTime(date.toISOString(), now)).toContain('2025');
  });
  it('formats the exclusive day boundary without mixing a clock time and 24:00', () => {
    const a = new Date(2026, 9, 28, 11, 54),
      end = new Date(2026, 9, 29);
    expect(rangeLabel([a.getTime(), end.getTime()], end.getTime())).toContain(
      'End of Day',
    );
    expect(
      rangeLabel([a.getTime(), end.getTime()], end.getTime()),
    ).not.toContain('24:00');
  });
  it('shows date information for actual overnight events', () => {
    const a = new Date(2026, 9, 28, 23),
      b = new Date(2026, 9, 29, 1);
    const text = eventTimeLabel(a.toISOString(), b.toISOString());
    expect(text).toContain(a.toLocaleString());
    expect(text).toContain(b.toLocaleString());
  });
});
