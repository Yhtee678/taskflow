import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { getSupabaseClient } from './supabase';
export const dataClient = () => getSupabaseClient() as SupabaseClient<Database>;
export class AccessError extends Error {
  constructor() {
    super(
      'This record is no longer available. Your project access may have changed.',
    );
  }
}
type Failure = { code?: string; message?: string };
export function dataError(error: Failure): Error {
  if (error.code === '42501' || error.code === 'PGRST116')
    return new AccessError();
  if (
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST202'
  )
    return new Error(
      'The database is missing a required table, field or function. Apply the reviewed application migrations (including Calendar) and refresh the API schema.',
    );
  if (error.code === '23503')
    return new Error(
      'That section, assignee or parent record is no longer available in this project. Refresh and try again.',
    );
  if (error.code === '23514')
    return new Error('Check the field values and try again.');
  if (error.code === '22023')
    return new Error(
      'The requested change could not be completed. Check the registered email or selected records.',
    );
  return new Error(
    'The database request failed. Check your connection and try again.',
  );
}
export function result<T>({
  data,
  error,
}: {
  data: T | null;
  error: Failure | null;
}): NonNullable<T> {
  if (error) throw dataError(error);
  if (data === null || data === undefined) throw new AccessError();
  return data as NonNullable<T>;
}
export function changed<T>(response: {
  data: T[] | null;
  error: Failure | null;
}): T {
  const rows = result(response);
  if (rows.length !== 1) throw new AccessError();
  return rows[0];
}
export async function allRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: Failure | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 500) {
    const next = result(await page(start, start + 499));
    rows.push(...next);
    if (next.length < 500) return rows;
  }
}
export function text(
  value: FormDataEntryValue | null,
  max: number,
  required = false,
): string {
  const s = String(value ?? '').trim();
  if ((required && !s) || s.length > max)
    throw new Error(
      `Enter ${required ? 'a value of 1' : 'at most'}â€“${max} characters.`,
    );
  return s;
}
export function safeResourceUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Enter a valid HTTP or HTTPS URL.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    value.length > 2048
  )
    throw new Error('Use an HTTP or HTTPS link without embedded credentials.');
  return url.href;
}
