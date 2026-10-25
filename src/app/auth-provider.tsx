import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';
import { AuthContext } from '@/features/auth/auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [configuration] = useState(() => {
    try {
      return { client: getSupabaseClient(), error: null };
    } catch (error) {
      return {
        client: null,
        error:
          error instanceof Error
            ? error.message
            : 'Supabase configuration is invalid.',
      };
    }
  });
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!configuration.client);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return params.has('error') || hash.has('error')
      ? 'Google sign-in was cancelled or could not be completed. Please try again.'
      : null;
  });

  useEffect(() => {
    const client = configuration.client;
    if (!client) return;
    let active = true;
    let revision = 0;
    // Keep the listener synchronous: SDK operations must run outside this callback.
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      revision++;
      setSession(next);
      setLoading(false);
      if (next) setError(null);
    });
    const startedAt = revision;
    void client.auth
      .getSession()
      .then(({ data, error: failure }) => {
        if (!active || revision !== startedAt) return;
        setSession(failure ? null : data.session);
        if (failure)
          setError('Your session could not be restored. Please sign in again.');
        setLoading(false);
      })
      .catch(() => {
        if (!active || revision !== startedAt) return;
        setSession(null);
        setError(
          'Unable to check your session. Check your connection and try again.',
        );
        setLoading(false);
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configuration.client, attempt]);

  async function signIn() {
    if (!configuration.client || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: failure } =
        await configuration.client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
      if (failure)
        setError('Google sign-in could not start. Please try again.');
    } catch {
      setError(
        'Unable to connect to Google sign-in. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    if (!configuration.client || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: failure } = await configuration.client.auth.signOut({
        scope: 'local',
      });
      if (failure)
        setError('Sign out failed. Check your connection and try again.');
      else setSession(null);
    } catch {
      setError('Sign out failed. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        busy,
        error,
        configurationError: configuration.error,
        signIn,
        signOut,
        retry: () => {
          if (!configuration.client) return;
          setLoading(true);
          setError(null);
          setAttempt((n) => n + 1);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
