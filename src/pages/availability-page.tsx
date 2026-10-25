import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { Project } from '@/types/domain';
import { people } from '@/features/projects/mock-data';
import { availability } from '@/features/availability/mock-data';
import { PageHeader, EmptyState } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
export function AvailabilityPage() {
  const project = useOutletContext<Project>();
  const [member, setMember] = useState('all');
  const slots = availability.filter(
    (s) =>
      s.projectId === project.id && (member === 'all' || s.userId === member),
  );
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const time = (v: string) =>
    new Date(v).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  return (
    <>
      <PageHeader
        title="Availability"
        description={`${project.name} · Team availability, separate from task deadlines.`}
      >
        <Button disabled title="Availability editing is deferred">
          Add my availability
        </Button>
      </PageHeader>
      <div className="toolbar">
        <select
          aria-label="Filter availability by member"
          value={member}
          onChange={(e) => setMember(e.target.value)}
        >
          <option value="all">All members</option>
          {people
            .filter((p) => project.members.includes(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <span className="helper">26–30 October 2026 · {timezone}</span>
      </div>
      <div
        className="calendar-scroll"
        role="region"
        aria-label="Team availability calendar"
        tabIndex={0}
      >
        <div className="availability-grid">
          {Array.from({ length: 5 }, (_, i) => {
            const day = new Date(2026, 9, 26 + i);
            const daySlots = slots.filter(
              (s) => new Date(s.start).toDateString() === day.toDateString(),
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
                {daySlots.length ? (
                  daySlots.map((s) => (
                    <div className="availability-slot" key={s.id}>
                      <strong>
                        {people.find((p) => p.id === s.userId)?.name}
                      </strong>
                      <span>
                        {time(s.start)}–{time(s.end)}
                      </span>
                      {s.userId === 'alex' && (
                        <small>Your availability · Preview</small>
                      )}
                    </div>
                  ))
                ) : (
                  <span className="muted">No slots</span>
                )}
              </section>
            );
          })}
        </div>
      </div>
      <section className="list-section">
        <h2>Find a time together</h2>
        <p className="helper">
          Overlap exploration and editing your own slots will be connected in
          the availability phase.
        </p>
        <EmptyState title="Team overlap preview">
          Select participants and explore shared time in a later phase. No
          meeting is scheduled.
        </EmptyState>
      </section>
    </>
  );
}
