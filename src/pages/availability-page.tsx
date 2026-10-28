import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { ProjectBundle, SlotRow } from '@/types/database';
import { useAuth } from '@/features/auth/auth-context';
import { useWorkspace } from '@/app/workspace-context';
import { useRemote } from '@/app/use-remote';
import {
  loadSlots,
  saveSlot,
  deleteSlot,
  commonAvailability,
} from '@/features/availability/queries';
import { PageHeader } from '@/components/ui/page-header';
import { RemoteState } from '@/components/ui/remote-state';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { startOfWeek, toLocalInput, toInstant } from '@/lib/local-dates';
import { TeamCalendar } from '@/features/calendar/team-calendar';
import { Link } from 'react-router-dom';
export function AvailabilityPage() {
  const bundle = useOutletContext<ProjectBundle>();
  return (
    <>
      <PageHeader
        title="Availability"
        description="Busy time and potentially available periods for selected project members."
      >
        <Button asChild>
          <Link to="/calendar">Manage my busy events</Link>
        </Button>
      </PageHeader>
      <TeamCalendar key={bundle.project.id} bundle={bundle} />
      <details className="list-section">
        <summary>Previously recorded free-time slots</summary>
        <p className="helper">
          These explicit project free-time records are preserved separately.
          They do not override Busy events or determine Suggested Availability.
        </p>
        <LegacyAvailability />
      </details>
    </>
  );
}
function LegacyAvailability() {
  const bundle = useOutletContext<ProjectBundle>();
  const { session } = useAuth();
  const { revision, refresh, mutate, pending } = useWorkspace();
  const [week, setWeek] = useState(() => startOfWeek());
  const [member, setMember] = useState('all');
  const [participants, setParticipants] = useState<string[]>([]);
  const [editor, setEditor] = useState<SlotRow | 'new' | null>(null);
  const [formError, setFormError] = useState('');
  const end = new Date(week.getFullYear(), week.getMonth(), week.getDate() + 7);
  const state = useRemote(
    `${bundle.project.id}:${week.toISOString()}:${revision}`,
    () => loadSlots(bundle.project.id, week.toISOString(), end.toISOString()),
  );
  const slots = state.data ?? [];
  const overlap = commonAvailability(
    slots,
    participants,
    week.getTime(),
    end.getTime(),
  );
  const change = (n: number) =>
    setWeek(
      new Date(week.getFullYear(), week.getMonth(), week.getDate() + n * 7),
    );
  const time = (v: Date) =>
    v.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return (
    <>
      <PageHeader
        title="Recorded free time"
        description={`${bundle.project.name} · Free time, separate from task deadlines.`}
      >
        <Button
          onClick={() => {
            setFormError('');
            setEditor('new');
          }}
        >
          Add my availability
        </Button>
      </PageHeader>
      <div className="calendar-toolbar">
        <div className="month-controls">
          <Button
            variant="outline"
            aria-label="Previous week"
            onClick={() => change(-1)}
          >
            ←
          </Button>
          <h2>
            {week.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}{' '}
            –{' '}
            {new Date(end.getTime() - 1).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </h2>
          <Button
            variant="outline"
            aria-label="Next week"
            onClick={() => change(1)}
          >
            →
          </Button>
        </div>
        <Button variant="ghost" onClick={() => setWeek(startOfWeek())}>
          This week
        </Button>
      </div>
      <div className="toolbar">
        <select
          aria-label="Filter availability by member"
          value={member}
          onChange={(e) => setMember(e.target.value)}
        >
          <option value="all">All members</option>
          {bundle.members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.display_name}
            </option>
          ))}
        </select>
        <span className="helper">
          {Intl.DateTimeFormat().resolvedOptions().timeZone} · Start inclusive,
          end exclusive
        </span>
      </div>
      {state.data ? (
        <>
          <div
            className="calendar-scroll"
            role="region"
            aria-label="Team availability calendar"
            tabIndex={0}
          >
            <div className="availability-grid">
              {Array.from({ length: 7 }, (_, i) => {
                const day = new Date(
                    week.getFullYear(),
                    week.getMonth(),
                    week.getDate() + i,
                  ),
                  next = new Date(
                    week.getFullYear(),
                    week.getMonth(),
                    week.getDate() + i + 1,
                  );
                const items = slots.filter(
                  (s) =>
                    (member === 'all' || s.user_id === member) &&
                    Date.parse(s.starts_at) < next.getTime() &&
                    Date.parse(s.ends_at) > day.getTime(),
                );
                return (
                  <section key={i}>
                    <h2>
                      {day.toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </h2>
                    {items.length ? (
                      items.map((s) => {
                        const own = s.user_id === session!.user.id;
                        const from = new Date(
                            Math.max(day.getTime(), Date.parse(s.starts_at)),
                          ),
                          to = new Date(
                            Math.min(next.getTime(), Date.parse(s.ends_at)),
                          );
                        return (
                          <div className="availability-slot" key={s.id}>
                            <strong>
                              {
                                bundle.members.find(
                                  (m) => m.user_id === s.user_id,
                                )?.display_name
                              }
                            </strong>
                            <span>
                              {time(from)}–
                              {to.getTime() === next.getTime()
                                ? 'End of Day'
                                : time(to)}
                            </span>
                            {own && (
                              <div className="slot-actions">
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    setFormError('');
                                    setEditor(s);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  disabled={pending}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        'Delete this entire availability range, including any overnight portion?',
                                      )
                                    )
                                      void mutate(
                                        () =>
                                          deleteSlot(
                                            bundle.project.id,
                                            session!.user.id,
                                            s.id,
                                          ),
                                        'Availability deleted.',
                                      );
                                  }}
                                >
                                  Delete
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <span className="muted">No free time recorded</span>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
          <section className="list-section">
            <h2>Shared recorded free time</h2>
            <p className="helper">
              Choose at least two members. Missing slots mean availability is
              unknown.
            </p>
            <div className="participant-controls">
              {bundle.members.map((m) => (
                <label key={m.user_id}>
                  <input
                    type="checkbox"
                    checked={participants.includes(m.user_id)}
                    onChange={(e) =>
                      setParticipants(
                        e.target.checked
                          ? [...participants, m.user_id]
                          : participants.filter((id) => id !== m.user_id),
                      )
                    }
                  />
                  {m.display_name}
                </label>
              ))}
            </div>
            {participants.length >= 2 &&
              (overlap.length ? (
                <ul className="overlap-list">
                  {overlap.map(([a, b]) => (
                    <li key={`${a}-${b}`}>
                      {new Date(a).toLocaleString()} –{' '}
                      {new Date(b).toLocaleString()}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No shared free time in this week.</p>
              ))}
          </section>
        </>
      ) : (
        <RemoteState state={state} retry={refresh} />
      )}
      {editor && (
        <Modal
          title={editor === 'new' ? 'Add availability' : 'Edit availability'}
          onClose={() => setEditor(null)}
        >
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              let start: string, end: string;
              try {
                start = toInstant(String(form.get('start') ?? '')) ?? '';
                end = toInstant(String(form.get('end') ?? '')) ?? '';
                if (!start || !end || Date.parse(start) >= Date.parse(end))
                  throw new Error(
                    'End must be after start. Select the following date for overnight availability.',
                  );
              } catch (err) {
                setFormError((err as Error).message);
                return;
              }
              if (
                await mutate(
                  () =>
                    saveSlot(
                      bundle.project.id,
                      session!.user.id,
                      start,
                      end,
                      editor === 'new' ? undefined : editor.id,
                    ),
                  'Availability saved.',
                )
              ) {
                setEditor(null);
                setWeek(startOfWeek(new Date(start)));
              }
            }}
          >
            <label>
              Available from (local)
              <input
                name="start"
                type="datetime-local"
                required
                defaultValue={
                  editor === 'new' ? '' : toLocalInput(editor.starts_at)
                }
              />
            </label>
            <label>
              Available until (local)
              <input
                name="end"
                type="datetime-local"
                required
                defaultValue={
                  editor === 'new' ? '' : toLocalInput(editor.ends_at)
                }
              />
            </label>
            <p>
              For overnight free time, choose the following date for the end.
              Only your own ranges can be changed.
            </p>
            {formError && <p role="alert">{formError}</p>}
            <Button disabled={pending}>Save availability</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
