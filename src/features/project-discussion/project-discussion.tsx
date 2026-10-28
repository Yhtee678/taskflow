import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/auth-context';
import { useWorkspace } from '@/app/workspace-context';
import { useRemote } from '@/app/use-remote';
import { RemoteState } from '@/components/ui/remote-state';
import { Button } from '@/components/ui/button';
import {
  addDiscussionComment,
  deleteDiscussionComment,
  loadDiscussion,
} from './queries';
export function ProjectDiscussion({ projectId }: { projectId: string }) {
  const { session } = useAuth();
  const { revision, refresh, mutate, pending } = useWorkspace();
  const [body, setBody] = useState('');
  const section = useRef<HTMLElement>(null);
  const location = useLocation();
  const state = useRemote(`${session!.user.id}:${projectId}:${revision}`, () =>
    loadDiscussion(projectId),
  );
  useEffect(() => {
    if (location.hash === '#project-discussion' && !state.loading) {
      section.current?.scrollIntoView?.({ block: 'start' });
      section.current?.focus({ preventScroll: true });
    }
  }, [location.hash, location.key, state.loading]);
  return (
    <section
      className="list-section project-discussion"
      aria-label="Project Discussion"
      id="project-discussion"
      ref={section}
      tabIndex={-1}
    >
      <h2>Project Discussion</h2>
      <p className="helper">General questions and updates for this project.</p>
      {state.data ? (
        <>
          {state.data.length ? (
            <ol className="comment-list">
              {state.data.map((c) => (
                <li key={c.id}>
                  <div className="comment-meta">
                    <strong>{c.author_name}</strong>
                    <time dateTime={c.created_at}>
                      {new Date(c.created_at).toLocaleString()}
                    </time>
                  </div>
                  <p className="plain-text">{c.body}</p>
                  {c.author_id === session!.user.id && (
                    <Button
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm('Delete your discussion comment?'))
                          void mutate(
                            () =>
                              deleteDiscussionComment(
                                projectId,
                                c.id,
                                session!.user.id,
                              ),
                            'Discussion comment deleted.',
                          );
                      }}
                    >
                      Delete discussion comment
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p>No discussion comments yet.</p>
          )}
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(
                  () => addDiscussionComment(projectId, body),
                  'Discussion comment added.',
                )
              )
                setBody('');
            }}
          >
            <label>
              Discussion comment
              <textarea
                required
                maxLength={20000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            <Button disabled={pending || !body.trim()}>Post comment</Button>
          </form>
        </>
      ) : (
        <RemoteState state={state} retry={refresh} />
      )}
    </section>
  );
}
