import { useContext, type ReactNode } from 'react';
import { SelectedProjectContext } from '@/components/layout/project-context';
export function PageHeader({
  title,
  description,
  children,
  showProject = true,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  showProject?: boolean;
}) {
  const project = useContext(SelectedProjectContext);
  return (
    <>
      {showProject && project && title !== 'My Projects' && (
        <p className="project-heading" aria-label="Current project">
          {project.name}
        </p>
      )}
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="header-actions">{children}</div>
      </header>
    </>
  );
}
export function EmptyState({
  title = 'No tasks found',
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{children ?? 'Try changing your filters.'}</p>
    </div>
  );
}
