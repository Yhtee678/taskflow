import { Link } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
export function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-panel">
        <div className="brand">
          <CheckCheck size={27} />
          TaskFlow
        </div>
        <h1>Sign in to TaskFlow</h1>
        <p>A shared place for your projects, tasks, and team.</p>
        <Button variant="outline" className="google-button" disabled>
          Continue with Google
        </Button>
        <p className="login-note">
          Google sign-in will be connected in Phase 2.
        </p>
        <Button asChild>
          <Link to="/my-tasks">Explore the frontend preview</Link>
        </Button>
        <p className="login-note">
          Mock data only. No account or session is created.
        </p>
      </div>
    </main>
  );
}
