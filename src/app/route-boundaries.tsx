import { Link, Outlet, useParams, useRouteError } from 'react-router-dom';
import { useWorkspace } from './workspace-context';
import { useRemote } from './use-remote';
import { loadProject } from '@/features/tasks/queries';
import { RemoteState } from '@/components/ui/remote-state';
export function ProjectRoute() {
  const { projectId } = useParams();
  const { revision, refresh } = useWorkspace();
  const state = useRemote(`${projectId}:${revision}`, () =>
    loadProject(projectId!),
  );
  if (!state.data)
    return (
      <>
        {!state.loading && <h2>Project unavailable</h2>}
        <RemoteState state={state} retry={refresh} />
        {!state.loading && <Link to="/projects">Return to My Projects</Link>}
      </>
    );
  return <Outlet key={projectId} context={state.data} />;
}
export function RouteError() {
  const error = useRouteError();
  console.error(error);
  return (
    <main className="empty-state">
      <h1>Something went wrong</h1>
      <p>Reload the page to try again.</p>
      <a href="/my-tasks">Return to My Tasks</a>
    </main>
  );
}
