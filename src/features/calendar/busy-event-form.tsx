import { useState } from 'react';
import type { BusyEventRow } from '@/types/database';
import { useAuth } from '@/features/auth/auth-context';
import { useWorkspace } from '@/app/workspace-context';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { toInstant, toLocalInput } from '@/lib/local-dates';
import { categories, saveBusyEvent, type BusyValues } from './queries';
export function BusyEventForm({
  event,
  onClose,
}: {
  event?: BusyEventRow;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const { mutate, pending } = useWorkspace();
  const [error, setError] = useState('');
  // Series retains its creation zone even if the browser has since changed zone.
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const differentZone = !!event && event.time_zone !== zone;
  return (
    <Modal
      title={event ? 'Edit busy event / series' : 'Add busy event'}
      onClose={onClose}
    >
      <form
        className="editor-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          const f = new FormData(e.currentTarget);
          try {
            const start = toInstant(String(f.get('start') ?? '')),
              end = toInstant(String(f.get('end') ?? ''));
            if (!start || !end) throw new Error('Start and end are required.');
            const values: BusyValues = {
              title: String(f.get('title') ?? ''),
              description: String(f.get('description') ?? ''),
              category: String(f.get('category')) as BusyValues['category'],
              starts_at: start,
              ends_at: end,
              recurrence: String(
                f.get('recurrence'),
              ) as BusyValues['recurrence'],
              time_zone: event?.time_zone ?? zone,
            };
            if (
              await mutate(
                () => saveBusyEvent(session!.user.id, values, event?.id),
                'Busy event saved.',
              )
            )
              onClose();
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <label>
          Title
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={event?.title}
          />
        </label>
        <label>
          Category
          <select name="category" defaultValue={event?.category ?? 'class'}>
            {Object.entries(categories).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Starts (local)
          <input
            type="datetime-local"
            name="start"
            required
            defaultValue={event ? toLocalInput(event.starts_at) : ''}
          />
        </label>
        <label>
          Ends (local)
          <input
            type="datetime-local"
            name="end"
            required
            defaultValue={event ? toLocalInput(event.ends_at) : ''}
          />
        </label>
        <label>
          Recurrence
          <select name="recurrence" defaultValue={event?.recurrence ?? 'none'}>
            <option value="none">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
        <label>
          Description (optional)
          <textarea
            name="description"
            maxLength={10000}
            defaultValue={event?.description}
          />
        </label>
        <p className="helper">
          {zone}. For overnight events, choose the next date for the end. Edits
          affect the entire series; there are no individual occurrence
          exceptions. Repeats follow local calendar dates in{' '}
          {event?.time_zone ?? zone}.
        </p>
        {differentZone && (
          <p className="helper">
            Inputs use your current zone; this series will continue repeating in
            its original zone ({event.time_zone}).
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        <Button disabled={pending}>Save busy event</Button>
      </form>
    </Modal>
  );
}
