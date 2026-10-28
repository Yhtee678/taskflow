import type { TaskRow } from '@/types/database';
import type { PersonalScheduleSnapshot } from '@/features/calendar/mini-calendar';
import { myTasksBannerState } from './banner-state';
export function MyTasksBanner({
  tasks,
  taskError,
  schedule,
  now,
}: {
  tasks: TaskRow[] | null;
  taskError: Error | null;
  schedule: PersonalScheduleSnapshot | null;
  now: Date;
}) {
  const state = myTasksBannerState(tasks, schedule, now);
  return (
    <section
      className={`my-tasks-banner ${state.kind}`}
      aria-label="Current time and task summary"
    >
      <div className="banner-content">
        <div className="banner-date">
          <time dateTime={now.toISOString()}>
            {now.toLocaleDateString(undefined, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        </div>
        <div className="banner-message">
          <strong>
            {taskError
              ? 'Assigned work is unavailable. Refresh to try again.'
              : state.message}
          </strong>
        </div>
        {!taskError && state.pending !== null && (
          <p>
            {state.overdue > 0 &&
              `${state.overdue} overdue task${state.overdue === 1 ? '' : 's'} · `}
            {state.pending
              ? `${state.pending} task${state.pending === 1 ? '' : 's'} remaining`
              : 'No pending assigned tasks.'}
            {state.next &&
              ` · Next deadline: ${new Date(state.next.due_at!).toLocaleString()}`}
          </p>
        )}
      </div>
      <div className="banner-clock">
        <time dateTime={now.toISOString()}>
          {now.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </time>
        <span
          className="banner-availability"
          data-availability={state.availability}
          aria-live="polite"
        >
          {state.availability}
        </span>
      </div>
    </section>
  );
}
