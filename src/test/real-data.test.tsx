import './data-api-mocks';
import {
  testProjects,
  testMembers,
  testSections,
  testTasks,
  testSlots,
} from './data-api-mocks';
import {
  render,
  screen,
  within,
  waitFor,
  renderHook,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { routes } from '@/app/router';
import { AuthContext } from '@/features/auth/auth-context';
import { testSession } from './auth-fixtures';
import { useRemote } from '@/app/use-remote';
import { createProject, loadCatalog } from '@/features/projects/queries';
import {
  saveTask,
  loadProject,
  loadMyTasks,
  saveStep,
  saveResource,
} from '@/features/tasks/queries';
import { saveSlot } from '@/features/availability/queries';
import { addMember } from '@/features/members/queries';
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
describe('real-data UI integration with mocked feature queries', () => {
  it('allows leaders to add members when the project already has six members', async () => {
    const user = userEvent.setup();
    const projectId = testProjects[0].id;
    for (let i = 0; i < 6; i++) {
      testMembers.push({
        project_id: projectId,
        user_id: `extra-${i}`,
        display_name: `Extra member ${i}`,
        role: 'member',
        created_at: '2026-10-26T00:00:00Z',
      });
    }
    await visit(`/projects/${projectId}/members`);
    const add = screen.getByRole('button', { name: 'Add member' });
    expect(add).toBeEnabled();
    expect(screen.queryByText(/\/5 members/)).not.toBeInTheDocument();
    await user.click(add);
    const dialog = screen.getByRole('dialog');
    await user.type(
      within(dialog).getByLabelText('Registered email'),
      'new@example.test',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Add member' }),
    );
    expect(addMember).toHaveBeenCalledWith(projectId, 'new@example.test');
  });
  it('creates the first project from the empty account state', async () => {
    const user = userEvent.setup();
    testProjects.splice(0);
    testMembers.splice(0);
    testTasks.splice(0);
    testSections.splice(0);
    await visit('/projects');
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New project' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'My real project');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save project' }),
    );
    expect(createProject).toHaveBeenCalledWith({
      name: 'My real project',
      description: '',
      due_date: null,
    });
    expect(
      await screen.findByRole('heading', { name: 'Overview', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Current project')).toHaveTextContent(
      'My real project',
    );
  });
  it('saves assignment, status, priority, deadline and guidance through the task form', async () => {
    const user = userEvent.setup();
    await visit('/projects/website/tasks/user-flows');
    await user.click(screen.getByRole('button', { name: 'Edit task' }));
    const d = screen.getByRole('dialog');
    await user.clear(within(d).getByLabelText('Task title'));
    await user.type(
      within(d).getByLabelText('Task title'),
      'Updated shared task',
    );
    await user.selectOptions(within(d).getByLabelText('Status'), 'done');
    await user.selectOptions(within(d).getByLabelText('Priority'), 'high');
    await user.selectOptions(within(d).getByLabelText('Assignee'), 'brandon');
    await user.type(
      within(d).getByLabelText('Guidance'),
      ' Updated instructions',
    );
    await user.click(within(d).getByRole('button', { name: 'Save task' }));
    expect(
      await screen.findByRole('heading', {
        name: 'Updated shared task',
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(saveTask).toHaveBeenCalledWith(
      'website',
      expect.objectContaining({
        title: 'Updated shared task',
        assignee_id: 'brandon',
        status: 'done',
        priority: 'high',
      }),
      'user-flows',
    );
  });
  it('persists optional checklist changes independently of task status', async () => {
    const user = userEvent.setup();
    await visit('/projects/website/tasks/user-flows');
    await user.click(
      screen.getByRole('checkbox', { name: 'Draft the journeys' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Draft the journeys' }),
      ).toBeChecked(),
    );
    expect(saveStep).toHaveBeenCalledWith(
      'website',
      'user-flows',
      expect.objectContaining({ is_completed: true }),
      'step-1',
    );
    expect(testTasks.find((t) => t.id === 'user-flows')!.status).toBe(
      'in_progress',
    );
  });
  it('rejects unsafe resource schemes without issuing a mutation', async () => {
    const user = userEvent.setup();
    await visit('/projects/website/tasks/user-flows');
    await user.click(screen.getByRole('button', { name: 'Add resource' }));
    const d = screen.getByRole('dialog');
    await user.type(within(d).getByLabelText('Title'), 'Unsafe reference');
    await user.type(within(d).getByLabelText('URL'), 'javascript:alert(1)');
    await user.click(within(d).getByRole('button', { name: 'Save resource' }));
    expect(within(d).getByRole('alert')).toHaveTextContent('HTTP');
    expect(saveResource).not.toHaveBeenCalled();
  });
  it('retains a failed membership form with a visible error rather than fake success', async () => {
    const user = userEvent.setup();
    vi.mocked(addMember).mockRejectedValueOnce(
      new Error('Registered user could not be added.'),
    );
    await visit('/projects/website/members');
    await user.click(screen.getByRole('button', { name: 'Add member' }));
    const d = screen.getByRole('dialog');
    await user.type(
      within(d).getByLabelText('Registered email'),
      'member@example.test',
    );
    await user.click(within(d).getByRole('button', { name: 'Add member' }));
    expect(await within(d).findByRole('alert')).toHaveTextContent(
      'could not be added',
    );
    expect(d).toBeInTheDocument();
  });
  it('saves valid overnight free time as exact instants', async () => {
    const user = userEvent.setup();
    await visit('/projects/website/availability');
    await user.click(screen.getByText('Previously recorded free-time slots'));
    await user.click(
      screen.getByRole('button', { name: 'Add my availability' }),
    );
    const d = screen.getByRole('dialog');
    // fireEvent handles datetime-local consistently across jsdom implementations.
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(within(d).getByLabelText('Available from (local)'), {
      target: { value: '2026-10-27T23:00' },
    });
    fireEvent.change(within(d).getByLabelText('Available until (local)'), {
      target: { value: '2026-10-28T01:00' },
    });
    await user.click(
      within(d).getByRole('button', { name: 'Save availability' }),
    );
    await waitFor(() => expect(saveSlot).toHaveBeenCalled());
    const slot = testSlots[0];
    expect(Date.parse(slot.ends_at) - Date.parse(slot.starts_at)).toBe(
      2 * 3600000,
    );
  });
  it('does not fall back to fixture projects after a catalog error', async () => {
    vi.mocked(loadCatalog).mockRejectedValueOnce(
      new Error('Database unavailable'),
    );
    await visit('/projects');
    expect(screen.getByRole('alert')).toHaveTextContent('Database unavailable');
    expect(screen.queryByText('Website Redesign')).not.toBeInTheDocument();
  });
  it('clears a project view when the next authorized refresh reports lost access', async () => {
    const user = userEvent.setup();
    await visit('/projects/website/tasks');
    vi.mocked(loadProject).mockRejectedValueOnce(
      new Error('Project access removed'),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh data' }));
    expect(
      await screen.findByRole('heading', { name: 'Project unavailable' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Map the key user flows' }),
    ).not.toBeInTheDocument();
  });
  it('keeps My Tasks scoped to the actual authenticated UID', async () => {
    await visit('/my-tasks');
    expect(loadMyTasks).toHaveBeenCalledWith(testSession.user.id);
  });
});
describe('request identity isolation', () => {
  it('discards an old project response arriving after the project key changes', async () => {
    let finish!: (value: string) => void;
    const first = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) =>
        useRemote(id, () =>
          id === 'A' ? first : Promise.resolve('Project B'),
        ),
      { initialProps: { id: 'A' } },
    );
    rerender({ id: 'B' });
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data).toBe('Project B'));
    const { act } = await import('@testing-library/react');
    await act(async () => finish('Stale project A'));
    expect(result.current.data).toBe('Project B');
  });
});
