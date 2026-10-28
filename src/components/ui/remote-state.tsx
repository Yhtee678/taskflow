import type { Remote } from '@/app/use-remote';
import { Button } from './button';
export function RemoteState({
  state,
  retry,
}: {
  state: Pick<Remote<unknown>, 'loading' | 'error'>;
  retry: () => void;
}) {
  return state.loading ? (
    <p role="status" className="helper">
      Loading…
    </p>
  ) : (
    <div className="empty-state">
      <p role="alert">
        {state.error?.message ?? 'This record is unavailable.'}
      </p>
      <Button variant="outline" onClick={retry}>
        Refresh data
      </Button>
    </div>
  );
}
