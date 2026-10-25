import { Link, Outlet, useParams, useRouteError } from 'react-router-dom';
import { EmptyState } from '@/components/ui/page-header';
import { projects } from '@/features/projects/mock-data';
export function ProjectRoute() {
  const { projectId } = useParams();
  const project = projects.find((p) => p.id === projectId);
  return project ? (
    <Outlet key={project.id} context={project} />
  ) : (
    <EmptyState title="Project not found">
      <Link to="/projects">Return to My Projects</Link>
    </EmptyState>
  );
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
