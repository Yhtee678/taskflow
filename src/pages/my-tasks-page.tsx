import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { tasks } from '@/features/tasks/mock-data';
import { currentUser } from '@/features/projects/mock-data';
import { TaskList } from '@/features/tasks/task-list';
import { TaskFilters } from '@/features/tasks/task-filters';
export function MyTasksPage() {
  const [status, setStatus] = useState('all');
  const [project, setProject] = useState('all');
  const [search, setSearch] = useState('');
  const visible = tasks.filter(
    (t) =>
      t.assignee === currentUser &&
      (status === 'all' || t.status === status) &&
      (project === 'all' || t.projectId === project) &&
      t.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="My Tasks"
        description="Your assigned work across all projects."
      />
      <TaskFilters
        {...{ status, setStatus, project, setProject, search, setSearch }}
      />
      <section className="list-section">
        <h2>
          Assigned to me <span className="count">{visible.length}</span>
        </h2>
        <TaskList tasks={visible} showProject />
      </section>
    </>
  );
}
