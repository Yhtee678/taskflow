import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BackgroundRefreshContext, useRemote } from '@/app/use-remote';
import { AccessError } from '@/lib/data-client';

describe('background request identity and failure handling', () => {
  it('retains loaded data during synchronization, then clears it if access is revoked', async () => {
    let revision = 0;
    let reject!: (error: Error) => void;
    const { result, rerender } = renderHook(
      () =>
        useRemote('user-A:project-A', () =>
          revision
            ? new Promise<string>((_resolve, fail) => {
                reject = fail;
              })
            : Promise.resolve('Authorized data'),
        ),
      {
        wrapper: ({ children }) => (
          <BackgroundRefreshContext.Provider value={revision}>
            {children}
          </BackgroundRefreshContext.Provider>
        ),
      },
    );
    await waitFor(() => expect(result.current.data).toBe('Authorized data'));
    revision++;
    rerender();
    expect(result.current).toMatchObject({
      data: 'Authorized data',
      loading: false,
    });
    await act(async () => reject(new AccessError()));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(AccessError);
  });
  it('never retains a previous resource or accepts its late background response after identity changes', async () => {
    let revision = 0;
    let finish!: (value: string) => void;
    const { result, rerender } = renderHook(
      ({ id }) =>
        useRemote(id, () =>
          id === 'user-B'
            ? Promise.resolve('User B data')
            : revision
              ? new Promise<string>((resolve) => {
                  finish = resolve;
                })
              : Promise.resolve('User A data'),
        ),
      {
        initialProps: { id: 'user-A' },
        wrapper: ({ children }) => (
          <BackgroundRefreshContext.Provider value={revision}>
            {children}
          </BackgroundRefreshContext.Provider>
        ),
      },
    );
    await waitFor(() => expect(result.current.data).toBe('User A data'));
    revision++;
    rerender({ id: 'user-A' });
    rerender({ id: 'user-B' });
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.data).toBe('User B data'));
    await act(async () => finish('Late user A data'));
    expect(result.current.data).toBe('User B data');
  });
});
