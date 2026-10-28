import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/app/workspace-context';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { text } from '@/lib/data-client';
import type { ProjectRow } from '@/types/database';
import { createProject, updateProject } from './queries';
export function ProjectForm({
  project,
  onClose,
}: {
  project?: ProjectRow;
  onClose: () => void;
}) {
  const { mutate, pending } = useWorkspace();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  return (
    <Modal title={project ? 'Edit project' : 'New project'} onClose={onClose}>
      <form
        className="editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          let values;
          try {
            values = {
              name: text(form.get('name'), 120, true),
              description: text(form.get('description'), 20000),
              due_date: String(form.get('due_date') || '') || null,
            };
          } catch (err) {
            setError((err as Error).message);
            return;
          }
          let created = '';
          if (
            await mutate(
              async () => {
                if (project) await updateProject(project.id, values);
                else created = await createProject(values);
              },
              project ? 'Project updated.' : 'Project created.',
            )
          ) {
            onClose();
            if (created) navigate(`/projects/${created}/overview`);
          }
        }}
      >
        <label>
          Name
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={project?.name}
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={20000}
            defaultValue={project?.description}
          />
        </label>
        <label>
          Project due date
          <input
            name="due_date"
            type="date"
            defaultValue={project?.due_date ?? ''}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <Button disabled={pending}>
          {pending ? 'Saving…' : 'Save project'}
        </Button>
      </form>
    </Modal>
  );
}
