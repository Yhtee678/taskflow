import { allRows, changed, dataClient, result, text } from '@/lib/data-client';
export async function loadComments(projectId: string, taskId: string) {
  const db = dataClient();
  // An inaccessible parent is an access error, not a misleading empty discussion.
  result(
    await db
      .from('tasks')
      .select('id')
      .eq('project_id', projectId)
      .eq('id', taskId)
      .maybeSingle(),
  );
  return allRows((a, b) =>
    db
      .from('task_comments')
      .select('*')
      .eq('project_id', projectId)
      .eq('task_id', taskId)
      .order('created_at')
      .order('id')
      .range(a, b),
  );
}
export async function addComment(
  projectId: string,
  taskId: string,
  body: string,
) {
  return changed(
    await dataClient()
      .from('task_comments')
      .insert({
        project_id: projectId,
        task_id: taskId,
        body: text(body, 20000, true),
      })
      .select(),
  );
}
export async function deleteComment(
  projectId: string,
  taskId: string,
  id: string,
  userId: string,
) {
  return changed(
    await dataClient()
      .from('task_comments')
      .delete()
      .eq('project_id', projectId)
      .eq('task_id', taskId)
      .eq('id', id)
      .eq('author_id', userId)
      .select(),
  );
}
