/** No SDK objects, response bodies, messages or credentials enter evidence. */
export interface ApiResponse {
  status: number;
  error: { code?: string } | null;
  data: unknown;
}
export type Expected = 'success' | 'filtered' | 'permission';
export interface Evidence {
  check: string;
  result: 'PASS' | 'FAIL';
  expected: Expected;
  observed: 'success' | 'zero rows' | 'permission error' | 'other error';
  httpStatus: number;
  code: string | null;
  rows: number | null;
}
export function evaluate(
  check: string,
  response: ApiResponse,
  expected: Expected,
  valid = true,
): Evidence {
  const ok = !response.error && response.status >= 200 && response.status < 300;
  const count = Array.isArray(response.data) ? response.data.length : null;
  // An expired session (401), network failure (0), missing RPC or FK error is
  // NOT evidence that an authenticated caller was denied by authorization.
  const denied = response.status === 403 && response.error?.code === '42501';
  const pass =
    expected === 'permission'
      ? denied
      : expected === 'filtered'
        ? ok && count === 0
        : ok && valid;
  return {
    check,
    result: pass ? 'PASS' : 'FAIL',
    expected,
    observed: denied
      ? 'permission error'
      : !ok
        ? 'other error'
        : count === 0
          ? 'zero rows'
          : 'success',
    httpStatus: response.status,
    code:
      response.error?.code && /^[A-Z0-9_]{1,32}$/i.test(response.error.code)
        ? response.error.code
        : null,
    rows: count,
  };
}
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export interface FixtureDescriptor {
  runId: string;
  actor: 'A' | 'B';
  projectRef: string;
  userId: string;
  email: string;
  projectId: string;
  sectionId: string;
  taskId: string;
}
export function validatePeer(value: FixtureDescriptor, own: FixtureDescriptor) {
  const keys = [
    'runId',
    'actor',
    'projectRef',
    'userId',
    'email',
    'projectId',
    'sectionId',
    'taskId',
  ];
  if (
    !value ||
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((k) => !keys.includes(k)) ||
    value.runId !== own.runId ||
    value.projectRef !== own.projectRef ||
    !['A', 'B'].includes(value.actor) ||
    value.actor === own.actor ||
    !isUuid(value.userId) ||
    value.userId === own.userId ||
    !isUuid(value.projectId) ||
    value.projectId === own.projectId ||
    !isUuid(value.sectionId) ||
    !isUuid(value.taskId) ||
    typeof value.email !== 'string' ||
    !/^[^\s@]+@[^\s@]+$/.test(value.email) ||
    value.email.toLowerCase() === own.email.toLowerCase()
  ) {
    throw new Error(
      'Use the other account’s unmodified fixture descriptor from this same run and backend. Never paste a session or token.',
    );
  }
  return { ...value };
}
