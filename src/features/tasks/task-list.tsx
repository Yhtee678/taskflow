import { Link } from 'react-router-dom';
import { Circle, CircleCheck, CircleDot } from 'lucide-react';
import type { TaskRow, Member } from '@/types/database';
import { useWorkspace } from '@/app/workspace-context';
import { statusLabels, priorityLabels } from './queries';
import { deadline } from '@/lib/dates';
import { EmptyState } from '@/components/ui/page-header';
export function TaskList({
  tasks,
  members = [],
  showProject = false,
  onToggleCompletion,
  completionPending,
}: {
  tasks: (TaskRow & { section_name?: string })[];
  members?: Member[];
  showProject?: boolean;
  onToggleCompletion?: (task: TaskRow) => void;
  completionPending?: ReadonlySet<string>;
}) {
  const { catalog, pending } = useWorkspace();
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
            {showProject && <th scope="col">Section</th>}
            <th scope="col">Assignee</th>
            <th scope="col">Status</th>
            <th scope="col">Priority</th>
            <th scope="col">Deadline</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const person = members.find((m) => m.user_id === task.assignee_id);
            const Icon =
              task.status === 'done'
                ? CircleCheck
                : task.status === 'in_progress'
                  ? CircleDot
                  : Circle;
            return (
              <tr key={task.id}>
                <td>
                  {onToggleCompletion ? (
                    <div className="task-title-cell">
                      <button
                        type="button"
                        className={`completion-toggle ${task.status}`}
                        aria-label={`Mark ${task.title} as ${task.status === 'done' ? 'to do' : 'done'}`}
                        aria-pressed={task.status === 'done'}
                        disabled={pending || completionPending?.has(task.id)}
                        onClick={() => onToggleCompletion(task)}
                      >
                        {task.status === 'done' ? (
                          <CircleCheck size={19} />
                        ) : (
                          <Circle size={19} />
                        )}
                      </button>
                      <Link
                        className="task-title"
                        to={`/projects/${task.project_id}/tasks/${task.id}`}
                      >
                        <span>{task.title}</span>
                      </Link>
                    </div>
                  ) : (
                    <Link
                      className="task-title"
                      to={`/projects/${task.project_id}/tasks/${task.id}`}
                    >
                      <Icon size={17} className={task.status} />
                      <span>{task.title}</span>
                    </Link>
                  )}
                </td>
                {showProject && (
                  <td>
                    <Link
                      className="subtle-link"
                      to={`/projects/${task.project_id}/overview`}
                    >
                      {catalog.data!.projects.find(
                        (p) => p.id === task.project_id,
                      )?.name ?? 'Project'}
                    </Link>
                  </td>
                )}
                {showProject && <td>{task.section_name ?? 'Section'}</td>}
                <td>
                  {showProject ? 'You' : (person?.display_name ?? 'Unassigned')}
                </td>
                <td>
                  <span className={`badge ${task.status}`}>
                    {statusLabels[task.status]}
                  </span>
                </td>
                <td>{priorityLabels[task.priority]}</td>
                <td className="date-cell">{deadline(task.due_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
