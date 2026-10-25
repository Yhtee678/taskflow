import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { projects } from '@/features/projects/mock-data';
import { tasks } from '@/features/tasks/mock-data';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { dateOnly } from '@/lib/dates';
export function ProjectsPage() {
  return (
    <>
      <PageHeader title="My Projects" description="Projects you belong to.">
        <Button disabled title="Project creation is available in a later phase">
          <Plus size={16} />
          New project
        </Button>
      </PageHeader>
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
              <p>{p.description}</p>
              <small>
                {p.members.length} members ·{' '}
                {tasks.filter((t) => t.projectId === p.id).length} tasks · Due{' '}
                {dateOnly(p.due)}
              </small>
            </div>
            <ArrowRight size={18} />
          </Link>
        ))}
      </div>
      <p className="helper">
        Project creation and membership actions are preview-only in this phase.
      </p>
    </>
  );
}
