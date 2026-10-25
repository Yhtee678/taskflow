import { describe, it, expect } from 'vitest';
import { readSupabaseConfig } from '@/lib/supabase-config';
describe('browser Supabase configuration', () => {
  it('accepts only browser publishable configuration', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      }),
    ).toEqual({ url: 'https://test.supabase.co', key: 'sb_publishable_test' });
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: 'http://localhost:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local',
      }).url,
    ).toBe('http://localhost:54321');
  });
  it.each([
    {},
    {
      VITE_SUPABASE_URL: 'not-a-url',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    },
    {
      VITE_SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_REPLACE_ME',
    },
    {
      VITE_SUPABASE_URL: 'http://remote.example',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    },
    {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_do_not_expose',
    },
    {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'service-role-key',
    },
    {
      VITE_SUPABASE_URL: 'https://user:password@test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    },
  ])(
    'rejects unsafe/missing configuration without echoing values (%#)',
    (env) => {
      expect(() => readSupabaseConfig(env)).toThrow();
      try {
        readSupabaseConfig(env);
      } catch (error) {
        expect(String(error)).not.toContain('sb_secret_do_not_expose');
        expect(String(error)).not.toContain('user:password');
      }
    },
  );
});
