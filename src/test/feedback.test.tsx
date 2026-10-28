import './data-api-mocks';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Link } from 'react-router-dom';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { AuthContext } from '@/features/auth/auth-context';
import { testSession } from './auth-fixtures';
import { AuthenticatedApp } from '@/app/workspace-provider';
import { useWorkspace } from '@/app/workspace-context';
import { FeedbackToast } from '@/components/ui/feedback-toast';
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: () => {
    const { mutate } = useWorkspace();
    return (
      <>
        <button onClick={() => void mutate(async () => {}, 'Saved.')}>
          Save
        </button>
        <button
          onClick={() =>
            void mutate(async () => {
              throw new Error('Action failed');
            }, 'Saved.')
          }
        >
          Fail
        </button>
        <Link to="/next">Next page</Link>
        <FeedbackToast />
      </>
    );
  },
}));
async function start() {
  render(
    <MemoryRouter>
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
        <AuthenticatedApp />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  await act(async () => {});
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe('action feedback lifecycle', () => {
  it('announces success then removes it after three seconds without page navigation', async () => {
    await start();
    fireEvent.click(screen.getByText('Save'));
    await act(async () => {});
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByText('Saved.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });
  it('keeps errors visible until manually dismissed', async () => {
    await start();
    fireEvent.click(screen.getByText('Fail'));
    await act(async () => {});
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByRole('alert')).toHaveTextContent('Action failed');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss feedback' }));
    expect(screen.queryByText('Action failed')).not.toBeInTheDocument();
  });
  it('clears transient action feedback on navigation', async () => {
    await start();
    fireEvent.click(screen.getByText('Save'));
    await act(async () => {});
    expect(screen.getByText('Saved.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Next page' }));
    await act(async () => {});
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });
  it('gives the latest success its own full timeout', async () => {
    await start();
    fireEvent.click(screen.getByText('Save'));
    await act(async () => {});
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(screen.getByText('Save'));
    await act(async () => {});
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('Saved.')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument();
  });
});
