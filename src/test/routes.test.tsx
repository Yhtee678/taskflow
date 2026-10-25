import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { routes } from '@/app/router';
function visit(path: string) {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [path] })}
    />,
  );
}
describe('Phase 1 routes', () => {
  it('changes heading context on My Tasks without filtering global work', async () => {
    const user = userEvent.setup();
    visit('/my-tasks');
    expect(screen.getByLabelText('Current project')).toHaveTextContent(
      'Website Redesign',
    );
    await user.selectOptions(
      screen.getByLabelText('Mobile selected project'),
      'research',
    );
    expect(screen.getByLabelText('Current project')).toHaveTextContent(
      'Research Project',
    );
    expect(
      screen.getByRole('heading', { name: 'My Tasks', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Your assigned work across all projects.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Map the key user flows' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Prepare interview questions' }),
    ).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', {
      name: 'Mobile navigation',
    });
    expect(
      within(navigation).getByRole('link', { name: 'Calendar' }),
    ).toHaveAttribute('href', '/projects/research/calendar');
  });
  it('opens More with the keyboard, exposes project routes, and restores focus on Escape', async () => {
    const user = userEvent.setup();
    visit('/projects/research/tasks');
    const navigation = screen.getByRole('navigation', {
      name: 'Mobile navigation',
    });
    const more = within(navigation).getByRole('button', { name: 'More' });
    more.focus();
    await user.keyboard('{Enter}');
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByLabelText('Selected project', {
        selector: '#more-project-picker',
      }),
    ).toHaveFocus();
    const panel = screen.getByRole('region', { name: 'More navigation' });
    for (const [label, path] of [
      ['Overview', 'overview'],
      ['All Tasks', 'tasks'],
      ['Members', 'members'],
      ['Availability', 'availability'],
    ]) {
      expect(within(panel).getByRole('link', { name: label })).toHaveAttribute(
        'href',
        `/projects/research/${path}`,
      );
    }
    await user.keyboard('{Escape}');
    expect(more).toHaveFocus();
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('region', { name: 'More navigation' }),
    ).not.toBeInTheDocument();
  });
  it('navigates through More and closes the panel', async () => {
    const user = userEvent.setup();
    visit('/my-tasks');
    await user.click(screen.getByRole('button', { name: 'More' }));
    const panel = screen.getByRole('region', { name: 'More navigation' });
    await user.click(within(panel).getByRole('link', { name: 'Availability' }));
    expect(
      await screen.findByRole('heading', { name: 'Availability', level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'More navigation' }),
    ).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole('navigation', { name: 'Mobile navigation' }),
      ).getByRole('button', { name: 'More' }),
    ).toHaveClass('active');
  });
  it.each([
    ['/login', 'Sign in to TaskFlow'],
    ['/my-tasks', 'My Tasks'],
    ['/projects', 'My Projects'],
    ['/projects/website/overview', 'Overview'],
    ['/projects/website/tasks', 'All Tasks'],
    ['/projects/website/tasks/user-flows', 'Map the key user flows'],
    ['/projects/website/members', 'Project Members'],
    ['/projects/website/calendar', 'Deadline Calendar'],
    ['/projects/website/availability', 'Availability'],
  ])('renders %s', async (path, heading) => {
    visit(path);
    expect(
      await screen.findByRole('heading', { name: heading, level: 1 }),
    ).toBeInTheDocument();
  });
  it('shows personal tasks across projects, excluding other assignees', () => {
    visit('/my-tasks');
    expect(
      screen.getByRole('link', { name: 'Prepare interview questions' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Map the key user flows' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Create homepage wireframes' }),
    ).not.toBeInTheDocument();
  });
  it('filters tasks and provides a recoverable empty state', async () => {
    const user = userEvent.setup();
    visit('/projects/website/tasks');
    await user.selectOptions(
      screen.getByLabelText('Filter by assignee'),
      'brandon',
    );
    expect(
      screen.getByRole('link', { name: 'Create homepage wireframes' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Map the key user flows' }),
    ).not.toBeInTheDocument();
    await user.type(screen.getByRole('searchbox'), 'no-match');
    expect(screen.getByText('No tasks found')).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox'));
    expect(
      screen.getByRole('link', { name: 'Create homepage wireframes' }),
    ).toBeInTheDocument();
  });
  it('switches project context and navigation', async () => {
    const user = userEvent.setup();
    visit('/projects/website/tasks');
    await user.selectOptions(
      screen.getByLabelText('Selected project'),
      'research',
    );
    expect(
      await screen.findByRole('heading', { name: 'Overview', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All Tasks' })).toHaveAttribute(
      'href',
      '/projects/research/tasks',
    );
    expect(
      screen.queryByText('Website Redesign / Design'),
    ).not.toBeInTheDocument();
  });
  it.each([
    ['/projects/missing/tasks', 'Project not found'],
    ['/projects/research/tasks/user-flows', 'Task not found'],
    ['/unknown', 'Page not found'],
  ])('handles invalid deep link %s', (path, title) => {
    visit(path);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Map the key user flows' }),
    ).not.toBeInTheDocument();
  });
  it('navigates from personal tasks to details and back', async () => {
    const user = userEvent.setup();
    visit('/my-tasks');
    await user.click(
      screen.getByRole('link', { name: 'Map the key user flows' }),
    );
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Map the key user flows',
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: '← All Tasks' }));
    expect(
      await screen.findByRole('heading', { name: 'All Tasks', level: 1 }),
    ).toBeInTheDocument();
  });
  it('navigates deadline months', async () => {
    const user = userEvent.setup();
    visit('/projects/website/calendar');
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(
      screen.getByRole('heading', { name: 'November 2026' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(
      screen.getByRole('heading', { name: 'October 2026' }),
    ).toBeInTheDocument();
  });
});
