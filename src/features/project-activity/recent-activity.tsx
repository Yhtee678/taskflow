import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { useWorkspace } from '@/app/workspace-context';
import { useRemote } from '@/app/use-remote';
import { Button } from '@/components/ui/button';
import { RemoteState } from '@/components/ui/remote-state';
import { loadProjectActivity } from './queries';
import {
  projectActivityText,
  projectActivityPreviewAction,
  activityPreviewTime,
} from './activity-text';
export function RecentActivity({
  projectId,
  preview = false,
}: {
  projectId: string;
  preview?: boolean;
}) {
  const { session } = useAuth();
  const { revision, refresh } = useWorkspace();
  const [limit, setLimit] = useState(preview ? 3 : 20);
  const section = useRef<HTMLElement>(null);
  const location = useLocation();
  const state = useRemote(
    `${session!.user.id}:${projectId}:${revision}:${limit}`,
    () => loadProjectActivity(projectId, limit),
  );
  useEffect(() => {
    if (!preview && location.hash === '#recent-activity' && !state.loading) {
      section.current?.scrollIntoView?.({ block: 'start' });
      section.current?.focus({ preventScroll: true });
    }
  }, [preview, location.hash, location.key, state.loading]);
  return (
    <section
      className={`list-section recent-activity${preview ? ' activity-preview' : ''}`}
      aria-label="Recent Activity"
      id={preview ? undefined : 'recent-activity'}
      ref={section}
      tabIndex={preview ? undefined : -1}
    >
      <h2>Recent Activity</h2>
      {state.data ? (
        <>
          {state.data.items.length ? (
            <ol
              className="activity-list"
              tabIndex={preview ? 0 : undefined}
              aria-label={preview ? 'Recent activity entries' : undefined}
            >
              {state.data.items.map((a) => {
                const message = projectActivityText(a);
                const content = preview ? (
                  <>
                    <span className="activity-preview-action">
                      {projectActivityPreviewAction(a)}
                    </span>
                    {a.kind !== 'discussion_added' && (
                      <span className="activity-preview-context">
                        {a.task_title}
                      </span>
                    )}
                  </>
                ) : (
                  message
                );
                const href =
                  a.kind === 'discussion_added'
                    ? `/projects/${projectId}/overview#project-discussion`
                    : a.task_id
                      ? `/projects/${projectId}/tasks/${a.task_id}`
                      : null;
                return (
                  <li key={a.id}>
                    {href ? (
                      <Link to={href}>{content}</Link>
                    ) : (
                      <span>
                        {content}{' '}
                        <span className="muted">Task no longer available.</span>
                      </span>
                    )}
                    <time dateTime={a.created_at}>
                      {preview
                        ? activityPreviewTime(a.created_at)
                        : new Date(a.created_at).toLocaleString()}
                    </time>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p>No recent activity yet.</p>
          )}
          {!preview && state.data.hasMore && (
            <Button variant="outline" onClick={() => setLimit((n) => n + 20)}>
              View More
            </Button>
          )}
        </>
      ) : (
        <RemoteState state={state} retry={refresh} />
      )}
      {preview && (
        <Link
          className="subtle-link"
          to={`/projects/${projectId}/overview#recent-activity`}
        >
          View full activity history →
        </Link>
      )}
    </section>
  );
}
