import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { useWorkspace } from '@/app/workspace-context';
import { PageHeader, EmptyState } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { ProjectForm } from '@/features/projects/project-form';
import { dateOnly } from '@/lib/dates';
export function ProjectsPage() {
  const { catalog } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const projects = catalog.data!.projects;
  return (
    <>
      <PageHeader title="My Projects" description="Projects you belong to.">
        <Button onClick={() => setCreating(true)}>
          <Plus size={16} />
          New project
        </Button>
      </PageHeader>
      {!projects.length ? (
        <EmptyState title="No projects yet">
          Create a project to start planning with your team.
        </EmptyState>
      ) : (
        <div className="project-list">
          {projects.map((p) => (
            <Link
              to={`/projects/${p.id}/overview`}
              className="project-row"
              key={p.id}
            >
              <div className="project-mark">{p.name.slice(0, 1)}</div>
              <div className="project-copy">
                <h2>{p.name}</h2>
                <p>{p.description || 'No description'}</p>
                <small>
                  {catalog.data!.memberships.find((m) => m.project_id === p.id)
                    ?.role === 'leader'
                    ? 'Project leader'
                    : 'Member'}{' '}
                  ·{' '}
                  {p.due_date
                    ? `Due ${dateOnly(p.due_date)}`
                    : 'No project due date'}
                </small>
              </div>
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
      )}
      {creating && <ProjectForm onClose={() => setCreating(false)} />}
    </>
  );
}
