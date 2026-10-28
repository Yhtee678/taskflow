import './data-api-mocks';
import {
  testProjectActivities,
  testDiscussion,
  testNotifications,
} from './data-api-mocks';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { routes } from '@/app/router';
import { AuthContext } from '@/features/auth/auth-context';
import { testSession } from './auth-fixtures';
import type {
  ProjectActivityRow,
  ProjectDiscussionRow,
} from '@/types/database';
import {
  addDiscussionComment,
  deleteDiscussionComment,
  loadDiscussion,
} from '@/features/project-discussion/queries';
import { loadProjectActivity } from '@/features/project-activity/queries';
import { projectActivityText } from '@/features/project-activity/activity-text';
import { loadProject } from '@/features/tasks/queries';
const uid = testSession.user.id;
async function visit(path = '/projects/website/overview') {
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
function activity(
  values: Partial<ProjectActivityRow> = {},
): ProjectActivityRow {
  return {
    id: 'activity-1',
    project_id: 'website',
    task_id: 'user-flows',
    task_title: 'Map the key user flows',
    actor_id: uid,
    actor_name: 'Test User',
    kind: 'task_completed',
    task_status: 'done',
    deadline_at: null,
    assignee_name: '',
    created_at: '2026-10-27T10:00:00Z',
    ...values,
  };
}
function comment(
  values: Partial<ProjectDiscussionRow> = {},
): ProjectDiscussionRow {
  return {
    id: 'discussion-1',
    project_id: 'website',
    author_id: uid,
    author_name: 'Test User',
    body: 'General project update',
    created_at: '2026-10-27T10:00:00Z',
    ...values,
  };
}
describe('project collaboration UI with mocked feature queries', () => {
  it('shows shared actor activity independently from an empty personal inbox', async () => {
    testProjectActivities.push(activity());
    await visit();
    const feed = screen.getByRole('region', { name: 'Recent Activity' });
    expect(
      within(feed).getByText('Test User completed “Map the key user flows”.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Notifications, 0 unread' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Project completion' }),
    ).toBeInTheDocument();
  });
  it('posts a discussion comment with the selected project and shows attribution', async () => {
    const user = userEvent.setup();
    await visit();
    const discussion = screen.getByRole('region', {
      name: 'Project Discussion',
    });
    expect(
      within(discussion).getByText('No discussion comments yet.'),
    ).toBeInTheDocument();
    expect(
      within(discussion).getByRole('button', { name: 'Post comment' }),
    ).toBeDisabled();
    await user.type(
      within(discussion).getByLabelText('Discussion comment'),
      'Please review the assignment brief.',
    );
    await user.click(
      within(discussion).getByRole('button', { name: 'Post comment' }),
    );
    expect(addDiscussionComment).toHaveBeenCalledWith(
      'website',
      'Please review the assignment brief.',
    );
    await screen.findByText('Please review the assignment brief.');
    expect(
      within(
        screen.getByRole('region', { name: 'Project Discussion' }),
      ).getByText('Test User'),
    ).toBeInTheDocument();
  });
  it('only offers own-comment deletion and safely renders plain text', async () => {
    testDiscussion.push(
      comment({ id: 'mine', body: '<img src=x onerror=alert(1)>' }),
      comment({
        id: 'peer',
        author_id: 'brandon',
        author_name: 'Brandon',
        body: 'Peer update',
      }),
    );
    const user = userEvent.setup();
    await visit();
    const discussion = screen.getByRole('region', {
      name: 'Project Discussion',
    });
    expect(
      within(discussion).getAllByRole('button', {
        name: 'Delete discussion comment',
      }),
    ).toHaveLength(1);
    expect(discussion.querySelector('img')).toBeNull();
    expect(
      within(discussion).getByText('<img src=x onerror=alert(1)>'),
    ).toBeInTheDocument();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(
      within(discussion).getByRole('button', {
        name: 'Delete discussion comment',
      }),
    );
    expect(deleteDiscussionComment).toHaveBeenCalledWith(
      'website',
      'mine',
      uid,
    );
    await waitFor(() =>
      expect(
        screen.queryByText('<img src=x onerror=alert(1)>'),
      ).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('Peer update')).toBeInTheDocument();
    confirm.mockRestore();
  });
  it('displays newest activity first and discussion comments chronologically', async () => {
    testProjectActivities.push(
      activity({
        id: 'old',
        task_title: 'Old task',
        created_at: '2026-10-26T01:00:00Z',
      }),
      activity({ id: 'new', task_title: 'New task' }),
    );
    testDiscussion.push(
      comment({ id: 'new', body: 'New discussion' }),
      comment({
        id: 'old',
        body: 'Old discussion',
        created_at: '2026-10-26T01:00:00Z',
      }),
    );
    await visit();
    expect(
      within(
        screen.getByRole('region', { name: 'Recent Activity' }),
      ).getAllByRole('listitem')[0],
    ).toHaveTextContent('New task');
    expect(
      within(
        screen.getByRole('region', { name: 'Project Discussion' }),
      ).getAllByRole('listitem')[0],
    ).toHaveTextContent('Old discussion');
  });
  it('loads older activity through View More without duplicating entries', async () => {
    for (let i = 0; i < 21; i++)
      testProjectActivities.push(
        activity({
          id: `activity-${i}`,
          task_title: `Task ${i}`,
          created_at: new Date(Date.UTC(2026, 9, 27, 10, i)).toISOString(),
        }),
      );
    const user = userEvent.setup();
    await visit();
    const feed = screen.getByRole('region', { name: 'Recent Activity' });
    expect(within(feed).getAllByRole('listitem')).toHaveLength(20);
    await user.click(within(feed).getByRole('button', { name: 'View More' }));
    await waitFor(() =>
      expect(within(feed).getAllByRole('listitem')).toHaveLength(21),
    );
    expect(loadProjectActivity).toHaveBeenCalledWith('website', 40);
    expect(
      within(feed).queryByRole('button', { name: 'View More' }),
    ).not.toBeInTheDocument();
  });
  it('switches activity and discussion to the selected project', async () => {
    testProjectActivities.push(
      activity({ task_title: 'Website only' }),
      activity({
        id: 'research',
        project_id: 'research',
        task_id: null,
        task_title: 'Research only',
      }),
    );
    testDiscussion.push(
      comment({ body: 'Website discussion' }),
      comment({
        id: 'research',
        project_id: 'research',
        body: 'Research discussion',
      }),
    );
    const user = userEvent.setup();
    await visit();
    expect(screen.getByText('Website discussion')).toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText('Selected project'),
      'research',
    );
    await screen.findByText('Research discussion');
    expect(screen.queryByText('Website discussion')).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Recent Activity' }),
    ).toHaveTextContent('Research only');
    expect(
      screen.getByRole('region', { name: 'Recent Activity' }),
    ).not.toHaveTextContent('Website only');
  });
  it('navigates from task activity to the existing task details', async () => {
    testProjectActivities.push(activity());
    const user = userEvent.setup();
    await visit();
    await user.click(
      within(screen.getByRole('region', { name: 'Recent Activity' })).getByRole(
        'link',
      ),
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Map the key user flows',
      }),
    ).toBeInTheDocument();
  });
  it('links discussion activities to the project discussion section', async () => {
    testProjectActivities.push(
      activity({ task_id: null, task_title: '', kind: 'discussion_added' }),
    );
    const user = userEvent.setup();
    const router = await visit();
    await user.click(
      within(screen.getByRole('region', { name: 'Recent Activity' })).getByRole(
        'link',
      ),
    );
    expect(router.state.location.hash).toBe('#project-discussion');
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Project Discussion' }),
      ).toHaveFocus(),
    );
  });
  it('navigates a project discussion notification to the correct project anchor', async () => {
    testNotifications.push({
      id: 'discussion-notice',
      user_id: uid,
      project_id: 'website',
      task_id: null,
      activity_id: 'activity-1',
      actor_id: 'brandon',
      actor_name: 'Brandon',
      kind: 'discussion_added',
      task_status: null,
      deadline_at: null,
      created_at: new Date().toISOString(),
      read_at: null,
      project_name: 'Website Redesign',
      task_title: '',
    });
    const user = userEvent.setup();
    const router = await visit('/projects/research/overview');
    await user.click(
      screen.getByRole('button', { name: 'Notifications, 1 unread' }),
    );
    const link = await within(screen.getByRole('dialog')).findByRole('link', {
      name: 'Brandon posted in Project Discussion.',
    });
    expect(link).toHaveAttribute(
      'href',
      '/projects/website/overview#project-discussion',
    );
    await user.click(link);
    expect(router.state.location.pathname).toBe('/projects/website/overview');
    await waitFor(() =>
      expect(
        screen.getByRole('region', { name: 'Project Discussion' }),
      ).toHaveFocus(),
    );
  });
  it('keeps deleted-task history without offering a broken task link', async () => {
    testProjectActivities.push(
      activity({ task_id: null, task_title: 'Deleted task' }),
    );
    await visit();
    const feed = screen.getByRole('region', { name: 'Recent Activity' });
    expect(
      within(feed).getByText('Task no longer available.'),
    ).toBeInTheDocument();
    expect(within(feed).queryByRole('link')).not.toBeInTheDocument();
  });
  it('handles loading failures in each section without showing fabricated data', async () => {
    vi.mocked(loadProjectActivity).mockRejectedValueOnce(
      new Error('History unavailable'),
    );
    vi.mocked(loadDiscussion).mockRejectedValueOnce(
      new Error('Discussion unavailable'),
    );
    await visit();
    expect(
      within(screen.getByRole('region', { name: 'Recent Activity' })).getByRole(
        'alert',
      ),
    ).toHaveTextContent('History unavailable');
    expect(
      within(
        screen.getByRole('region', { name: 'Project Discussion' }),
      ).getByRole('alert'),
    ).toHaveTextContent('Discussion unavailable');
    expect(
      screen.queryByLabelText('Discussion comment'),
    ).not.toBeInTheDocument();
  });
  it('keeps the draft and reports a rejected discussion write', async () => {
    const user = userEvent.setup();
    await visit();
    const discussion = screen.getByRole('region', {
      name: 'Project Discussion',
    });
    await user.type(
      within(discussion).getByLabelText('Discussion comment'),
      'Keep this draft',
    );
    vi.mocked(addDiscussionComment).mockRejectedValueOnce(
      new Error('Post failed'),
    );
    await user.click(
      within(discussion).getByRole('button', { name: 'Post comment' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Post failed');
    expect(within(discussion).getByLabelText('Discussion comment')).toHaveValue(
      'Keep this draft',
    );
  });
  it('clears both sections after project access is revoked on refresh', async () => {
    testProjectActivities.push(activity());
    testDiscussion.push(comment());
    const user = userEvent.setup();
    await visit();
    vi.mocked(loadProject).mockRejectedValueOnce(
      new Error('Project access revoked'),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh data' }));
    expect(
      await screen.findByRole('heading', { name: 'Project unavailable' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Recent Activity' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('General project update'),
    ).not.toBeInTheDocument();
  });
});
describe('shared activity descriptions', () => {
  it('uses the actor rather than personal notification wording for assignments', () => {
    expect(
      projectActivityText(
        activity({ kind: 'task_reassigned', assignee_name: 'Brandon' }),
      ),
    ).toContain('Test User reassigned');
    expect(
      projectActivityText(
        activity({ kind: 'task_reassigned', assignee_name: 'Brandon' }),
      ),
    ).toContain('to Brandon');
  });
  it('describes creation with initial assignment as one combined activity', () => {
    expect(
      projectActivityText(
        activity({ kind: 'task_created', assignee_name: 'Brandon' }),
      ),
    ).toBe(
      'Test User created “Map the key user flows” and assigned it to Brandon.',
    );
  });
});
