import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/app/workspace-context';
import type {
  ProjectBundle,
  TaskRow,
  Status,
  Priority,
} from '@/types/database';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { text } from '@/lib/data-client';
import { toLocalInput, toInstant } from '@/lib/local-dates';
import { saveTask, statusLabels, priorityLabels } from './queries';
export function TaskForm({
  bundle,
  task,
  sectionId,
  onClose,
}: {
  bundle: ProjectBundle;
  task?: TaskRow;
  sectionId?: string;
  onClose: () => void;
}) {
  const { mutate, pending } = useWorkspace();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  return (
    <Modal title={task ? 'Edit task' : 'New task'} onClose={onClose}>
      <form
        className="editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          let values;
          try {
            const status = String(form.get('status')) as Status,
              priority = String(form.get('priority')) as Priority;
            const section = String(form.get('section'));
            const assignee = String(form.get('assignee') || '');
            if (
              !Object.hasOwn(statusLabels, status) ||
              !Object.hasOwn(priorityLabels, priority) ||
              !bundle.sections.some((s) => s.id === section) ||
              (assignee && !bundle.members.some((m) => m.user_id === assignee))
            )
              throw new Error(
                'Choose a valid section, assignee, status and priority.',
              );
            values = {
              title: text(form.get('title'), 200, true),
              description: text(form.get('description'), 20000),
              guidance: text(form.get('guidance'), 20000),
              status,
              priority,
              section_id: section,
              assignee_id: assignee || null,
              due_at: toInstant(String(form.get('due') || '')),
              position:
                task?.position ??
                Math.max(
                  -1,
                  ...bundle.tasks
                    .filter((t) => t.section_id === section)
                    .map((t) => t.position),
                ) + 1,
            };
          } catch (err) {
            setError((err as Error).message);
            return;
          }
          let saved: TaskRow | undefined;
          if (
            await mutate(
              async () => {
                saved = await saveTask(bundle.project.id, values, task?.id);
              },
              task ? 'Task updated.' : 'Task created.',
            )
          ) {
            onClose();
            if (!task && saved)
              navigate(`/projects/${bundle.project.id}/tasks/${saved.id}`);
          }
        }}
      >
        <label>
          Task title
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={task?.title}
          />
        </label>
        <div className="form-grid">
          <label>
            Section
            <select
              name="section"
              defaultValue={
                task?.section_id ?? sectionId ?? bundle.sections[0]?.id
              }
              required
            >
              {bundle.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Assignee
            <select name="assignee" defaultValue={task?.assignee_id ?? ''}>
              <option value="">Unassigned</option>
              {bundle.members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select name="status" defaultValue={task?.status ?? 'todo'}>
              {Object.entries(statusLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select name="priority" defaultValue={task?.priority ?? 'normal'}>
              {Object.entries(priorityLabels).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Deadline (local date and time)
          <input
            name="due"
            type="datetime-local"
            defaultValue={toLocalInput(task?.due_at ?? null)}
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={20000}
            defaultValue={task?.description}
          />
        </label>
        <label>
          Guidance
          <textarea
            name="guidance"
            maxLength={20000}
            defaultValue={task?.guidance}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <Button disabled={pending}>{pending ? 'Saving…' : 'Save task'}</Button>
      </form>
    </Modal>
  );
}
