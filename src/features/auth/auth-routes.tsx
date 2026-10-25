import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth-context';
import { Button } from '@/components/ui/button';
export function ProtectedRoute() {
  const { session, loading } = useAuth();
  if (loading)
    return (
      <main className="empty-state" role="status">
        Checking your session…
      </main>
    );
  return session ? (
    <Outlet key={session.user.id} />
  ) : (
    <Navigate to="/login" replace />
  );
}
export function AuthCallbackPage() {
  const { loading, session, error, configurationError, retry } = useAuth();
  if (loading)
    return (
      <main className="empty-state" role="status">
        Completing sign-in…
      </main>
    );
  if (session) return <Navigate to="/my-tasks" replace />;
  return (
    <main className="login-page">
      <div className="login-panel">
        <h1>Sign-in could not be completed</h1>
        <p role="alert">
          {configurationError ??
            error ??
            'The sign-in link is invalid or has expired. Please start again.'}
        </p>
        <Button
          variant="outline"
          disabled={!!configurationError}
          onClick={retry}
        >
          Retry session check
        </Button>
        <p>
          <Link to="/login">Return to Sign In</Link>
        </p>
      </div>
    </main>
  );
}
