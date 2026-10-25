export function deadline(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
      }).format(new Date(value))
    : 'No deadline';
}
export function dateOnly(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}
