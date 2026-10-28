import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BusyEventRow, ProjectBundle } from '@/types/database';
import { useAuth } from '@/features/auth/auth-context';
import { useWorkspace } from '@/app/workspace-context';
import { useRemote } from '@/app/use-remote';
import {
  loadMyTasks,
  priorityLabels,
  statusLabels,
} from '@/features/tasks/queries';
import { PageHeader } from '@/components/ui/page-header';
import { RemoteState } from '@/components/ui/remote-state';
import { Button } from '@/components/ui/button';
import { BusyEventForm } from './busy-event-form';
import { categories, deleteBusyEvent, loadPersonalCalendar } from './queries';
import { monthWindow, overlaps, localDay } from './intervals';
import { DayPeriods } from './day-periods';
import { MonthGrid } from './month-grid';
import { SelectedProjectContext } from '@/components/layout/project-context';
import { CalendarTaskItem } from './calendar-task-item';
import { eventTimeLabel } from './schedule-time';
export function CalendarView({ bundle }: { bundle?: ProjectBundle }) {
  const { session } = useAuth();
  const project = useContext(SelectedProjectContext);
  const { revision, refresh, mutate, pending } = useWorkspace();
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => localDay());
  const [mine, setMine] = useState(false);
  const [editor, setEditor] = useState<BusyEventRow | 'new' | null>(null);
  const rangeWindow = monthWindow(month);
  const state = useRemote(
    `${session!.user.id}:${bundle?.project.id ?? 'personal'}:${rangeWindow.start.toISOString()}:${revision}`,
    async () => {
      const [personal, tasks] = await Promise.all([
        loadPersonalCalendar(
          session!.user.id,
          rangeWindow.start.toISOString(),
          rangeWindow.end.toISOString(),
        ),
        bundle ? Promise.resolve(bundle.tasks) : loadMyTasks(session!.user.id),
      ]);
      return { ...personal, tasks };
    },
  );
  const data = state.data;
  const visible = (data?.tasks ?? []).filter(
    (t) => !bundle || !mine || t.assignee_id === session!.user.id,
  );
  const next = new Date(
    selected.getFullYear(),
    selected.getMonth(),
    selected.getDate() + 1,
  );
  const occurrences = (data?.occurrences ?? []).filter((o) =>
    overlaps(o.starts_at, o.ends_at, selected, next),
  );
  const deadlines = visible.filter(
    (t) =>
      t.due_at && new Date(t.due_at).toDateString() === selected.toDateString(),
  );
  const change = (n: number) => {
    const d = new Date(month.getFullYear(), month.getMonth() + n, 1);
    setMonth(d);
    setSelected(d);
  };
  const ownEvents = data?.events ?? [];
  const eventActions = (event: BusyEventRow) => (
    <div className="slot-actions">
      <Button variant="ghost" onClick={() => setEditor(event)}>
        Edit {event.recurrence === 'none' ? 'event' : 'series'}
      </Button>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (
            window.confirm(
              `Delete ${event.recurrence === 'none' ? 'this event' : 'the entire recurring series'}?`,
            )
          )
            void mutate(
              () => deleteBusyEvent(session!.user.id, event.id),
              'Busy event deleted.',
            );
        }}
      >
        Delete {event.recurrence === 'none' ? 'event' : 'series'}
      </Button>
    </div>
  );
  function eventDetails(
    event: BusyEventRow,
    period: { starts_at: string; ends_at: string } = event,
    fullDate = false,
  ) {
    return (
      <>
        <strong>{event.title}</strong>
        <span>
          {categories[event.category]} ·{' '}
          {event.recurrence === 'none'
            ? 'Does not repeat'
            : `Repeats ${event.recurrence}`}{' '}
          · {event.time_zone}
        </span>
        <span className="event-time">
          {fullDate
            ? `${new Date(period.starts_at).toLocaleString()} – ${new Date(period.ends_at).toLocaleString()}`
            : eventTimeLabel(period.starts_at, period.ends_at)}
        </span>
        {event.description && <p className="plain-copy">{event.description}</p>}
        {eventActions(event)}
      </>
    );
  }
  const reminders = (data?.tasks ?? [])
    .filter((t) => t.assignee_id === session!.user.id && t.status !== 'done')
    .sort((a, b) => {
      const rank = { high: 0, normal: 1, low: 2 };
      return (
        (a.due_at ? Date.parse(a.due_at) : Infinity) -
          (b.due_at ? Date.parse(b.due_at) : Infinity) ||
        rank[a.priority] - rank[b.priority]
      );
    });
  return (
    <>
      <PageHeader
        title="Calendar"
        description={
          bundle
            ? `${bundle.project.name} deadlines and your personal busy time.`
            : 'Your personal busy time, suggested availability and assigned task deadlines.'
        }
      >
        {bundle && (
          <Button asChild variant="outline">
            <Link to="/calendar">Personal Calendar</Link>
          </Button>
        )}
        {!bundle && project && (
          <Button asChild variant="outline">
            <Link to={`/calendar?project=${project.id}`}>
              Project deadlines
            </Link>
          </Button>
        )}
        <Button onClick={() => setEditor('new')}>Add busy event</Button>
      </PageHeader>
      <p className="helper">
        Busy events are personal. Teammates see only Busy ranges in Team
        Availability. Task deadlines never block time. Unrecorded time is not
        confirmed free.
      </p>
      <div className="calendar-toolbar">
        <div className="month-controls">
          <Button
            variant="outline"
            aria-label="Previous month"
            onClick={() => change(-1)}
          >
            ←
          </Button>
          <h2>
            {month.toLocaleDateString(undefined, {
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <Button
            variant="outline"
            aria-label="Next month"
            onClick={() => change(1)}
          >
            →
          </Button>
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setMonth(new Date());
            setSelected(localDay());
          }}
        >
          Today
        </Button>
        {bundle && (
          <div className="segmented" aria-label="Deadline scope">
            <Button
              variant={!mine ? 'default' : 'ghost'}
              aria-pressed={!mine}
              onClick={() => setMine(false)}
            >
              All tasks
            </Button>
            <Button
              variant={mine ? 'default' : 'ghost'}
              aria-pressed={mine}
              onClick={() => setMine(true)}
            >
              My tasks
            </Button>
          </div>
        )}
      </div>
      {data ? (
        <>
          <MonthGrid
            month={month}
            selected={selected}
            onSelect={setSelected}
            renderDay={(day) => {
              const dayEnd = new Date(
                day.getFullYear(),
                day.getMonth(),
                day.getDate() + 1,
              );
              const busy = data.occurrences.filter((o) =>
                overlaps(o.starts_at, o.ends_at, day, dayEnd),
              );
              return (
                <>
                  {busy.length > 0 && (
                    <span className="busy-marker">Busy · {busy.length}</span>
                  )}
                  {visible
                    .filter(
                      (t) =>
                        t.due_at &&
                        new Date(t.due_at).toDateString() ===
                          day.toDateString(),
                    )
                    .map((t) => (
                      <Link
                        key={t.id}
                        aria-label={t.title}
                        className={`calendar-task ${t.status}`}
                        to={`/projects/${t.project_id}/tasks/${t.id}`}
                      >
                        {t.title}
                        <small>
                          {new Date(t.due_at!).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          · {statusLabels[t.status]} ·{' '}
                          {priorityLabels[t.priority]}
                        </small>
                      </Link>
                    ))}
                </>
              );
            }}
          />
          <section className="list-section" aria-label="Selected date details">
            <h2>
              {selected.toLocaleDateString(undefined, { dateStyle: 'full' })}
            </h2>
            <div className="daily-schedule">
              <section
                className="schedule-section"
                aria-label="Suggested Availability"
              >
                <h3>Suggested Availability</h3>
                <DayPeriods day={selected} periods={occurrences} stacked />
              </section>
              <section className="schedule-section" aria-label="My busy events">
                <h3>My busy events</h3>
                {!occurrences.length && <p className="empty-dash">—</p>}
                {occurrences.map((o) => {
                  const event = ownEvents.find((e) => e.id === o.event_id);
                  return event ? (
                    <article
                      className="busy-event-details"
                      key={`${o.event_id}-${o.starts_at}`}
                    >
                      {eventDetails(event, o)}
                    </article>
                  ) : null;
                })}
              </section>
              <section className="schedule-section" aria-label="Task deadlines">
                <h3>Task deadlines</h3>
                {deadlines.length ? (
                  <ul className="schedule-task-list">
                    {deadlines.map((t) => (
                      <li key={t.id}>
                        <CalendarTaskItem task={t} timeOnly />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="empty-dash">—</p>
                )}
              </section>
            </div>
          </section>
          <section
            className="list-section schedule-section"
            aria-label="Assigned work to complete"
          >
            <h2>Assigned work to complete</h2>
            <p className="helper">
              Incomplete tasks assigned to you, with overdue and nearest
              deadlines first. These reminders do not reserve time.
            </p>
            {reminders.length ? (
              <ul className="schedule-task-list">
                {reminders.map((t) => (
                  <li key={t.id}>
                    <CalendarTaskItem task={t} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-dash">—</p>
            )}
          </section>
          <details className="list-section">
            <summary>
              Manage all my busy events and series ({ownEvents.length})
            </summary>
            {ownEvents.length ? (
              ownEvents.map((e) => (
                <article key={e.id} className="busy-event-details">
                  {eventDetails(e, e, true)}
                </article>
              ))
            ) : (
              <p>
                No busy events recorded. Add one to see suggested availability.
              </p>
            )}
          </details>
        </>
      ) : (
        <RemoteState state={state} retry={refresh} />
      )}
      {editor && (
        <BusyEventForm
          event={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
