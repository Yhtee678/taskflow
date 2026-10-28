export function toLocalInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
export function toInstant(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (
    !Number.isFinite(date.getTime()) ||
    toLocalInput(date.toISOString()) !== value.slice(0, 16)
  )
    throw new Error(
      'Choose a valid local date and time. This local time may not exist because of a clock change.',
    );
  return date.toISOString();
}
export function startOfWeek(value = new Date()) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
