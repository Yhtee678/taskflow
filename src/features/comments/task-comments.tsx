import { useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { useWorkspace } from '@/app/workspace-context';
import { useRemote } from '@/app/use-remote';
import { RemoteState } from '@/components/ui/remote-state';
import { Button } from '@/components/ui/button';
import { addComment, deleteComment, loadComments } from './queries';
export function TaskComments({
  projectId,
  taskId,
}: {
  projectId: string;
  taskId: string;
}) {
  const { session } = useAuth();
  const { revision, refresh, mutate, pending } = useWorkspace();
  const [body, setBody] = useState('');
  const state = useRemote(
    `${session!.user.id}:${projectId}:${taskId}:${revision}`,
    () => loadComments(projectId, taskId),
  );
  return (
    <section className="task-comments" aria-label="Task comments">
      <h2>Comments</h2>
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
                        if (window.confirm('Delete your comment?'))
                          void mutate(
                            () =>
                              deleteComment(
                                projectId,
                                taskId,
                                c.id,
                                session!.user.id,
                              ),
                            'Comment deleted.',
                          );
                      }}
                    >
                      Delete comment
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p>No comments yet.</p>
          )}
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(
                  () => addComment(projectId, taskId, body),
                  'Comment added.',
                )
              )
                setBody('');
            }}
          >
            <label>
              Comment
              <textarea
                required
                maxLength={20000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            <Button disabled={pending || !body.trim()}>Add comment</Button>
          </form>
        </>
      ) : (
        <RemoteState state={state} retry={refresh} />
      )}
    </section>
  );
}
