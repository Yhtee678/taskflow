import { useState } from 'react';
import {
  Link,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router-dom';
import type { ProjectBundle, StepRow, ResourceRow } from '@/types/database';
import { useWorkspace } from '@/app/workspace-context';
import { useRemote } from '@/app/use-remote';
import {
  statusLabels,
  priorityLabels,
  loadTaskChildren,
  deleteTask,
  saveStep,
  deleteStep,
  saveResource,
  deleteResource,
} from '@/features/tasks/queries';
import { TaskForm } from '@/features/tasks/task-form';
import { PageHeader, EmptyState } from '@/components/ui/page-header';
import { RemoteState } from '@/components/ui/remote-state';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { text, safeResourceUrl } from '@/lib/data-client';
import { TaskComments } from '@/features/comments/task-comments';
type ChildEditor =
  { kind: 'step'; value?: StepRow } | { kind: 'resource'; value?: ResourceRow };
export function TaskDetailPage() {
  const bundle = useOutletContext<ProjectBundle>();
  const { id } = useParams();
  const projectId = bundle.project.id;
  const { revision, refresh, mutate, pending } = useWorkspace();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [child, setChild] = useState<ChildEditor | null>(null);
  const [formError, setFormError] = useState('');
  const task = bundle.tasks.find((t) => t.id === id);
  const state = useRemote(`${projectId}:${id}:${revision}`, () =>
    loadTaskChildren(projectId, id!),
  );
  if (!task)
    return (
      <EmptyState title="Task not found">
        <Link to={`/projects/${projectId}/tasks`}>Return to all tasks</Link>
      </EmptyState>
    );
  const children = state.data;
  return (
    <>
      <Link className="back-link" to={`/projects/${projectId}/tasks`}>
        ← All Tasks
      </Link>
      <PageHeader
        title={task.title}
        description={`${bundle.project.name} / ${bundle.sections.find((s) => s.id === task.section_id)?.name ?? ''}`}
      >
        <Button variant="outline" onClick={() => setEditing(true)}>
          Edit task
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={async () => {
            if (
              window.confirm(
                `Delete “${task.title}” and its steps and resources? This cannot be undone.`,
              ) &&
              (await mutate(
                () => deleteTask(projectId, task.id),
                'Task deleted.',
              ))
            )
              navigate(`/projects/${projectId}/tasks`);
          }}
        >
          Delete task
        </Button>
      </PageHeader>
      <div className="task-detail">
        <div>
          <section>
            <h2>Description</h2>
            <p className="plain-text">
              {task.description || 'No description.'}
            </p>
          </section>
          <section>
            <h2>Guidance</h2>
            <p className="plain-text">{task.guidance || 'No guidance yet.'}</p>
          </section>
          {children ? (
            <>
              <section>
                <div className="section-heading">
                  <h2>
                    Steps{' '}
                    <span className="count">
                      {children.steps.filter((s) => s.is_completed).length}/
                      {children.steps.length}
                    </span>
                  </h2>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setFormError('');
                      setChild({ kind: 'step' });
                    }}
                  >
                    Add step
                  </Button>
                </div>
                {!children.steps.length && (
                  <p>
                    Steps are optional. Add a checklist if this task needs one.
                  </p>
                )}
                {children.steps.map((step) => (
                  <div className="step" key={step.id}>
                    <label className="step-label">
                      <input
                        type="checkbox"
                        checked={step.is_completed}
                        disabled={pending}
                        onChange={(e) =>
                          void mutate(
                            () =>
                              saveStep(
                                projectId,
                                task.id,
                                {
                                  title: step.title,
                                  is_completed: e.target.checked,
                                  position: step.position,
                                },
                                step.id,
                              ),
                            'Step updated.',
                          )
                        }
                      />
                      <span>{step.title}</span>
                    </label>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setFormError('');
                        setChild({ kind: 'step', value: step });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm('Delete this step?'))
                          void mutate(
                            () => deleteStep(projectId, task.id, step.id),
                            'Step deleted.',
                          );
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </section>
              <section>
                <div className="section-heading">
                  <h2>Resources</h2>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setFormError('');
                      setChild({ kind: 'resource' });
                    }}
                  >
                    Add resource
                  </Button>
                </div>
                {!children.resources.length && <p>No resources yet.</p>}
                {children.resources.map((resource) => {
                  let href: string | null = null;
                  try {
                    href = safeResourceUrl(resource.url);
                  } catch {
                    /* Untrusted stored links stay non-clickable until corrected. */
                  }
                  return (
                    <div className="resource-row" key={resource.id}>
                      {href ? (
                        <a
                          className="resource"
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <strong>{resource.title} ↗</strong>
                          <span>{resource.description || resource.url}</span>
                        </a>
                      ) : (
                        <p>
                          {resource.title} · Invalid link; edit to correct it.
                        </p>
                      )}
                      <div className="inline-actions">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setFormError('');
                            setChild({ kind: 'resource', value: resource });
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm('Delete this resource?'))
                              void mutate(
                                () =>
                                  deleteResource(
                                    projectId,
                                    task.id,
                                    resource.id,
                                  ),
                                'Resource deleted.',
                              );
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </section>
            </>
          ) : (
            <RemoteState state={state} retry={refresh} />
          )}
          <TaskComments
            key={`${projectId}:${task.id}`}
            projectId={projectId}
            taskId={task.id}
          />
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
            <dt>Priority</dt>
            <dd>{priorityLabels[task.priority]}</dd>
            <dt>Assignee</dt>
            <dd>
              {bundle.members.find((m) => m.user_id === task.assignee_id)
                ?.display_name ?? 'Unassigned'}
            </dd>
            <dt>Deadline</dt>
            <dd>
              {task.due_at
                ? new Date(task.due_at).toLocaleString(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'No deadline'}
            </dd>
            <dt>Section</dt>
            <dd>
              {bundle.sections.find((s) => s.id === task.section_id)?.name}
            </dd>
          </dl>
          <p className="helper">
            All project members can edit this task. Step completion does not
            change its status.
          </p>
        </aside>
      </div>
      {editing && (
        <TaskForm
          bundle={bundle}
          task={task}
          onClose={() => setEditing(false)}
        />
      )}
      {child && children && (
        <Modal
          title={`${child.value ? 'Edit' : 'Add'} ${child.kind}`}
          onClose={() => setChild(null)}
        >
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              let work: () => Promise<unknown>;
              try {
                const title = text(
                  form.get('title'),
                  child.kind === 'step' ? 500 : 200,
                  true,
                );
                const position = Number(form.get('position'));
                if (!Number.isSafeInteger(position) || position < 0)
                  throw new Error('Order must be a non-negative integer.');
                if (child.kind === 'step')
                  work = () =>
                    saveStep(
                      projectId,
                      task.id,
                      {
                        title,
                        position,
                        is_completed: child.value?.is_completed ?? false,
                      },
                      child.value?.id,
                    );
                else {
                  const url = safeResourceUrl(
                    text(form.get('url'), 2048, true),
                  );
                  const description = text(form.get('description'), 20000);
                  work = () =>
                    saveResource(
                      projectId,
                      task.id,
                      { title, url, description, position },
                      child.value?.id,
                    );
                }
              } catch (err) {
                setFormError((err as Error).message);
                return;
              }
              if (
                await mutate(
                  work,
                  `${child.kind === 'step' ? 'Step' : 'Resource'} saved.`,
                )
              )
                setChild(null);
            }}
          >
            <label>
              Title
              <input
                name="title"
                required
                maxLength={child.kind === 'step' ? 500 : 200}
                defaultValue={child.value?.title}
              />
            </label>
            {child.kind === 'resource' && (
              <>
                <label>
                  URL
                  <input
                    name="url"
                    type="url"
                    required
                    maxLength={2048}
                    defaultValue={child.value?.url}
                  />
                </label>
                <label>
                  Description
                  <textarea
                    name="description"
                    maxLength={20000}
                    defaultValue={child.value?.description}
                  />
                </label>
              </>
            )}
            <label>
              Order
              <input
                name="position"
                type="number"
                min={0}
                step={1}
                required
                defaultValue={
                  child.value?.position ??
                  Math.max(
                    -1,
                    ...(child.kind === 'step'
                      ? children.steps
                      : children.resources
                    ).map((r) => r.position),
                  ) + 1
                }
              />
            </label>
            {formError && <p role="alert">{formError}</p>}
            <Button disabled={pending}>Save {child.kind}</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
