import { Navigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
export function LoginPage() {
  const { session, loading, busy, error, configurationError, signIn, retry } =
    useAuth();
  if (loading)
    return (
      <main className="login-page" role="status">
        Checking your session…
      </main>
    );
  if (session) return <Navigate to="/my-tasks" replace />;
  return (
    <main className="login-page">
      <div className="login-panel">
        <div className="brand">
          <CheckCheck size={27} />
          TaskFlow
        </div>
        <h1>Sign in to TaskFlow</h1>
        <p>A shared place for your projects, tasks, and team.</p>
        <Button
          variant="outline"
          className="google-button"
          disabled={busy || !!configurationError}
          onClick={() => void signIn()}
        >
          {busy ? 'Connecting…' : 'Continue with Google'}
        </Button>
        <p className="login-note">Sign in securely with your Google account.</p>
        {(configurationError || error) && (
          <p role="alert">{configurationError ?? error}</p>
        )}
        {error && !configurationError && (
          <Button variant="ghost" onClick={retry}>
            Retry session check
          </Button>
        )}
        <p className="login-note">
          Your projects are available after signing in.
        </p>
      </div>
    </main>
  );
}
