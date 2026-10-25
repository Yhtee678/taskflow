import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
export interface AuthState {
  session: Session | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  configurationError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  retry: () => void;
}
export const AuthContext = createContext<AuthState | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
