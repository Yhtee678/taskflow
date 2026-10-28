import './data-api-mocks';
import { testComments, testNotifications } from './data-api-mocks';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { routes } from '@/app/router';
import { AuthContext } from '@/features/auth/auth-context';
import { testSession } from './auth-fixtures';
import {
  addComment,
  deleteComment,
  loadComments,
} from '@/features/comments/queries';
import {
  loadInbox,
  markNotificationRead,
  type InboxItem,
} from '@/features/notifications/queries';
import { activityText } from '@/features/notifications/activity-text';
import { AccessError } from '@/lib/data-client';
const uid = testSession.user.id;
async function visit(path = '/projects/website/tasks/user-flows') {
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
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: [path] })}
      />
    </AuthContext.Provider>,
  );
  await waitFor(() =>
    expect(screen.queryAllByText('Loading…')).toHaveLength(0),
  );
  return view;
}
function notice(kind: InboxItem['kind'] = 'task_completed'): InboxItem {
  return {
    id: 'notice-1',
    user_id: uid,
    project_id: 'website',
    task_id: 'user-flows',
    activity_id: null,
    actor_id: 'brandon',
    actor_name: 'Brandon',
    kind,
    task_status: 'done',
    deadline_at: null,
    created_at: new Date().toISOString(),
    read_at: null,
    project_name: 'Website Redesign',
    task_title: 'Map the key user flows',
  };
}
describe('task collaboration UI at the mocked API boundary', () => {
  it('adds plain text comments and refreshes the discussion', async () => {
    const user = userEvent.setup();
    await visit();
    const comments = screen.getByRole('region', { name: 'Task comments' });
    expect(within(comments).getByText('No comments yet.')).toBeInTheDocument();
    expect(
      within(comments).getByRole('button', { name: 'Add comment' }),
    ).toBeDisabled();
    await user.type(
      within(comments).getByLabelText('Comment'),
      'Need help with validation.',
    );
    await user.click(
      within(comments).getByRole('button', { name: 'Add comment' }),
    );
    expect(addComment).toHaveBeenCalledWith(
      'website',
      'user-flows',
      'Need help with validation.',
    );
    expect(
      await screen.findByText('Need help with validation.'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Task comments' })).getByText(
        'Test User',
      ),
    ).toBeInTheDocument();
  });
  it('only offers deletion of own comments and preserves plain-text content', async () => {
    testComments.push(
      {
        id: 'own',
        project_id: 'website',
        task_id: 'user-flows',
        author_id: uid,
        author_name: 'Test User',
        body: '<script>alert(1)</script>',
        created_at: new Date().toISOString(),
      },
      {
        id: 'peer',
        project_id: 'website',
        task_id: 'user-flows',
        author_id: 'brandon',
        author_name: 'Brandon',
        body: 'Peer comment',
        created_at: new Date().toISOString(),
      },
    );
    const user = userEvent.setup();
    await visit();
    const comments = screen.getByRole('region', { name: 'Task comments' });
    expect(
      within(comments).getAllByRole('button', { name: 'Delete comment' }),
    ).toHaveLength(1);
    expect(
      within(comments).getByText('<script>alert(1)</script>'),
    ).toBeInTheDocument();
    expect(comments.querySelector('script')).toBeNull();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(
      within(comments).getByRole('button', { name: 'Delete comment' }),
    );
    expect(deleteComment).toHaveBeenCalledWith(
      'website',
      'user-flows',
      'own',
      uid,
    );
    await waitFor(() =>
      expect(
        screen.queryByText('<script>alert(1)</script>'),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('Peer comment')).toBeInTheDocument();
    confirm.mockRestore();
  });
  it('shows comment load errors without exposing an old discussion', async () => {
    vi.mocked(loadComments).mockRejectedValueOnce(
      new Error('Task access unavailable'),
    );
    await visit();
    const comments = screen.getByRole('region', { name: 'Task comments' });
    expect(within(comments).getByRole('alert')).toHaveTextContent(
      'Task access unavailable',
    );
    expect(
      within(comments).queryByLabelText('Comment'),
    ).not.toBeInTheDocument();
  });
  it('retains comment content and displays a failed write', async () => {
    const user = userEvent.setup();
    await visit();
    const comments = screen.getByRole('region', { name: 'Task comments' });
    await user.type(
      within(comments).getByLabelText('Comment'),
      'Keep my draft',
    );
    vi.mocked(addComment).mockRejectedValueOnce(
      new Error('Comment could not be saved'),
    );
    await user.click(
      within(comments).getByRole('button', { name: 'Add comment' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'could not be saved',
    );
    expect(within(comments).getByLabelText('Comment')).toHaveValue(
      'Keep my draft',
    );
  });
  it('loads unread counts on startup and checks reminders on opening/refresh', async () => {
    testNotifications.push(notice());
    const user = userEvent.setup();
    await visit('/my-tasks');
    expect(loadInbox).toHaveBeenCalledWith(uid, false);
    await user.click(
      screen.getByRole('button', { name: 'Notifications, 1 unread' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Notifications' });
    expect(
      await within(dialog).findByText(
        'Brandon completed Map the key user flows.',
      ),
    ).toBeInTheDocument();
    expect(loadInbox).toHaveBeenCalledWith(uid, true);
    await user.click(
      within(dialog).getByRole('button', { name: 'Refresh notifications' }),
    );
    expect(
      vi.mocked(loadInbox).mock.calls.filter((c) => c[1] === true).length,
    ).toBeGreaterThanOrEqual(2);
  });
  it('marks a notification read and preserves read state after remount', async () => {
    testNotifications.push(notice());
    const user = userEvent.setup();
    const first = await visit('/my-tasks');
    await user.click(
      screen.getByRole('button', { name: 'Notifications, 1 unread' }),
    );
    const dialog = screen.getByRole('dialog');
    await user.click(
      await within(dialog).findByRole('button', { name: 'Mark as read' }),
    );
    expect(markNotificationRead).toHaveBeenCalledWith(uid, 'notice-1');
    expect(await within(dialog).findByText('Read')).toBeInTheDocument();
    first.unmount();
    await visit('/my-tasks');
    await user.click(
      screen.getByRole('button', { name: 'Notifications, 0 unread' }),
    );
    expect(
      await within(screen.getByRole('dialog')).findByText('Read'),
    ).toBeInTheDocument();
  });
  it('navigates from an activity to the existing task details', async () => {
    testNotifications.push(notice());
    const user = userEvent.setup();
    await visit('/projects');
    await user.click(
      screen.getByRole('button', { name: 'Notifications, 1 unread' }),
    );
    const dialog = screen.getByRole('dialog');
    await user.click(
      await within(dialog).findByRole('link', {
        name: 'Brandon completed Map the key user flows.',
      }),
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Map the key user flows',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('shows empty/error inbox states and does not fake a successful read update', async () => {
    const user = userEvent.setup();
    await visit();
    await user.click(
      screen.getByRole('button', { name: 'Notifications, 0 unread' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(
      await within(dialog).findByText('No notifications yet.'),
    ).toBeInTheDocument();
    testNotifications.push(notice());
    await user.click(
      within(dialog).getByRole('button', { name: 'Refresh notifications' }),
    );
    const read = await within(dialog).findByRole('button', {
      name: 'Mark as read',
    });
    vi.mocked(markNotificationRead).mockRejectedValueOnce(
      new Error('Read update rejected'),
    );
    await user.click(read);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Read update rejected',
    );
    expect(within(dialog).getByText('Unread')).toBeInTheDocument();
  });
  it('refetches and clears inaccessible activity after a rejected read update', async () => {
    testNotifications.push(notice());
    const user = userEvent.setup();
    await visit();
    await user.click(
      screen.getByRole('button', { name: 'Notifications, 1 unread' }),
    );
    const dialog = screen.getByRole('dialog');
    const read = await within(dialog).findByRole('button', {
      name: 'Mark as read',
    });
    vi.mocked(markNotificationRead).mockRejectedValueOnce(new AccessError());
    vi.mocked(loadInbox).mockResolvedValueOnce([]);
    await user.click(read);
    expect(
      await within(dialog).findByText('No notifications yet.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('link')).not.toBeInTheDocument();
  });
  it('clears notifications after refreshed authorization removes access', async () => {
    testNotifications.push(notice());
    const user = userEvent.setup();
    await visit();
    await user.click(
      screen.getByRole('button', { name: 'Notifications, 1 unread' }),
    );
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByText(
      'Brandon completed Map the key user flows.',
    );
    testNotifications.splice(0);
    await user.click(
      within(dialog).getByRole('button', { name: 'Refresh notifications' }),
    );
    expect(
      await within(dialog).findByText('No notifications yet.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('link')).not.toBeInTheDocument();
  });
});
describe('notification activity descriptions', () => {
  it('represents completion once as a distinct activity, not a second status message', () => {
    expect(activityText(notice(), 'Task 4')).toBe('Brandon completed Task 4.');
  });
  it('distinguishes assignment, status, comments and deadline changes', () => {
    expect(activityText(notice('task_assigned'), 'Task 2')).toBe(
      'You were assigned Task 2.',
    );
    expect(
      activityText(
        { ...notice('task_status_changed'), task_status: 'in_progress' },
        'Task',
      ),
    ).toContain('In progress');
    expect(activityText(notice('comment_added'), 'Task 3')).toBe(
      'Brandon commented on Task 3.',
    );
    expect(activityText(notice('deadline_changed'), 'Task')).toContain(
      'removed the deadline',
    );
  });
  it('uses the actual deadline snapshot in reminder text', () => {
    const n = {
      ...notice('deadline_approaching'),
      deadline_at: '2026-10-27T12:00:00Z',
    };
    expect(activityText(n, 'Task')).toContain(
      new Date(n.deadline_at).toLocaleString(),
    );
  });
});
