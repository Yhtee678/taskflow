import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import type { ProjectBundle } from '@/types/database';
import { useAuth } from '@/features/auth/auth-context';
import { useWorkspace } from '@/app/workspace-context';
import { statusLabels } from '@/features/tasks/queries';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { TaskList } from '@/features/tasks/task-list';
import { ProjectForm } from '@/features/projects/project-form';
import { deleteProject } from '@/features/projects/queries';
import { dateOnly } from '@/lib/dates';
import { RecentActivity } from '@/features/project-activity/recent-activity';
import { ProjectDiscussion } from '@/features/project-discussion/project-discussion';
export function OverviewPage() {
  const bundle = useOutletContext<ProjectBundle>();
  const { project, tasks: list, sections, members } = bundle;
  const { session } = useAuth();
  const { mutate, pending } = useWorkspace();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const done = list.filter((t) => t.status === 'done').length;
  const leader = members.some(
    (m) => m.user_id === session!.user.id && m.role === 'leader',
  );
  return (
    <>
      <PageHeader title="Overview" description={project.name}>
        <Button variant="outline" onClick={() => setEditing(true)}>
          Edit project
        </Button>
        <Button asChild variant="outline">
          <Link to={`/projects/${project.id}/tasks`}>View all tasks</Link>
        </Button>
      </PageHeader>
      <section className="overview-intro">
        <p>{project.description || 'No project description.'}</p>
        <div className="metadata">
          <span>
            {project.due_date
              ? `Due ${dateOnly(project.due_date)}`
              : 'No project due date'}
          </span>
          <Link to={`/projects/${project.id}/members`}>
            {members.length} members
          </Link>
          <span>
            {members.find((m) => m.role === 'leader')?.display_name} · Project
            leader
          </span>
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
          max={Math.max(1, list.length)}
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
        {sections.length ? (
          sections.map((s) => {
            const items = list.filter((t) => t.section_id === s.id);
            return (
              <div className="section-progress" key={s.id}>
                <Link to={`/projects/${project.id}/tasks`}>{s.name}</Link>
                <progress
                  aria-label={`${s.name} completion`}
                  value={items.filter((t) => t.status === 'done').length}
                  max={Math.max(1, items.length)}
                />
                <span>
                  {items.filter((t) => t.status === 'done').length}/
                  {items.length} done
                </span>
              </div>
            );
          })
        ) : (
          <p>No sections yet. Add your first section in All Tasks.</p>
        )}
      </section>
      <section className="list-section">
        <h2>Open task deadlines</h2>
        <TaskList
          tasks={list
            .filter((t) => t.due_at && t.status !== 'done')
            .sort((a, b) => a.due_at!.localeCompare(b.due_at!))}
          members={members}
        />
      </section>
      <RecentActivity key={`activity:${project.id}`} projectId={project.id} />
      <ProjectDiscussion
        key={`discussion:${project.id}`}
        projectId={project.id}
      />
      {leader && (
        <section className="list-section">
          <Button
            variant="outline"
            disabled={pending}
            onClick={async () => {
              if (
                window.confirm(
                  `Permanently delete “${project.name}”, all tasks, steps, resources, availability and memberships? This cannot be undone.`,
                ) &&
                (await mutate(
                  () => deleteProject(project.id),
                  'Project deleted.',
                ))
              )
                navigate('/projects', { replace: true });
            }}
          >
            Delete project
          </Button>
        </section>
      )}
      {editing && (
        <ProjectForm project={project} onClose={() => setEditing(false)} />
      )}
    </>
  );
}
