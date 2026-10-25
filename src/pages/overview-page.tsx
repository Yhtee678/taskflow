import { Link, useOutletContext } from 'react-router-dom';
import type { Project } from '@/types/domain';
import { tasks, statusLabels } from '@/features/tasks/mock-data';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { TaskList } from '@/features/tasks/task-list';
import { dateOnly } from '@/lib/dates';
export function OverviewPage() {
  const project = useOutletContext<Project>();
  const list = tasks.filter((t) => t.projectId === project.id);
  const done = list.filter((t) => t.status === 'done').length;
  return (
    <>
      <PageHeader title="Overview" description={project.name}>
        <Button asChild variant="outline">
          <Link to={`/projects/${project.id}/tasks`}>View all tasks</Link>
        </Button>
      </PageHeader>
      <section className="overview-intro">
        <h2>{project.name}</h2>
        <p>{project.description}</p>
        <div className="metadata">
          <span>Due {dateOnly(project.due)}</span>
          <Link to={`/projects/${project.id}/members`}>
            {project.members.length} members
          </Link>
          <span>Alex Tan · Project leader</span>
        </div>
      </section>
      <section className="list-section">
        <h2>
          Project progress{' '}
          <span className="muted">
            {done} of {list.length} complete
          </span>
        </h2>
        <progress
          value={done}
          max={list.length}
          aria-label="Project completion"
        />
        <div className="status-summary">
          {Object.entries(statusLabels).map(([key, label]) => (
            <span key={key}>
              <span className={`status-dot ${key}`} />
              {label}
              <strong>{list.filter((t) => t.status === key).length}</strong>
            </span>
          ))}
        </div>
      </section>
      <section className="list-section">
        <h2>Sections</h2>
        {[...new Set(list.map((t) => t.section))].map((section) => {
          const items = list.filter((t) => t.section === section);
          return (
            <div className="section-progress" key={section}>
              <strong>{section}</strong>
              <progress
                aria-label={`${section} completion`}
                value={items.filter((t) => t.status === 'done').length}
                max={items.length}
              />
              <span>
                {items.filter((t) => t.status === 'done').length}/{items.length}{' '}
                done
              </span>
            </div>
          );
        })}
      </section>
      <section className="list-section">
        <h2>Upcoming deadlines</h2>
        <TaskList
          tasks={list
            .filter((t) => t.due && t.status !== 'done')
            .sort((a, b) => a.due!.localeCompare(b.due!))}
        />
      </section>
    </>
  );
}
