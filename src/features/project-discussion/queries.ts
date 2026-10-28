import { allRows, changed, dataClient, result, text } from '@/lib/data-client';
export async function loadDiscussion(projectId: string) {
  const db = dataClient();
  result(
    await db.from('projects').select('id').eq('id', projectId).maybeSingle(),
  );
  return allRows((a, b) =>
    db
      .from('project_discussion_comments')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at')
      .order('id')
      .range(a, b),
  );
}
export async function addDiscussionComment(projectId: string, body: string) {
  return changed(
    await dataClient()
      .from('project_discussion_comments')
      .insert({ project_id: projectId, body: text(body, 20000, true) })
      .select(),
  );
}
export async function deleteDiscussionComment(
  projectId: string,
  id: string,
  userId: string,
) {
  return changed(
    await dataClient()
      .from('project_discussion_comments')
      .delete()
      .eq('project_id', projectId)
      .eq('id', id)
      .eq('author_id', userId)
      .select(),
  );
}
