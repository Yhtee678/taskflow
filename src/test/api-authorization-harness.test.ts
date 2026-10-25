import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  evaluate,
  validatePeer,
  type FixtureDescriptor,
} from '@/dev/api-authorization-checks';
import { getSupabaseClient } from '@/lib/supabase';
import { openAuthorizationHarness } from '@/dev/real-api-authorization';
vi.mock('@/lib/supabase', () => ({ getSupabaseClient: vi.fn() }));
const a: FixtureDescriptor = {
  runId: '10000000-0000-4000-8000-000000000001',
  actor: 'A',
  projectRef: 'testreference12345678',
  userId: '10000000-0000-4000-8000-000000000002',
  email: 'a@example.test',
  projectId: '10000000-0000-4000-8000-000000000003',
  sectionId: '10000000-0000-4000-8000-000000000004',
  taskId: '10000000-0000-4000-8000-000000000005',
};
const b: FixtureDescriptor = {
  ...a,
  actor: 'B',
  userId: '20000000-0000-4000-8000-000000000002',
  email: 'b@example.test',
  projectId: '20000000-0000-4000-8000-000000000003',
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
afterEach(() => vi.unstubAllEnvs());
describe('real API harness local safeguards (no remote requests)', () => {
  it('distinguishes 2xx filtered results from HTTP permission errors', () => {
    const filtered = evaluate(
      'read',
      { status: 200, error: null, data: [] },
      'filtered',
    );
    expect(filtered.result).toBe('PASS');
    expect(filtered.observed).toBe('zero rows');
    const denied = evaluate(
      'rpc',
      { status: 403, error: { code: '42501' }, data: null },
      'permission',
    );
    expect(denied.result).toBe('PASS');
    expect(denied.observed).toBe('permission error');
    expect(
      evaluate(
        'read',
        { status: 403, error: { code: '42501' }, data: null },
        'filtered',
      ).result,
    ).toBe('FAIL');
    expect(
      evaluate('rpc', { status: 200, error: null, data: [] }, 'permission')
        .result,
    ).toBe('FAIL');
  });
  it.each([
    [401, '42501'],
    [409, '23503'],
    [404, 'PGRST202'],
    [0, 'TRANSPORT_ERROR'],
    [403, 'unexpected'],
  ])(
    'does not count %s/%s as an authenticated permission denial',
    (status, code) => {
      expect(
        evaluate(
          'deny',
          { status: Number(status), error: { code: String(code) }, data: null },
          'permission',
        ).result,
      ).toBe('FAIL');
    },
  );
  it('does not confuse a wrong positive result with success', () => {
    expect(
      evaluate(
        'positive',
        { status: 200, error: null, data: [] },
        'success',
        false,
      ).result,
    ).toBe('FAIL');
  });
  it('only emits sanitized metadata, never response bodies/messages', () => {
    const result = evaluate(
      'test',
      {
        status: 400,
        error: { code: 'bad\nvalue' },
        data: { private: 'not evidence' },
      },
      'success',
    );
    expect(result.code).toBeNull();
    expect(JSON.stringify(result)).not.toContain('not evidence');
    expect(Object.keys(result).sort()).toEqual([
      'check',
      'code',
      'expected',
      'httpStatus',
      'observed',
      'result',
      'rows',
    ]);
  });
  it('accepts only another account descriptor for this backend/run', () => {
    expect(validatePeer(b, a)).toEqual(b);
    for (const peer of [
      a,
      { ...b, runId: crypto.randomUUID() },
      { ...b, projectRef: 'otherproject' },
      { ...b, projectId: 'not-uuid' },
      { ...b, unexpected: 'reject extra fields' },
    ]) {
      expect(() => validatePeer(peer, a)).toThrow();
    }
  });
  it('performs no work when merely imported', () => {
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });
  it('refuses production and backend mismatch before initializing a client', async () => {
    vi.stubEnv('DEV', false);
    await expect(
      openAuthorizationHarness({
        runId: a.runId,
        actor: 'A',
        expectedProjectRef: a.projectRef,
      }),
    ).rejects.toThrow('development');
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://differentproject.supabase.co');
    await expect(
      openAuthorizationHarness({
        runId: a.runId,
        actor: 'A',
        expectedProjectRef: a.projectRef,
      }),
    ).rejects.toThrow('does not match');
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });
});
