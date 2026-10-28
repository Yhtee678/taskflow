import type { ReactNode } from 'react';
import { monthWindow } from './intervals';
export function MonthGrid({
  month,
  selected,
  onSelect,
  renderDay,
  compact = false,
}: {
  month: Date;
  selected: Date;
  onSelect: (d: Date) => void;
  renderDay: (d: Date) => ReactNode;
  compact?: boolean;
}) {
  const { start, days } = monthWindow(month);
  return (
    <div
      className={compact ? 'mini-month' : 'calendar-scroll'}
      role="region"
      aria-label={compact ? 'Dashboard month calendar' : 'Calendar month grid'}
      tabIndex={compact ? undefined : 0}
    >
      <div className={compact ? 'mini-month-grid' : 'calendar-grid'}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div className="weekday" key={d}>
            {compact ? d.slice(0, 1) : d}
          </div>
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate() + i,
          );
          const today = day.toDateString() === new Date().toDateString();
          return (
            <div
              key={i}
              className={`${compact ? 'mini-day' : 'calendar-day'} ${day.getMonth() === month.getMonth() ? '' : 'outside'}`}
            >
              <button
                type="button"
                className={`date-select ${today ? 'today' : ''}`}
                aria-label={day.toLocaleDateString(undefined, {
                  dateStyle: 'full',
                })}
                aria-current={today ? 'date' : undefined}
                aria-pressed={day.toDateString() === selected.toDateString()}
                onClick={() => onSelect(day)}
              >
                {day.getDate()}
              </button>
              {renderDay(day)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
