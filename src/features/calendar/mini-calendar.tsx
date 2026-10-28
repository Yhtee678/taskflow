import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-context';
import { useWorkspace } from '@/app/workspace-context';
import { useRemote } from '@/app/use-remote';
import type { TaskRow } from '@/types/database';
import { loadPersonalCalendar } from './queries';
import { monthWindow, overlaps, localDay } from './intervals';
import { MonthGrid } from './month-grid';
import { DayPeriods } from './day-periods';
import { CalendarTaskItem } from './calendar-task-item';
import { RemoteState } from '@/components/ui/remote-state';
import { Button } from '@/components/ui/button';
export interface PersonalScheduleSnapshot {
  data: Awaited<ReturnType<typeof loadPersonalCalendar>> | null;
  loading: boolean;
  error: Error | null;
  from: string;
  until: string;
}
export function MiniCalendar({
  tasks,
  onScheduleChange,
}: {
  tasks: TaskRow[];
  onScheduleChange?: (state: PersonalScheduleSnapshot) => void;
}) {
  const { session } = useAuth();
  const { revision, refresh } = useWorkspace();
  const [selected, setSelected] = useState(() => localDay());
  const [month, setMonth] = useState(() => new Date());
  const today = localDay(),
    tomorrow = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );
  const window = monthWindow(month);
  // One existing personal-calendar query supplies both previews. Include today
  // when navigating other months so today's availability stays accurate.
  const start = new Date(Math.min(window.start.getTime(), today.getTime())),
    end = new Date(Math.max(window.end.getTime(), tomorrow.getTime()));
  const state = useRemote(
    `mini:${session!.user.id}:${start.toISOString()}:${end.toISOString()}:${revision}`,
    () =>
      loadPersonalCalendar(
        session!.user.id,
        start.toISOString(),
        end.toISOString(),
      ),
  );
  const data = state.data;
  const { loading, error } = state;
  const from = start.toISOString(),
    until = end.toISOString();
  useEffect(() => {
    onScheduleChange?.({ data, loading, error, from, until });
  }, [onScheduleChange, data, loading, error, from, until]);
  const mine = tasks.filter(
    (t) => t.assignee_id === session!.user.id && t.due_at,
  );
  const next = new Date(
    selected.getFullYear(),
    selected.getMonth(),
    selected.getDate() + 1,
  );
  const events = (data?.occurrences ?? []).filter((o) =>
    overlaps(o.starts_at, o.ends_at, selected, next),
  );
  const deadlines = mine.filter(
    (t) => new Date(t.due_at!).toDateString() === selected.toDateString(),
  );
  const upcoming = (data?.occurrences ?? [])
    .filter((o) => Date.parse(o.ends_at) > Date.now())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const assigned = mine
    .filter((t) => t.status !== 'done')
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!))
    .slice(0, 3);
  const change = (n: number) => {
    const date = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(date);
    setSelected(date);
  };
  return (
    <div className="my-tasks-sidebar">
      <aside className="mini-calendar" aria-label="Dashboard calendar">
        <div className="mini-calendar-heading">
          <h2>
            {month.toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <div>
            <Button
              variant="ghost"
              aria-label="Previous mini calendar month"
              onClick={() => change(-1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="ghost"
              aria-label="Next mini calendar month"
              onClick={() => change(1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
        {data ? (
          <>
            <MonthGrid
              compact
              month={month}
              selected={selected}
              onSelect={setSelected}
              renderDay={(day) => {
                const end = new Date(
                  day.getFullYear(),
                  day.getMonth(),
                  day.getDate() + 1,
                );
                const busy = data.occurrences.some((o) =>
                  overlaps(o.starts_at, o.ends_at, day, end),
                );
                const deadline = mine.some(
                  (t) =>
                    new Date(t.due_at!).toDateString() === day.toDateString(),
                );
                return (
                  <span className="date-markers">
                    {busy && (
                      <span
                        aria-label="Personal busy events"
                        className="busy-dot"
                      />
                    )}
                    {deadline && (
                      <span
                        aria-label="Task deadlines"
                        className="deadline-dot"
                      />
                    )}
                  </span>
                );
              }}
            />
            <section
              className={`mini-calendar-section${!events.length && !deadlines.length ? ' is-empty' : ''}`}
              aria-label="Selected date"
            >
              <h3>
                {selected.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </h3>
              {events.length > 0 && (
                <ul className="mini-agenda">
                  {events.map((o) => (
                    <li
                      key={`${o.event_id}-${o.starts_at}`}
                      className="mini-busy-event"
                    >
                      <Circle size={12} aria-hidden="true" />
                      <span>
                        <strong>
                          {data.events.find((e) => e.id === o.event_id)?.title}
                        </strong>
                        <span className="schedule-task-meta">
                          Busy ·{' '}
                          {new Date(o.starts_at).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {deadlines.length > 0 && (
                <ul className="mini-agenda">
                  {deadlines.map((t) => (
                    <li key={t.id}>
                      <CalendarTaskItem task={t} timeOnly />
                    </li>
                  ))}
                </ul>
              )}
              {!events.length && !deadlines.length && (
                <p className="empty-dash">—</p>
              )}
            </section>
            <section
              className={`mini-calendar-section${!upcoming.length ? ' is-empty empty-upcoming' : ''}`}
              aria-label="Upcoming personal events"
            >
              <h3>Upcoming personal events</h3>
              {upcoming.length ? (
                <ul className="mini-agenda">
                  {upcoming.slice(0, 3).map((o) => (
                    <li key={`${o.event_id}-${o.starts_at}`}>
                      <strong>
                        {data.events.find((e) => e.id === o.event_id)?.title}
                      </strong>
                      <span className="schedule-task-meta">
                        {new Date(o.starts_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-dash">—</p>
              )}
            </section>
            <section
              className={`mini-calendar-section${!assigned.length ? ' is-empty empty-upcoming' : ''}`}
              aria-label="Upcoming assigned deadlines"
            >
              <h3>Upcoming assigned deadlines</h3>
              {assigned.length ? (
                <ul className="mini-agenda">
                  {assigned.map((t) => (
                    <li key={t.id}>
                      <CalendarTaskItem task={t} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-dash">—</p>
              )}
            </section>
          </>
        ) : (
          <RemoteState state={state} retry={refresh} />
        )}
        <div className="mini-calendar-section">
          <Link to="/calendar" aria-label="Open full Calendar">
            Open full Calendar →
          </Link>
        </div>
      </aside>
      <aside className="availability-preview" aria-label="My Availability">
        <h2>My Availability</h2>
        <p>
          Today ·{' '}
          {today.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </p>
        {data ? (
          data.occurrences.some((o) =>
            overlaps(o.starts_at, o.ends_at, today, tomorrow),
          ) ? (
            <DayPeriods day={today} periods={data.occurrences} stacked />
          ) : (
            <div className="availability-preview-empty">
              <strong>Potentially Available</strong>
              <p>No busy events recorded today</p>
            </div>
          )
        ) : (
          <RemoteState state={state} retry={refresh} />
        )}
        <Link to="/calendar">View full Calendar →</Link>
      </aside>
    </div>
  );
}
