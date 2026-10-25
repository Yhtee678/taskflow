import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { Project } from '@/types/domain';
import { tasks } from '@/features/tasks/mock-data';
import { PageHeader, EmptyState } from '@/components/ui/page-header';
import { TaskList } from '@/features/tasks/task-list';
import { TaskFilters } from '@/features/tasks/task-filters';
import { Button } from '@/components/ui/button';
export function AllTasksPage() {
  const project = useOutletContext<Project>();
  const [status, setStatus] = useState('all');
  const [person, setPerson] = useState('all');
  const [search, setSearch] = useState('');
  const visible = tasks.filter(
    (t) =>
      t.projectId === project.id &&
      (status === 'all' || t.status === status) &&
      (person === 'all' || (t.assignee ?? 'unassigned') === person) &&
      t.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="All Tasks"
        description={`${project.name} · Shared work for the whole team.`}
      >
        <Button disabled title="Task creation is deferred">
          Add task
        </Button>
      </PageHeader>
      <TaskFilters
        {...{ status, setStatus, person, setPerson, search, setSearch }}
      />
      {visible.length ? (
        [...new Set(visible.map((t) => t.section))].map((section) => (
          <section className="list-section" key={section}>
            <h2>
              {section}
              <span className="count">
                {visible.filter((t) => t.section === section).length}
              </span>
            </h2>
            <TaskList tasks={visible.filter((t) => t.section === section)} />
          </section>
        ))
      ) : (
        <EmptyState />
      )}
    </>
  );
}
