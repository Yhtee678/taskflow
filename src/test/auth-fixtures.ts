import type { Session } from '@supabase/supabase-js';
export const testSession: Session = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: '10000000-0000-0000-0000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'tester@example.test',
    app_metadata: { provider: 'google' },
    user_metadata: { full_name: 'Test User' },
    created_at: '2026-10-25T00:00:00Z',
  },
};
