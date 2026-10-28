import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-context';
import { useWorkspace } from '@/app/workspace-context';
import { useRemote } from '@/app/use-remote';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { RemoteState } from '@/components/ui/remote-state';
import { loadInbox, markNotificationRead } from './queries';
import { activityText, notificationHref } from './activity-text';
import { AccessError } from '@/lib/data-client';
export function NotificationBell() {
  const { session } = useAuth();
  const { revision } = useWorkspace();
  const [open, setOpen] = useState(false),
    [request, setRequest] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const userId = session!.user.id;
  const state = useRemote(`${userId}:${revision}:${request}:${open}`, () =>
    loadInbox(userId, open),
  );
  const refresh = () => {
    setError('');
    setRequest((n) => n + 1);
  };
  const unread = state.data?.filter((n) => !n.read_at).length;
  return (
    <>
      <Button
        variant="ghost"
        className="notification-bell"
        aria-label={`Notifications${unread === undefined ? '' : `, ${unread} unread`}`}
        onClick={() => {
          setError('');
          setOpen(true);
          refresh();
        }}
      >
        <Bell size={19} />
        <span className="notification-count" aria-hidden="true">
          {unread ?? (state.loading ? '…' : '!')}
        </span>
      </Button>
      {open && (
        <Modal title="Notifications" onClose={() => setOpen(false)}>
          <div className="notification-toolbar">
            <p className="helper">
              Project activity and deadline reminders. Refresh to check for
              updates.
            </p>
            <Button variant="outline" disabled={busy} onClick={refresh}>
              Refresh notifications
            </Button>
          </div>
          {error && <p role="alert">{error}</p>}
          {state.data ? (
            state.data.length ? (
              <ul className="notification-list">
                {state.data.map((n) => (
                  <li key={n.id} className={n.read_at ? '' : 'unread'}>
                    <span className="notification-read-state">
                      {n.read_at ? 'Read' : 'Unread'}
                    </span>
                    <Link
                      onClick={() => setOpen(false)}
                      to={notificationHref(n)}
                    >
                      {activityText(n, n.task_title)}
                    </Link>
                    <span>
                      {n.project_name}
                      {n.task_title
                        ? ` · ${n.task_title}`
                        : ' · Project Discussion'}
                    </span>
                    <time dateTime={n.created_at}>
                      {new Date(n.created_at).toLocaleString()}
                    </time>
                    {!n.read_at && (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError('');
                          try {
                            await markNotificationRead(userId, n.id);
                            refresh();
                          } catch (err) {
                            setError((err as Error).message);
                            if (err instanceof AccessError)
                              setRequest((n) => n + 1);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Mark as read
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No notifications yet.</p>
            )
          ) : (
            <RemoteState state={state} retry={refresh} />
          )}
        </Modal>
      )}
    </>
  );
}
