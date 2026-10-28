import { Link } from 'react-router-dom';
import { Circle, CircleCheck } from 'lucide-react';
import type { TaskRow } from '@/types/database';
import { priorityLabels, statusLabels } from '@/features/tasks/queries';
export function CalendarTaskItem({
  task,
  timeOnly = false,
}: {
  task: TaskRow;
  timeOnly?: boolean;
}) {
  const done = task.status === 'done',
    overdue = !done && !!task.due_at && Date.parse(task.due_at) < Date.now();
  const Icon = done ? CircleCheck : Circle;
  return (
    <div
      className={`schedule-task ${done ? 'is-complete' : overdue ? 'is-overdue' : 'is-upcoming'}`}
    >
      <Icon size={16} aria-hidden="true" />
      <div>
        <Link to={`/projects/${task.project_id}/tasks/${task.id}`}>
          {task.title}
        </Link>
        <span className="schedule-task-meta">
          {statusLabels[task.status]} · {priorityLabels[task.priority]} ·{' '}
          {task.due_at
            ? timeOnly
              ? new Date(task.due_at).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : new Date(task.due_at).toLocaleString()
            : 'No deadline'}
          {overdue ? ' · Overdue' : ''}
        </span>
      </div>
    </div>
  );
}
