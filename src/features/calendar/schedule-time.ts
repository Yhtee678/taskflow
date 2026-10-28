export function eventTimeLabel(start: string, end: string) {
  const a = new Date(start),
    b = new Date(end);
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };
  if (a.toDateString() === b.toDateString())
    return `${a.toLocaleTimeString(undefined, options)} – ${b.toLocaleTimeString(undefined, options)}`;
  return `${a.toLocaleString()} – ${b.toLocaleString()}`;
}
