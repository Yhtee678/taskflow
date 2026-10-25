import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import type { Project } from '@/types/domain';
import { tasks, statusLabels } from '@/features/tasks/mock-data';
import { people } from '@/features/projects/mock-data';
import { PageHeader, EmptyState } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
export function TaskDetailPage() {
  const project = useOutletContext<Project>();
  const { id } = useParams();
  const task = tasks.find((t) => t.id === id && t.projectId === project.id);
  const [checked, setChecked] = useState<string[]>(['journeys']);
  if (!task)
    return (
      <EmptyState title="Task not found">
        <Link to={`/projects/${project.id}/tasks`}>Return to all tasks</Link>
      </EmptyState>
    );
  return (
    <>
      <Link className="back-link" to={`/projects/${project.id}/tasks`}>
        ← All Tasks
      </Link>
      <PageHeader
        title={task.title}
        description={`${project.name} / ${task.section}`}
      >
        <Button disabled title="Editing is deferred">
          Edit task
        </Button>
      </PageHeader>
      <div className="task-detail">
        <div>
          <section>
            <h2>Description</h2>
            <p>{task.description}</p>
          </section>
          <section>
            <h2>Guidance</h2>
            <p>{task.guidance}</p>
          </section>
          <section>
            <h2>
              Steps <span className="count">{checked.length}/3</span>
            </h2>
            <p className="helper">
              Example checklist · toggles reset when you leave.
            </p>
            {[
              { id: 'journeys', title: 'Identify the primary journeys' },
              { id: 'draft', title: 'Draft and review with the team' },
              { id: 'feedback', title: 'Incorporate feedback' },
            ].map((step) => (
              <label className="step" key={step.id}>
                <input
                  type="checkbox"
                  checked={checked.includes(step.id)}
                  onChange={(e) =>
                    setChecked(
                      e.target.checked
                        ? [...checked, step.id]
                        : checked.filter((s) => s !== step.id),
                    )
                  }
                />
                <span>{step.title}</span>
              </label>
            ))}
          </section>
          <section>
            <h2>Resources</h2>
            <a
              className="resource"
              href="https://www.w3.org/WAI/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>Web accessibility guidance ↗</strong>
              <span>Reference for accessible user journeys and interfaces</span>
            </a>
            <a
              className="resource"
              href="https://www.figma.com/design/oOU4WPTBqP6EdO5YIiGfsx"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>TaskFlow design reference ↗</strong>
              <span>Approved screen direction</span>
            </a>
          </section>
        </div>
        <aside className="detail-properties">
          <h2>Task details</h2>
          <dl>
            <dt>Status</dt>
            <dd>
              <span className={`badge ${task.status}`}>
                {statusLabels[task.status]}
              </span>
            </dd>
            <dt>Assignee</dt>
            <dd>
              {people.find((p) => p.id === task.assignee)?.name ?? 'Unassigned'}
            </dd>
            <dt>Deadline</dt>
            <dd>
              {task.due
                ? new Date(task.due).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'No deadline'}
            </dd>
            <dt>Section</dt>
            <dd>{task.section}</dd>
          </dl>
          <p className="helper">
            All project members will be able to edit this task when connected.
          </p>
        </aside>
      </div>
    </>
  );
}
