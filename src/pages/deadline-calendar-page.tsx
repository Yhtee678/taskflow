import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Project } from '@/types/domain';
import { tasks } from '@/features/tasks/mock-data';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
export function DeadlineCalendarPage() {
  const project = useOutletContext<Project>();
  const [month, setMonth] = useState(() => new Date(2026, 9, 1));
  const [mine, setMine] = useState(false);
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (start.getDay() + 6) % 7;
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const cells = Math.ceil((offset + count) / 7) * 7;
  const visible = tasks.filter(
    (t) =>
      t.projectId === project.id && t.due && (!mine || t.assignee === 'alex'),
  );
  const change = (n: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  return (
    <>
      <PageHeader
        title="Deadline Calendar"
        description={`${project.name} · Task deadlines in your local timezone.`}
      />
      <div className="calendar-toolbar">
        <div className="month-controls">
          <Button
            variant="outline"
            aria-label="Previous month"
            onClick={() => change(-1)}
          >
            <ChevronLeft size={16} />
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
            <ChevronRight size={16} />
          </Button>
        </div>
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
      </div>
      <div
        className="calendar-scroll"
        role="region"
        aria-label="Deadline month grid"
        tabIndex={0}
      >
        <div className="calendar-grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div className="weekday" key={d}>
              {d}
            </div>
          ))}
          {Array.from({ length: cells }, (_, i) => {
            const date = new Date(
              month.getFullYear(),
              month.getMonth(),
              i - offset + 1,
            );
            const inMonth = date.getMonth() === month.getMonth();
            const today = date.toDateString() === new Date().toDateString();
            return (
              <div
                className={`calendar-day ${inMonth ? '' : 'outside'}`}
                key={i}
              >
                <span className={today ? 'today' : ''}>{date.getDate()}</span>
                {visible
                  .filter(
                    (t) =>
                      new Date(t.due!).toDateString() === date.toDateString(),
                  )
                  .map((t) => (
                    <Link
                      className={`calendar-task ${t.status}`}
                      key={t.id}
                      to={`/projects/${project.id}/tasks/${t.id}`}
                    >
                      {t.title}
                    </Link>
                  ))}
              </div>
            );
          })}
        </div>
      </div>
      <p className="helper">
        Sample deadlines are in October 2026. Tasks without deadlines do not
        appear here. Availability is shown separately.
      </p>
    </>
  );
}
