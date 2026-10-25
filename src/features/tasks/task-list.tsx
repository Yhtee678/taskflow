import { Link } from 'react-router-dom';
import { Circle, CircleCheck, CircleDot } from 'lucide-react';
import type { Task } from '@/types/domain';
import { projects, people } from '@/features/projects/mock-data';
import { statusLabels } from './mock-data';
import { deadline } from '@/lib/dates';
import { EmptyState } from '@/components/ui/page-header';
export function TaskList({
  tasks,
  showProject = false,
}: {
  tasks: Task[];
  showProject?: boolean;
}) {
  if (!tasks.length) return <EmptyState />;
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label="Task table"
      tabIndex={0}
    >
      <table className="task-table">
        <thead>
          <tr>
            <th scope="col">Task name</th>
            {showProject && <th scope="col">Project</th>}
            <th scope="col">Assignee</th>
            <th scope="col">Status</th>
            <th scope="col">Deadline</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const person = people.find((p) => p.id === task.assignee);
            const Icon =
              task.status === 'done'
                ? CircleCheck
                : task.status === 'in_progress'
                  ? CircleDot
                  : Circle;
            return (
              <tr key={task.id}>
                <td>
                  <Link
                    className="task-title"
                    to={`/projects/${task.projectId}/tasks/${task.id}`}
                  >
                    <Icon size={17} className={task.status} />
                    <span>{task.title}</span>
                  </Link>
                </td>
                {showProject && (
                  <td>
                    <Link
                      className="subtle-link"
                      to={`/projects/${task.projectId}/overview`}
                    >
                      {projects.find((p) => p.id === task.projectId)?.name}
                    </Link>
                  </td>
                )}
                <td>
                  {person ? (
                    <span className="person">
                      <span className="avatar small">{person.initials}</span>
                      {person.name}
                    </span>
                  ) : (
                    <span className="muted">Unassigned</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${task.status}`}>
                    {statusLabels[task.status]}
                  </span>
                </td>
                <td className="date-cell">{deadline(task.due)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
