import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { loadCatalog } from '@/features/projects/queries';
import { AccessError } from '@/lib/data-client';
import { AppShell } from '@/components/layout/app-shell';
import { useRemote } from './use-remote';
import { WorkspaceContext } from './workspace-context';
import { initialFilters } from '@/features/tasks/filter-state';
export function AuthenticatedApp() {
  const { session } = useAuth();
  const userId = session!.user.id;
  const location = useLocation();
  const [myTasksFilters, setMyTasksFilters] = useState(initialFilters);
  const mutationInFlight = useRef(false);
  const [revision, setRevision] = useState(0),
    [pending, setPending] = useState(false),
    [feedback, setFeedback] = useState<{
      message: string;
      error: boolean;
    } | null>(null);
  const refresh = () => setRevision((n) => n + 1);
  const catalog = useRemote(`${userId}:${revision}`, () => loadCatalog(userId));
  useEffect(() => {
    setFeedback(null);
    setMyTasksFilters(initialFilters);
  }, [location.key, userId]);
  useEffect(() => {
    if (!feedback || feedback.error) return;
    const timer = window.setTimeout(
      () => setFeedback((current) => (current === feedback ? null : current)),
      3000,
    );
    return () => window.clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    const focus = () => {
      if (!mutationInFlight.current) setRevision((n) => n + 1);
    };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, []);
  async function mutate(work: () => Promise<unknown>, message: string) {
    if (mutationInFlight.current) return false;
    mutationInFlight.current = true;
    setPending(true);
    setFeedback(null);
    try {
      await work();
      setFeedback({ message, error: false });
      refresh();
      return true;
    } catch (error) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : 'The change failed. Please try again.',
        error: true,
      });
      if (error instanceof AccessError) refresh();
      return false;
    } finally {
      mutationInFlight.current = false;
      setPending(false);
    }
  }
  return (
    <WorkspaceContext.Provider
      value={{
        catalog,
        revision,
        pending,
        feedback,
        refresh,
        mutate,
        dismissFeedback: () => setFeedback(null),
        myTasksFilters,
        setMyTasksFilters,
      }}
    >
      <AppShell />
    </WorkspaceContext.Provider>
  );
}
