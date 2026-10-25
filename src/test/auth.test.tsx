import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/app/auth-provider';
import { routes } from '@/app/router';
import { getSupabaseClient } from '@/lib/supabase';
import { testSession } from './auth-fixtures';
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: vi.fn() }));
let listener: (event: AuthChangeEvent, session: Session | null) => void;
const unsubscribe = vi.fn();
const getSession = vi.fn();
const signInWithOAuth = vi.fn();
const signOut = vi.fn();
function visit(path = '/my-tasks') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return { router, ...view };
}
beforeEach(() => {
  vi.resetAllMocks();
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  signInWithOAuth.mockResolvedValue({
    data: { url: 'https://accounts.google.com/' },
    error: null,
  });
  signOut.mockResolvedValue({ error: null });
  vi.mocked(getSupabaseClient).mockReturnValue({
    auth: {
      getSession,
      signInWithOAuth,
      signOut,
      onAuthStateChange: vi.fn((callback) => {
        listener = callback;
        return { data: { subscription: { unsubscribe } } };
      }),
    },
  } as unknown as SupabaseClient);
});
describe('Supabase authentication integration (SDK mocked)', () => {
  it.each([
    '/',
    '/my-tasks',
    '/projects',
    '/projects/website/tasks/user-flows',
    '/projects/website/availability',
  ])('blocks signed-out route %s', async (path) => {
    const { router } = visit(path);
    expect(
      await screen.findByRole('heading', { name: 'Sign in to TaskFlow' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(
      screen.queryByText('Map the key user flows'),
    ).not.toBeInTheDocument();
  });
  it('does not reveal protected content while restoring the session', () => {
    getSession.mockReturnValue(new Promise(() => {}));
    visit();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Checking your session',
    );
    expect(
      screen.queryByRole('heading', { name: 'My Tasks' }),
    ).not.toBeInTheDocument();
  });
  it('restores a session and redirects an authenticated login to My Tasks', async () => {
    getSession.mockResolvedValue({
      data: { session: testSession },
      error: null,
    });
    const { router } = visit('/login');
    expect(
      await screen.findByRole('heading', { name: 'My Tasks', level: 1 }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/my-tasks');
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(
      screen.getByText(/fictional demo data for Alex Tan/),
    ).toBeInTheDocument();
  });
  it('starts Google OAuth with the same-origin callback', async () => {
    const user = userEvent.setup();
    visit('/login');
    await user.click(
      await screen.findByRole('button', { name: 'Continue with Google' }),
    );
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  });
  it('shows OAuth errors and allows another attempt', async () => {
    const user = userEvent.setup();
    signInWithOAuth.mockResolvedValueOnce({ error: new Error('failure') });
    visit('/login');
    await user.click(
      await screen.findByRole('button', { name: 'Continue with Google' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Google sign-in could not start',
    );
    await user.click(
      screen.getByRole('button', { name: 'Continue with Google' }),
    );
    expect(signInWithOAuth).toHaveBeenCalledTimes(2);
  });
  it('clears protected UI on sign-out and unsubscribes on unmount', async () => {
    const user = userEvent.setup();
    getSession.mockResolvedValue({
      data: { session: testSession },
      error: null,
    });
    const view = visit();
    await screen.findByRole('heading', { name: 'My Tasks', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(
      await screen.findByRole('heading', { name: 'Sign in to TaskFlow' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Test User')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Map the key user flows'),
    ).not.toBeInTheDocument();
    view.unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
  it('retains the session when sign-out fails and supports retry', async () => {
    const user = userEvent.setup();
    getSession.mockResolvedValue({
      data: { session: testSession },
      error: null,
    });
    signOut.mockResolvedValueOnce({ error: new Error('offline') });
    visit();
    await screen.findByRole('heading', { name: 'My Tasks', level: 1 });
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sign out failed',
    );
    expect(screen.getByText('Test User')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(
      await screen.findByRole('heading', { name: 'Sign in to TaskFlow' }),
    ).toBeInTheDocument();
  });
  it('reacts to session expiry or another tab signing out', async () => {
    getSession.mockResolvedValue({
      data: { session: testSession },
      error: null,
    });
    visit();
    await screen.findByRole('heading', { name: 'My Tasks', level: 1 });
    act(() => listener('SIGNED_OUT', null));
    expect(
      await screen.findByRole('heading', { name: 'Sign in to TaskFlow' }),
    ).toBeInTheDocument();
  });
  it('does not overwrite a newer auth event with a stale restore result', async () => {
    let resolve!: (value: {
      data: { session: Session | null };
      error: null;
    }) => void;
    getSession.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    visit();
    act(() => listener('SIGNED_IN', testSession));
    await screen.findByRole('heading', { name: 'My Tasks', level: 1 });
    await act(async () => resolve({ data: { session: null }, error: null }));
    expect(
      screen.getByRole('heading', { name: 'My Tasks', level: 1 }),
    ).toBeInTheDocument();
  });
  it('handles missing configuration without initializing a session', async () => {
    vi.mocked(getSupabaseClient).mockImplementation(() => {
      throw new Error(
        'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local',
      );
    });
    visit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Set VITE_SUPABASE_URL',
    );
    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeDisabled();
    expect(getSession).not.toHaveBeenCalled();
  });
  it('handles failed session restoration without redirect loops', async () => {
    getSession.mockRejectedValue(new Error('offline'));
    const { router } = visit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to check your session',
    );
    expect(router.state.location.pathname).toBe('/login');
  });
  it('finishes the callback using the SDK-restored session', async () => {
    getSession.mockResolvedValue({
      data: { session: testSession },
      error: null,
    });
    visit('/auth/callback');
    expect(
      await screen.findByRole('heading', { name: 'My Tasks', level: 1 }),
    ).toBeInTheDocument();
  });
  it('shows an expired or invalid callback without a redirect loop', async () => {
    const { router } = visit('/auth/callback');
    expect(
      await screen.findByRole('heading', {
        name: 'Sign-in could not be completed',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).getByRole('link', {
        name: 'Return to Sign In',
      }),
    ).toHaveAttribute('href', '/login');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/auth/callback'),
    );
  });
});
