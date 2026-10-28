import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ProjectBundle, SectionRow } from '@/types/database';
import { useWorkspace } from '@/app/workspace-context';
import { PageHeader, EmptyState } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { TaskList } from '@/features/tasks/task-list';
import { TaskFilters } from '@/features/tasks/task-filters';
import { initialFilters } from '@/features/tasks/filter-state';
import { filterTasks } from '@/features/tasks/filter-tasks';
import { TaskForm } from '@/features/tasks/task-form';
import {
  saveSection,
  deleteSection,
  reorderSections,
} from '@/features/tasks/queries';
import { text } from '@/lib/data-client';
export function AllTasksPage() {
  const bundle = useOutletContext<ProjectBundle>();
  const { mutate, pending } = useWorkspace();
  const [filters, setFilters] = useState(initialFilters);
  const [taskSection, setTaskSection] = useState<string | null>(null);
  const [section, setSection] = useState<SectionRow | 'new' | null>(null);
  const visible = filterTasks(bundle.tasks, filters);
  const projectId = bundle.project.id;
  async function move(index: number, delta: number) {
    const ids = bundle.sections.map((s) => s.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    await mutate(() => reorderSections(projectId, ids), 'Sections reordered.');
  }
  return (
    <>
      <PageHeader
        title="All Tasks"
        description={`${bundle.project.name} · Shared work for the whole team.`}
      >
        <Button variant="outline" onClick={() => setSection('new')}>
          Add section
        </Button>
        <Button
          disabled={!bundle.sections.length}
          onClick={() => setTaskSection(bundle.sections[0].id)}
        >
          Add task
        </Button>
      </PageHeader>
      <TaskFilters
        value={filters}
        onChange={setFilters}
        members={bundle.members}
      />
      {!bundle.sections.length && (
        <EmptyState title="No sections yet">
          Add a section to organize this project’s tasks.
        </EmptyState>
      )}
      {bundle.sections.map((s, index) => (
        <section className="list-section" key={s.id}>
          <div className="section-heading">
            <h2>
              {s.name}{' '}
              <span className="count">
                {visible.filter((t) => t.section_id === s.id).length}
              </span>
            </h2>
            <div className="inline-actions">
              <Button variant="ghost" onClick={() => setTaskSection(s.id)}>
                Add task
              </Button>
              <Button variant="ghost" onClick={() => setSection(s)}>
                Rename
              </Button>
              <Button
                variant="ghost"
                disabled={pending || index === 0}
                aria-label={`Move ${s.name} up`}
                onClick={() => void move(index, -1)}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                disabled={pending || index === bundle.sections.length - 1}
                aria-label={`Move ${s.name} down`}
                onClick={() => void move(index, 1)}
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  const count = bundle.tasks.filter(
                    (t) => t.section_id === s.id,
                  ).length;
                  if (
                    window.confirm(
                      `Delete “${s.name}” and its ${count} task(s), including steps and resources? This cannot be undone.`,
                    )
                  )
                    void mutate(
                      () => deleteSection(projectId, s.id),
                      'Section deleted.',
                    );
                }}
              >
                Delete
              </Button>
            </div>
          </div>
          <TaskList
            tasks={visible.filter((t) => t.section_id === s.id)}
            members={bundle.members}
          />
        </section>
      ))}
      {taskSection && (
        <TaskForm
          bundle={bundle}
          sectionId={taskSection}
          onClose={() => setTaskSection(null)}
        />
      )}
      {section && (
        <Modal
          title={section === 'new' ? 'New section' : 'Rename section'}
          onClose={() => setSection(null)}
        >
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (
                await mutate(
                  () =>
                    saveSection(
                      projectId,
                      {
                        name: text(form.get('name'), 120, true),
                        position:
                          section === 'new'
                            ? Math.max(
                                -1,
                                ...bundle.sections.map((s) => s.position),
                              ) + 1
                            : section.position,
                      },
                      section === 'new' ? undefined : section.id,
                    ),
                  'Section saved.',
                )
              )
                setSection(null);
            }}
          >
            <label>
              Section name
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={section === 'new' ? '' : section.name}
              />
            </label>
            <Button disabled={pending}>Save section</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
