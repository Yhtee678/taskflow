import { useState } from 'react';
import { useWorkspace } from '@/app/workspace-context';
import { useRemote } from '@/app/use-remote';
import type { ProjectBundle } from '@/types/database';
import { loadTeamBusy } from './queries';
import { commonPotential, rangeLabel } from './intervals';
import { DayPeriods } from './day-periods';
import { startOfWeek } from '@/lib/local-dates';
import { Button } from '@/components/ui/button';
import { RemoteState } from '@/components/ui/remote-state';
export function TeamCalendar({ bundle }: { bundle: ProjectBundle }) {
  const { revision, refresh } = useWorkspace();
  const [week, setWeek] = useState(() => startOfWeek());
  // null means every current member, including members added after a refresh.
  const [chosen, setChosen] = useState<string[] | null>(null);
  const participants = bundle.members.filter(
    (m) => chosen === null || chosen.includes(m.user_id),
  );
  const [dayIndex, setDayIndex] = useState(0);
  const end = new Date(week.getFullYear(), week.getMonth(), week.getDate() + 7);
  const state = useRemote(
    `${bundle.project.id}:${week.toISOString()}:${revision}`,
    () =>
      loadTeamBusy(bundle.project.id, week.toISOString(), end.toISOString()),
  );
  const data = state.data;
  const day = new Date(
    week.getFullYear(),
    week.getMonth(),
    week.getDate() + dayIndex,
  );
  const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  const change = (n: number) =>
    setWeek(
      new Date(week.getFullYear(), week.getMonth(), week.getDate() + 7 * n),
    );
  return (
    <section className="list-section team-busy-calendar">
      <h2>Team availability</h2>
      <p className="helper">
        {bundle.project.name}. Only Busy time ranges are shared. Private titles,
        categories and descriptions are visible only to their owner. Unrecorded
        time is only potentially available, never confirmed.
      </p>
      <div className="calendar-toolbar">
        <div className="month-controls">
          <Button
            variant="outline"
            aria-label="Previous team week"
            onClick={() => change(-1)}
          >
            ←
          </Button>
          <h3>
            {week.toLocaleDateString()} –{' '}
            {new Date(end.getTime() - 1).toLocaleDateString()}
          </h3>
          <Button
            variant="outline"
            aria-label="Next team week"
            onClick={() => change(1)}
          >
            →
          </Button>
        </div>
        <Button variant="ghost" onClick={() => setWeek(startOfWeek())}>
          This week
        </Button>
      </div>
      <fieldset className="participant-controls">
        <legend>Members to display</legend>
        {bundle.members.map((m) => (
          <label key={m.user_id}>
            <input
              type="checkbox"
              checked={participants.some((p) => p.user_id === m.user_id)}
              onChange={(e) =>
                setChosen(
                  e.target.checked
                    ? [...participants.map((p) => p.user_id), m.user_id]
                    : participants
                        .filter((p) => p.user_id !== m.user_id)
                        .map((p) => p.user_id),
                )
              }
            />
            {m.display_name}
          </label>
        ))}
      </fieldset>
      <div className="day-picker" aria-label="Team calendar date">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(
            week.getFullYear(),
            week.getMonth(),
            week.getDate() + i,
          );
          return (
            <Button
              key={i}
              variant={i === dayIndex ? 'default' : 'outline'}
              aria-pressed={i === dayIndex}
              onClick={() => setDayIndex(i)}
            >
              {d.toLocaleDateString(undefined, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </Button>
          );
        })}
      </div>
      {data ? (
        <>
          <section className="common-potential">
            <h3>Suggested Availability · all selected members</h3>
            {!participants.length ? (
              <p>Select members to compare.</p>
            ) : commonPotential(
                data,
                participants.map((m) => m.user_id),
                day.getTime(),
                next.getTime(),
              ).length ? (
              <ul>
                {commonPotential(
                  data,
                  participants.map((m) => m.user_id),
                  day.getTime(),
                  next.getTime(),
                ).map((r) => (
                  <li key={r[0]}>
                    {rangeLabel(r, next.getTime())} · Potentially Available
                  </li>
                ))}
              </ul>
            ) : (
              <p>No common potentially available periods on this date.</p>
            )}
          </section>
          <div className="member-timelines">
            {participants.map((m) => (
              <section key={m.user_id}>
                <h3>{m.display_name}</h3>
                <DayPeriods
                  day={day}
                  periods={data.filter((p) => p.user_id === m.user_id)}
                />
              </section>
            ))}
          </div>
        </>
      ) : (
        <RemoteState state={state} retry={refresh} />
      )}
    </section>
  );
}
